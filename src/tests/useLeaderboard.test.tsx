import { renderHook, act } from '@testing-library/react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore');
    return {
        ...actual,
        collection: vi.fn(() => 'mock-collection-ref'),
        doc: vi.fn(() => 'mock-doc-ref'),
        onSnapshot: vi.fn(() => vi.fn()), // returns an unsubscribe function
        orderBy: vi.fn(),
        query: vi.fn(() => 'mock-query'),
        limit: vi.fn(),
        where: vi.fn(),
        setDoc: vi.fn(),
        getCountFromServer: vi.fn(),
        serverTimestamp: vi.fn(() => 'server-timestamp'),
        increment: vi.fn((val) => ({ _increment: val }))
    };
});

vi.mock('../backend/FirebaseConfig', () => ({
    db: {}
}));

describe('useLeaderboard', () => {
    const mockUser = {
        uid: 'user123',
        displayName: 'Test User',
        email: 'test@example.com',
        isAnonymous: false
    } as unknown as import('firebase/auth').User;

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with loading state and sets up top players listener', () => {
        (firestore.onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((query, callback) => {
            // simulate initial snapshot with data
            callback({
                docs: [
                    { id: 'player1', data: () => ({ displayName: 'Player 1', totalPoints: 100, gamesWon: 5 }) }
                ]
            });
            return vi.fn(); // unsubscribe fn
        });

        const { result } = renderHook(() => useLeaderboard(null));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.topPlayers).toHaveLength(1);
        expect(result.current.topPlayers[0].displayName).toBe('Player 1');
        expect(firestore.onSnapshot).toHaveBeenCalledTimes(1); // Only top players, since user is null
    });

    it('sets up current user listener if user is logged in', async () => {
        let userSnapshotCallback: (snapshot: { exists: () => boolean, data?: () => unknown }) => void;
        (firestore.onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((queryOrDoc, callback) => {
            if (queryOrDoc === 'mock-doc-ref') {
                userSnapshotCallback = callback;
            }
            return vi.fn();
        });

        const { result } = renderHook(() => useLeaderboard(mockUser));

        (firestore.getCountFromServer as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: () => ({ count: 5 })
        });

        await act(async () => {
            // TypeScript check to ensure it was assigned
            if (userSnapshotCallback) {
                await userSnapshotCallback({
                    exists: () => true,
                    data: () => ({ displayName: 'Test User', totalPoints: 50, gamesWon: 2 })
                });
            }
        });

        expect(result.current.currentUserEntry).toBeDefined();
        expect(result.current.currentUserEntry?.totalPoints).toBe(50);
        expect(result.current.currentUserRank).toBe(6); // 5 + 1
    });

    it('handles null user entry gracefully', async () => {
        let userSnapshotCallback: (snapshot: { exists: () => boolean, data?: () => unknown }) => void;
        (firestore.onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((queryOrDoc, callback) => {
            if (queryOrDoc === 'mock-doc-ref') {
                userSnapshotCallback = callback;
            }
            return vi.fn();
        });

        const { result } = renderHook(() => useLeaderboard(mockUser));

        await act(async () => {
            if (userSnapshotCallback) {
                await userSnapshotCallback({
                    exists: () => false
                });
            }
        });

        expect(result.current.currentUserEntry).toBeNull();
        expect(result.current.currentUserRank).toBeNull();
    });

    it('submitScore increments score', async () => {
        const { result } = renderHook(() => useLeaderboard(mockUser));

        await act(async () => {
            await result.current.submitScore(10);
        });

        expect(firestore.setDoc).toHaveBeenCalledWith(
            'mock-doc-ref',
            expect.objectContaining({
                displayName: 'Test User',
                totalPoints: { _increment: 10 },
                gamesWon: { _increment: 1 },
                lastUpdated: 'server-timestamp'
            }),
            { merge: true }
        );
    });

    it('submitScore does nothing for anonymous user', async () => {
        const anonymousUser = { ...mockUser, isAnonymous: true };
        const { result } = renderHook(() => useLeaderboard(anonymousUser));

        await act(async () => {
            await result.current.submitScore(10);
        });

        expect(firestore.setDoc).not.toHaveBeenCalled();
    });
});
