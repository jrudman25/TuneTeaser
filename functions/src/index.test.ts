import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({
    initializeApp: vi.fn(),
}));

// We need to mock getFirestore and getStorage before importing index
const mockDocDelete = vi.fn();
const mockCollectionGet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                delete: mockDocDelete,
                collection: vi.fn(() => ({
                    get: mockCollectionGet
                }))
            }))
        })),
        batch: vi.fn(() => ({
            delete: mockBatchDelete,
            commit: mockBatchCommit
        }))
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
    cleanupUserOnDelete 
} from './index';

describe('Cloud Functions (index.ts)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        it('deletes user docs and storage', async () => {
            mockCollectionGet.mockResolvedValueOnce({
                empty: false,
                size: 2,
                docs: [{ ref: 'ref1' }, { ref: 'ref2' }]
            });

            await (cleanupUserOnDelete as any)({ uid: 'user123' });

            expect(mockDocDelete).toHaveBeenCalled();
            expect(mockBatchDelete).toHaveBeenCalledTimes(2);
            expect(mockBatchCommit).toHaveBeenCalled();
            expect(mockDeleteFiles).toHaveBeenCalledWith({ prefix: 'users/user123/' });
        });
    });
});
