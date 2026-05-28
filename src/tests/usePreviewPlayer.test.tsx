import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePreviewPlayer from '../hooks/usePreviewPlayer';

describe('usePreviewPlayer hook', () => {
    let mockAudioPlay: ReturnType<typeof vi.fn>;
    let mockAudioPause: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
        vi.restoreAllMocks();
        
        mockAudioPlay = vi.fn().mockResolvedValue(undefined);
        mockAudioPause = vi.fn();
        
        // Mock global Audio constructor
        global.Audio = class {
            play = mockAudioPlay;
            pause = mockAudioPause;
            volume = 1;
            currentTime = 0;
            src = '';
            addEventListener = vi.fn((event, cb) => {
                if (event === 'canplay' || event === 'playing') {
                    cb(); // trigger immediately
                }
            });
            load = vi.fn();
        } as any;
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => usePreviewPlayer());

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.volume).toBe(0.5);
    });

    it('plays preview and stops after duration', async () => {
        vi.useFakeTimers();

        const { result } = renderHook(() => usePreviewPlayer());

        await act(async () => {
            result.current.playPreview('http://example.com/audio.mp3', 2000);
        });

        expect(result.current.isPlaying).toBe(true);
        expect(mockAudioPlay).toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(result.current.isPlaying).toBe(false);
        expect(mockAudioPause).toHaveBeenCalled();
        
        vi.useRealTimers();
    });

    it('stops playback when stopPreview is called', async () => {
        const { result } = renderHook(() => usePreviewPlayer());

        await act(async () => {
            result.current.playPreview('http://example.com/audio.mp3', 5000);
        });

        expect(result.current.isPlaying).toBe(true);

        act(() => {
            result.current.pause();
        });

        expect(result.current.isPlaying).toBe(false);
        expect(mockAudioPause).toHaveBeenCalled();
    });

    it('handles audio play rejection gracefully', async () => {
        // Mock play to reject (e.g. browser auto-play policy)
        mockAudioPlay.mockRejectedValue(new Error('Autoplay prevented'));

        const { result } = renderHook(() => usePreviewPlayer());

        await act(async () => {
            result.current.playPreview('http://example.com/audio.mp3', 2000);
        });

        expect(result.current.isPlaying).toBe(false);
        expect(mockAudioPlay).toHaveBeenCalled();
    });

    it('updates volume correctly', () => {
        const { result } = renderHook(() => usePreviewPlayer());

        act(() => {
            result.current.setVolume(0.8);
        });

        expect(result.current.volume).toBe(0.8);
    });
});
