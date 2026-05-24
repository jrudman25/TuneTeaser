import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';

const SPOTIFY_PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

/**
 * Extracts a Spotify playlist ID from a URL like:
 * https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123
 * Returns null if the URL is not a valid Spotify playlist link.
 */
export const extractSpotifyPlaylistId = (value: string): string | null => {
    try {
        const url = new URL(value.trim());
        if (!url.hostname.endsWith('spotify.com')) return null;

        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'playlist' && pathParts[1] && SPOTIFY_PLAYLIST_ID_PATTERN.test(pathParts[1])) {
            return pathParts[1];
        }
    } catch {
        return null;
    }

    return null;
};

interface GetPlaylistNameResponse {
    name: string;
}

/**
 * Fetches the playlist name from Spotify via the backend Cloud Function.
 * Returns null on failure so callers can fall back to manual input.
 */
export const fetchSpotifyPlaylistName = async (playlistUrl: string): Promise<string | null> => {
    const playlistId = extractSpotifyPlaylistId(playlistUrl);
    if (!playlistId) return null;

    try {
        const callable = httpsCallable<{ playlistId: string }, GetPlaylistNameResponse>(
            functions,
            'getPlaylistName'
        );

        const result = await callable({ playlistId });
        return result.data.name || null;
    } catch {
        return null;
    }
};
