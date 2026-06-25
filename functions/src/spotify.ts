export interface ResolvedSpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string }[];
    };
    externalUrl: string;
}

export interface SpotifyTrackApiResponse {
    id: string;
    name: string;
    artists: { name: string }[];
    album?: {
        name?: string;
        images?: { url: string }[];
    };
    external_urls?: {
        spotify?: string;
    };
}

export interface SpotifyUserPlaylist {
    id: string;
    name: string;
    trackCount: number;
    externalUrl: string;
    imageUrl?: string;
}

export interface SpotifyPlaylistSearchResult extends SpotifyUserPlaylist {
    ownerName: string;
    imageUrl: string;
}

const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TRACKS_URL = 'https://api.spotify.com/v1/tracks';
const SPOTIFY_PLAYLISTS_URL = 'https://api.spotify.com/v1/playlists';
const SPOTIFY_USERS_URL = 'https://api.spotify.com/v1/users';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

export const normalizeTrackIds = (input: unknown) => {
    if (!Array.isArray(input)) {
        throw new Error('trackIds must be an array.');
    }

    const trackIds: string[] = [];
    const seenTrackIds = new Set<string>();

    input.forEach((value) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!SPOTIFY_TRACK_ID_PATTERN.test(trimmed)) return;
        if (seenTrackIds.has(trimmed)) return;

        seenTrackIds.add(trimmed);
        trackIds.push(trimmed);
    });

    if (trackIds.length > 200) {
        throw new Error('A single import can resolve up to 200 Spotify track links.');
    }

    return trackIds;
};

export const mapSpotifyTrack = (track: SpotifyTrackApiResponse): ResolvedSpotifyTrack => ({
    id: track.id,
    name: track.name,
    artists: (track.artists || []).map((artist) => ({ name: artist.name })),
    album: {
        name: track.album?.name || '',
        images: track.album?.images || []
    },
    externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
});

export const getSpotifyAccessToken = async (clientId: string, clientSecret: string) => {
    if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
        return cachedAccessToken;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' })
    });

    if (!response.ok) {
        throw new Error(`Spotify token request failed with ${response.status}.`);
    }

    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
        throw new Error('Spotify token response did not include an access token.');
    }

    cachedAccessToken = data.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;
    return cachedAccessToken;
};

export const fetchSpotifyTracks = async (trackIds: string[], accessToken: string) => {
    const resolvedTracks: ResolvedSpotifyTrack[] = [];
    const errors: string[] = [];

    for (let offset = 0; offset < trackIds.length; offset += 50) {
        const batch = trackIds.slice(offset, offset + 50);
        const response = await fetch(`${SPOTIFY_TRACKS_URL}?ids=${batch.join(',')}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Spotify track lookup failed with ${response.status}.`);
        }

        const data = await response.json() as { tracks?: Array<SpotifyTrackApiResponse | null> };
        (data.tracks || []).forEach((track, index) => {
            if (!track) {
                errors.push(`Track ${batch[index]} could not be found on Spotify.`);
                return;
            }

            resolvedTracks.push(mapSpotifyTrack(track));
        });
    }

    return { tracks: resolvedTracks, errors };
};

export const fetchPlaylistName = async (playlistId: string, accessToken: string): Promise<string> => {
    const response = await fetch(`${SPOTIFY_PLAYLISTS_URL}/${playlistId}?fields=name`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify playlist lookup failed with ${response.status}.`);
    }

    const data = await response.json() as { name?: string };
    if (!data.name) {
        throw new Error('Spotify did not return a playlist name.');
    }

    return data.name;
};

export const extractSpotifyUserId = (profileUrl: string): string | null => {
    try {
        const url = new URL(profileUrl.trim());
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

const SPOTIFY_USER_ID_PATTERN = /^[A-Za-z0-9._-]{2,128}$/;

const extractSpotifyUserIdFromSearchInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const profileUserId = extractSpotifyUserId(trimmed);
    if (profileUserId) return profileUserId;

    return SPOTIFY_USER_ID_PATTERN.test(trimmed) ? trimmed : null;
};

interface SpotifyUserPlaylistsPage {
    items?: Array<{
        id?: string;
        name?: string;
        images?: { url?: string }[];
        tracks?: { total?: number };
        external_urls?: { spotify?: string };
    }>;
    next: string | null;
}

export const fetchUserPlaylists = async (
    profileUrl: string,
    accessToken: string
): Promise<{ userId: string; playlists: SpotifyUserPlaylist[] }> => {
    const userId = extractSpotifyUserId(profileUrl);
    if (!userId) {
        throw new Error('Enter a valid Spotify profile URL.');
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const playlists: SpotifyUserPlaylist[] = [];
    let nextUrl: string | null = `${SPOTIFY_USERS_URL}/${encodeURIComponent(userId)}/playlists?limit=50&fields=items(id,name,images(url),tracks(total),external_urls(spotify)),next`;

    while (nextUrl) {
        const response = await fetch(nextUrl, { headers });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('This Spotify user was not found.');
            }

            throw new Error(`Spotify returned an error (${response.status}). Please try again.`);
        }

        const data = await response.json() as SpotifyUserPlaylistsPage;
        for (const playlist of data.items || []) {
            if (!playlist.id || !playlist.name) continue;

            playlists.push({
                id: playlist.id,
                name: playlist.name,
                trackCount: playlist.tracks?.total || 0,
                imageUrl: playlist.images?.find(image => typeof image?.url === 'string' && image.url.trim())?.url || '',
                externalUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`
            });
        }

        nextUrl = data.next;
    }

    return { userId, playlists };
};

type SpotifyPlaylistSearchItem = {
    id?: string;
    name?: string;
    images?: { url?: string }[];
    tracks?: { total?: number };
    owner?: { display_name?: string; id?: string };
    external_urls?: { spotify?: string };
};

interface SpotifyPlaylistSearchPage {
    playlists?: {
        total?: number;
        items?: Array<SpotifyPlaylistSearchItem | null>;
    };
}

type SpotifyPlaylistSearchCandidate = SpotifyPlaylistSearchResult & {
    ownerSearchText: string;
};

const mapSpotifyPlaylistSearchItems = (
    items: Array<SpotifyPlaylistSearchItem | null> = []
): SpotifyPlaylistSearchCandidate[] => (
    items
        .filter((playlist): playlist is SpotifyPlaylistSearchItem & { id: string; name: string } => Boolean(playlist?.id && playlist?.name))
        .map((playlist) => {
            const ownerName = playlist.owner?.display_name || playlist.owner?.id || 'Spotify user';
            const ownerSearchText = [
                playlist.owner?.display_name,
                playlist.owner?.id
            ]
                .filter((value): value is string => Boolean(value))
                .join(' ')
                .toLowerCase();

            return {
                id: playlist.id,
                name: playlist.name,
                ownerName,
                ownerSearchText,
                trackCount: playlist.tracks?.total || 0,
                imageUrl: playlist.images?.find(image => typeof image?.url === 'string' && image.url.trim())?.url || '',
                externalUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`
            };
        })
);

const stripOwnerSearchText = ({ ownerSearchText, ...playlist }: SpotifyPlaylistSearchCandidate): SpotifyPlaylistSearchResult => playlist;

const mapUserPlaylistSearchResults = (
    playlists: SpotifyUserPlaylist[],
    ownerName: string
): SpotifyPlaylistSearchResult[] => playlists.map((playlist): SpotifyPlaylistSearchResult => ({
    id: playlist.id,
    name: playlist.name,
    ownerName,
    trackCount: playlist.trackCount,
    imageUrl: playlist.imageUrl || '',
    externalUrl: playlist.externalUrl
}));

const searchSpotifyPlaylistCandidates = async (
    query: string,
    accessToken: string
): Promise<{ playlists: SpotifyPlaylistSearchCandidate[]; total: number }> => {
    const params = new URLSearchParams({
        q: query,
        type: 'playlist',
        limit: '50'
    });
    const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify playlist search failed with ${response.status}.`);
    }

    const data = await response.json() as SpotifyPlaylistSearchPage;
    return {
        playlists: mapSpotifyPlaylistSearchItems(data.playlists?.items),
        total: data.playlists?.total || 0
    };
};

export const searchSpotifyPlaylists = async (
    query: string,
    ownerHint: string,
    accessToken: string
): Promise<{ playlists: SpotifyPlaylistSearchResult[]; total: number }> => {
    const trimmedQuery = query.trim();
    const trimmedOwnerHint = ownerHint.trim().toLowerCase();
    if (trimmedQuery.length < 2) {
        throw new Error('Search for at least 2 characters.');
    }

    const searchResult = await searchSpotifyPlaylistCandidates(trimmedQuery, accessToken);
    const playlists = searchResult.playlists
        .filter(playlist => !trimmedOwnerHint || playlist.ownerSearchText.includes(trimmedOwnerHint))
        .map(stripOwnerSearchText);

    if (playlists.length > 0) {
        return {
            playlists,
            total: searchResult.total || playlists.length
        };
    }

    const userId = extractSpotifyUserIdFromSearchInput(ownerHint || query);
    if (userId) {
        try {
            const userPlaylists = await fetchUserPlaylists(`https://open.spotify.com/user/${encodeURIComponent(userId)}`, accessToken);
            const playlistNameFilter = ownerHint ? trimmedQuery.toLowerCase() : '';
            const userPlaylistResults = userPlaylists.playlists
                .filter(playlist => !playlistNameFilter || playlist.name.toLowerCase().includes(playlistNameFilter))
                .slice(0, 50);

            if (userPlaylistResults.length > 0 || !playlistNameFilter) {
                return {
                    playlists: mapUserPlaylistSearchResults(userPlaylistResults, userPlaylists.userId),
                    total: userPlaylistResults.length
                };
            }

            const userPlaylistSuggestions = userPlaylists.playlists
                .slice(0, 50);

            return {
                playlists: mapUserPlaylistSearchResults(userPlaylistSuggestions, userPlaylists.userId),
                total: userPlaylistSuggestions.length
            };
        } catch (error: any) {
            if (!error.message?.includes('not found')) {
                throw error;
            }
        }
    }

    if (trimmedOwnerHint.length >= 2) {
        const ownerDisplayNameSearch = await searchSpotifyPlaylistCandidates(trimmedOwnerHint, accessToken);
        const ownerDisplayNameMatches = ownerDisplayNameSearch.playlists
            .filter(playlist => playlist.ownerSearchText.includes(trimmedOwnerHint));
        const playlistNameMatches = ownerDisplayNameMatches
            .filter(playlist => playlist.name.toLowerCase().includes(trimmedQuery))
            .map(stripOwnerSearchText);

        if (playlistNameMatches.length > 0) {
            return {
                playlists: playlistNameMatches,
                total: playlistNameMatches.length
            };
        }

        const ownerDisplayNameSuggestions = ownerDisplayNameMatches
            .slice(0, 50)
            .map(stripOwnerSearchText);
        if (ownerDisplayNameSuggestions.length > 0) {
            return {
                playlists: ownerDisplayNameSuggestions,
                total: ownerDisplayNameSuggestions.length
            };
        }
    }

    return {
        playlists,
        total: searchResult.total || playlists.length
    };
};

interface SpotifyPlaylistTracksPage {
    items?: Array<{ track: SpotifyTrackApiResponse | null }>;
    next: string | null;
    total: number;
}
const PLAYLIST_TRACKS_FIELDS = 'items(track(id,name,artists(name),album(name,images(url)),external_urls(spotify))),next,total';

export const fetchPlaylistTracks = async (
    playlistId: string,
    accessToken: string,
    offset = 0,
    limit = 100
): Promise<{ name: string; tracks: ResolvedSpotifyTrack[]; total: number; errors: string[] }> => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const tracks: ResolvedSpotifyTrack[] = [];
    const errors: string[] = [];

    if (offset === 0) {
        // Fetch playlist name and the first page of tracks
        const url = `${SPOTIFY_PLAYLISTS_URL}/${playlistId}?fields=name,tracks(${PLAYLIST_TRACKS_FIELDS})`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('This playlist was not found. It may be private -- make it public on Spotify, then try again.');
            }
            if (response.status === 403) {
                throw new Error('This playlist is private. Make it public on Spotify, then try again.');
            }
            throw new Error(`Spotify returned an error (${response.status}). Please try again.`);
        }

        const data = await response.json() as {
            name?: string;
            tracks?: SpotifyPlaylistTracksPage;
        };

        const playlistName = data.name || 'Untitled Playlist';
        const total = data.tracks?.total || 0;

        for (const item of data.tracks?.items || []) {
            if (!item.track) continue;
            tracks.push(mapSpotifyTrack(item.track));
        }

        return { name: playlistName, tracks, total, errors };
    } else {
        // Fetch a specific page of tracks
        const url = `${SPOTIFY_PLAYLISTS_URL}/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=${PLAYLIST_TRACKS_FIELDS}`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Spotify returned an error (${response.status}) for offset ${offset}.`);
        }

        const data = await response.json() as SpotifyPlaylistTracksPage;
        const total = data.total || 0;

        for (const item of data.items || []) {
            if (!item.track) continue;
            tracks.push(mapSpotifyTrack(item.track));
        }

        return { name: '', tracks, total, errors };
    }
};
