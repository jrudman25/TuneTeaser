import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';

export interface SpotifyUserPlaylist {
    id: string;
    name: string;
    trackCount: number;
    externalUrl: string;
}

interface GetUserPlaylistsResponse {
    userId: string;
    playlists: SpotifyUserPlaylist[];
}

export const extractSpotifyUserId = (value: string): string | null => {
    try {
        const url = new URL(value.trim());
        if (!url.hostname.endsWith('spotify.com')) return null;

        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] !== 'user' || !pathParts[1]) return null;

        const userId = decodeURIComponent(pathParts[1]).trim();
        if (!userId || userId.includes('/') || userId.length > 128) return null;

        return userId;
    } catch {
        return null;
    }
};

export const fetchSpotifyUserPlaylists = async (profileUrl: string): Promise<GetUserPlaylistsResponse> => {
    const callable = httpsCallable<{ profileUrl: string }, GetUserPlaylistsResponse>(
        functions,
        'getUserPlaylists'
    );

    const result = await callable({ profileUrl });
    return result.data;
};
