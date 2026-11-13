import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameLogic } from '../hooks/useGameLogic';
import { ManualPlaylist } from '../utils/manualPlaylists';

const mocks = vi.hoisted(() => ({
    preloadPreview: vi.fn()
}));

vi.mock('../hooks/usePreviewPlayer', () => ({
    default: () => ({
        playPreview: vi.fn(),
        pause: vi.fn(),
        isPlaying: false,
        error: null,
        volume: 0.5,
        setVolume: vi.fn(),
        positionMs: 0,
        playbackDurationMs: 0,
        preloadPreview: mocks.preloadPreview
    })
}));

const mockStartSoloRound = vi.fn();
const mockSubmitSoloGuess = vi.fn();
const mockGiveUpSoloRound = vi.fn();

vi.mock('../utils/soloRounds', () => ({
    startSoloRound: (...args: any[]) => mockStartSoloRound(...args),
    submitSoloGuess: (...args: any[]) => mockSubmitSoloGuess(...args),
    giveUpSoloRound: (...args: any[]) => mockGiveUpSoloRound(...args)
}));

const mockGetManualPlaylistTracks = vi.fn();
vi.mock('../utils/spotifyPlaylistImporter', () => ({
    getManualPlaylistTracks: (...args: any[]) => mockGetManualPlaylistTracks(...args)
}));

const makeTrack = (id: string, name: string) => ({
    id,
    name,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [] }
});

const manualPlaylist: ManualPlaylist = {
    id: 'manual1',
    name: 'My Mix',
    sourceUrl: '',
    sourceType: 'spotify-url',
    tracks: [makeTrack('t1', 'Song One'), makeTrack('t2', 'Song Two')]
};

const ROUND = {
    roundId: 'round-1',
    previewUrl: 'https://preview.example/x.m4a',
    snippetDurationMs: 2000,
    eligibleForPoints: true,
    playableTrackCount: 2
};

const ANSWER = {
    id: 't1',
    name: 'Song One',
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [] }
};

describe('useGameLogic (server-run solo rounds)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStartSoloRound.mockResolvedValue(ROUND);
        mockGetManualPlaylistTracks.mockResolvedValue(manualPlaylist.tracks);
    });

    const renderGame = () => renderHook(() => useGameLogic(false, [manualPlaylist], true));

    it('starts a server round with a preview and no answer exposed', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        expect(mockStartSoloRound).toHaveBeenCalledWith('manual1');
        expect(result.current.gameState).toBe('playing');
        expect(result.current.currentRoundId).toBe('round-1');
        expect(result.current.snippetDuration).toBe(2000);
        expect(result.current.targetSong).toBeNull();
        expect(result.current.currentTracks).toHaveLength(2);
    });

    it('extends the snippet on a blank guess', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'incorrect', snippetDurationMs: 4000, pointsAwarded: null });

        let response: any;
        await act(async () => {
            response = await result.current.handleGuessSubmit('');
        });

        expect(mockSubmitSoloGuess).toHaveBeenCalledWith('round-1', '');
        expect(response.result).toBe('incorrect');
        expect(result.current.snippetDuration).toBe(4000);
        expect(result.current.feedbackMessage).toContain('extended');
        expect(result.current.wrongGuesses).toHaveLength(0);
    });

    it('reveals the answer on a correct guess', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
        });

        expect(result.current.gameState).toBe('end');
        expect(result.current.targetSong).toEqual(ANSWER);
        expect(result.current.feedbackMessage).toContain('Correct');
    });

    it('reveals the answer when out of snippet', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'out-of-snippet', snippetDurationMs: 30000, pointsAwarded: null, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('nope');
        });

        expect(result.current.gameState).toBe('end');
        expect(result.current.targetSong).toEqual(ANSWER);
        expect(result.current.feedbackMessage).toContain('Song One');
    });

    it('tracks wrong guesses with case-insensitive dedupe', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'incorrect', snippetDurationMs: 4000, pointsAwarded: null });

        await act(async () => {
            await result.current.handleGuessSubmit('Wrong One');
            await result.current.handleGuessSubmit('wrong one');
            await result.current.handleGuessSubmit('Wrong Two');
        });

        expect(result.current.wrongGuesses).toEqual(['Wrong One', 'Wrong Two']);
    });

    it('reveals the answer on give up', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        mockGiveUpSoloRound.mockResolvedValue({ answer: ANSWER });

        await act(async () => {
            await result.current.handleGiveUp();
        });

        expect(mockGiveUpSoloRound).toHaveBeenCalledWith('round-1');
        expect(result.current.gameState).toBe('end');
        expect(result.current.targetSong).toEqual(ANSWER);
    });

    it('returns to idle with feedback when the start call fails', async () => {
        mockStartSoloRound.mockRejectedValue(new Error('Could not find a playable preview for this playlist.'));
        const { result } = renderGame();

        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        expect(result.current.gameState).toBe('idle');
        expect(result.current.feedbackMessage).toContain('playable preview');
    });

    it('discards a stale playlist load', async () => {
        const { result } = renderGame();
        let resolveFirst: (v: any) => void = () => { };
        mockStartSoloRound
            .mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }))
            .mockResolvedValueOnce({ ...ROUND, roundId: 'second' });

        await act(async () => {
            void result.current.loadPlaylist('manual1', 'My Mix');
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(1);

        await act(async () => {
            result.current.handleSelectNewPlaylist();
        });
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        expect(result.current.currentRoundId).toBe('second');

        resolveFirst({ ...ROUND, roundId: 'first' });
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(result.current.currentRoundId).toBe('second');
    });

    it('prefetches the next round when a game ends and reuses it on Play Again', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(1);
        expect(mocks.preloadPreview).toHaveBeenCalledWith(ROUND.previewUrl);

        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'round-2' });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
            await Promise.resolve();
        });

        expect(result.current.gameState).toBe('end');
        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);
        expect(mockStartSoloRound).toHaveBeenLastCalledWith('manual1');

        await act(async () => {
            result.current.handlePlayAgain();
            await Promise.resolve();
        });

        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);
        expect(result.current.gameState).toBe('playing');
        expect(result.current.currentRoundId).toBe('round-2');
    });

    it('awaits an in-flight prefetch instead of starting a second round', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        let resolvePrefetch: (value: unknown) => void = () => { };
        mockStartSoloRound.mockImplementationOnce(() => new Promise(resolve => { resolvePrefetch = resolve; }));
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);

        await act(async () => {
            result.current.handlePlayAgain();
        });
        resolvePrefetch({ ...ROUND, roundId: 'round-2' });
        await act(async () => {
            await Promise.resolve();
        });

        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);
        expect(result.current.gameState).toBe('playing');
        expect(result.current.currentRoundId).toBe('round-2');
    });

    it('falls back to a fresh round when the prefetch fails', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        mockStartSoloRound.mockRejectedValueOnce(new Error('prefetch failed'));
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
            await Promise.resolve();
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);

        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'round-3' });
        await act(async () => {
            result.current.handlePlayAgain();
            await Promise.resolve();
        });

        expect(mockStartSoloRound).toHaveBeenCalledTimes(3);
        expect(result.current.gameState).toBe('playing');
        expect(result.current.currentRoundId).toBe('round-3');
    });

    it('discards the prefetch when selecting a new playlist', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'stale-round' });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
            await Promise.resolve();
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);

        await act(async () => {
            result.current.handleSelectNewPlaylist();
        });
        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'fresh-round' });
        await act(async () => {
            await result.current.loadPlaylist('guest_top_hits', 'Top Hits');
        });

        expect(mockStartSoloRound).toHaveBeenCalledTimes(3);
        expect(mockStartSoloRound).toHaveBeenLastCalledWith('guest_top_hits');
        expect(result.current.currentRoundId).toBe('fresh-round');
    });

    it('discards a prefetch older than 25 minutes', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'stale-round' });
        mockSubmitSoloGuess.mockResolvedValue({ result: 'correct', snippetDurationMs: 2000, pointsAwarded: 25, answer: ANSWER });

        await act(async () => {
            await result.current.handleGuessSubmit('Song One');
            await Promise.resolve();
        });
        expect(mockStartSoloRound).toHaveBeenCalledTimes(2);

        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 26 * 60 * 1000);
        mockStartSoloRound.mockResolvedValueOnce({ ...ROUND, roundId: 'fresh-round' });
        await act(async () => {
            result.current.handlePlayAgain();
            await Promise.resolve();
        });
        dateNowSpy.mockRestore();

        expect(mockStartSoloRound).toHaveBeenCalledTimes(3);
        expect(result.current.currentRoundId).toBe('fresh-round');
    });

    it('ignores a double-submit while one is in flight', async () => {
        const { result } = renderGame();
        await act(async () => {
            await result.current.loadPlaylist('manual1', 'My Mix');
        });

        let resolveGuess: any;
        mockSubmitSoloGuess.mockImplementation(() => new Promise(resolve => { resolveGuess = resolve; }));

        let firstPromise: any;
        let secondResult: any;
        await act(async () => {
            firstPromise = result.current.handleGuessSubmit('a');
            secondResult = await result.current.handleGuessSubmit('b');
            resolveGuess({ result: 'incorrect', snippetDurationMs: 4000, pointsAwarded: null });
            await firstPromise;
        });

        expect(mockSubmitSoloGuess).toHaveBeenCalledTimes(1);
        expect(secondResult).toBeNull();
    });
});
