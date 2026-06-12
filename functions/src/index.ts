import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { fetchPlaylistName, fetchPlaylistTracks, fetchSpotifyTracks, fetchUserPlaylists, getSpotifyAccessToken, normalizeTrackIds } from './spotify';

initializeApp();

const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');
const MULTIPLAYER_ROOM_LIMIT_FREE = 5;
const MULTIPLAYER_ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MULTIPLAYER_ROOM_CODE_LENGTH = 6;
const MIN_TRACKS_FOR_LEADERBOARD_POINTS = 10;
const LEADERBOARD_SCORE_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_SNIPPET_DURATION_MS = 2000;
const MAX_SNIPPET_DURATION_MS = 30000;

const makeRoomCode = () => {
    let code = '';
    for (let i = 0; i < MULTIPLAYER_ROOM_CODE_LENGTH; i++) {
        code += MULTIPLAYER_ROOM_CODE_CHARS[Math.floor(Math.random() * MULTIPLAYER_ROOM_CODE_CHARS.length)];
    }
    return code;
};

const getRoomName = (value: unknown) => {
    const roomName = typeof value === 'string' ? value.trim().slice(0, 40) : '';
    if (!roomName) {
        throw new HttpsError('invalid-argument', 'Room name is required.');
    }
    return roomName;
};

const getRoomId = (value: unknown) => {
    const roomId = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{6}$/.test(roomId)) {
        throw new HttpsError('invalid-argument', 'Enter a valid room code.');
    }
    return roomId;
};

const getAuthedUid = (request: any) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to use multiplayer.');
    }
    return request.auth.uid;
};

const getPlayerDisplayName = async (uid: string) => {
    const userRecord = await getAuth().getUser(uid);
    return userRecord.displayName
        || userRecord.email?.split('@')[0]
        || `Guest ${uid.slice(0, 6).toUpperCase()}`;
};

const calculateLeaderboardPoints = (snippetDurationMs: number) => {
    const base = 10;
    const maxBonus = 15;
    const clamped = Math.max(MIN_SNIPPET_DURATION_MS, Math.min(MAX_SNIPPET_DURATION_MS, snippetDurationMs));
    const fraction = 1 - (clamped - MIN_SNIPPET_DURATION_MS) / (MAX_SNIPPET_DURATION_MS - MIN_SNIPPET_DURATION_MS);
    return base + Math.round(maxBonus * fraction);
};

const getScoreString = (value: unknown, fieldName: string, maxLength: number) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > maxLength || normalized.includes('/')) {
        throw new HttpsError('invalid-argument', `${fieldName} is invalid.`);
    }
    return normalized;
};

const getScoreInteger = (value: unknown, fieldName: string) => {
    if (!Number.isInteger(value)) {
        throw new HttpsError('invalid-argument', `${fieldName} is invalid.`);
    }
    return value as number;
};

const getScoreCooldownId = (playlistId: string, songId: string) => {
    return createHash('sha256').update(`${playlistId}:${songId}`).digest('hex');
};

const deleteCollectionDocs = async (docs: any[]) => {
    if (docs.length === 0) return;

    const db = getFirestore();

    for (let i = 0; i < docs.length; i += 500) {
        const batch = db.batch();
        docs.slice(i, i + 500).forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
};

const cleanupUserData = async (uid: string) => {
    const db = getFirestore();
    const bucket = getStorage().bucket();

    console.log(`[cleanupUserData] Starting cleanup for user: ${uid}`);

    const leaderboardRef = db.collection('leaderboard').doc(uid);
    const recentScoresSnapshot = await leaderboardRef.collection('recentScores').get();
    await deleteCollectionDocs(recentScoresSnapshot.docs);
    console.log(`[cleanupUserData] Deleted ${recentScoresSnapshot.size || 0} recent score docs for user: ${uid}`);

    await leaderboardRef.delete();
    console.log(`[cleanupUserData] Deleted leaderboard doc for user: ${uid}`);

    const userRef = db.collection('users').doc(uid);
    const playlistsSnapshot = await userRef.collection('playlists').get();
    await deleteCollectionDocs(playlistsSnapshot.docs);
    console.log(`[cleanupUserData] Deleted ${playlistsSnapshot.size || 0} playlists for user: ${uid}`);

    await userRef.delete();
    console.log(`[cleanupUserData] Deleted user doc: ${uid}`);

    await bucket.deleteFiles({ prefix: `users/${uid}/` });
    console.log(`[cleanupUserData] Deleted Storage files for user: ${uid}`);
};

export const submitLeaderboardScore = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const signInProvider = request.auth?.token?.firebase?.sign_in_provider;

    if (signInProvider === 'anonymous') {
        throw new HttpsError('permission-denied', 'Anonymous users cannot submit leaderboard scores.');
    }

    const playlistId = getScoreString(request.data?.playlistId, 'Playlist ID', 160);
    const songId = getScoreString(request.data?.songId, 'Song ID', 160);
    const playlistTrackCount = getScoreInteger(request.data?.playlistTrackCount, 'Playlist track count');
    const snippetDurationMs = getScoreInteger(request.data?.snippetDurationMs, 'Snippet duration');

    if (playlistTrackCount < MIN_TRACKS_FOR_LEADERBOARD_POINTS) {
        throw new HttpsError('failed-precondition', 'This playlist is not eligible for leaderboard points.');
    }

    if (snippetDurationMs < MIN_SNIPPET_DURATION_MS || snippetDurationMs > MAX_SNIPPET_DURATION_MS) {
        throw new HttpsError('invalid-argument', 'Snippet duration is invalid.');
    }

    const userRecord = await getAuth().getUser(uid);
    const displayName = userRecord.displayName
        || userRecord.email?.split('@')[0]
        || 'Anonymous';
    const points = calculateLeaderboardPoints(snippetDurationMs);
    const db = getFirestore();
    const leaderboardRef = db.collection('leaderboard').doc(uid);
    const cooldownRef = leaderboardRef.collection('recentScores').doc(getScoreCooldownId(playlistId, songId));
    const now = Date.now();

    await db.runTransaction(async transaction => {
        const cooldownSnap = await transaction.get(cooldownRef);
        const lastScoredAt = cooldownSnap.exists ? cooldownSnap.data()?.scoredAtMillis : null;

        if (typeof lastScoredAt === 'number' && now - lastScoredAt < LEADERBOARD_SCORE_COOLDOWN_MS) {
            throw new HttpsError('failed-precondition', 'This song was scored recently. Try another song.');
        }

        transaction.set(leaderboardRef, {
            displayName,
            totalPoints: FieldValue.increment(points),
            gamesWon: FieldValue.increment(1),
            lastUpdated: FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(cooldownRef, {
            playlistId,
            songId,
            scoredAtMillis: now,
            expiresAtMillis: now + LEADERBOARD_SCORE_COOLDOWN_MS
        }, { merge: true });
    });

    return { points };
});

const getRoomRefForHost = async (roomId: string, uid: string) => {
    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) {
        throw new HttpsError('not-found', 'Room not found.');
    }

    const room = roomSnap.data();
    if (room?.hostUid !== uid) {
        throw new HttpsError('permission-denied', 'Only the host can do that.');
    }

    return { db, roomRef, room };
};

export const createMultiplayerRoom = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomName = getRoomName(request.data?.roomName);
    const displayName = await getPlayerDisplayName(uid);
    const now = Date.now();
    const db = getFirestore();

    for (let attempt = 0; attempt < 5; attempt++) {
        const roomId = makeRoomCode();
        const roomRef = db.collection('multiplayerRooms').doc(roomId);
        const roomSnap = await roomRef.get();

        if (roomSnap.exists) {
            continue;
        }

        const roomData = {
            id: roomId,
            roomName,
            hostUid: uid,
            status: 'lobby',
            visibility: 'private',
            maxPlayers: MULTIPLAYER_ROOM_LIMIT_FREE,
            pointGoal: 100,
            playerCount: 1,
            playlistId: null,
            playlistName: null,
            createdAt: now,
            updatedAt: now,
            expiresAt: now + 12 * 60 * 60 * 1000
        };

        const playerData = {
            uid,
            displayName,
            isHost: true,
            score: 0,
            state: 'lobby',
            joinedAt: now,
            updatedAt: now
        };

        const batch = db.batch();
        batch.set(roomRef, roomData);
        batch.set(roomRef.collection('players').doc(uid), playerData);
        await batch.commit();

        return { roomId };
    }

    throw new HttpsError('resource-exhausted', 'Could not create a room code. Try again.');
});

export const joinMultiplayerRoom = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const displayName = await getPlayerDisplayName(uid);
    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const playerRef = roomRef.collection('players').doc(uid);
    const now = Date.now();

    await db.runTransaction(async transaction => {
        const roomSnap = await transaction.get(roomRef);

        if (!roomSnap.exists) {
            throw new HttpsError('not-found', 'Room not found.');
        }

        const room = roomSnap.data();
        const playerSnap = await transaction.get(playerRef);
        const playerCount = typeof room?.playerCount === 'number' ? room.playerCount : 0;
        const maxPlayers = typeof room?.maxPlayers === 'number' ? room.maxPlayers : MULTIPLAYER_ROOM_LIMIT_FREE;

        if (room?.status === 'ended') {
            throw new HttpsError('failed-precondition', 'This game has ended.');
        }

        if (!playerSnap.exists && playerCount >= maxPlayers) {
            throw new HttpsError('resource-exhausted', 'This room is full.');
        }

        transaction.set(playerRef, {
            uid,
            displayName,
            isHost: room?.hostUid === uid,
            score: playerSnap.exists ? playerSnap.data()?.score || 0 : 0,
            state: 'lobby',
            joinedAt: playerSnap.exists ? playerSnap.data()?.joinedAt || now : now,
            updatedAt: now
        }, { merge: true });

        transaction.update(roomRef, {
            playerCount: playerSnap.exists ? playerCount : playerCount + 1,
            updatedAt: now
        });
    });

    return { roomId };
});

export const updateMultiplayerRoomSettings = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const playlistId = typeof request.data?.playlistId === 'string' ? request.data.playlistId.trim().slice(0, 128) : '';
    const playlistName = typeof request.data?.playlistName === 'string' ? request.data.playlistName.trim().slice(0, 128) : '';
    const pointGoal = Number(request.data?.pointGoal);

    if (!playlistId || !playlistName) {
        throw new HttpsError('invalid-argument', 'Pick a playlist before starting multiplayer.');
    }

    if (!Number.isInteger(pointGoal) || pointGoal < 10 || pointGoal > 1000) {
        throw new HttpsError('invalid-argument', 'Point goal must be between 10 and 1000.');
    }

    const { roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (room?.status !== 'lobby' && room?.status !== 'ended') {
        throw new HttpsError('failed-precondition', 'Settings can only be changed from the lobby or end screen.');
    }

    await roomRef.update({
        playlistId,
        playlistName,
        pointGoal,
        status: 'lobby',
        updatedAt: Date.now()
    });

    return { roomId };
});

export const startMultiplayerGame = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const { roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (!room?.playlistId || !room?.playlistName) {
        throw new HttpsError('failed-precondition', 'Pick a playlist before starting.');
    }

    await roomRef.update({
        status: 'playing',
        startedAt: Date.now(),
        updatedAt: Date.now()
    });

    return { roomId };
});

export const kickMultiplayerPlayer = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const targetUid = typeof request.data?.targetUid === 'string' ? request.data.targetUid.trim() : '';

    if (!targetUid || targetUid === uid) {
        throw new HttpsError('invalid-argument', 'Choose another player to kick.');
    }

    const { db, roomRef } = await getRoomRefForHost(roomId, uid);
    const playerRef = roomRef.collection('players').doc(targetUid);

    await db.runTransaction(async transaction => {
        const playerSnap = await transaction.get(playerRef);
        const roomSnap = await transaction.get(roomRef);

        if (!playerSnap.exists || !roomSnap.exists) {
            return;
        }

        const room = roomSnap.data();
        const playerCount = Math.max(0, (room?.playerCount || 1) - 1);
        transaction.delete(playerRef);
        transaction.update(roomRef, {
            playerCount,
            updatedAt: Date.now()
        });
    });

    return { roomId };
});

export const leaveMultiplayerRoom = onCall({
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const playerRef = roomRef.collection('players').doc(uid);
    const roomSnap = await roomRef.get();
    const now = Date.now();

    if (!roomSnap.exists) {
        return { roomId };
    }

    const room = roomSnap.data();

    if (room?.hostUid === uid) {
        const playersSnap = await roomRef.collection('players').get();
        const batch = db.batch();
        playersSnap.docs.forEach(playerDoc => {
            batch.delete(playerDoc.ref);
        });
        batch.update(roomRef, {
            status: 'ended',
            playerCount: 0,
            updatedAt: now,
            endedAt: now
        });
        await batch.commit();
        return { roomId };
    }

    await db.runTransaction(async transaction => {
        const playerSnap = await transaction.get(playerRef);
        const currentRoomSnap = await transaction.get(roomRef);

        if (!playerSnap.exists || !currentRoomSnap.exists) {
            return;
        }

        const currentRoom = currentRoomSnap.data();
        const playerCount = Math.max(0, (currentRoom?.playerCount || 1) - 1);
        transaction.delete(playerRef);
        transaction.update(roomRef, {
            playerCount,
            updatedAt: now
        });
    });

    return { roomId };
});

export const resolveSpotifyTracks = onCall({
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 60,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to resolve Spotify tracks.');
    }

    const trackIds = normalizeTrackIds(request.data?.trackIds);

    if (trackIds.length === 0) {
        return { tracks: [], errors: ['Paste at least one Spotify track link.'] };
    }

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        return await fetchSpotifyTracks(trackIds, accessToken);
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Could not resolve Spotify tracks.');
    }
});

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export const getPlaylistName = onCall({
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const playlistId = typeof request.data?.playlistId === 'string'
        ? request.data.playlistId.trim()
        : '';

    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new HttpsError('invalid-argument', 'Invalid Spotify playlist ID.');
    }

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        const name = await fetchPlaylistName(playlistId, accessToken);
        return { name };
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Could not fetch playlist name.');
    }
});

export const getUserPlaylists = onCall({
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 30,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const profileUrl = typeof request.data?.profileUrl === 'string'
        ? request.data.profileUrl.trim()
        : '';

    if (!profileUrl) {
        throw new HttpsError('invalid-argument', 'Spotify profile URL is required.');
    }

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        return await fetchUserPlaylists(profileUrl, accessToken);
    } catch (error: any) {
        const message = error.message || 'Could not fetch user playlists.';
        if (message.includes('valid Spotify profile URL')) {
            throw new HttpsError('invalid-argument', message);
        }
        if (message.includes('not found')) {
            throw new HttpsError('not-found', message);
        }
        throw new HttpsError('internal', message);
    }
});

export const importSpotifyPlaylist = onCall({
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 60,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const playlistId = typeof request.data?.playlistId === 'string'
        ? request.data.playlistId.trim()
        : '';
    const offset = typeof request.data?.offset === 'number' ? request.data.offset : 0;
    const limit = typeof request.data?.limit === 'number' ? request.data.limit : 100;

    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new HttpsError('invalid-argument', 'Invalid Spotify playlist ID.');
    }

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        return await fetchPlaylistTracks(playlistId, accessToken, offset, limit);
    } catch (error: any) {
        const message = error.message || 'Could not import playlist.';
        if (message.includes('not found')) {
            throw new HttpsError('not-found', message);
        }
        if (message.includes('private')) {
            throw new HttpsError('permission-denied', message);
        }
        throw new HttpsError('internal', message);
    }
});

export const getManualPlaylistTracks = onCall({
    timeoutSeconds: 30,
    memory: '256MiB',
    invoker: 'public'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const playlistId = typeof request.data?.playlistId === 'string'
        ? request.data.playlistId.trim()
        : '';

    if (!playlistId) {
        throw new HttpsError('invalid-argument', 'Playlist ID is required.');
    }

    const userId = request.auth.uid;
    const bucket = getStorage().bucket();
    const file = bucket.file(`users/${userId}/playlists/${playlistId}.json`);

    try {
        const [exists] = await file.exists();
        if (!exists) {
            return { tracks: [] };
        }
        const [content] = await file.download();
        const tracks = JSON.parse(content.toString('utf-8'));
        return { tracks };
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Could not fetch tracks from Storage.');
    }
});

export const cleanupUserOnDelete = functionsV1.auth.user().onDelete(async (userRecord: any) => {
    const uid = userRecord.uid;

    try {
        await cleanupUserData(uid);
    } catch (error) {
        console.error(`[cleanupUserOnDelete] Error cleaning up user ${uid}:`, error);
        throw error;
    }
});

export const cleanupAnonymousUsers = onSchedule('every 24 hours', async () => {
    const auth = getAuth();
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    
    let nextPageToken: string | undefined;
    let deletedCount = 0;

    try {
        do {
            const listUsersResult = await auth.listUsers(1000, nextPageToken);
            const usersToDelete = listUsersResult.users.filter(user => {
                const isAnonymous = user.providerData.length === 0;
                const lastSignInTime = new Date(user.metadata.lastSignInTime || user.metadata.creationTime).getTime();
                const isInactive = now - lastSignInTime > thirtyDaysInMs;
                return isAnonymous && isInactive;
            });

            if (usersToDelete.length > 0) {
                const uidsToDelete = usersToDelete.map(user => user.uid);
                for (const uid of uidsToDelete) {
                    await cleanupUserData(uid);
                }
                // Firebase Admin SDK supports deleting up to 1000 users at once
                await auth.deleteUsers(uidsToDelete);
                deletedCount += uidsToDelete.length;
            }
            
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        console.log(`[cleanupAnonymousUsers] Successfully deleted ${deletedCount} inactive anonymous users.`);
    } catch (error) {
        console.error('[cleanupAnonymousUsers] Error cleaning up anonymous users:', error);
    }
});
