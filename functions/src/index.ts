import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableOptions } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';
import { createHash } from 'crypto';
import { fetchPlaylistName, fetchPlaylistTracks, fetchSpotifyTracks, fetchUserPlaylists, getSpotifyAccessToken, normalizeTrackIds } from './spotify';
import { GUEST_TRACKS } from './premadePlaylists';

initializeApp();

const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');
const MULTIPLAYER_ROOM_LIMIT_FREE = 5;
const MULTIPLAYER_ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MULTIPLAYER_ROOM_CODE_LENGTH = 6;
const MIN_TRACKS_FOR_LEADERBOARD_POINTS = 10;
const DEFAULT_ROUND_TIMER_SECONDS = 90;
const MIN_ROUND_TIMER_SECONDS = 15;
const MAX_ROUND_TIMER_SECONDS = 300;
const LEADERBOARD_SCORE_COOLDOWN_MS = 10 * 60 * 1000;
const MIN_SNIPPET_DURATION_MS = 2000;
const MAX_SNIPPET_DURATION_MS = 30000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SPOTIFY_READ_RATE_LIMIT = 20;
const SPOTIFY_IMPORT_RATE_LIMIT = 30;
const MULTIPLAYER_ROUND_LOOKUP_ATTEMPTS = 8;

export const shouldEnforceAppCheck = () => process.env.FUNCTIONS_EMULATOR !== 'true';

const PUBLIC_CALLABLE_OPTIONS = {
    timeoutSeconds: 15,
    memory: '256MiB',
    invoker: 'public',
    enforceAppCheck: shouldEnforceAppCheck()
} satisfies CallableOptions;

const normalizeAnswer = (value: unknown) => {
    return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
};

const songVersionKeywordPattern = /(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)/i;

const normalizeSongTitleForGuess = (value: unknown) => {
    const title = typeof value === 'string' ? value.trim() : '';
    const withoutBracketedVersion = title.replace(/\s*[[(][^\])]*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)[^\])]*[\])]\s*$/i, '').trim();
    const bracketCleaned = withoutBracketedVersion || title;
    const withoutDashVersion = bracketCleaned.replace(/\s+-\s+.*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio).*$/i, '').trim();
    const cleaned = songVersionKeywordPattern.test(bracketCleaned) ? withoutDashVersion || bracketCleaned : bracketCleaned;
    return normalizeAnswer(cleaned);
};

const getTrackArtistName = (track: any) => {
    const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : null;
    return typeof firstArtist?.name === 'string' ? firstArtist.name : '';
};

const getTrackArtworkUrl = (track: any) => {
    const images = Array.isArray(track?.album?.images) ? track.album.images : [];
    const firstImage = images.find((image: any) => typeof image?.url === 'string' && image.url.trim());
    return firstImage?.url || null;
};

const getTrackName = (track: any) => {
    return typeof track?.name === 'string' ? track.name : '';
};

const makeAnswerHash = (roomId: string, roundId: string, title: string) => {
    return createHash('sha256')
        .update(`${roomId}:${roundId}:${normalizeAnswer(title)}`)
        .digest('hex');
};

const cleanItunesQuery = (value: string) => {
    return value.replace(/ - .*/, '').replace(/[([].*?[)\]]/g, '').trim();
};

const getItunesPreview = async (
    trackName: string,
    artistName: string,
    albumName?: string
): Promise<{ previewUrl: string; artworkUrl: string } | null> => {
    const searchTerm = cleanItunesQuery(trackName);
    const term = encodeURIComponent(`${searchTerm} ${artistName}`);
    const response = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=50`);

    if (!response.ok) {
        return null;
    }

    const data = await response.json() as {
        resultCount?: number;
        results?: Array<{
            previewUrl?: string;
            artworkUrl100?: string;
            trackName?: string;
            artistName?: string;
            collectionName?: string;
        }>;
    };

    if (!data.resultCount || !Array.isArray(data.results)) {
        return null;
    }

    const bannedTerms = ['remix', 'mix', 'live', 'instrumental', 'club', 'edit'];
    const normalizedTarget = normalizeAnswer(cleanItunesQuery(trackName));
    const normalizedArtist = artistName.toLowerCase();

    const bestMatch = data.results
        .map(result => {
            const resultName = (result.trackName || '').toLowerCase();
            const resultArtist = (result.artistName || '').toLowerCase();
            const resultAlbum = (result.collectionName || '').toLowerCase();
            let score = 0;

            if (!result.previewUrl || !resultArtist.includes(normalizedArtist) && !normalizedArtist.includes(resultArtist)) {
                return { result, score: -1 };
            }

            const hasBannedTerm = bannedTerms.some(term => resultName.includes(term) && !trackName.toLowerCase().includes(term));
            if (hasBannedTerm) {
                return { result, score: -1 };
            }

            const normalizedResult = normalizeAnswer(cleanItunesQuery(result.trackName || ''));
            if (normalizedResult === normalizedTarget) {
                score += 10;
            } else if (normalizedResult.includes(normalizedTarget) || normalizedTarget.includes(normalizedResult)) {
                const maxLength = Math.max(normalizedResult.length, normalizedTarget.length);
                const lengthDiff = Math.abs(normalizedResult.length - normalizedTarget.length);
                if (maxLength > 0 && (1 - lengthDiff / maxLength) > 0.7) {
                    score += 5;
                } else {
                    return { result, score: -1 };
                }
            } else {
                return { result, score: -1 };
            }

            if (albumName) {
                const normalizedAlbumTarget = normalizeAnswer(cleanItunesQuery(albumName));
                const normalizedAlbumResult = normalizeAnswer(cleanItunesQuery(resultAlbum));
                if (normalizedAlbumResult === normalizedAlbumTarget) {
                    score += 5;
                } else if (normalizedAlbumResult.includes(normalizedAlbumTarget) || normalizedAlbumTarget.includes(normalizedAlbumResult)) {
                    score += 2;
                }
            }

            return { result, score };
        })
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.result;

    if (!bestMatch?.previewUrl) {
        return null;
    }

    return {
        previewUrl: bestMatch.previewUrl,
        artworkUrl: bestMatch.artworkUrl100 ? bestMatch.artworkUrl100.replace('100x100', '600x600') : ''
    };
};

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
        throw new HttpsError('unauthenticated', 'You must be logged in.');
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

const isCorrectGuess = (guess: string, title: string, artistName: string) => {
    const checkGuess = normalizeAnswer(guess);
    const checkTitle = normalizeSongTitleForGuess(title);
    const targetOption = artistName ? `${title} - ${artistName}` : title;
    const checkTargetOption = normalizeAnswer(targetOption);
    const isExactOptionMatch = checkTargetOption === checkGuess && checkGuess.length > 0;
    const guessCoversEnoughOfTitle = checkTitle.length > 0 && checkGuess.length / checkTitle.length >= 0.5;
    const isTitleMatch = checkTitle === checkGuess || (
        checkGuess.length > 2
        && guessCoversEnoughOfTitle
        && checkTitle.includes(checkGuess)
    );

    return isExactOptionMatch || isTitleMatch;
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

const assertUidRateLimit = async (uid: string, action: string, maxRequests: number) => {
    const db = getFirestore();
    const now = Date.now();
    const limitRef = db.collection('callableRateLimits').doc(`${uid}_${action}`);

    await db.runTransaction(async transaction => {
        const limitSnap = await transaction.get(limitRef);
        const limit = limitSnap.exists ? limitSnap.data() : null;
        const windowStartedAtMillis = typeof limit?.windowStartedAtMillis === 'number'
            ? limit.windowStartedAtMillis
            : 0;
        const count = typeof limit?.count === 'number' ? limit.count : 0;
        const isCurrentWindow = now - windowStartedAtMillis < RATE_LIMIT_WINDOW_MS;

        if (isCurrentWindow && count >= maxRequests) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again in a minute.');
        }

        if (isCurrentWindow) {
            transaction.update(limitRef, {
                count: FieldValue.increment(1),
                updatedAtMillis: now,
                expiresAtMillis: now + RATE_LIMIT_WINDOW_MS
            });
            return;
        }

        transaction.set(limitRef, {
            uid,
            action,
            count: 1,
            windowStartedAtMillis: now,
            updatedAtMillis: now,
            expiresAtMillis: now + RATE_LIMIT_WINDOW_MS
        }, { merge: true });
    });
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

export const submitLeaderboardScore = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
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

const getHostPlaylistTracks = async (uid: string, playlistId: string) => {
    if (Array.isArray(GUEST_TRACKS[playlistId])) {
        return GUEST_TRACKS[playlistId].map((item: any) => item.track);
    }

    const db = getFirestore();
    const playlistRef = db.collection('users').doc(uid).collection('playlists').doc(playlistId);
    const playlistSnap = await playlistRef.get();
    const playlist = playlistSnap.exists ? playlistSnap.data() : null;

    if (!playlistSnap.exists) {
        throw new HttpsError('not-found', 'Host playlist not found.');
    }

    if (Array.isArray(playlist?.tracks) && playlist.tracks.length > 0) {
        return playlist.tracks;
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(`users/${uid}/playlists/${playlistId}.json`);
    const [exists] = await file.exists();

    if (!exists) {
        return [];
    }

    const [content] = await file.download();
    const tracks = JSON.parse(content.toString('utf-8'));
    return Array.isArray(tracks) ? tracks : [];
};

const getPlayableTracks = (tracks: any[]) => {
    return tracks.filter(track => (
        typeof track?.id === 'string'
        && normalizeAnswer(getTrackName(track)).length > 0
        && getTrackArtistName(track)
    ));
};

const buildRoundChoices = (tracks: any[]) => {
    return getPlayableTracks(tracks).map(track => ({
        id: track.id,
        name: getTrackName(track),
        artistName: getTrackArtistName(track)
    }));
};

const makeRoundId = (roomId: string, trackId: string) => {
    return createHash('sha256')
        .update(`${roomId}:${Date.now()}:${trackId}:${Math.random()}`)
        .digest('hex')
        .slice(0, 16);
};

const startNextMultiplayerRound = async (
    db: any,
    roomRef: any,
    roomId: string,
    hostUid: string,
    playlistId: string,
    roundNumber: number,
    roundTimerSeconds: number
) => {
    const tracks = await getHostPlaylistTracks(hostUid, playlistId);
    const playableTracks = getPlayableTracks(tracks);

    if (playableTracks.length < 2) {
        throw new HttpsError('failed-precondition', 'Pick a playlist with at least 2 playable tracks.');
    }

    const shuffled = [...playableTracks].sort(() => 0.5 - Math.random());
    let roundTrack: any | null = null;
    let preview: { previewUrl: string; artworkUrl: string } | null = null;

    for (const candidate of shuffled.slice(0, MULTIPLAYER_ROUND_LOOKUP_ATTEMPTS)) {
        const artistName = getTrackArtistName(candidate);
        const albumName = typeof candidate.album?.name === 'string' ? candidate.album.name : '';
        preview = await getItunesPreview(getTrackName(candidate), artistName, albumName);
        if (preview?.previewUrl) {
            roundTrack = candidate;
            break;
        }
    }

    if (!roundTrack || !preview?.previewUrl) {
        throw new HttpsError('failed-precondition', 'Could not find a playable preview for this playlist. Try another playlist.');
    }

    const now = Date.now();
    const roundId = makeRoundId(roomId, roundTrack.id);
    const artistName = getTrackArtistName(roundTrack);
    const albumName = typeof roundTrack.album?.name === 'string' ? roundTrack.album.name : '';
    const artworkUrl = preview.artworkUrl || getTrackArtworkUrl(roundTrack);
    const choices = buildRoundChoices(tracks);
    const currentRound = {
        id: roundId,
        trackId: roundTrack.id,
        artistName,
        albumName,
        artworkUrl,
        startedAt: now,
        endsAt: now + roundTimerSeconds * 1000,
        roundTimerSeconds,
        snippetDurationMs: MIN_SNIPPET_DURATION_MS,
        state: 'playing',
        roundNumber
    };
    const playersSnap = await roomRef.collection('players').get();
    const batch = db.batch();
    const roomUpdate: any = {
        status: 'playing',
        updatedAt: now,
        endedAt: FieldValue.delete(),
        winnerUid: FieldValue.delete(),
        winnerDisplayName: FieldValue.delete(),
        revealedRound: FieldValue.delete(),
        currentRound
    };

    if (roundNumber === 1) {
        roomUpdate.startedAt = now;
    }

    batch.set(roomRef.collection('rounds').doc(roundId), {
        id: roundId,
        trackId: roundTrack.id,
        title: getTrackName(roundTrack),
        artistName,
        albumName,
        artworkUrl,
        answerHash: makeAnswerHash(roomId, roundId, getTrackName(roundTrack)),
        previewUrl: preview.previewUrl,
        choices,
        createdAt: now
    });
    batch.update(roomRef, roomUpdate);
    playersSnap.docs.forEach((playerDoc: any) => {
        batch.set(playerDoc.ref, {
            state: 'guessing',
            currentRoundId: roundId,
            roundSnippetDurationMs: MIN_SNIPPET_DURATION_MS,
            roundCompletedAt: null,
            lastEarnedPoints: null,
            updatedAt: now
        }, { merge: true });
    });

    await batch.commit();
    return { roundId };
};

const assertJoinedPlayer = async (roomRef: any, uid: string) => {
    const playerRef = roomRef.collection('players').doc(uid);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
        throw new HttpsError('permission-denied', 'Join the room before playing.');
    }
    return { playerRef, player: playerSnap.data() };
};

const getSafeRevealedRound = (roundData: any) => ({
    id: roundData.id,
    trackId: roundData.trackId,
    title: roundData.title,
    artistName: roundData.artistName,
    albumName: roundData.albumName,
    artworkUrl: roundData.artworkUrl
});

const settleRoundIfComplete = async (
    roomId: string,
    roundId: string,
    now: number
) => {
    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    let nextRoundInput: { hostUid: string; playlistId: string; roundNumber: number; roundTimerSeconds: number } | null = null;

    await db.runTransaction(async transaction => {
        const roomSnap = await transaction.get(roomRef);
        const playersQuerySnap = await transaction.get(roomRef.collection('players'));
        const roundPrivateRef = roomRef.collection('rounds').doc(roundId);
        const roundPrivateSnap = await transaction.get(roundPrivateRef);

        if (!roomSnap.exists || !roundPrivateSnap.exists) return;

        const room = roomSnap.data();
        if (room?.status !== 'playing' || room?.currentRound?.id !== roundId || room.currentRound?.state !== 'playing') {
            return;
        }

        const players = playersQuerySnap.docs.map((playerDoc: any) => ({ ref: playerDoc.ref, data: playerDoc.data() }));
        if (players.length === 0) return;

        const allDone = players.every((player: any) => (
            player.data.currentRoundId === roundId
            && ['correct', 'gave-up', 'timed-out'].includes(player.data.state)
        ));
        if (!allDone) return;

        const winner = players
            .filter((player: any) => typeof player.data.score === 'number' && player.data.score >= (room?.pointGoal || 100))
            .sort((a: any, b: any) => b.data.score - a.data.score)[0];
        const roundData = roundPrivateSnap.data();
        const revealedRound = getSafeRevealedRound(roundData);

        if (winner) {
            transaction.update(roomRef, {
                status: 'ended',
                winnerUid: winner.data.uid,
                winnerDisplayName: winner.data.displayName,
                endedAt: now,
                updatedAt: now,
                revealedRound,
                currentRound: {
                    ...room.currentRound,
                    state: 'completed',
                    completedAt: now
                }
            });
            return;
        }

        transaction.update(roomRef, {
            updatedAt: now,
            revealedRound,
            currentRound: {
                ...room.currentRound,
                state: 'advancing',
                completedAt: now
            }
        });

        nextRoundInput = {
            hostUid: room.hostUid,
            playlistId: room.playlistId,
            roundNumber: (room.currentRound?.roundNumber || 1) + 1,
            roundTimerSeconds: room.roundTimerSeconds || DEFAULT_ROUND_TIMER_SECONDS
        };
    });

    const roundToStart = nextRoundInput as { hostUid: string; playlistId: string; roundNumber: number; roundTimerSeconds: number } | null;
    if (roundToStart) {
        await startNextMultiplayerRound(
            db,
            roomRef,
            roomId,
            roundToStart.hostUid,
            roundToStart.playlistId,
            roundToStart.roundNumber,
            roundToStart.roundTimerSeconds
        );
    }
};

export const createMultiplayerRoom = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
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
            roundTimerSeconds: DEFAULT_ROUND_TIMER_SECONDS,
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

export const joinMultiplayerRoom = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
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

        const existingPlayer = playerSnap.exists ? playerSnap.data() || {} : {};
        const isRejoiningCurrentRound = playerSnap.exists
            && room?.status === 'playing'
            && room?.currentRound?.id
            && existingPlayer.currentRoundId === room.currentRound.id;
        const playerData: any = {
            uid,
            displayName,
            isHost: room?.hostUid === uid,
            score: playerSnap.exists ? existingPlayer.score || 0 : 0,
            state: isRejoiningCurrentRound ? existingPlayer.state : 'lobby',
            joinedAt: playerSnap.exists ? existingPlayer.joinedAt || now : now,
            updatedAt: now
        };

        if (isRejoiningCurrentRound) {
            playerData.currentRoundId = existingPlayer.currentRoundId;
            playerData.roundSnippetDurationMs = existingPlayer.roundSnippetDurationMs || MIN_SNIPPET_DURATION_MS;
            playerData.roundCompletedAt = existingPlayer.roundCompletedAt || null;
            playerData.lastEarnedPoints = existingPlayer.lastEarnedPoints || null;
        }

        transaction.set(playerRef, playerData, { merge: true });

        transaction.update(roomRef, {
            playerCount: playerSnap.exists ? playerCount : playerCount + 1,
            updatedAt: now
        });
    });

    return { roomId };
});

export const updateMultiplayerRoomSettings = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const playlistId = typeof request.data?.playlistId === 'string' ? request.data.playlistId.trim().slice(0, 128) : '';
    const playlistName = typeof request.data?.playlistName === 'string' ? request.data.playlistName.trim().slice(0, 128) : '';
    const pointGoal = Number(request.data?.pointGoal);
    const roundTimerSeconds = Number(request.data?.roundTimerSeconds);

    if (!playlistId || !playlistName) {
        throw new HttpsError('invalid-argument', 'Pick a playlist before starting multiplayer.');
    }

    if (!Number.isInteger(pointGoal) || pointGoal < 10 || pointGoal > 1000) {
        throw new HttpsError('invalid-argument', 'Point goal must be between 10 and 1000.');
    }

    if (!Number.isInteger(roundTimerSeconds) || roundTimerSeconds < MIN_ROUND_TIMER_SECONDS || roundTimerSeconds > MAX_ROUND_TIMER_SECONDS) {
        throw new HttpsError('invalid-argument', `Round timer must be between ${MIN_ROUND_TIMER_SECONDS} and ${MAX_ROUND_TIMER_SECONDS} seconds.`);
    }

    const { roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (room?.status !== 'lobby' && room?.status !== 'ended') {
        throw new HttpsError('failed-precondition', 'Settings can only be changed from the lobby or end screen.');
    }

    await roomRef.update({
        playlistId,
        playlistName,
        pointGoal,
        roundTimerSeconds,
        status: 'lobby',
        updatedAt: Date.now()
    });

    return { roomId };
});

export const startMultiplayerGame = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const { db, roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (!room?.playlistId || !room?.playlistName) {
        throw new HttpsError('failed-precondition', 'Pick a playlist before starting.');
    }

    await startNextMultiplayerRound(db, roomRef, roomId, uid, room.playlistId, 1, room.roundTimerSeconds || DEFAULT_ROUND_TIMER_SECONDS);

    return { roomId };
});

export const getMultiplayerRoundData = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const roundId = typeof request.data?.roundId === 'string' ? request.data.roundId.trim() : '';

    if (!roundId) {
        throw new HttpsError('invalid-argument', 'Round ID is required.');
    }

    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) {
        throw new HttpsError('not-found', 'Room not found.');
    }

    await assertJoinedPlayer(roomRef, uid);

    const room = roomSnap.data();
    if (room?.currentRound?.id !== roundId) {
        throw new HttpsError('failed-precondition', 'This round is no longer active.');
    }

    const roundSnap = await roomRef.collection('rounds').doc(roundId).get();
    if (!roundSnap.exists) {
        throw new HttpsError('not-found', 'Round data not found.');
    }

    const round = roundSnap.data();
    return {
        roundId,
        previewUrl: round?.previewUrl || '',
        choices: Array.isArray(round?.choices) ? round.choices : [],
        artworkUrl: round?.artworkUrl || room?.currentRound?.artworkUrl || null,
        artistName: round?.artistName || room?.currentRound?.artistName || '',
        albumName: round?.albumName || room?.currentRound?.albumName || ''
    };
});

export const submitMultiplayerGuess = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const roundId = typeof request.data?.roundId === 'string' ? request.data.roundId.trim() : '';
    const guess = typeof request.data?.guess === 'string' ? request.data.guess.trim().slice(0, 200) : '';
    const requestedSnippetDurationMs = Number(request.data?.snippetDurationMs);

    if (!roundId) {
        throw new HttpsError('invalid-argument', 'Round ID is required.');
    }

    if (!Number.isInteger(requestedSnippetDurationMs)
        || requestedSnippetDurationMs < MIN_SNIPPET_DURATION_MS
        || requestedSnippetDurationMs > MAX_SNIPPET_DURATION_MS) {
        throw new HttpsError('invalid-argument', 'Snippet duration is invalid.');
    }

    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const playerRef = roomRef.collection('players').doc(uid);
    const roundRef = roomRef.collection('rounds').doc(roundId);
    const now = Date.now();
    let response: { correct: boolean; points: number; snippetDurationMs: number; done: boolean } = {
        correct: false,
        points: 0,
        snippetDurationMs: requestedSnippetDurationMs,
        done: false
    };

    await db.runTransaction(async transaction => {
        const roomSnap = await transaction.get(roomRef);
        const playerSnap = await transaction.get(playerRef);
        const roundSnap = await transaction.get(roundRef);

        if (!roomSnap.exists) {
            throw new HttpsError('not-found', 'Room not found.');
        }
        if (!playerSnap.exists) {
            throw new HttpsError('permission-denied', 'Join the room before playing.');
        }
        if (!roundSnap.exists) {
            throw new HttpsError('not-found', 'Round data not found.');
        }

        const room = roomSnap.data();
        const player = playerSnap.data() || {};
        const round = roundSnap.data();
        if (room?.status !== 'playing' || room?.currentRound?.id !== roundId || room.currentRound?.state !== 'playing') {
            throw new HttpsError('failed-precondition', 'This round is not active.');
        }
        if (player?.currentRoundId !== roundId) {
            throw new HttpsError('failed-precondition', 'You are not active in this round.');
        }
        const playerState = typeof player.state === 'string' ? player.state : '';
        if (['correct', 'gave-up', 'timed-out'].includes(playerState)) {
            response = {
                correct: playerState === 'correct',
                points: player.lastEarnedPoints || 0,
                snippetDurationMs: player.roundSnippetDurationMs || requestedSnippetDurationMs,
                done: true
            };
            return;
        }
        if (playerState !== 'guessing') {
            throw new HttpsError('failed-precondition', 'You are not active in this round.');
        }

        const currentSnippetDurationMs = typeof player?.roundSnippetDurationMs === 'number'
            ? player.roundSnippetDurationMs
            : requestedSnippetDurationMs;
        const correct = isCorrectGuess(guess, round?.title || '', round?.artistName || '');

        if (correct) {
            const points = calculateLeaderboardPoints(currentSnippetDurationMs);
            transaction.update(playerRef, {
                score: FieldValue.increment(points),
                state: 'correct',
                roundCompletedAt: now,
                lastEarnedPoints: points,
                roundSnippetDurationMs: currentSnippetDurationMs,
                updatedAt: now
            });
            response = { correct: true, points, snippetDurationMs: currentSnippetDurationMs, done: true };
            return;
        }

        const nextSnippetDurationMs = Math.min(currentSnippetDurationMs + 2000, MAX_SNIPPET_DURATION_MS);
        const timedOut = currentSnippetDurationMs >= MAX_SNIPPET_DURATION_MS;
        transaction.update(playerRef, {
            state: timedOut ? 'timed-out' : 'guessing',
            roundSnippetDurationMs: nextSnippetDurationMs,
            roundCompletedAt: timedOut ? now : null,
            lastEarnedPoints: null,
            updatedAt: now
        });
        response = {
            correct: false,
            points: 0,
            snippetDurationMs: nextSnippetDurationMs,
            done: timedOut
        };
    });

    if (response.done) {
        await settleRoundIfComplete(roomId, roundId, now);
    }

    return response;
});

export const giveUpMultiplayerRound = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const roundId = typeof request.data?.roundId === 'string' ? request.data.roundId.trim() : '';

    if (!roundId) {
        throw new HttpsError('invalid-argument', 'Round ID is required.');
    }

    const db = getFirestore();
    const roomRef = db.collection('multiplayerRooms').doc(roomId);
    const playerRef = roomRef.collection('players').doc(uid);
    const now = Date.now();

    await db.runTransaction(async transaction => {
        const roomSnap = await transaction.get(roomRef);
        const playerSnap = await transaction.get(playerRef);

        if (!roomSnap.exists) {
            throw new HttpsError('not-found', 'Room not found.');
        }
        if (!playerSnap.exists) {
            throw new HttpsError('permission-denied', 'Join the room before playing.');
        }

        const room = roomSnap.data();
        const player = playerSnap.data();
        if (room?.status !== 'playing' || room?.currentRound?.id !== roundId || room.currentRound?.state !== 'playing') {
            throw new HttpsError('failed-precondition', 'This round is not active.');
        }
        if (player?.currentRoundId !== roundId || ['correct', 'gave-up', 'timed-out'].includes(player?.state)) {
            return;
        }

        transaction.update(playerRef, {
            state: 'gave-up',
            roundCompletedAt: now,
            lastEarnedPoints: null,
            updatedAt: now
        });
    });

    await settleRoundIfComplete(roomId, roundId, now);
    return { roomId };
});

export const playMultiplayerAgain = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const { db, roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (!room?.playlistId) {
        throw new HttpsError('failed-precondition', 'Pick a playlist before starting.');
    }
    if (room?.status !== 'ended') {
        throw new HttpsError('failed-precondition', 'Play again is only available after a game ends.');
    }

    const playersSnap = await roomRef.collection('players').get();
    const batch = db.batch();
    playersSnap.docs.forEach((playerDoc: any) => {
        batch.set(playerDoc.ref, {
            score: 0,
            state: 'guessing',
            currentRoundId: null,
            roundSnippetDurationMs: MIN_SNIPPET_DURATION_MS,
            roundCompletedAt: null,
            lastEarnedPoints: null,
            updatedAt: Date.now()
        }, { merge: true });
    });
    await batch.commit();

    await startNextMultiplayerRound(db, roomRef, roomId, uid, room.playlistId, 1, room.roundTimerSeconds || DEFAULT_ROUND_TIMER_SECONDS);
    return { roomId };
});

export const returnMultiplayerToLobby = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roomId = getRoomId(request.data?.roomId);
    const { db, roomRef, room } = await getRoomRefForHost(roomId, uid);

    if (room?.status !== 'ended') {
        throw new HttpsError('failed-precondition', 'Return to lobby is only available after a game ends.');
    }

    const now = Date.now();
    const playersSnap = await roomRef.collection('players').get();
    const batch = db.batch();
    batch.update(roomRef, {
        status: 'lobby',
        currentRound: FieldValue.delete(),
        revealedRound: FieldValue.delete(),
        winnerUid: FieldValue.delete(),
        winnerDisplayName: FieldValue.delete(),
        endedAt: FieldValue.delete(),
        updatedAt: now
    });
    playersSnap.docs.forEach((playerDoc: any) => {
        batch.set(playerDoc.ref, {
            score: 0,
            state: 'lobby',
            currentRoundId: null,
            roundSnippetDurationMs: null,
            roundCompletedAt: null,
            lastEarnedPoints: null,
            updatedAt: now
        }, { merge: true });
    });
    await batch.commit();

    return { roomId };
});

export const kickMultiplayerPlayer = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
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

export const leaveMultiplayerRoom = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
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
    ...PUBLIC_CALLABLE_OPTIONS,
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 60,
}, async (request) => {
    const uid = getAuthedUid(request);

    const trackIds = normalizeTrackIds(request.data?.trackIds);

    if (trackIds.length === 0) {
        return { tracks: [], errors: ['Paste at least one Spotify track link.'] };
    }

    await assertUidRateLimit(uid, 'resolveSpotifyTracks', SPOTIFY_IMPORT_RATE_LIMIT);

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        return await fetchSpotifyTracks(trackIds, accessToken);
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Could not resolve Spotify tracks.');
    }
});

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export const getPlaylistName = onCall({
    ...PUBLIC_CALLABLE_OPTIONS,
    secrets: [spotifyClientId, spotifyClientSecret],
}, async (request) => {
    const uid = getAuthedUid(request);

    const playlistId = typeof request.data?.playlistId === 'string'
        ? request.data.playlistId.trim()
        : '';

    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new HttpsError('invalid-argument', 'Invalid Spotify playlist ID.');
    }

    await assertUidRateLimit(uid, 'getPlaylistName', SPOTIFY_READ_RATE_LIMIT);

    try {
        const accessToken = await getSpotifyAccessToken(spotifyClientId.value(), spotifyClientSecret.value());
        const name = await fetchPlaylistName(playlistId, accessToken);
        return { name };
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Could not fetch playlist name.');
    }
});

export const getUserPlaylists = onCall({
    ...PUBLIC_CALLABLE_OPTIONS,
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 30,
}, async (request) => {
    const uid = getAuthedUid(request);

    const profileUrl = typeof request.data?.profileUrl === 'string'
        ? request.data.profileUrl.trim()
        : '';

    if (!profileUrl) {
        throw new HttpsError('invalid-argument', 'Spotify profile URL is required.');
    }

    await assertUidRateLimit(uid, 'getUserPlaylists', SPOTIFY_READ_RATE_LIMIT);

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
    ...PUBLIC_CALLABLE_OPTIONS,
    secrets: [spotifyClientId, spotifyClientSecret],
    timeoutSeconds: 60,
}, async (request) => {
    const uid = getAuthedUid(request);

    const playlistId = typeof request.data?.playlistId === 'string'
        ? request.data.playlistId.trim()
        : '';
    const offset = typeof request.data?.offset === 'number' ? request.data.offset : 0;
    const limit = typeof request.data?.limit === 'number' ? request.data.limit : 100;

    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new HttpsError('invalid-argument', 'Invalid Spotify playlist ID.');
    }

    await assertUidRateLimit(uid, 'importSpotifyPlaylist', SPOTIFY_IMPORT_RATE_LIMIT);

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
    ...PUBLIC_CALLABLE_OPTIONS,
    timeoutSeconds: 30
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
