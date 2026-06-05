import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';
import { fetchPlaylistName, fetchPlaylistTracks, fetchSpotifyTracks, fetchUserPlaylists, getSpotifyAccessToken, normalizeTrackIds } from './spotify';

initializeApp();

const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');
const MULTIPLAYER_ROOM_LIMIT_FREE = 5;
const MULTIPLAYER_ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MULTIPLAYER_ROOM_CODE_LENGTH = 6;

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
    const db = getFirestore();
    const bucket = getStorage().bucket();

    console.log(`[cleanupUserOnDelete] Starting cleanup for user: ${uid}`);

    try {
        // 1. Delete leaderboard doc
        await db.collection('leaderboard').doc(uid).delete();
        console.log(`[cleanupUserOnDelete] Deleted leaderboard doc for user: ${uid}`);

        // 2. Delete all playlists in the users/{uid}/playlists subcollection
        const playlistsSnapshot = await db.collection('users').doc(uid).collection('playlists').get();
        if (!playlistsSnapshot.empty) {
            const batch = db.batch();
            playlistsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`[cleanupUserOnDelete] Deleted ${playlistsSnapshot.size} playlists for user: ${uid}`);
        }

        // 3. Delete the user document itself
        await db.collection('users').doc(uid).delete();
        console.log(`[cleanupUserOnDelete] Deleted user doc: ${uid}`);

        // 4. Delete the user's Storage folder
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
        console.log(`[cleanupUserOnDelete] Deleted Storage files for user: ${uid}`);

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
