import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import usePreviewPlayer from '../hooks/usePreviewPlayer';

type Listener = { cb: () => void; once: boolean };

// Fake <audio> element: currentTime advances with fake-timer time while
// playing and freezes while stalled; events fire through stored listeners.
class FakeAudio {
    static instances: FakeAudio[] = [];

    listeners = new Map<string, Set<Listener>>();
    volume = 1;
    preload = '';
    readyState = 0;
    src = '';
    private isPlayingNow = false;
    private resumedAt = 0;
    private playedMs = 0;

    constructor(src?: string) {
        if (src) this.src = src;
        FakeAudio.instances.push(this);
    }

    addEventListener = (event: string, cb: () => void, options?: { once?: boolean }) => {
        const set = this.listeners.get(event) || new Set<Listener>();
        set.add({ cb, once: Boolean(options?.once) });
        this.listeners.set(event, set);
    };

    removeEventListener = (event: string, cb: () => void) => {
        const set = this.listeners.get(event);
        if (!set) return;
        set.forEach(entry => {
            if (entry.cb === cb) set.delete(entry);
        });
    };

    dispatch = (event: string) => {
        if (event === 'waiting') this.freeze();
        if (event === 'playing') this.resume();
        const entries = [...(this.listeners.get(event) || [])];
        entries.forEach(entry => {
            if (entry.once) this.listeners.get(event)?.delete(entry);
            entry.cb();
        });
    };

    private resume() {
        if (this.isPlayingNow) return;
        this.isPlayingNow = true;
        this.resumedAt = Date.now();
    }

    private freeze() {
        if (this.isPlayingNow) {
            this.playedMs += Date.now() - this.resumedAt;
        }
        this.isPlayingNow = false;
    }

    get currentTime() {
        return (this.playedMs + (this.isPlayingNow ? Date.now() - this.resumedAt : 0)) / 1000;
    }

    play = vi.fn((): Promise<void> => {
        this.readyState = 4;
        this.dispatch('playing');
        return Promise.resolve();
    });

    pause = vi.fn(() => {
        this.freeze();
    });

    load = vi.fn();
}

describe('usePreviewPlayer hook', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        FakeAudio.instances = [];
        vi.stubGlobal('Audio', FakeAudio);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const playSnippet = async (result: { current: ReturnType<typeof usePreviewPlayer> }, url = 'http://example.com/audio.mp3', durationMs = 2000) => {
        await act(async () => {
            result.current.playPreview(url, durationMs);
        });
        const audio = FakeAudio.instances[FakeAudio.instances.length - 1];
        act(() => {
            audio.dispatch('canplay');
        });
        await act(async () => {
            await Promise.resolve();
        });
        return audio;
    };

    it('initializes with default state', () => {
        const { result } = renderHook(() => usePreviewPlayer());

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.volume).toBe(0.5);
        expect(result.current.positionMs).toBe(0);
        expect(result.current.playbackDurationMs).toBe(0);
    });

    it('plays preview and stops after duration', async () => {
        vi.useFakeTimers();

        const { result } = renderHook(() => usePreviewPlayer());
        const audio = await playSnippet(result);

        expect(result.current.isPlaying).toBe(true);
        expect(result.current.playbackDurationMs).toBe(2000);
        expect(audio.play).toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(result.current.isPlaying).toBe(false);
        expect(audio.pause).toHaveBeenCalled();
    });

    it('stops playback when pause is called', async () => {
        const { result } = renderHook(() => usePreviewPlayer());
        const audio = await playSnippet(result, 'http://example.com/audio.mp3', 5000);

        expect(result.current.isPlaying).toBe(true);

        act(() => {
            result.current.pause();
        });

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.positionMs).toBe(0);
        expect(audio.pause).toHaveBeenCalled();
    });

    it('handles audio play rejection gracefully', async () => {
        const { result } = renderHook(() => usePreviewPlayer());

        await act(async () => {
            result.current.playPreview('http://example.com/audio.mp3', 2000);
        });

        const audio = FakeAudio.instances[0];
        audio.play.mockRejectedValue(new Error('Autoplay prevented'));

        act(() => {
            audio.dispatch('canplay');
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.error).toBe('Failed to play preview. Please try again.');
        expect(audio.play).toHaveBeenCalled();
    });

    it('updates volume correctly', () => {
        const { result } = renderHook(() => usePreviewPlayer());

        act(() => {
            result.current.setVolume(0.8);
        });

        expect(result.current.volume).toBe(0.8);
    });

    it('keeps the snippet playing through a buffering stall', async () => {
        vi.useFakeTimers();

        const { result } = renderHook(() => usePreviewPlayer());
        const audio = await playSnippet(result, 'http://example.com/audio.mp3', 2000);

        expect(result.current.isPlaying).toBe(true);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            audio.dispatch('waiting');
        });
        act(() => {
            vi.advanceTimersByTime(3000);
        });

        // A wall-clock timer would have stopped playback 2s in; position-based
        // stopping keeps it alive until 2s of audio actually played.
        expect(result.current.isPlaying).toBe(true);

        act(() => {
            audio.dispatch('playing');
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.isPlaying).toBe(false);
        expect(audio.pause).toHaveBeenCalled();
        expect(audio.currentTime).toBeGreaterThanOrEqual(1.98);
    });

    it('updates positionMs on timeupdate', async () => {
        vi.useFakeTimers();

        const { result } = renderHook(() => usePreviewPlayer());
        const audio = await playSnippet(result);

        act(() => {
            vi.advanceTimersByTime(1200);
            audio.dispatch('timeupdate');
        });

        expect(result.current.positionMs).toBe(1200);
    });

    it('reuses a preloaded element and plays without waiting for canplay', async () => {
        const { result } = renderHook(() => usePreviewPlayer());

        act(() => {
            result.current.preloadPreview('http://example.com/audio.mp3');
        });

        expect(FakeAudio.instances).toHaveLength(1);
        const preloaded = FakeAudio.instances[0];
        expect(preloaded.src).toBe('http://example.com/audio.mp3');
        expect(preloaded.preload).toBe('auto');
        preloaded.readyState = 4;

        await act(async () => {
            result.current.playPreview('http://example.com/audio.mp3', 2000);
            await Promise.resolve();
        });

        expect(FakeAudio.instances).toHaveLength(1);
        expect(preloaded.play).toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(true);
        expect(result.current.playbackDurationMs).toBe(2000);
    });

    it('creates a fresh element when the preload url does not match', async () => {
        const { result } = renderHook(() => usePreviewPlayer());

        act(() => {
            result.current.preloadPreview('http://example.com/other.mp3');
        });
        const audio = await playSnippet(result, 'http://example.com/audio.mp3', 2000);

        expect(FakeAudio.instances).toHaveLength(2);
        expect(audio.src).toBe('http://example.com/audio.mp3');
        expect(result.current.isPlaying).toBe(true);
    });
});
