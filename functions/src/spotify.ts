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

const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TRACKS_URL = 'https://api.spotify.com/v1/tracks';
const SPOTIFY_PLAYLISTS_URL = 'https://api.spotify.com/v1/playlists';

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

interface SpotifyPlaylistTracksPage {
    items?: Array<{ track: SpotifyTrackApiResponse | null }>;
    next: string | null;
    total: number;
}

const MAX_PLAYLIST_TRACKS = 200;
const PLAYLIST_TRACKS_FIELDS = 'items(track(id,name,artists(name),album(name,images(url)),external_urls(spotify))),next,total';

export const fetchPlaylistTracks = async (
    playlistId: string,
    accessToken: string
): Promise<{ name: string; tracks: ResolvedSpotifyTrack[]; errors: string[] }> => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const tracks: ResolvedSpotifyTrack[] = [];
    const errors: string[] = [];

    // First request includes playlist name
    const firstUrl = `${SPOTIFY_PLAYLISTS_URL}/${playlistId}?fields=name,tracks(${PLAYLIST_TRACKS_FIELDS})`;
    const firstResponse = await fetch(firstUrl, { headers });

    if (!firstResponse.ok) {
        if (firstResponse.status === 404) {
            throw new Error('This playlist was not found. It may be private -- make it public on Spotify, then try again.');
        }
        if (firstResponse.status === 403) {
            throw new Error('This playlist is private. Make it public on Spotify, then try again.');
        }
        throw new Error(`Spotify returned an error (${firstResponse.status}). Please try again.`);
    }

    const firstData = await firstResponse.json() as {
        name?: string;
        tracks?: SpotifyPlaylistTracksPage;
    };

    const playlistName = firstData.name || '';
    const totalTracks = firstData.tracks?.total || 0;

    if (totalTracks > MAX_PLAYLIST_TRACKS) {
        errors.push(`This playlist has ${totalTracks} tracks. Only the first ${MAX_PLAYLIST_TRACKS} will be imported.`);
    }

    // Process first page
    for (const item of firstData.tracks?.items || []) {
        if (!item.track) continue;
        tracks.push(mapSpotifyTrack(item.track));
        if (tracks.length >= MAX_PLAYLIST_TRACKS) break;
    }

    // Paginate through remaining tracks
    let nextUrl = firstData.tracks?.next || null;
    while (nextUrl && tracks.length < MAX_PLAYLIST_TRACKS) {
        const pageResponse = await fetch(nextUrl, { headers });
        if (!pageResponse.ok) break;

        const pageData = await pageResponse.json() as SpotifyPlaylistTracksPage;
        for (const item of pageData.items || []) {
            if (!item.track) continue;
            tracks.push(mapSpotifyTrack(item.track));
            if (tracks.length >= MAX_PLAYLIST_TRACKS) break;
        }

        nextUrl = pageData.next;
    }

    return { name: playlistName, tracks, errors };
};
