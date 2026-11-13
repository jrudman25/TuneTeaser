import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import { GUEST_TRACKS } from './premadePlaylists';
import { normalizeSongTitleForGuess } from './answerMatching';

export const getTrackName = (track: any) => {
    return typeof track?.name === 'string' ? track.name : '';
};

export const getTrackArtistName = (track: any) => {
    const firstArtist = Array.isArray(track?.artists) ? track.artists[0] : null;
    return typeof firstArtist?.name === 'string' ? firstArtist.name : '';
};

export const getTrackArtworkUrl = (track: any) => {
    const images: Array<{ url?: string; width?: number }> = Array.isArray(track?.album?.images) ? track.album.images : [];
    const validImages = images.filter(image => typeof image?.url === 'string' && image.url.trim());
    const sizedImages = validImages.filter((image): image is { url?: string; width: number } => (
        typeof image?.width === 'number' && image.width >= 300
    ));
    if (sizedImages.length > 0) {
        return sizedImages.reduce((min, image) => (image.width < min.width ? image : min)).url || null;
    }
    return validImages[0]?.url || null;
};

export const getTrackAlbumName = (track: any) => {
    return typeof track?.album?.name === 'string' ? track.album.name : '';
};

export const getPlayableTracks = (tracks: any[]) => {
    return tracks.filter(track => (
        typeof track?.id === 'string'
        && normalizeSongTitleForGuess(getTrackName(track)).length > 0
        && getTrackArtistName(track)
    ));
};

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const downloadStorageTracks = async (uid: string, playlistId: string) => {
    const bucket = getStorage().bucket();
    const file = bucket.file(`users/${uid}/playlists/${playlistId}.json`);
    const [exists] = await file.exists();
    if (!exists) return null;

    const [content] = await file.download();
    let tracks: unknown = null;
    try {
        tracks = JSON.parse(content.toString('utf-8'));
    } catch {
        tracks = null;
    }
    return Array.isArray(tracks) ? tracks : [];
};

export const loadPlaylistTracks = async (
    uid: string,
    playlistId: string,
    notFoundMessage = 'Playlist not found.'
): Promise<{ tracks: any[]; source: 'featured' | 'saved' | 'storage-only' }> => {
    if (Array.isArray(GUEST_TRACKS[playlistId])) {
        return { tracks: GUEST_TRACKS[playlistId].map((item: any) => item.track), source: 'featured' };
    }

    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
        throw new HttpsError('invalid-argument', 'Playlist ID is invalid.');
    }

    const db = getFirestore();
    const playlistRef = db.collection('users').doc(uid).collection('playlists').doc(playlistId);
    const playlistSnap = await playlistRef.get();

    if (playlistSnap.exists) {
        const playlist = playlistSnap.data();
        if (Array.isArray(playlist?.tracks) && playlist.tracks.length > 0) {
            return { tracks: playlist.tracks, source: 'saved' };
        }
        const storageTracks = await downloadStorageTracks(uid, playlistId);
        return { tracks: storageTracks || [], source: 'saved' };
    }

    const storageTracks = await downloadStorageTracks(uid, playlistId);
    if (storageTracks) {
        return { tracks: storageTracks, source: 'storage-only' };
    }

    throw new HttpsError('not-found', notFoundMessage);
};
