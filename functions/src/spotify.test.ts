import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapSpotifyTrack, normalizeTrackIds, searchSpotifyPlaylists } from './spotify';

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

describe('searchSpotifyPlaylists', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('maps public playlist search results and applies owner hint filtering', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                playlists: {
                    total: 2,
                    items: [
                        {
                            id: '1234567890123456789012',
                            name: 'Road Trip',
                            images: [{ url: 'https://image.example/cover.jpg' }],
                            tracks: { total: 42 },
                            owner: { display_name: 'Jamie' },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                        },
                        {
                            id: 'abcdefghijklmnopqrstuv',
                            name: 'Road Trip',
                            images: [],
                            tracks: { total: 12 },
                            owner: { display_name: 'Someone Else' },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                        }
                    ]
                }
            })
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jam', 'token-1');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('type=playlist'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } })
        );
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('limit=50'),
            expect.any(Object)
        );
        expect(result).toEqual({
            total: 2,
            playlists: [
                {
                    id: '1234567890123456789012',
                    name: 'Road Trip',
                    ownerName: 'Jamie',
                    trackCount: 42,
                    imageUrl: 'https://image.example/cover.jpg',
                    externalUrl: 'https://open.spotify.com/playlist/1234567890123456789012'
                }
            ]
        });
    });

    it('matches owner hints against Spotify owner usernames', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                playlists: {
                    total: 1,
                    items: [
                        {
                            id: '1234567890123456789012',
                            name: 'Road Trip',
                            images: [],
                            tracks: { total: 42 },
                            owner: { display_name: 'Jamie R.', id: 'jamie-playlists' },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                        }
                    ]
                }
            })
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jamie-playlists', 'token-1');

        expect(result.playlists).toEqual([
            expect.objectContaining({
                id: '1234567890123456789012',
                ownerName: 'Jamie R.'
            })
        ]);
    });

    it('falls back to a Spotify user playlist lookup when the query is a username', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        total: 0,
                        items: []
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    next: null,
                    items: [
                        {
                            id: '1234567890123456789012',
                            name: 'My Public Playlist',
                            images: [{ url: 'https://image.example/user-playlist.jpg' }],
                            tracks: { total: 15 },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                        }
                    ]
                })
            });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('jamie-playlists', '', 'token-1');

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('/v1/users/jamie-playlists/playlists'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } })
        );
        expect(result).toEqual({
            total: 1,
            playlists: [
                {
                    id: '1234567890123456789012',
                    name: 'My Public Playlist',
                    ownerName: 'jamie-playlists',
                    trackCount: 15,
                    imageUrl: 'https://image.example/user-playlist.jpg',
                    externalUrl: 'https://open.spotify.com/playlist/1234567890123456789012'
                }
            ]
        });
    });

    it('falls back to owner playlist lookup and filters by playlist name', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        total: 25,
                        items: [
                            {
                                id: 'abcdefghijklmnopqrstuv',
                                name: 'Road Trip',
                                images: [],
                                tracks: { total: 12 },
                                owner: { display_name: 'Someone Else', id: 'someone-else' },
                                external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                            }
                        ]
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    next: null,
                    items: [
                        {
                            id: '1234567890123456789012',
                            name: 'Road Trip Favorites',
                            images: [],
                            tracks: { total: 42 },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                        },
                        {
                            id: 'mnopqrstuvwxyzabcdefgh',
                            name: 'Workout',
                            images: [],
                            tracks: { total: 20 },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/mnopqrstuvwxyzabcdefgh' }
                        }
                    ]
                })
            });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jamie-playlists', 'token-1');

        expect(result.playlists).toEqual([
            expect.objectContaining({
                id: '1234567890123456789012',
                name: 'Road Trip Favorites',
                ownerName: 'jamie-playlists'
            })
        ]);
    });

    it('returns user playlist suggestions when owner lookup succeeds but the playlist name does not match', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        total: 0,
                        items: []
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    next: null,
                    items: [
                        {
                            id: '1234567890123456789012',
                            name: 'Chill Mix',
                            images: [],
                            tracks: { total: 18 },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                        },
                        {
                            id: 'abcdefghijklmnopqrstuv',
                            name: 'Workout',
                            images: [],
                            tracks: { total: 20 },
                            external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                        }
                    ]
                })
            });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jamie-playlists', 'token-1');

        expect(result.playlists).toEqual([
            expect.objectContaining({ name: 'Chill Mix', ownerName: 'jamie-playlists' }),
            expect.objectContaining({ name: 'Workout', ownerName: 'jamie-playlists' })
        ]);
    });

    it('falls back to display name search when Spotify username lookup does not find a user', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        total: 0,
                        items: []
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: vi.fn()
            })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    playlists: {
                        total: 2,
                        items: [
                            {
                                id: '1234567890123456789012',
                                name: 'Chill Mix',
                                images: [],
                                tracks: { total: 18 },
                                owner: { display_name: 'Jamie', id: 'actual-jamie-id' },
                                external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                            },
                            {
                                id: 'abcdefghijklmnopqrstuv',
                                name: 'Someone Else Mix',
                                images: [],
                                tracks: { total: 20 },
                                owner: { display_name: 'Someone Else', id: 'someone-else' },
                                external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                            }
                        ]
                    }
                })
            });
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'Jamie', 'token-1');

        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('q=jamie'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } })
        );
        expect(result.playlists).toEqual([
            expect.objectContaining({
                id: '1234567890123456789012',
                name: 'Chill Mix',
                ownerName: 'Jamie'
            })
        ]);
    });

    it('rejects very short searches', async () => {
        await expect(searchSpotifyPlaylists('a', '', 'token-1')).rejects.toThrow('at least 2');
    });
});
