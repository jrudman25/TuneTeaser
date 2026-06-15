/**
 * gameLogic.test.tsx
 * Tests the useGameLogic hook: guess matching, auto-skip, and playlist loading.
 * @version 2026.05.26
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

describe('useGameLogic - Guess Matching', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        (getItunesPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
            previewUrl: 'http://test-preview-url.com',
            artworkUrl: 'http://test-art.com'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with idle state', () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        expect(result.current.gameState).toBe('idle');
    });

    it('correctly identifies a correct guess (exact match)', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Paranoid Android', uri: 'spotify:track:1', artists: [{ name: 'Radiohead' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.targetSong?.name).toBe('Paranoid Android');

        act(() => { result.current.setUserGuess('paranoid android'); });
        act(() => { result.current.handleGuessSubmit(); });

        expect(result.current.gameState).toBe('end');
        expect(result.current.feedbackMessage).toContain('Correct');
    });

    it('correctly identifies a correct guess (partial match)', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Paranoid Android (Remastered)', uri: 'spotify:track:1', artists: [{ name: 'Radiohead' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.targetSong?.name).toBe('Paranoid Android (Remastered)');

        act(() => { result.current.setUserGuess('paranoid android'); });
        act(() => { result.current.handleGuessSubmit(); });

        expect(result.current.gameState).toBe('end');
        expect(result.current.feedbackMessage).toContain('Correct');
    });

    it('rejects short common substrings even when they appear in the title', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Love in the Dark', uri: 'spotify:track:1', artists: [{ name: 'Adele' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        act(() => { result.current.setUserGuess('love'); });
        act(() => { result.current.handleGuessSubmit(); });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.feedbackMessage).toContain('Incorrect');
    });

    it('correctly identifies a correct guess (no punctuation)', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Why Can\'t We Be Friends?', uri: 'spotify:track:1', artists: [{ name: 'War' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.targetSong?.name).toBe('Why Can\'t We Be Friends?');

        act(() => { result.current.setUserGuess('why cant we be friends'); });
        act(() => { result.current.handleGuessSubmit(); });

        expect(result.current.gameState).toBe('end');
        expect(result.current.feedbackMessage).toContain('Correct');
    });

    it('correctly identifies a wrong guess', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1', artists: [{ name: 'The Smiths' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.targetSong?.name).toBe('Some Girls Are Bigger Than Others');

        act(() => { result.current.setUserGuess('There Is a Light That Never Goes Out'); });
        act(() => { result.current.handleGuessSubmit(); });

        expect(result.current.gameState).toBe('playing');
        expect(result.current.feedbackMessage).toContain('Incorrect');
    });

    it('correctly identifies two wrong guesses', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1', artists: [{ name: 'The Smiths' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');

        act(() => { result.current.setUserGuess('There Is a Light That Never Goes Out'); });
        act(() => { result.current.handleGuessSubmit(); });
        expect(result.current.gameState).toBe('playing');
        expect(result.current.feedbackMessage).toContain('Incorrect');

        act(() => { result.current.setUserGuess('The Queen Is Dead'); });
        act(() => { result.current.handleGuessSubmit(); });
        expect(result.current.gameState).toBe('playing');
        expect(result.current.feedbackMessage).toContain('Incorrect');
    });

    it('correctly identifies a right guess after a wrong guess', async () => {
        const { result } = renderHook(() => useGameLogic('fake-token', false));
        const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1', artists: [{ name: 'The Smiths' }] } }];

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.gameState).toBe('playing');

        act(() => { result.current.setUserGuess('There Is a Light That Never Goes Out'); });
        act(() => { result.current.handleGuessSubmit(); });
        expect(result.current.gameState).toBe('playing');
        expect(result.current.feedbackMessage).toContain('Incorrect');

        act(() => { result.current.setUserGuess('Some Girls Are Bigger Than Others'); });
        act(() => { result.current.handleGuessSubmit(); });
        expect(result.current.gameState).toBe('end');
        expect(result.current.feedbackMessage).toContain('Correct');
    });
});

describe('useGameLogic - Auto Skip', () => {
    beforeEach(() => {
        vi.resetAllMocks();
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

        (getItunesPreview as ReturnType<typeof vi.fn>).mockImplementation(async (name: string) => {
            if (name === 'Bad Song') return null;
            if (name === 'Good Song') return { previewUrl: 'http://preview.url/good', artworkUrl: 'http://art.url' };
            return null;
        });

        const { result } = renderHook(() => useGameLogic('fake-token', false));

        await act(async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.1);
            await result.current.startGame(mockTracks);
        });

        expect(result.current.targetSong?.id).toBe('2');
        expect(getItunesPreview).toHaveBeenCalled();
        expect(result.current.targetSong?.name).not.toBe('Bad Song');
    });

    it('handles case where no tracks have previews', async () => {
        const mockTracks = [
            { track: { id: '1', name: 'Bad Song 1', artists: [{ name: 'Artist 1' }], uri: 'uri1' } }
        ];

        (getItunesPreview as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const { result } = renderHook(() => useGameLogic('fake-token', false));

        await act(async () => {
            await result.current.startGame(mockTracks);
        });

        expect(result.current.targetSong).toBeNull();
        expect(result.current.feedbackMessage).toContain('No playable tracks');
    });

    it('loads playlist from manualPlaylists if isManualMode is true', async () => {
        const mockManualPlaylists = [{
            id: 'playlist1',
            tracks: [{ id: 'guest1', name: 'Guest Song', artists: [{ name: 'Guest Artist' }] }]
        }];

        (getItunesPreview as ReturnType<typeof vi.fn>).mockResolvedValue({ previewUrl: 'url', artworkUrl: 'art' });

        const { result } = renderHook(() => useGameLogic('fake-token', false, mockManualPlaylists as any, true));

        await act(async () => {
            await result.current.loadPlaylist('playlist1', 'Playlist 1');
        });

        expect(result.current.feedbackMessage).toBe('');
        expect(getItunesPreview).toHaveBeenCalled();
        expect(result.current.targetSong?.id).toBe('guest1');
        expect(result.current.isLoadingGame).toBe(false);
    });
});
