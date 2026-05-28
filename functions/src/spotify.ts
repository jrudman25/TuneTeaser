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
}

const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TRACKS_URL = 'https://api.spotify.com/v1/tracks';
const SPOTIFY_PLAYLISTS_URL = 'https://api.spotify.com/v1/playlists';
const SPOTIFY_USERS_URL = 'https://api.spotify.com/v1/users';

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

interface SpotifyUserPlaylistsPage {
    items?: Array<{
        id?: string;
        name?: string;
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
    let nextUrl: string | null = `${SPOTIFY_USERS_URL}/${encodeURIComponent(userId)}/playlists?limit=50&fields=items(id,name,tracks(total),external_urls(spotify)),next`;

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
                externalUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`
            });
        }

        nextUrl = data.next;
    }

    return { userId, playlists };
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
