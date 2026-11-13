import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({
    initializeApp: vi.fn(),
}));

// We need to mock getFirestore and getStorage before importing index
const mockDocDelete = vi.fn();
const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionGet = vi.fn();
const mockQueryWhere = vi.fn();
const mockQueryOrderBy = vi.fn();
const mockQueryLimit = vi.fn();
const mockQueryStartAfter = vi.fn();
const mockQueryGet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCreate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionSet = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockTransactionDelete = vi.fn();
const mockRunTransaction = vi.fn();
const { mockOnCallConfigs } = vi.hoisted(() => ({
    mockOnCallConfigs: [] as any[]
}));
const { mockFieldValueIncrement, mockFieldValueServerTimestamp, mockFieldValueDelete } = vi.hoisted(() => ({
    mockFieldValueIncrement: vi.fn((value: number) => ({ _increment: value })),
    mockFieldValueServerTimestamp: vi.fn(() => 'server-timestamp'),
    mockFieldValueDelete: vi.fn(() => ({ _delete: true }))
}));

const mockDocSet = vi.fn();
const mockGetAll = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: mockFieldValueIncrement,
        serverTimestamp: mockFieldValueServerTimestamp,
        delete: mockFieldValueDelete
    },
    Timestamp: {
        fromMillis: (ms: number) => ({ toMillis: () => ms })
    },
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                delete: mockDocDelete,
                get: mockDocGet,
                set: mockDocSet,
                update: mockDocUpdate,
                collection: vi.fn(() => ({
                    get: mockCollectionGet,
                    doc: vi.fn(() => ({
                        get: mockDocGet,
                        set: mockDocSet,
                        update: mockDocUpdate,
                        delete: mockDocDelete
                    }))
                }))
            })),
            where: mockQueryWhere
        })),
        batch: vi.fn(() => ({
            delete: mockBatchDelete,
            create: mockBatchCreate,
            set: mockBatchSet,
            update: mockBatchUpdate,
            commit: mockBatchCommit
        })),
        getAll: mockGetAll,
        runTransaction: mockRunTransaction
    }))
}));

const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockListUsers = vi.fn();
const mockDeleteUsers = vi.fn();

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        getUser: mockGetUser,
        updateUser: mockUpdateUser,
        listUsers: mockListUsers,
        deleteUsers: mockDeleteUsers
    }))
}));

const mockFileExists = vi.fn();
const mockFileDownload = vi.fn();
const mockDeleteFiles = vi.fn();

vi.mock('firebase-admin/storage', () => ({
    getStorage: vi.fn(() => ({
        bucket: vi.fn(() => ({
            file: vi.fn(() => ({
                exists: mockFileExists,
                download: mockFileDownload
            })),
            deleteFiles: mockDeleteFiles
        }))
    }))
}));

// Mock defineSecret and onCall
vi.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        onCall: vi.fn((config, handler) => {
            mockOnCallConfigs.push(config);
            return handler; // Just return the handler so we can call it directly
        })
    };
});

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn((name) => ({ value: () => `secret-${name}` }))
}));

vi.mock('firebase-functions/v1', () => ({
    auth: {
        user: () => ({
            onDelete: vi.fn((handler) => handler) // return handler to call directly
        })
    }
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((schedule, handler) => handler)
}));

// Mock spotify.ts
vi.mock('./spotify', () => ({
    getSpotifyAccessToken: vi.fn(() => Promise.resolve('mock-token')),
    fetchSpotifyTracks: vi.fn(() => Promise.resolve({ tracks: [], errors: [] })),
    fetchPlaylistName: vi.fn(() => Promise.resolve('Mock Playlist')),
    fetchUserPlaylists: vi.fn(() => Promise.resolve({ playlists: [] })),
    searchSpotifyPlaylists: vi.fn(() => Promise.resolve({ playlists: [], total: 0 })),
    fetchPlaylistTracks: vi.fn(() => Promise.resolve({ name: 'P', tracks: [], total: 0, errors: [] })),
    normalizeTrackIds: vi.fn((ids) => ids || [])
}));

import { fetchPlaylistTracks } from './spotify';
import {
    resolveSpotifyTracks,
    getPlaylistName,
    getUserPlaylists,
    searchPublicPlaylists,
    importSpotifyPlaylist,
    getManualPlaylistTracks,
    cleanupUserOnDelete,
    createMultiplayerRoom,
    joinMultiplayerRoom,
    updateMultiplayerRoomSettings,
    startMultiplayerGame,
    getMultiplayerRoundData,
    submitMultiplayerGuess,
    kickMultiplayerPlayer,
    leaveMultiplayerRoom,
    cleanupAnonymousUsers,
    initializeTuneTeaserAccount,
    updateTuneTeaserUsername,
    advanceMultiplayerRound,
    advanceStuckMultiplayerRounds,
    expireStuckMultiplayerRounds,
    cleanupExpiredMultiplayerRooms,
    shouldEnforceAppCheck
} from './index';

describe('Cloud Functions (index.ts)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ displayName: 'Player One' });
        mockUpdateUser.mockResolvedValue({ uid: 'user123' });
        mockListUsers.mockResolvedValue({ users: [] });
        mockBatchCommit.mockResolvedValue(undefined);
        mockDocUpdate.mockResolvedValue(undefined);
        mockTransactionGet.mockResolvedValue({ exists: false, data: () => ({}) });
        mockDocSet.mockResolvedValue(undefined);
        mockGetAll.mockImplementation((...refs: any[]) => Promise.resolve(
            refs.map(() => ({ exists: false, data: () => null }))
        ));
        mockCollectionGet.mockResolvedValue({ empty: true, size: 0, docs: [] });
        mockQueryGet.mockResolvedValue({ empty: true, size: 0, docs: [] });
        mockQueryOrderBy.mockReturnValue({ orderBy: mockQueryOrderBy, limit: mockQueryLimit, startAfter: mockQueryStartAfter, get: mockQueryGet });
        mockQueryStartAfter.mockReturnValue({ startAfter: mockQueryStartAfter, limit: mockQueryLimit, get: mockQueryGet });
        mockQueryLimit.mockReturnValue({ startAfter: mockQueryStartAfter, get: mockQueryGet });
        mockQueryWhere.mockReturnValue({ where: mockQueryWhere, orderBy: mockQueryOrderBy, limit: mockQueryLimit, startAfter: mockQueryStartAfter, get: mockQueryGet });
        mockDeleteUsers.mockResolvedValue({ successCount: 0, failureCount: 0, errors: [] });
        mockFieldValueIncrement.mockImplementation((value: number) => ({ _increment: value }));
        mockFieldValueServerTimestamp.mockReturnValue('server-timestamp');
        mockFieldValueDelete.mockReturnValue({ _delete: true });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                resultCount: 1,
                results: [
                    {
                        previewUrl: 'https://example.com/preview.m4a',
                        artworkUrl100: 'https://example.com/100x100.jpg',
                        trackName: 'First Song',
                        artistName: 'Artist One',
                        collectionName: 'Album One'
                    }
                ]
            })
        }));
        mockRunTransaction.mockImplementation(async callback => {
            return callback({
                get: mockTransactionGet,
                set: mockTransactionSet,
                update: mockTransactionUpdate,
                delete: mockTransactionDelete
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('enforces App Check on public callable functions', () => {
        expect(mockOnCallConfigs.length).toBeGreaterThan(0);
        expect(mockOnCallConfigs.every(config => config.enforceAppCheck === true)).toBe(true);
    });

    it('disables App Check enforcement in the Functions emulator', () => {
        const originalValue = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        expect(shouldEnforceAppCheck()).toBe(false);
        if (originalValue === undefined) {
            delete process.env.FUNCTIONS_EMULATOR;
        } else {
            process.env.FUNCTIONS_EMULATOR = originalValue;
        }
        expect(shouldEnforceAppCheck()).toBe(true);
    });

    describe('initializeTuneTeaserAccount', () => {
        it('reserves the username, initializes leaderboard data, and updates Auth display name', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({ exists: false, data: () => ({}) })
                .mockResolvedValueOnce({ exists: false, data: () => ({}) });

            const result = await (initializeTuneTeaserAccount as any)({
                data: { username: ' Player One ' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            });

            expect(result).toEqual({ displayName: 'Player One' });
            expect(mockTransactionSet).toHaveBeenCalledTimes(2);
            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                uid: 'user123',
                displayName: 'Player One',
                normalizedDisplayName: 'player one'
            });
            expect(mockTransactionSet.mock.calls[1][1]).toMatchObject({
                displayName: 'Player One',
                totalPoints: 0,
                gamesWon: 0,
                lastUpdated: 'server-timestamp'
            });
            expect(mockUpdateUser).toHaveBeenCalledWith('user123', { displayName: 'Player One' });
        });

        it('rejects duplicate usernames owned by another user', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'other-user' }) })
                .mockResolvedValueOnce({ exists: false, data: () => ({}) });

            await expect((initializeTuneTeaserAccount as any)({
                data: { username: 'Player One' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('This username is already taken');

            expect(mockUpdateUser).not.toHaveBeenCalled();
        });

        it('rejects usernames with offensive language', async () => {
            await expect((initializeTuneTeaserAccount as any)({
                data: { username: 'shithead' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('Username contains offensive or inappropriate language');

            expect(mockRunTransaction).not.toHaveBeenCalled();
            expect(mockUpdateUser).not.toHaveBeenCalled();
        });
    });

    describe('updateTuneTeaserUsername', () => {
        it('moves the username reservation, preserves leaderboard totals, and updates Auth display name', async () => {
            mockGetUser.mockResolvedValueOnce({ displayName: 'Player One' });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: false, data: () => ({}) })
                .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'user123' }) })
                .mockResolvedValueOnce({ exists: true, data: () => ({ totalPoints: 50, gamesWon: 2 }) });

            const result = await (updateTuneTeaserUsername as any)({
                data: { username: ' Player Two ' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            });

            expect(result).toEqual({ displayName: 'Player Two' });
            expect(mockTransactionSet).toHaveBeenCalledTimes(2);
            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                uid: 'user123',
                displayName: 'Player Two',
                normalizedDisplayName: 'player two'
            });
            expect(mockTransactionDelete).toHaveBeenCalledTimes(1);
            expect(mockTransactionSet.mock.calls[1][1]).toMatchObject({
                displayName: 'Player Two',
                totalPoints: 50,
                gamesWon: 2,
                lastUpdated: 'server-timestamp'
            });
            expect(mockUpdateUser).toHaveBeenCalledWith('user123', { displayName: 'Player Two' });
        });

        it('rejects username changes to a reservation owned by another user', async () => {
            mockGetUser.mockResolvedValueOnce({ displayName: 'Player One' });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'other-user' }) })
                .mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'user123' }) })
                .mockResolvedValueOnce({ exists: true, data: () => ({ totalPoints: 50, gamesWon: 2 }) });

            await expect((updateTuneTeaserUsername as any)({
                data: { username: 'Player Two' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('This username is already taken');

            expect(mockUpdateUser).not.toHaveBeenCalled();
        });

        it('rejects username changes with offensive language', async () => {
            await expect((updateTuneTeaserUsername as any)({
                data: { username: 'asshole' },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('Username contains offensive or inappropriate language');

            expect(mockGetUser).not.toHaveBeenCalled();
            expect(mockUpdateUser).not.toHaveBeenCalled();
        });
    });

    describe('createMultiplayerRoom', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((createMultiplayerRoom as any)({ data: { roomName: 'Party' }, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('creates a lobby room and host player', async () => {
            const result = await (createMultiplayerRoom as any)({ data: { roomName: ' Party Room ' }, auth: { uid: 'host123' } });

            expect(result.roomId).toMatch(/^[A-Z2-9]{6}$/);
            expect(mockBatchCreate).toHaveBeenCalledTimes(1);
            expect(mockBatchSet).toHaveBeenCalledTimes(1);
            expect(mockBatchCreate.mock.calls[0][1]).toMatchObject({
                id: result.roomId,
                roomName: 'Party Room',
                hostUid: 'host123',
                status: 'lobby',
                maxPlayers: 5,
                playerCount: 1,
                pointGoal: 100
            });
            expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
                uid: 'host123',
                displayName: 'Player One',
                isHost: true,
                score: 0,
                state: 'lobby'
            });
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('retries with a new code when the room id already exists', async () => {
            mockBatchCommit
                .mockRejectedValueOnce({ code: 6 })
                .mockResolvedValueOnce(undefined);

            const result = await (createMultiplayerRoom as any)({ data: { roomName: 'Party' }, auth: { uid: 'host123' } });

            expect(result.roomId).toMatch(/^[A-Z2-9]{6}$/);
            expect(mockBatchCommit).toHaveBeenCalledTimes(2);
            expect(mockBatchCreate).toHaveBeenCalledTimes(2);
        });

        it('propagates commit errors that are not already-exists', async () => {
            mockBatchCommit.mockRejectedValue(new Error('firestore down'));

            await expect((createMultiplayerRoom as any)({ data: { roomName: 'Party' }, auth: { uid: 'host123' } }))
                .rejects.toThrow('firestore down');
        });

        it('rejects with resource-exhausted when the rate limit is hit', async () => {
            mockTransactionGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ windowStartedAtMillis: Date.now(), count: 5 })
            });

            await expect((createMultiplayerRoom as any)({ data: { roomName: 'Party' }, auth: { uid: 'host123' } }))
                .rejects.toThrow('Too many requests');

            expect(mockBatchCommit).not.toHaveBeenCalled();
            expect(mockBatchCreate).not.toHaveBeenCalled();
        });

        it('rejects room names with offensive language', async () => {
            await expect((createMultiplayerRoom as any)({
                data: { roomName: 'shit party' },
                auth: { uid: 'host123' }
            })).rejects.toThrow('Room name contains offensive or inappropriate language');

            expect(mockBatchCommit).not.toHaveBeenCalled();
        });
    });

    describe('joinMultiplayerRoom', () => {
        it('rejects invalid room codes', async () => {
            await expect((joinMultiplayerRoom as any)({ data: { roomId: 'short' }, auth: { uid: 'player1' } }))
                .rejects.toThrow('Enter a valid room code');
        });

        it('rejects a new player when the room is full', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ status: 'lobby', playerCount: 5, maxPlayers: 5 })
                })
                .mockResolvedValueOnce({ exists: false });

            await expect((joinMultiplayerRoom as any)({ data: { roomId: 'abc234' }, auth: { uid: 'player1' } }))
                .rejects.toThrow('This room is full');

            expect(mockTransactionSet).not.toHaveBeenCalled();
            expect(mockTransactionUpdate).not.toHaveBeenCalled();
        });

        it('preserves score and joinedAt when an existing player rejoins', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ hostUid: 'host123', status: 'lobby', playerCount: 2, maxPlayers: 5 })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ score: 30, joinedAt: 12345 })
                });

            const result = await (joinMultiplayerRoom as any)({ data: { roomId: 'abc234' }, auth: { uid: 'player1' } });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                uid: 'player1',
                displayName: 'Player One',
                isHost: false,
                score: 30,
                joinedAt: 12345
            });
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({ playerCount: 2 });
        });

        it('adds a new player to the current round when a game is already playing', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        hostUid: 'host123',
                        status: 'playing',
                        playerCount: 2,
                        maxPlayers: 5,
                        currentRound: { id: 'round1' }
                    })
                })
                .mockResolvedValueOnce({ exists: false });

            await (joinMultiplayerRoom as any)({ data: { roomId: 'abc234' }, auth: { uid: 'player1' } });

            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                state: 'guessing',
                currentRoundId: 'round1',
                roundSnippetDurationMs: 2000,
                roundCompletedAt: null,
                lastEarnedPoints: null
            });
        });

        it('preserves current round completion state when an existing player rejoins during play', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        hostUid: 'host123',
                        status: 'playing',
                        playerCount: 2,
                        maxPlayers: 5,
                        currentRound: { id: 'round1' }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        score: 30,
                        joinedAt: 12345,
                        state: 'correct',
                        currentRoundId: 'round1',
                        roundSnippetDurationMs: 2000,
                        roundCompletedAt: 98765,
                        lastEarnedPoints: 25
                    })
                });

            const result = await (joinMultiplayerRoom as any)({ data: { roomId: 'abc234' }, auth: { uid: 'player1' } });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                score: 30,
                state: 'correct',
                currentRoundId: 'round1',
                roundSnippetDurationMs: 2000,
                roundCompletedAt: 98765,
                lastEarnedPoints: 25
            });
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({ playerCount: 2 });
        });
    });

    describe('updateMultiplayerRoomSettings', () => {
        it('rejects non-host updates', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', status: 'lobby' })
            });

            await expect((updateMultiplayerRoomSettings as any)({
                data: { roomId: 'ABC234', playlistId: 'playlist1', playlistName: 'Hits', pointGoal: 100, roundTimerSeconds: 90 },
                auth: { uid: 'player1' }
            })).rejects.toThrow('Only the host can do that');
        });

        it('saves host settings from the lobby', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', status: 'lobby' })
            });

            const result = await (updateMultiplayerRoomSettings as any)({
                data: { roomId: 'ABC234', playlistId: ' playlist1 ', playlistName: ' Hits ', pointGoal: 250, roundTimerSeconds: 90 },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({
                playlistId: 'playlist1',
                playlistName: 'Hits',
                pointGoal: 250,
                roundTimerSeconds: 90,
                status: 'lobby'
            }));
        });

        it('stores profane playlist names censored', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', status: 'lobby' })
            });

            await (updateMultiplayerRoomSettings as any)({
                data: { roomId: 'ABC234', playlistId: 'playlist1', playlistName: 'asshole hits', pointGoal: 100, roundTimerSeconds: 90 },
                auth: { uid: 'host123' }
            });

            const storedName = mockDocUpdate.mock.calls[0][0].playlistName;
            expect(storedName).not.toContain('asshole');
            expect(storedName).toContain('*');
        });
    });

    describe('startMultiplayerGame', () => {
        it('requires a selected playlist', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', status: 'lobby', playlistId: null, playlistName: null })
            });

            await expect((startMultiplayerGame as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'host123' }
            })).rejects.toThrow('Pick a playlist before starting');
        });

        it('starts the first authoritative round when the host starts', async () => {
            mockDocGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ hostUid: 'host123', status: 'lobby', playlistId: 'playlist1', playlistName: 'Hits' })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        tracks: [
                            { id: 'track1', name: 'First Song', artists: [{ name: 'Artist One' }], album: { name: 'Album One', images: [{ url: 'https://example.com/one.jpg' }] } },
                            { id: 'track2', name: 'Second Song', artists: [{ name: 'Artist Two' }], album: { name: 'Album Two', images: [] } }
                        ]
                    })
                });
            vi.spyOn(Math, 'random').mockReturnValue(0);

            const result = await (startMultiplayerGame as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
                trackId: 'track1',
                title: 'First Song',
                previewUrl: 'https://example.com/preview.m4a',
                choices: expect.arrayContaining([
                    expect.objectContaining({ id: 'track1', name: 'First Song', artistName: 'Artist One' })
                ])
            });
            expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                status: 'playing',
                currentRound: expect.objectContaining({
                    trackId: 'track1',
                    artistName: 'Artist One',
                    albumName: 'Album One',
                    artworkUrl: 'https://example.com/300x300.jpg',
                    snippetDurationMs: 2000,
                    state: 'playing',
                    roundNumber: 1
                })
            }));
            expect(mockBatchUpdate.mock.calls[0][1].currentRound).not.toHaveProperty('name');
            expect(mockBatchUpdate.mock.calls[0][1].currentRound).not.toHaveProperty('answerHash');
            expect(mockBatchSet.mock.calls[0][1]).toMatchObject({ answerHash: expect.any(String) });
        });

        it('starts a game with a premade playlist', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    resultCount: 1,
                    results: [
                        {
                            previewUrl: 'https://example.com/as-it-was.m4a',
                            artworkUrl100: 'https://example.com/100x100.jpg',
                            trackName: 'As It Was',
                            artistName: 'Harry Styles',
                            collectionName: 'Harry\'s House'
                        }
                    ]
                })
            }));
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    hostUid: 'host123',
                    status: 'lobby',
                    playlistId: 'guest_top_hits',
                    playlistName: 'Top Hits'
                })
            });
            mockCollectionGet.mockResolvedValueOnce({ docs: [] });
            vi.spyOn(Math, 'random').mockReturnValue(0.999);

            const result = await (startMultiplayerGame as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
                trackId: expect.any(String),
                title: expect.any(String),
                previewUrl: 'https://example.com/as-it-was.m4a'
            });
            expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                status: 'playing'
            }));
        });

        it('rejects starting a game that is already playing', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    hostUid: 'host123',
                    status: 'playing',
                    playlistId: 'playlist1',
                    playlistName: 'Hits',
                    currentRound: { id: 'round1', state: 'playing' }
                })
            });

            await expect((startMultiplayerGame as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'host123' }
            })).rejects.toThrow('The game has already started');

            expect(mockBatchSet).not.toHaveBeenCalled();
            expect(mockBatchCommit).not.toHaveBeenCalled();
        });
    });

    describe('multiplayer gameplay', () => {
        it('returns playable round data only to joined players', async () => {
            mockDocGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        currentRound: {
                            id: 'round1',
                            artworkUrl: null,
                            artistName: 'Artist One',
                            albumName: 'Album One'
                        }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ uid: 'player1' })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        previewUrl: 'https://example.com/preview.m4a',
                        choices: [{ id: 'track1', name: 'First Song', artistName: 'Artist One' }],
                        artworkUrl: null,
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        title: 'First Song'
                    })
                });

            const result = await (getMultiplayerRoundData as any)({
                data: { roomId: 'ABC234', roundId: 'round1' },
                auth: { uid: 'player1' }
            });

            expect(result).toEqual({
                roundId: 'round1',
                previewUrl: 'https://example.com/preview.m4a',
                choices: [{ id: 'track1', name: 'First Song', artistName: 'Artist One' }],
                artworkUrl: null,
                artistName: 'Artist One',
                albumName: 'Album One'
            });
            expect(result).not.toHaveProperty('title');
        });

        it('awards bounded points once for a correct multiplayer guess', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        uid: 'player1',
                        displayName: 'Player One',
                        currentRoundId: 'round1',
                        roundSnippetDurationMs: 2000,
                        state: 'guessing',
                        score: 0
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        playlistId: 'playlist1',
                        hostUid: 'host123',
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [
                        {
                            ref: 'player1-ref',
                            data: () => ({
                                uid: 'player1',
                                displayName: 'Player One',
                                currentRoundId: 'round1',
                                state: 'correct',
                                score: 25
                            })
                        },
                        {
                            ref: 'player2-ref',
                            data: () => ({
                                uid: 'player2',
                                displayName: 'Player Two',
                                currentRoundId: 'round1',
                                state: 'guessing',
                                score: 0
                            })
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                });

            const result = await (submitMultiplayerGuess as any)({
                data: {
                    roomId: 'ABC234',
                    roundId: 'round1',
                    guess: 'First Song',
                    snippetDurationMs: 2000
                },
                auth: { uid: 'player1' }
            });

            expect(result).toEqual({
                correct: true,
                points: 25,
                snippetDurationMs: 2000,
                done: true
            });
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({
                score: { _increment: 25 },
                state: 'correct',
                lastEarnedPoints: 25,
                roundSnippetDurationMs: 2000
            });
        });

        it('times out a late guess instead of awarding points', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(10_000);
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1, endsAt: 9_000 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        uid: 'player1',
                        currentRoundId: 'round1',
                        roundSnippetDurationMs: 2000,
                        state: 'guessing',
                        score: 0
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ id: 'round1', title: 'First Song', artistName: 'Artist One' })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1, endsAt: 9_000 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [
                        {
                            ref: 'player1-ref',
                            data: () => ({ uid: 'player1', currentRoundId: 'round1', state: 'timed-out', score: 0 })
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                });

            const result = await (submitMultiplayerGuess as any)({
                data: {
                    roomId: 'ABC234',
                    roundId: 'round1',
                    guess: 'First Song',
                    snippetDurationMs: 2000
                },
                auth: { uid: 'player1' }
            });

            expect(result).toEqual({ correct: false, points: 0, snippetDurationMs: 2000, done: true });
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({
                state: 'timed-out',
                roundCompletedAt: 10_000,
                lastEarnedPoints: null
            });
            expect(mockFieldValueIncrement).not.toHaveBeenCalled();
        });

        it('rejects guesses from a player whose current round state is not active', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        uid: 'player1',
                        currentRoundId: 'round1',
                        roundSnippetDurationMs: 2000,
                        state: 'lobby',
                        score: 25
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One'
                    })
                });

            await expect((submitMultiplayerGuess as any)({
                data: {
                    roomId: 'ABC234',
                    roundId: 'round1',
                    guess: 'First Song',
                    snippetDurationMs: 2000
                },
                auth: { uid: 'player1' }
            })).rejects.toThrow('You are not active in this round');

            expect(mockTransactionUpdate).not.toHaveBeenCalled();
        });

        it('accepts a multiplayer guess before trailing remaster metadata', async () => {
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        uid: 'player1',
                        displayName: 'Player One',
                        currentRoundId: 'round1',
                        roundSnippetDurationMs: 2000,
                        state: 'guessing',
                        score: 0
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'Any Time At All - Remastered 2009',
                        artistName: 'The Beatles',
                        albumName: 'A Hard Day\'s Night',
                        artworkUrl: null
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        playlistId: 'playlist1',
                        hostUid: 'host123',
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [
                        {
                            ref: 'player1-ref',
                            data: () => ({
                                uid: 'player1',
                                displayName: 'Player One',
                                currentRoundId: 'round1',
                                state: 'correct',
                                score: 25
                            })
                        },
                        {
                            ref: 'player2-ref',
                            data: () => ({
                                uid: 'player2',
                                displayName: 'Player Two',
                                currentRoundId: 'round1',
                                state: 'guessing',
                                score: 0
                            })
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'Any Time At All - Remastered 2009',
                        artistName: 'The Beatles',
                        albumName: 'A Hard Day\'s Night',
                        artworkUrl: null
                    })
                });

            const result = await (submitMultiplayerGuess as any)({
                data: {
                    roomId: 'ABC234',
                    roundId: 'round1',
                    guess: 'Any Time At All',
                    snippetDurationMs: 2000
                },
                auth: { uid: 'player1' }
            });

            expect(result.correct).toBe(true);
            expect(result.points).toBe(25);
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({
                score: { _increment: 25 },
                state: 'correct'
            });
        });
    });

    describe('kickMultiplayerPlayer', () => {
        it('does not allow the host to kick themselves', async () => {
            await expect((kickMultiplayerPlayer as any)({
                data: { roomId: 'ABC234', targetUid: 'host123' },
                auth: { uid: 'host123' }
            })).rejects.toThrow('Choose another player to kick');
        });

        it('deletes the target player and decrements player count', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', status: 'lobby' })
            });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ playerCount: 3 })
                });

            const result = await (kickMultiplayerPlayer as any)({
                data: { roomId: 'ABC234', targetUid: 'player1' },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockTransactionDelete).toHaveBeenCalled();
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({ playerCount: 2 });
        });

        it('settles an active round after kicking the last unfinished player', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(10_000);
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    hostUid: 'host123',
                    status: 'playing',
                    playerCount: 2,
                    pointGoal: 100,
                    currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                })
            });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        hostUid: 'host123',
                        status: 'playing',
                        playerCount: 2,
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [{
                        ref: 'host-ref',
                        data: () => ({ uid: 'host123', currentRoundId: 'round1', state: 'correct', score: 25 })
                    }]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                });

            const result = await (kickMultiplayerPlayer as any)({
                data: { roomId: 'ABC234', targetUid: 'player1' },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockRunTransaction).toHaveBeenCalledTimes(2);
            expect(mockTransactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                currentRound: expect.objectContaining({ state: 'advancing' })
            }));
        });
    });

    describe('leaveMultiplayerRoom', () => {
        it('deletes a guest player and decrements player count', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', playerCount: 3 })
            });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({ playerCount: 3 })
                });

            const result = await (leaveMultiplayerRoom as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'player1' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockTransactionDelete).toHaveBeenCalled();
            expect(mockTransactionUpdate.mock.calls[0][1]).toMatchObject({ playerCount: 2 });
        });

        it('settles an active round after the final guessing player leaves', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(10_000);
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    hostUid: 'host123',
                    status: 'playing',
                    playerCount: 2,
                    pointGoal: 100,
                    currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                })
            });
            mockTransactionGet
                .mockResolvedValueOnce({ exists: true })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        playerCount: 2,
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', roundNumber: 1 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [{
                        ref: 'host-ref',
                        data: () => ({ uid: 'host123', currentRoundId: 'round1', state: 'correct', score: 25 })
                    }]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                });

            await (leaveMultiplayerRoom as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'player1' }
            });

            expect(mockRunTransaction).toHaveBeenCalledTimes(2);
            expect(mockTransactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                currentRound: expect.objectContaining({ state: 'advancing' })
            }));
        });

        it('closes the room when the host leaves', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ hostUid: 'host123', playerCount: 2 })
            });
            mockCollectionGet.mockResolvedValueOnce({
                docs: [{ ref: 'host-player-ref' }, { ref: 'guest-player-ref' }]
            });

            const result = await (leaveMultiplayerRoom as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'host123' }
            });

            expect(result).toEqual({ roomId: 'ABC234' });
            expect(mockBatchDelete).toHaveBeenCalledTimes(2);
            expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                status: 'ended',
                closeReason: 'host-left',
                playerCount: 0
            }));
            expect(mockBatchCommit).toHaveBeenCalled();
        });
    });

    describe('resolveSpotifyTracks', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((resolveSpotifyTracks as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('returns early if no valid trackIds', async () => {
            const result = await (resolveSpotifyTracks as any)({ data: { trackIds: [] }, auth: { uid: 'user1' } });
            expect(result.tracks).toEqual([]);
            expect(result.errors).toContain('Paste at least one Spotify track link.');
        });
    });

    describe('getPlaylistName', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((getPlaylistName as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('throws invalid-argument for bad playlist ID', async () => {
            await expect((getPlaylistName as any)({ data: { playlistId: 'short' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Invalid Spotify playlist ID');
        });

        it('returns playlist name for valid ID', async () => {
            const validId = '1234567890123456789012'; // 22 chars
            const result = await (getPlaylistName as any)({ data: { playlistId: validId }, auth: { uid: 'user1' } });
            expect(result).toEqual({ name: 'Mock Playlist' });
        });
    });

    describe('getUserPlaylists', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((getUserPlaylists as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('throws invalid-argument for empty profile URL', async () => {
            await expect((getUserPlaylists as any)({ data: { profileUrl: '' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Spotify profile URL is required');
        });
    });

    describe('searchPublicPlaylists', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((searchPublicPlaylists as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('throws invalid-argument for short query', async () => {
            await expect((searchPublicPlaylists as any)({ data: { query: 'a' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Search for at least 2 characters');
        });

        it('returns playlist search results for valid query', async () => {
            const result = await (searchPublicPlaylists as any)({ data: { query: 'Road Trip', ownerHint: 'Jamie' }, auth: { uid: 'user1' } });
            expect(result).toEqual({ playlists: [], total: 0 });
        });
    });

    describe('importSpotifyPlaylist', () => {
        it('throws invalid-argument for bad playlist ID', async () => {
            await expect((importSpotifyPlaylist as any)({ data: { playlistId: 'invalid' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Invalid Spotify playlist ID');
        });

        it('throws invalid-argument for non-integer pagination values', async () => {
            await expect((importSpotifyPlaylist as any)({
                data: { playlistId: '1234567890123456789012', offset: 1.5, limit: 100 },
                auth: { uid: 'user1' }
            })).rejects.toThrow('Offset must be an integer from 0 to 5000');

            await expect((importSpotifyPlaylist as any)({
                data: { playlistId: '1234567890123456789012', offset: 0, limit: 101 },
                auth: { uid: 'user1' }
            })).rejects.toThrow('Limit must be an integer from 1 to 100');
        });

        it('passes validated pagination values to Spotify fetch', async () => {
            await (importSpotifyPlaylist as any)({
                data: { playlistId: '1234567890123456789012', offset: 100, limit: 50 },
                auth: { uid: 'user1' }
            });

            expect(fetchPlaylistTracks).toHaveBeenCalledWith('1234567890123456789012', 'mock-token', 100, 50);
        });

        it('rate limits repeated imports per uid', async () => {
            mockTransactionGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    count: 30,
                    windowStartedAtMillis: Date.now()
                })
            });

            await expect((importSpotifyPlaylist as any)({
                data: { playlistId: '1234567890123456789012' },
                auth: { uid: 'user1' }
            })).rejects.toThrow('Too many requests');
        });
    });

    describe('getManualPlaylistTracks', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((getManualPlaylistTracks as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be signed in');
        });

        it('throws invalid-argument for missing playlist ID', async () => {
            await expect((getManualPlaylistTracks as any)({ data: {}, auth: { uid: 'user1' } }))
                .rejects.toThrow('Playlist ID is required');
        });

        it('returns empty tracks if file does not exist', async () => {
            mockFileExists.mockResolvedValueOnce([false]);
            const result = await (getManualPlaylistTracks as any)({ data: { playlistId: 'my-playlist' }, auth: { uid: 'user1' } });
            expect(result).toEqual({ tracks: [] });
            expect(mockFileExists).toHaveBeenCalled();
        });

        it('returns tracks from downloaded file', async () => {
            mockFileExists.mockResolvedValueOnce([true]);
            mockFileDownload.mockResolvedValueOnce([Buffer.from(JSON.stringify([{ id: 't1' }]))]);
            const result = await (getManualPlaylistTracks as any)({ data: { playlistId: 'my-playlist' }, auth: { uid: 'user1' } });
            expect(result).toEqual({ tracks: [{ id: 't1' }] });
            expect(mockFileDownload).toHaveBeenCalled();
        });
    });

    describe('cleanupUserOnDelete', () => {
        it('deletes username reservation, leaderboard data, user playlists, user doc, solo round doc, and storage', async () => {
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ displayName: 'Player One' })
            });
            mockCollectionGet
                .mockResolvedValueOnce({
                    empty: false,
                    size: 1,
                    docs: [{ ref: 'score-ref' }]
                })
                .mockResolvedValueOnce({
                    empty: false,
                    size: 1,
                    docs: [{ ref: 'daily-points-ref' }]
                })
                .mockResolvedValueOnce({
                    empty: false,
                    size: 2,
                    docs: [{ ref: 'playlist-ref-1' }, { ref: 'playlist-ref-2' }]
                });

            await (cleanupUserOnDelete as any)({ uid: 'user123' });

            expect(mockDocDelete).toHaveBeenCalledTimes(4);
            expect(mockBatchDelete).toHaveBeenCalledTimes(4);
            expect(mockBatchCommit).toHaveBeenCalledTimes(3);
            expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'users/user123/' });
        });
    });

    describe('advanceMultiplayerRound', () => {
        it('returns false when an advancing round is not ready yet', async () => {
            mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ uid: 'player1' }) });
            vi.spyOn(Date, 'now').mockReturnValue(1000);
            mockTransactionGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({
                    status: 'playing',
                    currentRound: { id: 'round1', state: 'advancing', advancesAt: 2000, roundNumber: 1 }
                })
            });

            const result = await (advanceMultiplayerRound as any)({
                data: { roomId: 'ABC234' },
                auth: { uid: 'player1' }
            });

            expect(result).toEqual({ roomId: 'ABC234', advanced: false });
            expect(mockTransactionUpdate).not.toHaveBeenCalled();
        });
    });

    describe('expireStuckMultiplayerRounds', () => {
        it('times out unfinished players and settles expired rounds', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(10_000);
            mockQueryGet.mockResolvedValueOnce({
                empty: false,
                size: 1,
                docs: [{ id: 'ABC234', data: () => ({ currentRound: { endsAt: 9_000 } }) }]
            });
            mockTransactionGet
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', endsAt: 9_000 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [{
                        ref: 'player1-ref',
                        data: () => ({ uid: 'player1', currentRoundId: 'round1', state: 'guessing', score: 0 })
                    }]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        status: 'playing',
                        pointGoal: 100,
                        currentRound: { id: 'round1', state: 'playing', endsAt: 9_000 }
                    })
                })
                .mockResolvedValueOnce({
                    docs: [{
                        ref: 'player1-ref',
                        data: () => ({ uid: 'player1', currentRoundId: 'round1', state: 'timed-out', score: 0 })
                    }]
                })
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        id: 'round1',
                        trackId: 'track1',
                        title: 'First Song',
                        artistName: 'Artist One',
                        albumName: 'Album One',
                        artworkUrl: null
                    })
                });

            await (expireStuckMultiplayerRounds as any)();

            expect(mockQueryWhere).toHaveBeenCalledWith('currentRound.state', '==', 'playing');
            expect(mockQueryWhere).toHaveBeenCalledWith('currentRound.endsAt', '<=', 10_000);
            expect(mockQueryOrderBy).toHaveBeenCalledWith('currentRound.endsAt');
            expect(mockQueryGet).toHaveBeenCalledTimes(1);
            expect(mockQueryStartAfter).not.toHaveBeenCalled();
            expect(mockTransactionUpdate).toHaveBeenCalledWith('player1-ref', expect.objectContaining({
                state: 'timed-out',
                roundCompletedAt: 10_000
            }));
            expect(mockTransactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                currentRound: expect.objectContaining({ state: 'advancing' })
            }));
        });

        it('keeps fetching overdue rounds while a page is full', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(10_000);
            const pageOneDocs = Array.from({ length: 50 }, (_, index) => ({
                id: `ROOM${index}`,
                data: () => ({ currentRound: { endsAt: 9_000 } })
            }));
            const pageTwoDocs = Array.from({ length: 3 }, (_, index) => ({
                id: `ROOM5${index}`,
                data: () => ({ currentRound: { endsAt: 9_000 } })
            }));
            mockQueryGet
                .mockResolvedValueOnce({ empty: false, size: 50, docs: pageOneDocs })
                .mockResolvedValueOnce({ empty: false, size: 3, docs: pageTwoDocs });

            await (expireStuckMultiplayerRounds as any)();

            expect(mockQueryGet).toHaveBeenCalledTimes(2);
            expect(mockQueryStartAfter).toHaveBeenCalledTimes(1);
            expect(mockQueryStartAfter).toHaveBeenCalledWith(pageOneDocs[49]);
            expect(mockRunTransaction).toHaveBeenCalledTimes(53);
        });
    });

    describe('advanceStuckMultiplayerRounds', () => {
        it('queries overdue advancing rooms and re-checks them inside a transaction', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(1000);
            mockQueryGet.mockResolvedValueOnce({
                empty: false,
                size: 1,
                docs: [{ id: 'ABC234', data: () => ({ currentRound: { advancesAt: 500 } }) }]
            });

            await (advanceStuckMultiplayerRounds as any)();

            expect(mockQueryWhere).toHaveBeenCalledWith('currentRound.state', '==', 'advancing');
            expect(mockQueryWhere).toHaveBeenCalledWith('currentRound.advancesAt', '<=', 1000);
            expect(mockQueryOrderBy).toHaveBeenCalledWith('currentRound.advancesAt');
            expect(mockQueryGet).toHaveBeenCalledTimes(1);
            expect(mockQueryStartAfter).not.toHaveBeenCalled();
            expect(mockRunTransaction).toHaveBeenCalledTimes(1);
            expect(mockTransactionUpdate).not.toHaveBeenCalled();
        });
    });

    describe('cleanupExpiredMultiplayerRooms', () => {
        it('deletes expired room player and round subcollections before deleting the room', async () => {
            const roomRef = {
                collection: vi.fn(() => ({ get: mockCollectionGet })),
                delete: mockDocDelete
            };
            mockQueryGet.mockResolvedValueOnce({
                empty: false,
                size: 1,
                docs: [{ ref: roomRef }]
            });
            mockCollectionGet
                .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ ref: 'player-ref' }] })
                .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ ref: 'round-ref' }] });

            await (cleanupExpiredMultiplayerRooms as any)();

            expect(mockQueryWhere).toHaveBeenCalledWith('expiresAt', '<=', expect.any(Number));
            expect(mockQueryOrderBy).toHaveBeenCalledWith('expiresAt');
            expect(mockQueryGet).toHaveBeenCalledTimes(1);
            expect(mockQueryStartAfter).not.toHaveBeenCalled();
            expect(mockBatchDelete).toHaveBeenCalledTimes(2);
            expect(mockDocDelete).toHaveBeenCalled();
        });

        it('keeps deleting expired rooms while a page is full', async () => {
            const makeDocs = (count: number, offset: number) => Array.from({ length: count }, (_, index) => ({
                ref: {
                    collection: vi.fn(() => ({ get: mockCollectionGet })),
                    delete: mockDocDelete
                },
                data: () => ({ expiresAt: offset + index })
            }));
            const pageOneDocs = makeDocs(50, 0);
            mockQueryGet
                .mockResolvedValueOnce({ empty: false, size: 50, docs: pageOneDocs })
                .mockResolvedValueOnce({ empty: false, size: 3, docs: makeDocs(3, 50) });

            await (cleanupExpiredMultiplayerRooms as any)();

            expect(mockQueryGet).toHaveBeenCalledTimes(2);
            expect(mockQueryStartAfter).toHaveBeenCalledTimes(1);
            expect(mockQueryStartAfter).toHaveBeenCalledWith(pageOneDocs[49]);
            expect(mockDocDelete).toHaveBeenCalledTimes(53);
        });
    });

    describe('cleanupAnonymousUsers', () => {
        it('cleans user data before bulk deleting inactive anonymous users', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-12T00:00:00Z').getTime());
            mockListUsers.mockResolvedValueOnce({
                users: [
                    {
                        uid: 'anon-old',
                        providerData: [],
                        metadata: { lastSignInTime: '2026-04-01T00:00:00Z', creationTime: '2026-04-01T00:00:00Z' }
                    },
                    {
                        uid: 'anon-new',
                        providerData: [],
                        metadata: { lastSignInTime: '2026-06-01T00:00:00Z', creationTime: '2026-06-01T00:00:00Z' }
                    },
                    {
                        uid: 'password-old',
                        providerData: [{ providerId: 'password' }],
                        metadata: { lastSignInTime: '2026-04-01T00:00:00Z', creationTime: '2026-04-01T00:00:00Z' }
                    }
                ],
                pageToken: undefined
            });
            mockDocGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ displayName: 'Old Guest' })
            });
            mockCollectionGet
                .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ ref: 'score-ref' }] })
                .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ ref: 'daily-points-ref' }] })
                .mockResolvedValueOnce({
                    empty: false,
                    size: 2,
                    docs: [{ ref: 'playlist-ref-1' }, { ref: 'playlist-ref-2' }]
                });

            await (cleanupAnonymousUsers as any)();

            expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'users/anon-old/' });
            expect(mockDeleteUsers).toHaveBeenCalledWith(['anon-old']);
        });
    });
});
