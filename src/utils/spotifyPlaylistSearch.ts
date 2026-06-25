import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';

export interface SpotifyPlaylistSearchResult {
    id: string;
    name: string;
    ownerName: string;
    trackCount: number;
    imageUrl: string;
    externalUrl: string;
}

interface SearchPublicPlaylistsResponse {
    playlists: SpotifyPlaylistSearchResult[];
    total: number;
}

export const searchPublicSpotifyPlaylists = async (
    query: string,
    ownerHint = ''
): Promise<SearchPublicPlaylistsResponse> => {
    const callable = httpsCallable<
        { query: string; ownerHint: string },
        SearchPublicPlaylistsResponse
    >(
        functions,
        'searchPublicPlaylists'
    );

    const result = await callable({ query, ownerHint });
    return result.data;
};
