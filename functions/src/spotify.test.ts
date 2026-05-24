import { describe, expect, it } from 'vitest';
import { mapSpotifyTrack, normalizeTrackIds } from './spotify';

describe('normalizeTrackIds', () => {
    it('deduplicates ids while preserving order', () => {
        expect(normalizeTrackIds([
            '76GlO5H5RT6g7y0gev86Nk',
            '4PTG3Z6ehGkBFwjybzWkR8',
            '76GlO5H5RT6g7y0gev86Nk'
        ])).toEqual([
            '76GlO5H5RT6g7y0gev86Nk',
            '4PTG3Z6ehGkBFwjybzWkR8'
        ]);
    });

    it('ignores invalid values', () => {
        expect(normalizeTrackIds([
            'https://open.spotify.com/playlist/not-a-track',
            null,
            'too-short',
            '76GlO5H5RT6g7y0gev86Nk'
        ])).toEqual(['76GlO5H5RT6g7y0gev86Nk']);
    });

    it('rejects imports over 200 ids', () => {
        const ids = Array.from({ length: 201 }, (_, index) => `${index.toString().padStart(22, '0')}`);

        expect(() => normalizeTrackIds(ids)).toThrow('up to 200');
    });
});

describe('mapSpotifyTrack', () => {
    it('maps Spotify track metadata into ManualTrack shape', () => {
        expect(mapSpotifyTrack({
            id: '76GlO5H5RT6g7y0gev86Nk',
            name: 'Track Name',
            artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
            album: {
                name: 'Album Name',
                images: [{ url: 'https://image.example/cover.jpg' }]
            },
            external_urls: {
                spotify: 'https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk'
            }
        })).toEqual({
            id: '76GlO5H5RT6g7y0gev86Nk',
            name: 'Track Name',
            artists: [{ name: 'Artist One' }, { name: 'Artist Two' }],
            album: {
                name: 'Album Name',
                images: [{ url: 'https://image.example/cover.jpg' }]
            },
            externalUrl: 'https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk'
        });
    });
});
