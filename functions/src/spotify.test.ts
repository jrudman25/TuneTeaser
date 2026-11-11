import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    fetchPlaylistTracks,
    fetchSpotifyTracks,
    fetchUserPlaylists,
    mapSpotifyTrack,
    normalizeTrackIds,
    searchSpotifyPlaylists,
    SpotifyRequestError
} from './spotify';

const okJsonResponse = (body: any) => ({
    ok: true,
    json: vi.fn().mockResolvedValue(body)
});

const abortSignalExpectation = expect.objectContaining({ signal: expect.any(AbortSignal) });

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

    it('rejects imports over 50 ids', () => {
        const ids = Array.from({ length: 51 }, (_, index) => `${index.toString().padStart(22, '0')}`);

        expect(() => normalizeTrackIds(ids)).toThrow('up to 50');
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

describe('fetchSpotifyTracks', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const makeTrack = (id: string) => ({
        id,
        name: `Song ${id}`,
        artists: [{ name: 'Artist' }],
        album: { name: 'Album', images: [] }
    });

    it('resolves each track id with an individual request and preserves input order', async () => {
        const ids = ['aaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccccc'];
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            const id = url.split('/').pop() as string;
            return Promise.resolve(okJsonResponse(makeTrack(id)));
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchSpotifyTracks(ids, 'token-1');

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://api.spotify.com/v1/tracks/aaaaaaaaaaaaaaaaaaaaaa',
            abortSignalExpectation
        );
        expect(result.tracks.map(track => track.id)).toEqual(ids);
        expect(result.errors).toEqual([]);
    });

    it('reports not-found tracks without dropping the rest', async () => {
        const ids = ['aaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccccc'];
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            const id = url.split('/').pop() as string;
            if (id === 'bbbbbbbbbbbbbbbbbbbbbb') {
                return Promise.resolve({ ok: false, status: 404, json: vi.fn() });
            }
            return Promise.resolve(okJsonResponse(makeTrack(id)));
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchSpotifyTracks(ids, 'token-1');

        expect(result.tracks.map(track => track.id)).toEqual([
            'aaaaaaaaaaaaaaaaaaaaaa',
            'cccccccccccccccccccccc'
        ]);
        expect(result.errors).toEqual(['Track bbbbbbbbbbbbbbbbbbbbbb could not be found on Spotify.']);
    });
});

describe('fetchPlaylistTracks', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const playlistId = '1234567890123456789012';

    it('fetches metadata plus the items page on the first request', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(okJsonResponse({
                name: 'My Mix',
                owner: { display_name: 'Dev Account', id: 'dev-id' }
            }))
            .mockResolvedValueOnce(okJsonResponse({
                total: 3,
                items: [
                    { item: { id: 'track-new', name: 'New Shape', artists: [{ name: 'A' }], album: { name: 'Al', images: [] } } },
                    { track: { id: 'track-legacy', name: 'Legacy Shape', artists: [{ name: 'B' }], album: { name: 'Al', images: [] } } },
                    { item: { id: 'local-track', name: 'Local', artists: [{ name: 'C' }], is_local: true } },
                    { item: { id: 'episode-1', name: 'Episode', type: 'episode' } },
                    { item: null }
                ]
            }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchPlaylistTracks(playlistId, 'token-1', 0, 100);

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,owner(display_name,id)`,
            abortSignalExpectation
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `https://api.spotify.com/v1/playlists/${playlistId}/items?offset=0&limit=50`,
            abortSignalExpectation
        );
        expect(result.name).toBe('My Mix');
        expect(result.ownerName).toBe('Dev Account');
        expect(result.total).toBe(3);
        expect(result.tracks.map(track => track.id)).toEqual(['track-new', 'track-legacy']);
    });

    it('requests only the items page for later offsets', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJsonResponse({ total: 60, items: [] }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchPlaylistTracks(playlistId, 'token-1', 50, 25);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            `https://api.spotify.com/v1/playlists/${playlistId}/items?offset=50&limit=25`,
            abortSignalExpectation
        );
        expect(result.name).toBe('');
        expect(result.ownerName).toBe('');
    });

    it('maps a 403 on the items endpoint to a permission-denied error', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(okJsonResponse({ name: 'My Mix', owner: {} }))
            .mockResolvedValueOnce({ ok: false, status: 403, json: vi.fn() });
        vi.stubGlobal('fetch', fetchMock);

        const error = await fetchPlaylistTracks(playlistId, 'token-1', 0, 50).catch(e => e);
        expect(error).toBeInstanceOf(SpotifyRequestError);
        expect(error.code).toBe('permission-denied');
        expect(error.message).toContain('Build Custom Playlist');
    });

    it('maps a 404 on the items endpoint to a not-found error', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(okJsonResponse({ name: 'My Mix', owner: {} }))
            .mockResolvedValueOnce({ ok: false, status: 404, json: vi.fn() });
        vi.stubGlobal('fetch', fetchMock);

        const error = await fetchPlaylistTracks(playlistId, 'token-1', 0, 50).catch(e => e);
        expect(error).toBeInstanceOf(SpotifyRequestError);
        expect(error.code).toBe('not-found');
    });
});

describe('fetchUserPlaylists', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reads track counts from both the items and tracks fields', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJsonResponse({
            next: null,
            items: [
                {
                    id: '1234567890123456789012',
                    name: 'New Shape',
                    items: { total: 30 },
                    external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                },
                {
                    id: 'abcdefghijklmnopqrstuv',
                    name: 'Legacy Shape',
                    tracks: { total: 12 },
                    external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                }
            ]
        }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await fetchUserPlaylists('https://open.spotify.com/user/jamie', 'token-1');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/v1/users/jamie/playlists?limit=50'),
            abortSignalExpectation
        );
        expect(result.playlists).toEqual([
            expect.objectContaining({ id: '1234567890123456789012', trackCount: 30 }),
            expect.objectContaining({ id: 'abcdefghijklmnopqrstuv', trackCount: 12 })
        ]);
    });

    it('maps a 404 to a not-found error and a 403 to permission-denied', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 404, json: vi.fn() })
            .mockResolvedValueOnce({ ok: false, status: 403, json: vi.fn() });
        vi.stubGlobal('fetch', fetchMock);

        const notFound = await fetchUserPlaylists('https://open.spotify.com/user/jamie', 'token-1').catch(e => e);
        expect(notFound).toBeInstanceOf(SpotifyRequestError);
        expect(notFound.code).toBe('not-found');
        expect(notFound.message).toContain('no longer shares');

        const denied = await fetchUserPlaylists('https://open.spotify.com/user/jamie', 'token-1').catch(e => e);
        expect(denied).toBeInstanceOf(SpotifyRequestError);
        expect(denied.code).toBe('permission-denied');
    });
});

describe('searchSpotifyPlaylists', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const searchPage = (items: any[], total = items.length, next: string | null = null) => okJsonResponse({
        playlists: { total, next, items }
    });

    it('maps public playlist search results and applies owner hint filtering', async () => {
        const fetchMock = vi.fn().mockResolvedValue(searchPage([
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
                items: { total: 12 },
                owner: { display_name: 'Someone Else' },
                external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
            }
        ], 2));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jam', 'token-1');

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('type=playlist'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token-1' }, signal: expect.any(AbortSignal) })
        );
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('limit=10'),
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

    it('paginates with limit=10 until a short page and takes total from the first page', async () => {
        const fullPage = Array.from({ length: 10 }, (_, index) => ({
            id: `playlist${index.toString().padStart(17, '0')}`,
            name: 'Mix',
            items: { total: 5 },
            owner: { display_name: 'Jamie' }
        }));
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(searchPage(fullPage, 34, 'next-page'))
            .mockResolvedValueOnce(searchPage(fullPage.slice(0, 3), 34, null));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('mix', '', 'token-1');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('offset=0'), abortSignalExpectation);
        expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('offset=10'), abortSignalExpectation);
        expect(result.total).toBe(34);
        expect(result.playlists).toHaveLength(13);
    });

    it('stops paginating after five pages even when more results exist', async () => {
        const fullPage = Array.from({ length: 10 }, (_, index) => ({
            id: `playlist${index.toString().padStart(17, '0')}`,
            name: 'Mix',
            items: { total: 5 },
            owner: { display_name: 'Jamie' }
        }));
        const fetchMock = vi.fn().mockResolvedValue(searchPage(fullPage, 100, 'next-page'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('mix', '', 'token-1');

        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('offset=40'), abortSignalExpectation);
        expect(result.playlists).toHaveLength(50);
    });

    it('matches owner hints against Spotify owner usernames', async () => {
        const fetchMock = vi.fn().mockResolvedValue(searchPage([
            {
                id: '1234567890123456789012',
                name: 'Road Trip',
                images: [],
                tracks: { total: 42 },
                owner: { display_name: 'Jamie R.', id: 'jamie-playlists' },
                external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
            }
        ], 1));
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
            .mockResolvedValueOnce(searchPage([], 0))
            .mockResolvedValueOnce(okJsonResponse({
                next: null,
                items: [
                    {
                        id: '1234567890123456789012',
                        name: 'My Public Playlist',
                        images: [{ url: 'https://image.example/user-playlist.jpg' }],
                        items: { total: 15 },
                        external_urls: { spotify: 'https://open.spotify.com/playlist/1234567890123456789012' }
                    }
                ]
            }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('jamie-playlists', '', 'token-1');

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('/v1/users/jamie-playlists/playlists'),
            expect.objectContaining({ headers: { Authorization: 'Bearer token-1' }, signal: expect.any(AbortSignal) })
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
            .mockResolvedValueOnce(searchPage([
                {
                    id: 'abcdefghijklmnopqrstuv',
                    name: 'Road Trip',
                    images: [],
                    tracks: { total: 12 },
                    owner: { display_name: 'Someone Else', id: 'someone-else' },
                    external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                }
            ], 25))
            .mockResolvedValueOnce(okJsonResponse({
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
                        items: { total: 20 },
                        external_urls: { spotify: 'https://open.spotify.com/playlist/mnopqrstuvwxyzabcdefgh' }
                    }
                ]
            }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jamie-playlists', 'token-1');

        expect(result.playlists).toEqual([
            expect.objectContaining({
                id: '1234567890123456789012',
                name: 'Road Trip Favorites',
                ownerName: 'jamie-playlists',
                trackCount: 42
            })
        ]);
    });

    it('returns user playlist suggestions when owner lookup succeeds but the playlist name does not match', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(searchPage([], 0))
            .mockResolvedValueOnce(okJsonResponse({
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
                        items: { total: 20 },
                        external_urls: { spotify: 'https://open.spotify.com/playlist/abcdefghijklmnopqrstuv' }
                    }
                ]
            }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await searchSpotifyPlaylists('Road Trip', 'jamie-playlists', 'token-1');

        expect(result.playlists).toEqual([
            expect.objectContaining({ name: 'Chill Mix', ownerName: 'jamie-playlists' }),
            expect.objectContaining({ name: 'Workout', ownerName: 'jamie-playlists' })
        ]);
    });

    it('falls back to display name search when Spotify username lookup does not find a user', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(searchPage([], 0))
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: vi.fn()
            })
            .mockResolvedValueOnce(searchPage([
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
            ], 2));
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
