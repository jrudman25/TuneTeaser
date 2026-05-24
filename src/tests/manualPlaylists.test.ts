import { describe, expect, it } from 'vitest';
import { manualTracksToGameItems, parsePlaylistLines } from '../utils/manualPlaylists';

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
