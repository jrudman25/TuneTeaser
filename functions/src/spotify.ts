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

export class SpotifyRequestError extends Error {
    constructor(
        message: string,
        public code: 'invalid-argument' | 'not-found' | 'permission-denied' | 'resource-exhausted' | 'unavailable' | 'internal'
    ) {
        super(message);
    }
}

const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TRACKS_URL = 'https://api.spotify.com/v1/tracks';
const SPOTIFY_PLAYLISTS_URL = 'https://api.spotify.com/v1/playlists';
const SPOTIFY_USERS_URL = 'https://api.spotify.com/v1/users';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_FETCH_TIMEOUT_MS = 10_000;
const SPOTIFY_TRACK_LOOKUP_CONCURRENCY = 5;
const SPOTIFY_PLAYLIST_PAGE_LIMIT_MAX = 50;
const SPOTIFY_SEARCH_PAGE_LIMIT = 10;
const SPOTIFY_SEARCH_MAX_PAGES = 5;
const SPOTIFY_RATE_LIMIT_MESSAGE = 'Spotify is rate limiting requests. Try again in a minute.';

const spotifyFetch = async (url: string, init: RequestInit = {}) => {
    const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(SPOTIFY_FETCH_TIMEOUT_MS)
    });
    if (response.status === 429) {
        throw new SpotifyRequestError(SPOTIFY_RATE_LIMIT_MESSAGE, 'resource-exhausted');
    }
    return response;
};

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

    if (trackIds.length > 50) {
        throw new Error('A single import can resolve up to 50 Spotify track links.');
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
    const response = await spotifyFetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' })
    });

    if (!response.ok) {
        throw new SpotifyRequestError(`Spotify token request failed with ${response.status}.`, 'internal');
    }

    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
        throw new SpotifyRequestError('Spotify token response did not include an access token.', 'internal');
    }

    cachedAccessToken = data.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;
    return cachedAccessToken;
};

export const fetchSpotifyTracks = async (trackIds: string[], accessToken: string) => {
    const resolvedByIndex: Array<ResolvedSpotifyTrack | null> = new Array(trackIds.length).fill(null);
    const headers = { Authorization: `Bearer ${accessToken}` };

    for (let offset = 0; offset < trackIds.length; offset += SPOTIFY_TRACK_LOOKUP_CONCURRENCY) {
        const batch = trackIds.slice(offset, offset + SPOTIFY_TRACK_LOOKUP_CONCURRENCY);
        await Promise.all(batch.map(async (trackId, index) => {
            const response = await spotifyFetch(`${SPOTIFY_TRACKS_URL}/${trackId}`, { headers });

            if (response.status === 404) {
                return;
            }
            if (!response.ok) {
                throw new SpotifyRequestError(`Spotify track lookup failed with ${response.status}.`, 'internal');
            }

            const track = await response.json() as SpotifyTrackApiResponse | null;
            if (track && track.id) {
                resolvedByIndex[offset + index] = mapSpotifyTrack(track);
            }
        }));
    }

    const resolvedTracks: ResolvedSpotifyTrack[] = [];
    const errors: string[] = [];
    trackIds.forEach((trackId, index) => {
        const track = resolvedByIndex[index];
        if (track) {
            resolvedTracks.push(track);
        } else {
            errors.push(`Track ${trackId} could not be found on Spotify.`);
        }
    });

    return { tracks: resolvedTracks, errors };
};

export const fetchPlaylistName = async (playlistId: string, accessToken: string): Promise<string> => {
    const response = await spotifyFetch(`${SPOTIFY_PLAYLISTS_URL}/${playlistId}?fields=name`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new SpotifyRequestError(`Spotify playlist lookup failed with ${response.status}.`, 'internal');
    }

    const data = await response.json() as { name?: string };
    if (!data.name) {
        throw new SpotifyRequestError('Spotify did not return a playlist name.', 'internal');
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

const SPOTIFY_PROFILE_UNAVAILABLE_MESSAGE = 'This Spotify profile could not be loaded. Spotify no longer shares other users\' playlists with apps like TuneTeaser, so paste playlist links or build a custom playlist instead.';

interface SpotifyPlaylistCounts {
    items?: { total?: number };
    tracks?: { total?: number };
}

const getPlaylistTrackCount = (playlist: SpotifyPlaylistCounts) => {
    return playlist.items?.total ?? playlist.tracks?.total ?? 0;
};

interface SpotifyUserPlaylistsPage {
    items?: Array<{
        id?: string;
        name?: string;
        images?: { url?: string }[];
        items?: { total?: number };
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
        throw new SpotifyRequestError('Enter a valid Spotify profile URL.', 'invalid-argument');
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const playlists: SpotifyUserPlaylist[] = [];
    let nextUrl: string | null = `${SPOTIFY_USERS_URL}/${encodeURIComponent(userId)}/playlists?limit=50`;

    while (nextUrl) {
        const response = await spotifyFetch(nextUrl, { headers });

        if (!response.ok) {
            if (response.status === 404) {
                throw new SpotifyRequestError(SPOTIFY_PROFILE_UNAVAILABLE_MESSAGE, 'not-found');
            }
            if (response.status === 403 || response.status === 410) {
                throw new SpotifyRequestError(SPOTIFY_PROFILE_UNAVAILABLE_MESSAGE, 'permission-denied');
            }

            throw new SpotifyRequestError(`Spotify returned an error (${response.status}). Please try again.`, 'internal');
        }

        const data = await response.json() as SpotifyUserPlaylistsPage;
        for (const playlist of data.items || []) {
            if (!playlist.id || !playlist.name) continue;

            playlists.push({
                id: playlist.id,
                name: playlist.name,
                trackCount: getPlaylistTrackCount(playlist),
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
    items?: { total?: number };
    tracks?: { total?: number };
    owner?: { display_name?: string; id?: string };
    external_urls?: { spotify?: string };
};

interface SpotifyPlaylistSearchPage {
    playlists?: {
        total?: number;
        next?: string | null;
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
                trackCount: getPlaylistTrackCount(playlist),
                imageUrl: playlist.images?.find(image => typeof image?.url === 'string' && image.url.trim())?.url || '',
                externalUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`
            };
        })
);

const stripOwnerSearchText = (playlist: SpotifyPlaylistSearchCandidate): SpotifyPlaylistSearchResult => ({
    id: playlist.id,
    name: playlist.name,
    ownerName: playlist.ownerName,
    trackCount: playlist.trackCount,
    imageUrl: playlist.imageUrl,
    externalUrl: playlist.externalUrl
});

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
    const playlists: SpotifyPlaylistSearchCandidate[] = [];
    let total = 0;

    for (let page = 0; page < SPOTIFY_SEARCH_MAX_PAGES; page++) {
        const params = new URLSearchParams({
            q: query,
            type: 'playlist',
            limit: String(SPOTIFY_SEARCH_PAGE_LIMIT),
            offset: String(page * SPOTIFY_SEARCH_PAGE_LIMIT)
        });
        const response = await spotifyFetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new SpotifyRequestError(`Spotify playlist search failed with ${response.status}.`, 'internal');
        }

        const data = await response.json() as SpotifyPlaylistSearchPage;
        if (page === 0) {
            total = data.playlists?.total || 0;
        }

        const items = data.playlists?.items || [];
        playlists.push(...mapSpotifyPlaylistSearchItems(items));

        if (items.length < SPOTIFY_SEARCH_PAGE_LIMIT || !data.playlists?.next) {
            break;
        }
    }

    return { playlists, total };
};

export const searchSpotifyPlaylists = async (
    query: string,
    ownerHint: string,
    accessToken: string
): Promise<{ playlists: SpotifyPlaylistSearchResult[]; total: number }> => {
    const trimmedQuery = query.trim();
    const trimmedOwnerHint = ownerHint.trim().toLowerCase();
    if (trimmedQuery.length < 2) {
        throw new SpotifyRequestError('Search for at least 2 characters.', 'invalid-argument');
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
            if (!(error instanceof SpotifyRequestError) || error.code !== 'not-found') {
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

interface SpotifyPlaylistItemsPage {
    items?: Array<{
        item?: (SpotifyTrackApiResponse & { is_local?: boolean; type?: string }) | null;
        track?: (SpotifyTrackApiResponse & { is_local?: boolean; type?: string }) | null;
    } | null>;
    next: string | null;
    total: number;
}

const SPOTIFY_PLAYLIST_OWNER_ONLY_MESSAGE = 'Spotify no longer lets TuneTeaser read the tracks in this playlist. Add its tracks as "Song - Artist" lines with Build Custom Playlist instead.';
const SPOTIFY_PLAYLIST_NOT_FOUND_MESSAGE = 'This playlist was not found. It may be private or deleted.';

const throwForPlaylistStatus = (status: number, context: string): never => {
    if (status === 403) {
        throw new SpotifyRequestError(SPOTIFY_PLAYLIST_OWNER_ONLY_MESSAGE, 'permission-denied');
    }
    if (status === 404) {
        throw new SpotifyRequestError(SPOTIFY_PLAYLIST_NOT_FOUND_MESSAGE, 'not-found');
    }
    throw new SpotifyRequestError(`Spotify returned an error (${status})${context}.`, 'internal');
};

const mapPlaylistItemsPage = (data: SpotifyPlaylistItemsPage, tracks: ResolvedSpotifyTrack[]) => {
    for (const entry of data.items || []) {
        const item = entry?.item ?? entry?.track;
        if (!item || item.is_local) continue;
        if (typeof item.type === 'string' && item.type !== 'track') continue;
        tracks.push(mapSpotifyTrack(item));
    }
    return typeof data.total === 'number' ? data.total : 0;
};

export const fetchPlaylistTracks = async (
    playlistId: string,
    accessToken: string,
    offset = 0,
    limit = 100
): Promise<{ name: string; ownerName: string; tracks: ResolvedSpotifyTrack[]; total: number; errors: string[] }> => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const pageLimit = Math.min(Math.max(1, limit), SPOTIFY_PLAYLIST_PAGE_LIMIT_MAX);
    const tracks: ResolvedSpotifyTrack[] = [];
    const errors: string[] = [];

    let name = '';
    let ownerName = '';
    if (offset === 0) {
        const metadataResponse = await spotifyFetch(`${SPOTIFY_PLAYLISTS_URL}/${playlistId}?fields=name,owner(display_name,id)`, { headers });
        if (!metadataResponse.ok) {
            throwForPlaylistStatus(metadataResponse.status, '');
        }
        const metadata = await metadataResponse.json() as {
            name?: string;
            owner?: { display_name?: string; id?: string };
        };
        name = metadata.name || 'Untitled Playlist';
        ownerName = metadata.owner?.display_name || metadata.owner?.id || '';
    }

    const itemsResponse = await spotifyFetch(`${SPOTIFY_PLAYLISTS_URL}/${playlistId}/items?offset=${offset}&limit=${pageLimit}`, { headers });
    if (!itemsResponse.ok) {
        throwForPlaylistStatus(itemsResponse.status, ` for offset ${offset}`);
    }

    const data = await itemsResponse.json() as SpotifyPlaylistItemsPage;
    const total = mapPlaylistItemsPage(data, tracks);

    return { name, ownerName, tracks, total, errors };
};
