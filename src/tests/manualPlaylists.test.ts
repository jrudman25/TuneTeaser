import { describe, expect, it } from 'vitest';
import {
    extractSpotifyTrackId,
    manualTracksToGameItems,
    parsePlaylistLines,
    parseTrackImportInput
} from '../utils/manualPlaylists';

describe('parsePlaylistLines', () => {
    it('parses Song - Artist lines', () => {
        const result = parsePlaylistLines('Paranoid Android - Radiohead');

        expect(result.errors).toEqual([]);
        expect(result.tracks).toEqual([
            {
                id: 'manual-1-paranoid-android-radiohead',
                name: 'Paranoid Android',
                artists: [{ name: 'Radiohead' }],
                album: {
                    name: '',
                    images: []
                }
            }
        ]);
    });

    it('ignores blank lines', () => {
        const result = parsePlaylistLines('\nSong One - Artist One\n\nSong Two - Artist Two\n');

        expect(result.errors).toEqual([]);
        expect(result.tracks).toHaveLength(2);
        expect(result.tracks[1].id).toBe('manual-2-song-two-artist-two');
    });

    it('rejects lines missing the required separator', () => {
        const result = parsePlaylistLines('Song One by Artist One');

        expect(result.tracks).toEqual([]);
        expect(result.errors).toEqual(['Line 1: use "Song - Artist".']);
    });

    it('wraps tracks in the game item shape', () => {
        const result = parsePlaylistLines('Song One - Artist One');

        expect(manualTracksToGameItems(result.tracks)).toEqual([
            {
                track: result.tracks[0],
                is_local: false
            }
        ]);
    });
});

describe('Spotify track import parsing', () => {
    it('extracts Spotify track IDs from URLs and URIs', () => {
        expect(extractSpotifyTrackId('https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk?si=test')).toBe('76GlO5H5RT6g7y0gev86Nk');
        expect(extractSpotifyTrackId('spotify:track:4PTG3Z6ehGkBFwjybzWkR8')).toBe('4PTG3Z6ehGkBFwjybzWkR8');
    });

    it('rejects playlist URLs in the track input', () => {
        const result = parseTrackImportInput('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

        expect(result.spotifyTrackIds).toEqual([]);
        expect(result.errors).toEqual(['Line 1: paste track links, not playlist/album/artist links.']);
    });

    it('deduplicates Spotify track IDs while preserving order', () => {
        const result = parseTrackImportInput([
            'https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk',
            'spotify:track:4PTG3Z6ehGkBFwjybzWkR8',
            'https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk'
        ].join('\n'));

        expect(result.spotifyTrackIds).toEqual([
            '76GlO5H5RT6g7y0gev86Nk',
            '4PTG3Z6ehGkBFwjybzWkR8'
        ]);
        expect(result.duplicateCount).toBe(1);
    });

    it('supports mixed Spotify links and manual Song - Artist lines', () => {
        const result = parseTrackImportInput([
            'https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk',
            'Manual Song - Manual Artist'
        ].join('\n'));

        expect(result.spotifyTrackIds).toEqual(['76GlO5H5RT6g7y0gev86Nk']);
        expect(result.manualTracks[0].name).toBe('Manual Song');
        expect(result.manualTracks[0].artists[0].name).toBe('Manual Artist');
    });
});
