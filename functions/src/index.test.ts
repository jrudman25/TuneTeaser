import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({
    initializeApp: vi.fn(),
}));

// We need to mock getFirestore and getStorage before importing index
const mockDocDelete = vi.fn();
const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionGet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchSet = vi.fn();
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

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        increment: mockFieldValueIncrement,
        serverTimestamp: mockFieldValueServerTimestamp,
        delete: mockFieldValueDelete
    },
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                delete: mockDocDelete,
                get: mockDocGet,
                update: mockDocUpdate,
                collection: vi.fn(() => ({
                    get: mockCollectionGet,
                    doc: vi.fn(() => ({
                        get: mockDocGet,
                        update: mockDocUpdate,
                        delete: mockDocDelete
                    }))
                }))
            }))
        })),
        batch: vi.fn(() => ({
            delete: mockBatchDelete,
            set: mockBatchSet,
            update: mockBatchUpdate,
            commit: mockBatchCommit
        })),
        runTransaction: mockRunTransaction
    }))
}));

const mockGetUser = vi.fn();
const mockListUsers = vi.fn();
const mockDeleteUsers = vi.fn();

vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        getUser: mockGetUser,
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
    fetchPlaylistTracks: vi.fn(() => Promise.resolve({ name: 'P', tracks: [], total: 0, errors: [] })),
    normalizeTrackIds: vi.fn((ids) => ids || [])
}));

import { 
    resolveSpotifyTracks, 
    getPlaylistName, 
    getUserPlaylists, 
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
    submitLeaderboardScore,
    cleanupAnonymousUsers,
    shouldEnforceAppCheck
} from './index';

describe('Cloud Functions (index.ts)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ displayName: 'Player One' });
        mockListUsers.mockResolvedValue({ users: [] });
        mockBatchCommit.mockResolvedValue(undefined);
        mockDocUpdate.mockResolvedValue(undefined);
        mockTransactionGet.mockResolvedValue({ exists: false, data: () => ({}) });
        mockCollectionGet.mockResolvedValue({ empty: true, size: 0, docs: [] });
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

    describe('submitLeaderboardScore', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((submitLeaderboardScore as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be logged in');
        });

        it('rejects anonymous users', async () => {
            await expect((submitLeaderboardScore as any)({
                data: {
                    playlistId: 'playlist1',
                    songId: 'song1',
                    playlistTrackCount: 10,
                    snippetDurationMs: 2000
                },
                auth: { uid: 'anon1', token: { firebase: { sign_in_provider: 'anonymous' } } }
            })).rejects.toThrow('Anonymous users cannot submit leaderboard scores');
        });

        it('rejects playlists below the scoring threshold', async () => {
            await expect((submitLeaderboardScore as any)({
                data: {
                    playlistId: 'playlist1',
                    songId: 'song1',
                    playlistTrackCount: 9,
                    snippetDurationMs: 2000
                },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('This playlist is not eligible');
        });

        it('calculates bounded points and writes leaderboard increments in a transaction', async () => {
            mockTransactionGet.mockResolvedValueOnce({ exists: false });

            const result = await (submitLeaderboardScore as any)({
                data: {
                    playlistId: 'playlist1',
                    songId: 'song1',
                    playlistTrackCount: 10,
                    snippetDurationMs: 2000
                },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            });

            expect(result).toEqual({ points: 25 });
            expect(mockTransactionSet).toHaveBeenCalledTimes(2);
            expect(mockTransactionSet.mock.calls[0][1]).toMatchObject({
                displayName: 'Player One',
                totalPoints: { _increment: 25 },
                gamesWon: { _increment: 1 },
                lastUpdated: 'server-timestamp'
            });
            expect(mockTransactionSet.mock.calls[0][2]).toEqual({ merge: true });
            expect(mockTransactionSet.mock.calls[1][1]).toMatchObject({
                playlistId: 'playlist1',
                songId: 'song1'
            });
        });

        it('rejects scoring the same song and playlist during cooldown', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(1000000);
            mockTransactionGet.mockResolvedValueOnce({
                exists: true,
                data: () => ({ scoredAtMillis: 999000 })
            });

            await expect((submitLeaderboardScore as any)({
                data: {
                    playlistId: 'playlist1',
                    songId: 'song1',
                    playlistTrackCount: 10,
                    snippetDurationMs: 2000
                },
                auth: { uid: 'user123', token: { firebase: { sign_in_provider: 'password' } } }
            })).rejects.toThrow('This song was scored recently');
        });
    });

    describe('createMultiplayerRoom', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((createMultiplayerRoom as any)({ data: { roomName: 'Party' }, auth: undefined }))
                .rejects.toThrow('You must be logged in');
        });

        it('creates a lobby room and host player', async () => {
            mockDocGet.mockResolvedValueOnce({ exists: false });

            const result = await (createMultiplayerRoom as any)({ data: { roomName: ' Party Room ' }, auth: { uid: 'host123' } });

            expect(result.roomId).toMatch(/^[A-Z2-9]{6}$/);
            expect(mockBatchSet).toHaveBeenCalledTimes(2);
            expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
                id: result.roomId,
                roomName: 'Party Room',
                hostUid: 'host123',
                status: 'lobby',
                maxPlayers: 5,
                playerCount: 1,
                pointGoal: 100
            });
            expect(mockBatchSet.mock.calls[1][1]).toMatchObject({
                uid: 'host123',
                displayName: 'Player One',
                isHost: true,
                score: 0,
                state: 'lobby'
            });
            expect(mockBatchCommit).toHaveBeenCalled();
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
                    artworkUrl: 'https://example.com/600x600.jpg',
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
            vi.spyOn(Math, 'random').mockReturnValue(0);

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
                playerCount: 0
            }));
            expect(mockBatchCommit).toHaveBeenCalled();
        });
    });

    describe('resolveSpotifyTracks', () => {
        it('throws unauthenticated if no auth', async () => {
            await expect((resolveSpotifyTracks as any)({ data: {}, auth: undefined }))
                .rejects.toThrow('You must be logged in');
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
                .rejects.toThrow('You must be logged in');
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
                .rejects.toThrow('You must be logged in');
        });

        it('throws invalid-argument for empty profile URL', async () => {
            await expect((getUserPlaylists as any)({ data: { profileUrl: '' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Spotify profile URL is required');
        });
    });

    describe('importSpotifyPlaylist', () => {
        it('throws invalid-argument for bad playlist ID', async () => {
            await expect((importSpotifyPlaylist as any)({ data: { playlistId: 'invalid' }, auth: { uid: 'user1' } }))
                .rejects.toThrow('Invalid Spotify playlist ID');
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
                .rejects.toThrow('You must be logged in');
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
        it('deletes leaderboard data, user playlists, user doc, and storage', async () => {
            mockCollectionGet
                .mockResolvedValueOnce({
                    empty: false,
                    size: 1,
                    docs: [{ ref: 'score-ref' }]
                })
                .mockResolvedValueOnce({
                    empty: false,
                    size: 2,
                    docs: [{ ref: 'playlist-ref-1' }, { ref: 'playlist-ref-2' }]
                });

            await (cleanupUserOnDelete as any)({ uid: 'user123' });

            expect(mockDocDelete).toHaveBeenCalledTimes(2);
            expect(mockBatchDelete).toHaveBeenCalledTimes(3);
            expect(mockBatchCommit).toHaveBeenCalledTimes(2);
            expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'users/user123/' });
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
            mockCollectionGet
                .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ ref: 'score-ref' }] })
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
