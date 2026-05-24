import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';
import { ManualTrack } from './manualPlaylists';

interface ResolveSpotifyTracksResponse {
    tracks: ManualTrack[];
    errors: string[];
}

export const resolveSpotifyTracks = async (trackIds: string[]) => {
    const callable = httpsCallable<{ trackIds: string[] }, ResolveSpotifyTracksResponse>(
        functions,
        'resolveSpotifyTracks'
    );

    const result = await callable({ trackIds });
    return result.data;
};
