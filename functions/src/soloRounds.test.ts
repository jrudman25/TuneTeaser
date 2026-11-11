import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// Path-aware in-memory fake of firebase-admin firestore/storage/auth.
const { fake } = vi.hoisted(() => {
    type DocData = Record<string, any>;
    const docs = new Map<string, DocData>();
    const storageFiles = new Map<string, string>();
    const authUsers = new Map<string, any>();

    const INCREMENT = Symbol('increment');
    const SERVER_TIMESTAMP = Symbol('serverTimestamp');
    const DELETE_FIELD = Symbol('deleteField');

    const resolveValue = (existing: DocData | undefined, key: string, value: any) => {
        if (value && typeof value === 'object' && value.__type === INCREMENT) {
            return (typeof existing?.[key] === 'number' ? existing[key] : 0) + value.amount;
        }
        if (value && typeof value === 'object' && value.__type === SERVER_TIMESTAMP) {
            return { __serverTimestamp: true };
        }
        return value;
    };

    const applyData = (path: string, data: DocData, merge: boolean) => {
        const existing = merge ? docs.get(path) : undefined;
        const next: DocData = merge ? { ...(existing || {}) } : {};
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && value.__type === DELETE_FIELD) {
                delete next[key];
            } else {
                next[key] = resolveValue(existing, key, value);
            }
        }
        docs.set(path, next);
    };

    const snapFor = (path: string) => ({
        exists: docs.has(path),
        id: path.split('/').pop(),
        data: () => docs.get(path),
        ref: refFor(path)
    });

    const collectionGet = (collectionPath: string) => {
        const prefix = `${collectionPath}/`;
        const found = [...docs.keys()]
            .filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
            .map(snapFor);
        return Promise.resolve({ docs: found, empty: found.length === 0, size: found.length });
    };

    function collectionRef(path: string): any {
        return {
            path,
            doc: (id: string) => refFor(`${path}/${id}`),
            get: () => collectionGet(path),
            where: () => ({ get: () => collectionGet(path), limit: () => ({ get: () => collectionGet(path) }) })
        };
    }

    function refFor(path: string): any {
        return {
            path,
            id: path.split('/').pop(),
            get: () => Promise.resolve(snapFor(path)),
            set: (data: DocData, options?: { merge?: boolean }) => {
                applyData(path, data, Boolean(options?.merge));
                return Promise.resolve();
            },
            update: (data: DocData) => {
                if (!docs.has(path)) return Promise.reject(new Error(`No document to update: ${path}`));
                applyData(path, data, true);
                return Promise.resolve();
            },
            delete: () => {
                docs.delete(path);
                return Promise.resolve();
            },
            collection: (name: string) => collectionRef(`${path}/${name}`)
        };
    }

    const db = {
        collection: (path: string) => collectionRef(path),
        getAll: (...refs: any[]) => Promise.resolve(refs.map(ref => snapFor(ref.path))),
        batch: () => {
            const ops: (() => void)[] = [];
            return {
                set: (ref: any, data: DocData, options?: { merge?: boolean }) => ops.push(() => applyData(ref.path, data, Boolean(options?.merge))),
                update: (ref: any, data: DocData) => ops.push(() => applyData(ref.path, data, true)),
                delete: (ref: any) => ops.push(() => docs.delete(ref.path)),
                commit: () => { ops.forEach(op => op()); return Promise.resolve(); }
            };
        },
        runTransaction: async (callback: any) => {
            const ops: (() => void)[] = [];
            const transaction = {
                get: (target: any) => {
                    if (typeof target?.get === 'function' && target.path === undefined) {
                        return target.get();
                    }
                    return Promise.resolve(snapFor(target.path));
                },
                set: (ref: any, data: DocData, options?: { merge?: boolean }) => ops.push(() => applyData(ref.path, data, Boolean(options?.merge))),
                update: (ref: any, data: DocData) => ops.push(() => applyData(ref.path, data, true)),
                delete: (ref: any) => ops.push(() => docs.delete(ref.path))
            };
            const result = await callback(transaction);
            ops.forEach(op => op());
            return result;
        }
    };

    const auth = {
        getUser: (uid: string) => {
            const record = authUsers.get(uid);
            if (!record) return Promise.reject(new Error(`No user ${uid}`));
            return Promise.resolve(record);
        },
        updateUser: (uid: string, props: any) => {
            authUsers.set(uid, { ...authUsers.get(uid), ...props });
            return Promise.resolve(authUsers.get(uid));
        }
    };

    const bucket = {
        file: (path: string) => ({
            exists: () => Promise.resolve([storageFiles.has(path)]),
            download: () => Promise.resolve([Buffer.from(storageFiles.get(path) || '', 'utf-8')])
        }),
        deleteFiles: () => Promise.resolve()
    };

    return {
        fake: {
            docs,
            storageFiles,
            authUsers,
            db,
            auth,
            bucket,
            INCREMENT,
            SERVER_TIMESTAMP,
            DELETE_FIELD,
            reset: () => {
                docs.clear();
                storageFiles.clear();
                authUsers.clear();
            }
        }
    };
});

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => fake.db,
    FieldValue: {
        increment: (amount: number) => ({ __type: fake.INCREMENT, amount }),
        serverTimestamp: () => ({ __type: fake.SERVER_TIMESTAMP }),
        delete: () => ({ __type: fake.DELETE_FIELD })
    },
    Timestamp: {
        fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })
    }
}));

vi.mock('firebase-admin/auth', () => ({
    getAuth: () => fake.auth
}));

vi.mock('firebase-admin/storage', () => ({
    getStorage: () => ({ bucket: () => fake.bucket })
}));

vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((config, handler) => handler)
    };
});

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn((name) => ({ value: () => `secret-${name}` }))
}));

import { startSoloRound, submitSoloGuess, giveUpSoloRound } from './soloRounds';
import { pickTrackWithPreview } from './itunesPreview';
import { GUEST_TRACKS } from './premadePlaylists';

const EMAIL_AUTH = { uid: 'user1', token: { firebase: { sign_in_provider: 'password' } } };
const ANON_AUTH = { uid: 'guest1', token: { firebase: { sign_in_provider: 'anonymous' } } };

const makeTrack = (id: string, name: string, artist = 'Test Artist', album = 'Test Album') => ({
    id,
    name,
    artists: [{ name: artist }],
    album: { name: album, images: [{ url: `https://img.example/${id}.jpg` }] }
});

const cleanItunesQuery = (value: string) => value.replace(/ - .*/, '').replace(/[([].*?[)\]]/g, '').trim();

// iTunes mock that returns a 'found' match for any of the provided tracks and 'missing' otherwise.
const stubFetchForTracks = (tracks: any[]) => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
        const term = decodeURIComponent(new URL(url).searchParams.get('term') || '');
        const track = tracks.find(candidate => (
            term === `${cleanItunesQuery(candidate.name || '')} ${candidate.artists?.[0]?.name || ''}`.trim()
        ));
        if (!track) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ resultCount: 0, results: [] })
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                resultCount: 1,
                results: [{
                    previewUrl: `https://preview.example/${encodeURIComponent(track.name)}.m4a`,
                    artworkUrl100: 'https://art.example/100x100.jpg',
                    trackName: track.name,
                    artistName: track.artists[0].name,
                    collectionName: track.album?.name || ''
                }]
            })
        });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

const savePlaylistDoc = (uid: string, playlistId: string, tracks?: any[]) => {
    fake.docs.set(`users/${uid}/playlists/${playlistId}`, tracks ? { tracks } : { name: 'Saved' });
};

const readSoloDoc = (uid: string) => fake.docs.get(`soloRounds/${uid}`) as any;

const startSolo = async (uid = 'user1', playlistId = 'playlist1', auth = EMAIL_AUTH) => {
    return (startSoloRound as any)({ data: { playlistId }, auth: { ...auth, uid } });
};

const submitGuess = async (roundId: string, guess: string, uid = 'user1', auth = EMAIL_AUTH, extraData: any = {}) => {
    return (submitSoloGuess as any)({ data: { roundId, guess, ...extraData }, auth: { ...auth, uid } });
};

describe('solo rounds', () => {
    beforeEach(() => {
        fake.reset();
        vi.clearAllMocks();
        fake.authUsers.set('user1', { displayName: 'Player One', email: 'player@example.com' });
        fake.authUsers.set('guest1', { providerData: [] });
        vi.spyOn(Math, 'random').mockReturnValue(0.999);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('starts a round without leaking the answer', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const result = await startSolo();

        expect(result).toEqual({
            roundId: expect.any(String),
            previewUrl: expect.any(String),
            snippetDurationMs: 2000,
            eligibleForPoints: true,
            playableTrackCount: 12
        });
        expect(result).not.toHaveProperty('title');
        expect(result).not.toHaveProperty('trackId');
        expect(result).not.toHaveProperty('artistName');
        expect(result).not.toHaveProperty('artworkUrl');
        expect(result).not.toHaveProperty('albumName');
    });

    it('marks a saved playlist with fewer than 10 playable tracks as ineligible and awards no points', async () => {
        const tracks = [makeTrack('t1', 'Only Song')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        expect(start.eligibleForPoints).toBe(false);

        const guess = await submitGuess(start.roundId, 'Only Song');
        expect(guess.result).toBe('correct');
        expect(guess.pointsAwarded).toBeNull();
        expect(guess.pointsNote).toBe('ineligible');
        expect(guess.answer?.name).toBe('Only Song');
        expect(fake.docs.has('leaderboard/user1')).toBe(false);
    });

    it('never awards points to anonymous users', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('guest1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo('guest1', 'playlist1', ANON_AUTH);
        expect(start.eligibleForPoints).toBe(false);

        const guess = await submitGuess(start.roundId, readSoloDoc('guest1').title, 'guest1', ANON_AUTH);
        expect(guess.result).toBe('correct');
        expect(guess.pointsAwarded).toBeNull();
        expect(guess.pointsNote).toBe('ineligible');
        expect(fake.docs.has('leaderboard/guest1')).toBe(false);
    });

    it('awards points from the server-tracked snippet duration and ignores client fields', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        const round = readSoloDoc('user1');

        // Two wrong guesses extend the server-tracked snippet from 2s to 6s.
        const first = await submitGuess(start.roundId, '', 'user1', EMAIL_AUTH, { snippetDurationMs: 30000 });
        expect(first).toMatchObject({ result: 'incorrect', snippetDurationMs: 4000 });
        const second = await submitGuess(start.roundId, 'not it', 'user1', EMAIL_AUTH, { snippetDurationMs: 2000, points: 999, playlistTrackCount: 1 });
        expect(second).toMatchObject({ result: 'incorrect', snippetDurationMs: 6000 });

        const final = await submitGuess(start.roundId, round.title, 'user1', EMAIL_AUTH, { snippetDurationMs: 2000 });
        expect(final).toMatchObject({ result: 'correct', snippetDurationMs: 6000, pointsAwarded: 23 });
        expect(final.answer?.id).toBe(round.trackId);

        const leaderboard = fake.docs.get('leaderboard/user1') as any;
        expect(leaderboard.totalPoints).toBe(23);
        expect(leaderboard.gamesWon).toBe(1);
        expect(leaderboard.displayName).toBe('Player One');
    });

    it('writes Timestamp expiresAt for TTL on cooldown and rate-limit docs and drops legacy expiresAtMillis', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        await startSolo();
        const rateLimitPaths = [...fake.docs.keys()].filter(path => path.startsWith('callableRateLimits/'));
        expect(rateLimitPaths.length).toBeGreaterThan(0);
        rateLimitPaths.forEach(path => fake.docs.set(path, { ...fake.docs.get(path), expiresAtMillis: 1 }));

        const before = Date.now();
        const start = await startSolo();
        const round = readSoloDoc('user1');
        const cooldownPath = `leaderboard/user1/recentScores/${createHash('sha256').update(`playlist1:${round.trackId}`).digest('hex')}`;
        fake.docs.set(cooldownPath, { scoredAtMillis: Date.now() - 60 * 60 * 1000, expiresAtMillis: 1 });
        await submitGuess(start.roundId, round.title);

        const cooldown = fake.docs.get(cooldownPath) as any;
        expect(cooldown.expiresAtMillis).toBeUndefined();
        expect(cooldown.expiresAt.toMillis()).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);

        for (const path of rateLimitPaths) {
            const limit = fake.docs.get(path) as any;
            expect(limit.expiresAtMillis).toBeUndefined();
            expect(limit.expiresAt.toMillis()).toBeGreaterThan(before);
        }
    });

    it('rejects guesses with an unknown or stale round id', async () => {
        const tracks = [makeTrack('t1', 'Only Song')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        await expect(submitGuess('bad-round-id', 'Only Song')).rejects.toThrow('This round is no longer active');

        // Starting a new round invalidates the old round id.
        const next = await startSolo();
        await expect(submitGuess(start.roundId, 'Only Song')).rejects.toThrow('This round is no longer active');
        expect(next.roundId).not.toBe(start.roundId);
    });

    it('rejects guesses after the round expires', async () => {
        const tracks = [makeTrack('t1', 'Only Song')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        readSoloDoc('user1').expiresAtMillis = Date.now() - 1;

        await expect(submitGuess(start.roundId, 'Only Song')).rejects.toThrow('This round is no longer active');
    });

    it('treats a blank guess on a non-Latin title as an extend, not a win', async () => {
        const tracks = [makeTrack('t1', '残酷な天使のテーゼ', 'Yoko Takahashi')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        const blank = await submitGuess(start.roundId, '');
        expect(blank).toMatchObject({ result: 'incorrect', snippetDurationMs: 4000 });
        expect(readSoloDoc('user1').state).toBe('playing');

        const correct = await submitGuess(start.roundId, '残酷な天使のテーゼ');
        expect(correct.result).toBe('correct');
        expect(correct.answer?.name).toBe('残酷な天使のテーゼ');
    });

    it('ends the round and reveals the answer at the 30s snippet limit', async () => {
        const tracks = [makeTrack('t1', 'Only Song', 'Artist', 'Album X')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        readSoloDoc('user1').snippetDurationMs = 30000;

        const result = await submitGuess(start.roundId, 'wrong again');
        expect(result).toMatchObject({ result: 'out-of-snippet', snippetDurationMs: 30000, pointsAwarded: null });
        expect(result.answer).toEqual({
            id: 't1',
            name: 'Only Song',
            artists: [{ name: 'Artist' }],
            album: { name: 'Album X', images: [{ url: 'https://art.example/600x600.jpg' }] }
        });
        expect(readSoloDoc('user1').state).toBe('out-of-snippet');
    });

    it('blocks re-scoring the same track during the cooldown window', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        const round = readSoloDoc('user1');

        const cooldownId = createHash('sha256').update(`playlist1:${round.trackId}`).digest('hex');
        fake.docs.set(`leaderboard/user1/recentScores/${cooldownId}`, {
            playlistId: 'playlist1',
            songId: round.trackId,
            scoredAtMillis: Date.now() - 5 * 60 * 1000,
            expiresAt: { toMillis: () => Date.now() + 5 * 60 * 1000 }
        });

        const guess = await submitGuess(start.roundId, round.title);
        expect(guess).toMatchObject({ result: 'correct', pointsAwarded: null, pointsNote: 'cooldown' });
        expect(fake.docs.has('leaderboard/user1')).toBe(false);
    });

    it('stops awarding once the daily points cap is reached', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        const dateKey = new Date().toISOString().slice(0, 10);
        fake.docs.set(`leaderboard/user1/dailyPoints/${dateKey}`, { points: 1490, dateKey });

        const guess = await submitGuess(start.roundId, readSoloDoc('user1').title);
        expect(guess).toMatchObject({ result: 'correct', pointsAwarded: null, pointsNote: 'daily-cap' });
        expect((fake.docs.get(`leaderboard/user1/dailyPoints/${dateKey}`) as any).points).toBe(1490);
    });

    it('avoids recently played tracks for the same playlist', async () => {
        const tracks = [makeTrack('t1', 'Song One'), makeTrack('t2', 'Song Two')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        await startSolo();
        const firstTrackId = readSoloDoc('user1').trackId;

        await startSolo();
        const secondRound = readSoloDoc('user1');
        expect(secondRound.trackId).not.toBe(firstTrackId);
        expect(secondRound.recentTrackIds).toContain(secondRound.trackId);
    });

    it('loads a guest storage-only playlist and marks it ineligible', async () => {
        const tracks = Array.from({ length: 12 }, (_, i) => makeTrack(`t${i}`, `Song ${i}`));
        fake.storageFiles.set('users/guest1/playlists/guest_manual_123.json', JSON.stringify(tracks));
        stubFetchForTracks(tracks);

        const start = await startSolo('guest1', 'guest_manual_123', ANON_AUTH);
        expect(start.eligibleForPoints).toBe(false);
        expect(start.playableTrackCount).toBe(12);

        const guess = await submitGuess(start.roundId, readSoloDoc('guest1').title, 'guest1', ANON_AUTH);
        expect(guess.pointsNote).toBe('ineligible');
    });

    it('plays a featured playlist for email users', async () => {
        stubFetchForTracks(GUEST_TRACKS['guest_top_hits'].map((item: any) => item.track));

        const start = await startSolo('user1', 'guest_top_hits');
        expect(start.roundId).toEqual(expect.any(String));
        expect(start.previewUrl).toContain('preview.example');
        expect(start.eligibleForPoints).toBe(true);
        expect(start.playableTrackCount).toBeGreaterThanOrEqual(10);
    });

    it('rejects an invalid playlist id', async () => {
        await expect(startSolo('user1', 'bad/id')).rejects.toThrow('Playlist ID is invalid');
        await expect(startSolo('user1', 'missing_playlist')).rejects.toThrow('Playlist not found');
    });

    it('fails cleanly when no preview can be found', async () => {
        const tracks = [makeTrack('t1', 'Only Song')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks([]);

        await expect(startSolo()).rejects.toThrow('Could not find a playable preview');
        expect(fake.docs.has('soloRounds/user1')).toBe(false);
    });

    it('gives up, reveals the answer, and is idempotent', async () => {
        const tracks = [makeTrack('t1', 'Only Song', 'Artist', 'Album X')];
        savePlaylistDoc('user1', 'playlist1', tracks);
        stubFetchForTracks(tracks);

        const start = await startSolo();
        const first = await (giveUpSoloRound as any)({ data: { roundId: start.roundId }, auth: EMAIL_AUTH });
        expect(first.answer).toEqual({
            id: 't1',
            name: 'Only Song',
            artists: [{ name: 'Artist' }],
            album: { name: 'Album X', images: [{ url: 'https://art.example/600x600.jpg' }] }
        });
        expect(readSoloDoc('user1').state).toBe('gave-up');

        const second = await (giveUpSoloRound as any)({ data: { roundId: start.roundId }, auth: EMAIL_AUTH });
        expect(second).toEqual(first);

        await expect((giveUpSoloRound as any)({ data: { roundId: 'unknown' }, auth: EMAIL_AUTH }))
            .rejects.toThrow('This round is no longer active');
    });
});

describe('pickTrackWithPreview cache', () => {
    beforeEach(() => {
        fake.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('serves a repeat candidate from the cache without calling fetch', async () => {
        const candidates = [makeTrack('t1', 'Song One')];
        const fetchMock = stubFetchForTracks(candidates);

        const first = await pickTrackWithPreview(candidates, 4);
        expect(first?.track.id).toBe('t1');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const second = await pickTrackWithPreview(candidates, 4);
        expect(second?.track.id).toBe('t1');
        expect(second?.stats.cacheHits).toBe(1);
        expect(second?.stats.lookups).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not cache failed lookups', async () => {
        const track = makeTrack('t1', 'Song One');
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() })
            .mockImplementation((url: string) => {
                const term = decodeURIComponent(new URL(url).searchParams.get('term') || '');
                if (term !== 'Song One Test Artist') {
                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ resultCount: 0, results: [] }) });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        resultCount: 1,
                        results: [{
                            previewUrl: 'https://preview.example/song-one.m4a',
                            artworkUrl100: 'https://art.example/100x100.jpg',
                            trackName: 'Song One',
                            artistName: 'Test Artist'
                        }]
                    })
                });
            });
        vi.stubGlobal('fetch', fetchMock);

        const first = await pickTrackWithPreview([track], 4);
        expect(first).toBeNull();
        expect([...fake.docs.keys()].filter(key => key.startsWith('itunesPreviewCache/'))).toHaveLength(0);

        const second = await pickTrackWithPreview([track], 4);
        expect(second?.track.id).toBe('t1');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('treats expired cache entries as unknown', async () => {
        const track = makeTrack('t1', 'Song One');
        const fetchMock = stubFetchForTracks([track]);
        const cacheId = createHash('sha256').update('song one|test artist|test album').digest('hex');
        fake.docs.set(`itunesPreviewCache/${cacheId}`, {
            status: 'found',
            previewUrl: 'https://preview.example/stale.m4a',
            artworkUrl: '',
            checkedAtMillis: Date.now() - 20 * 24 * 60 * 60 * 1000,
            expiresAt: { toMillis: () => Date.now() - 1 }
        });

        const result = await pickTrackWithPreview([track], 4);
        expect(result?.track.id).toBe('t1');
        expect(result?.previewUrl).toContain('preview.example/Song');
        expect(result?.stats.lookups).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
