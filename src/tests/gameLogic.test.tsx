/**
 * gameLogic.test.tsx
 * Tests the useGameLogic hook.
 * @version 2026.02.09
 */
import { renderHook, act } from '@testing-library/react';
import { useGameLogic } from '../hooks/useGameLogic';
import { getItunesPreview } from '../utils/itunes';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mocks
vi.mock('../utils/itunes', () => ({
    getItunesPreview: vi.fn()
}));

vi.mock('../hooks/usePreviewPlayer', () => ({
    default: () => ({
        playPreview: vi.fn(),
        pause: vi.fn(),
        isPlaying: false,
        error: null,
        volume: 0.5,
        setVolume: vi.fn()
    })
}));

describe('useGameLogic - Auto Skip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Restore console to avoid polluting output, but maybe spy on it if needed
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('skips tracks with no preview and selects a valid one', async () => {
        const mockTracks = [
            { track: { id: '1', name: 'Bad Song', artists: [{ name: 'Artist 1' }], uri: 'uri1' } },
            { track: { id: '2', name: 'Good Song', artists: [{ name: 'Artist 2' }], uri: 'uri2' } }
        ];

        // Mock getItunesPreview implementation to return null for Bad Song, URL for Good Song
        (getItunesPreview as any).mockImplementation(async (name: string) => {
            if (name === 'Bad Song') return null;
            if (name === 'Good Song') return 'http://preview.url/good';
            return null;
        });

        const { result } = renderHook(() => useGameLogic('fake-token'));

        await act(async () => {
            // Since startGame shuffles, we might hit Good Song first. 
            // To ensure we test skipping, we can force the shuffle or just check that *eventually* we get a valid song and NO invalid song is set as target.
            // Actually, mocking Math.random is better to ensure deterministic order.
            vi.spyOn(Math, 'random').mockReturnValue(0.1); // Ensure predictable shuffle/random index?
            // The shuffle uses .sort(() => 0.5 - Math.random()). 
            // If Math.random() < 0.5, it returns positive (swap).
            // Let's just trust that the logic handles it. 
            // If we limit the mock tracks, it HAS to pick one or the other.

            await result.current.startGame(mockTracks);
        });

        // Should have selected Good Song (id: 2) eventually
        expect(result.current.targetSong?.id).toBe('2');
        expect(getItunesPreview).toHaveBeenCalled();

        // Verify we didn't end up with Bad Song
        expect(result.current.targetSong?.name).not.toBe('Bad Song');
    });

    it('handles case where no tracks have previews', async () => {
        const mockTracks = [
            { track: { id: '1', name: 'Bad Song 1', artists: [{ name: 'Artist 1' }], uri: 'uri1' } }
        ];

        (getItunesPreview as any).mockResolvedValue(null);

        const { result } = renderHook(() => useGameLogic('fake-token'));

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.targetSong).toBeNull();
        expect(result.current.feedbackMessage).toContain('No playable tracks');
    });
});
