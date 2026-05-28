import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';
import { ManualTrack } from './manualPlaylists';

interface ImportSpotifyPlaylistResponse {
    name: string;
    tracks: ManualTrack[];
    total: number;
    errors: string[];
}

/**
 * Imports a page of a Spotify playlist (name + tracks + total count) via the backend.
 * Accepts a Spotify playlist ID (22-char alphanumeric string), plus offset and limit.
 */
export const importSpotifyPlaylist = async (
    playlistId: string,
    offset = 0,
    limit = 100
): Promise<ImportSpotifyPlaylistResponse> => {
    const callable = httpsCallable<{ playlistId: string; offset?: number; limit?: number }, ImportSpotifyPlaylistResponse>(
        functions,
        'importSpotifyPlaylist'
    );

    const result = await callable({ playlistId, offset, limit });
    return result.data;
};

/**
 * Downloads manual playlist tracks securely via the server-side Cloud Function proxy,
 * completely avoiding browser CORS policy violations.
 */
export const getManualPlaylistTracks = async (
    playlistId: string
): Promise<ManualTrack[]> => {
    const callable = httpsCallable<{ playlistId: string }, { tracks: ManualTrack[] }>(
        functions,
        'getManualPlaylistTracks'
    );

    const result = await callable({ playlistId });
    return result.data.tracks;
};
