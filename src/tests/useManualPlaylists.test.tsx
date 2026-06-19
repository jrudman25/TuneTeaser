import { renderHook, act } from '@testing-library/react';
import { useManualPlaylists, PLAYLIST_LIMIT, TRACK_LIMIT } from '../hooks/useManualPlaylists';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as firestore from 'firebase/firestore';
import * as storage from 'firebase/storage';

// Mock dependencies
vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore');
    return {
        ...actual,
        collection: vi.fn(() => 'mock-collection-ref'),
        doc: vi.fn(() => ({ id: 'mock-doc-id' })),
        getDocs: vi.fn(),
        orderBy: vi.fn(),
        query: vi.fn(() => 'mock-query'),
        setDoc: vi.fn(),
        updateDoc: vi.fn(),
        deleteDoc: vi.fn(),
        serverTimestamp: vi.fn(() => 'server-timestamp')
    };
});

vi.mock('firebase/storage', async () => {
    const actual = await vi.importActual('firebase/storage');
    return {
        ...actual,
        ref: vi.fn(),
        uploadBytes: vi.fn(),
        getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com')),
        deleteObject: vi.fn()
    };
});

vi.mock('../backend/FirebaseConfig', () => ({
    db: {},
    storage: {}
}));

describe('useManualPlaylists', () => {
    const mockUser = {
        uid: 'user123',
        isAnonymous: false
    } as unknown as import('firebase/auth').User;
    const mockGuestUser = {
        uid: 'guest123',
        isAnonymous: true
    } as unknown as import('firebase/auth').User;

    beforeEach(() => {
        vi.resetAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Guest User Flows', () => {
        it('fetches guest playlists from localStorage', async () => {
            localStorage.setItem('guestPlaylists', JSON.stringify([
                { id: '1', name: 'Guest Playlist' }
            ]));

            const { result } = renderHook(() => useManualPlaylists(null, true));

            await act(async () => {
                await result.current.fetchManualPlaylists();
            });

            expect(result.current.manualPlaylists).toHaveLength(1);
            expect(result.current.manualPlaylists[0].name).toBe('Guest Playlist');
        });

        it('adds a new playlist for guest to localStorage', async () => {
            const { result } = renderHook(() => useManualPlaylists(mockGuestUser, true));

            await act(async () => {
                await result.current.addManualPlaylist(
                    'New Guest Playlist',
                    'https://open.spotify.com/playlist/test',
                    [{ id: 't1', name: 'Track 1', artists: [{ name: 'Artist 1' }], album: { name: '', images: [] } }]
                );
            });

            const stored = JSON.parse(localStorage.getItem('guestPlaylists') || '[]');
            expect(stored).toHaveLength(1);
            expect(stored[0].name).toBe('New Guest Playlist');
            expect(stored[0].tracksUrl).toBe('https://mock-url.com');
            expect(storage.uploadBytes).toHaveBeenCalled();
            expect(storage.ref).toHaveBeenCalledWith({}, expect.stringMatching(/^users\/guest123\/playlists\/guest_manual_\d+\.json$/));
        });

        it('deletes a guest playlist from localStorage', async () => {
            localStorage.setItem('guestPlaylists', JSON.stringify([
                { id: 'playlist-1', name: 'Guest Playlist' }
            ]));

            const { result } = renderHook(() => useManualPlaylists(mockGuestUser, true));

            await act(async () => {
                await result.current.deleteManualPlaylist('playlist-1');
            });

            const stored = JSON.parse(localStorage.getItem('guestPlaylists') || '[]');
            expect(stored).toHaveLength(0);
            expect(storage.ref).toHaveBeenCalledWith({}, 'users/guest123/playlists/playlist-1.json');
        });
    });

    describe('Authenticated User Flows', () => {
        it('fetches playlists from firestore for signed in user', async () => {
            (firestore.getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
                docs: [
                    { id: 'p1', data: () => ({ name: 'Auth Playlist' }) }
                ]
            });

            const { result } = renderHook(() => useManualPlaylists(mockUser, false));

            await act(async () => {
                await result.current.fetchManualPlaylists();
            });

            expect(result.current.manualPlaylists).toHaveLength(1);
            expect(result.current.manualPlaylists[0].name).toBe('Auth Playlist');
            expect(firestore.collection).toHaveBeenCalledWith({}, 'users', 'user123', 'playlists');
        });

        it('adds a new playlist for signed in user to firestore', async () => {
            // First getDocs is to check limits
            (firestore.getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });

            const { result } = renderHook(() => useManualPlaylists(mockUser, false));

            await act(async () => {
                await result.current.addManualPlaylist(
                    'New Auth Playlist',
                    'https://open.spotify.com/playlist/test',
                    []
                );
            });

            expect(firestore.setDoc).toHaveBeenCalledWith(
                { id: 'mock-doc-id' }, // Doc ref
                expect.objectContaining({
                    name: 'New Auth Playlist',
                    status: 'ready'
                })
            );
        });
    });

    describe('Regex and Validation (playlistNameRegex)', () => {
        it('rejects empty names', async () => {
            const { result } = renderHook(() => useManualPlaylists(null, true));

            await expect(
                act(async () => {
                    await result.current.addManualPlaylist('   ', 'url', []);
                })
            ).rejects.toThrow('Playlist name is required.');
        });

        it('accepts valid playlist names', async () => {
            const { result } = renderHook(() => useManualPlaylists(mockGuestUser, true));
            const validNames = [
                'My Playlist',
                'Rock_Classics-2026',
                'Hits!',
                'Best of (Live)',
                'Cool #1',
                'My "Playlist"',
                "John's Mix",
                'A, B & C',
                'Mix [Vol 1]',
                'Test/Track'
            ];

            for (const name of validNames) {
                await act(async () => {
                    await result.current.addManualPlaylist(name, 'url', []);
                });
            }

            const stored = JSON.parse(localStorage.getItem('guestPlaylists') || '[]');
            expect(stored.length).toBe(validNames.length);
        });

        it('rejects invalid characters in playlist names', async () => {
            const { result } = renderHook(() => useManualPlaylists(null, true));
            const invalidNames = [
                'My Playlist 🎶', // emoji
                'Hacking<Script>', // brackets
                'Test;DropTable', // semicolon
                'Infinity ∞' // special symbol
            ];

            for (const name of invalidNames) {
                await expect(
                    act(async () => {
                        await result.current.addManualPlaylist(name, 'url', []);
                    })
                ).rejects.toThrow('Playlist name must be 1-100 characters long');
            }
        });

        it('rejects playlist names that are too long', async () => {
            const { result } = renderHook(() => useManualPlaylists(null, true));
            const tooLongName = 'A'.repeat(101);

            await expect(
                act(async () => {
                    await result.current.addManualPlaylist(tooLongName, 'url', []);
                })
            ).rejects.toThrow('Playlist name must be 1-100 characters long');
        });
    });

    describe('Limits enforcement', () => {
        it('enforces PLAYLIST_LIMIT for guests', async () => {
            // Setup max playlists
            const maxPlaylists = Array.from({ length: PLAYLIST_LIMIT }).map((_, i) => ({ id: `${i}`, name: `P${i}` }));
            localStorage.setItem('guestPlaylists', JSON.stringify(maxPlaylists));

            const { result } = renderHook(() => useManualPlaylists(null, true));

            await expect(
                act(async () => {
                    await result.current.addManualPlaylist('One More', 'url', []);
                })
            ).rejects.toThrow(`You have reached the limit of ${PLAYLIST_LIMIT} playlists`);
        });

        it('enforces TRACK_LIMIT by capping the tracks array', async () => {
            const { result } = renderHook(() => useManualPlaylists(mockGuestUser, true));

            const tooManyTracks = Array.from({ length: TRACK_LIMIT + 10 }).map((_, i) => ({
                id: `t${i}`, name: `Track ${i}`, artists: [{ name: 'A' }], album: { name: '', images: [] }
            }));

            await act(async () => {
                await result.current.addManualPlaylist('Track Limit Test', 'url', tooManyTracks);
            });

            // The tracks sent to storage should be capped at TRACK_LIMIT
            // Since we passed a Blob to uploadBytes in the hook, let's just assert that the 
            // uploadBytes was called, we can't easily parse the Blob here.
            expect(storage.uploadBytes).toHaveBeenCalled();

            const stored = JSON.parse(localStorage.getItem('guestPlaylists') || '[]');
            expect(stored[0].totalCount).toBe(TRACK_LIMIT);
            expect(stored[0].importedCount).toBe(TRACK_LIMIT);
        });
    });
});
