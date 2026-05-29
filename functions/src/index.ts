import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';
import { fetchPlaylistName, fetchPlaylistTracks, fetchSpotifyTracks, fetchUserPlaylists, getSpotifyAccessToken, normalizeTrackIds } from './spotify';

initializeApp();

const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID');
const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET');

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
