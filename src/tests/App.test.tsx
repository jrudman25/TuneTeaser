/**
 * App.test.tsx
 * Tests the App component.
 * @version 2026.02.06
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameLogic } from '../hooks/useGameLogic';

// Mock getItunesPreview to avoid real API calls
vi.mock('../utils/itunes', () => ({
  getItunesPreview: vi.fn(),
}));

// Mock usePreviewPlayer to avoid Audio issues
vi.mock('../hooks/usePreviewPlayer', () => ({
  default: () => ({
    playPreview: vi.fn(),
    pause: vi.fn(),
    isPlaying: false,
    error: null,
    volume: 0.5,
    setVolume: vi.fn(),
  })
}));

describe('useGameLogic', () => {
  const mockAccessToken = 'fake-token';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));
    expect(result.current.gameState).toBe('idle');
  });

  it('correctly identifies a correct guess (exact match)', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Paranoid Android', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Paranoid Android');

    // Make a guess
    act(() => {
      result.current.setUserGuess('paranoid android');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('end');
    expect(result.current.feedbackMessage).toContain('Correct');
  });

  it('correctly identifies a correct guess (partial match)', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Paranoid Android (Remastered)', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Paranoid Android (Remastered)');

    // Make a guess
    act(() => {
      result.current.setUserGuess('paranoid android');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('end');
    expect(result.current.feedbackMessage).toContain('Correct');
  });

  it('correctly identifies a correct guess (no punctuation)', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Why Can\'t We Be Friends?', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Why Can\'t We Be Friends?');

    // Make a guess
    act(() => {
      result.current.setUserGuess('why cant we be friends');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('end');
    expect(result.current.feedbackMessage).toContain('Correct');
  });

  it('correctly identifies a wrong guess', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Some Girls Are Bigger Than Others');

    // Make a guess
    act(() => {
      result.current.setUserGuess('There Is a Light That Never Goes Out');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.feedbackMessage).toContain('Incorrect');
  });

  it('correctly identifies two wrong guesses', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Some Girls Are Bigger Than Others');

    // Make a guess
    act(() => {
      result.current.setUserGuess('There Is a Light That Never Goes Out');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.feedbackMessage).toContain('Incorrect');

    // Make a guess
    act(() => {
      result.current.setUserGuess('The Queen Is Dead');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.feedbackMessage).toContain('Incorrect');
  });

  it('correctly identifies a right guess after a wrong guess', () => {
    const { result } = renderHook(() => useGameLogic(mockAccessToken));

    const mockTracks = [{ track: { id: '1', name: 'Some Girls Are Bigger Than Others', uri: 'spotify:track:1' } }];

    act(() => {
      result.current.startGame(mockTracks);
    });

    // Verify game started
    expect(result.current.gameState).toBe('playing');
    expect(result.current.targetSong?.name).toBe('Some Girls Are Bigger Than Others');

    // Make a guess
    act(() => {
      result.current.setUserGuess('There Is a Light That Never Goes Out');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.feedbackMessage).toContain('Incorrect');

    // Make a guess
    act(() => {
      result.current.setUserGuess('Some Girls Are Bigger Than Others');
    });

    act(() => {
      result.current.handleGuessSubmit();
    });

    expect(result.current.gameState).toBe('end');
    expect(result.current.feedbackMessage).toContain('Correct');
  });
});
