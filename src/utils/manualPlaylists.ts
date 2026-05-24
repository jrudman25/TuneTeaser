export interface ManualTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string }[];
    };
    externalUrl?: string;
}

export interface ManualPlaylist {
    id: string;
    name: string;
    sourceUrl: string;
    sourceType: 'spotify-url';
    tracks: ManualTrack[];
    createdAt?: any;
    updatedAt?: any;
}

export interface ParsedPlaylistLines {
    tracks: ManualTrack[];
    errors: string[];
}

export interface ParsedTrackImport {
    manualTracks: ManualTrack[];
    spotifyTrackIds: string[];
    errors: string[];
    duplicateCount: number;
}

const makeTrackId = (name: string, artist: string, index: number) => {
    const slug = `${name}-${artist}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return `manual-${index + 1}-${slug || 'track'}`;
};

const SPOTIFY_TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

export const extractSpotifyTrackId = (value: string) => {
    const trimmed = value.trim();
    const uriMatch = trimmed.match(/^spotify:track:([A-Za-z0-9]{22})$/);
    if (uriMatch) return uriMatch[1];

    try {
        const url = new URL(trimmed);
        if (!url.hostname.endsWith('spotify.com')) return null;

        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'track' && pathParts[1] && SPOTIFY_TRACK_ID_PATTERN.test(pathParts[1])) {
            return pathParts[1];
        }
    } catch {
        return null;
    }

    return null;
};

export const isSpotifyNonTrackUrl = (value: string) => {
    try {
        const url = new URL(value.trim());
        if (!url.hostname.endsWith('spotify.com')) return false;

        const [resourceType] = url.pathname.split('/').filter(Boolean);
        return ['playlist', 'album', 'artist', 'show', 'episode'].includes(resourceType || '');
    } catch {
        return false;
    }
};

const parseManualTrackLine = (line: string, lineIndex: number, trackIndex: number) => {
    const separator = ' - ';
    const separatorIndex = line.indexOf(separator);

    if (separatorIndex === -1) {
        return {
            track: null,
            error: `Line ${lineIndex + 1}: use a Spotify track URL or "Song - Artist".`
        };
    }

    const name = line.slice(0, separatorIndex).trim();
    const artist = line.slice(separatorIndex + separator.length).trim();

    if (!name || !artist) {
        return {
            track: null,
            error: `Line ${lineIndex + 1}: song and artist are required.`
        };
    }

    return {
        track: {
            id: makeTrackId(name, artist, trackIndex),
            name,
            artists: [{ name: artist }],
            album: {
                name: '',
                images: []
            }
        },
        error: null
    };
};

export const parsePlaylistLines = (rawLines: string): ParsedPlaylistLines => {
    const tracks: ManualTrack[] = [];
    const errors: string[] = [];

    rawLines.split(/\r?\n/).forEach((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const parsed = parseManualTrackLine(trimmed, lineIndex, tracks.length);
        if (parsed.error || !parsed.track) {
            errors.push(`Line ${lineIndex + 1}: use "Song - Artist".`);
            return;
        }

        tracks.push(parsed.track);
    });

    return { tracks, errors };
};

export const parseTrackImportInput = (rawLines: string): ParsedTrackImport => {
    const manualTracks: ManualTrack[] = [];
    const spotifyTrackIds: string[] = [];
    const errors: string[] = [];
    const seenSpotifyIds = new Set<string>();
    let duplicateCount = 0;

    rawLines.split(/\r?\n/).forEach((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const spotifyTrackId = extractSpotifyTrackId(trimmed);
        if (spotifyTrackId) {
            if (seenSpotifyIds.has(spotifyTrackId)) {
                duplicateCount += 1;
                return;
            }

            seenSpotifyIds.add(spotifyTrackId);
            spotifyTrackIds.push(spotifyTrackId);
            return;
        }

        if (isSpotifyNonTrackUrl(trimmed)) {
            errors.push(`Line ${lineIndex + 1}: paste track links, not playlist/album/artist links.`);
            return;
        }

        const parsed = parseManualTrackLine(trimmed, lineIndex, manualTracks.length);
        if (parsed.error || !parsed.track) {
            errors.push(parsed.error || `Line ${lineIndex + 1}: could not read this track.`);
            return;
        }

        manualTracks.push(parsed.track);
    });

    if (spotifyTrackIds.length > 200) {
        errors.push('A single import can resolve up to 200 Spotify track links.');
    }

    return { manualTracks, spotifyTrackIds, errors, duplicateCount };
};

export const manualTracksToGameItems = (tracks: ManualTrack[]) => {
    return tracks.map(track => ({
        track,
        is_local: false
    }));
};
