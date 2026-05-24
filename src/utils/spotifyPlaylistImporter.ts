import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';
import { ManualTrack } from './manualPlaylists';

interface ImportSpotifyPlaylistResponse {
    name: string;
    tracks: ManualTrack[];
    errors: string[];
}

/**
 * Imports a full Spotify playlist (name + tracks) via the backend.
 * Accepts a Spotify playlist ID (22-char alphanumeric string).
 */
export const importSpotifyPlaylist = async (playlistId: string): Promise<ImportSpotifyPlaylistResponse> => {
    const callable = httpsCallable<{ playlistId: string }, ImportSpotifyPlaylistResponse>(
        functions,
        'importSpotifyPlaylist'
    );

    const result = await callable({ playlistId });
    return result.data;
};
