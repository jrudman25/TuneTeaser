export interface ManualTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string }[];
    };
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

const makeTrackId = (name: string, artist: string, index: number) => {
    const slug = `${name}-${artist}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return `manual-${index + 1}-${slug || 'track'}`;
};

export const parsePlaylistLines = (rawLines: string): ParsedPlaylistLines => {
    const tracks: ManualTrack[] = [];
    const errors: string[] = [];

    rawLines.split(/\r?\n/).forEach((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const separator = ' - ';
        const separatorIndex = trimmed.indexOf(separator);

        if (separatorIndex === -1) {
            errors.push(`Line ${lineIndex + 1}: use "Song - Artist".`);
            return;
        }

        const name = trimmed.slice(0, separatorIndex).trim();
        const artist = trimmed.slice(separatorIndex + separator.length).trim();

        if (!name || !artist) {
            errors.push(`Line ${lineIndex + 1}: song and artist are required.`);
            return;
        }

        tracks.push({
            id: makeTrackId(name, artist, tracks.length),
            name,
            artists: [{ name: artist }],
            album: {
                name: '',
                images: []
            }
        });
    });

    return { tracks, errors };
};

export const manualTracksToGameItems = (tracks: ManualTrack[]) => {
    return tracks.map(track => ({
        track,
        is_local: false
    }));
};
