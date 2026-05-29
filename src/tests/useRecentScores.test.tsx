import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRecentScores } from '../hooks/useRecentScores';

describe('useRecentScores hook', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows scoring a new song', () => {
        const { result } = renderHook(() => useRecentScores());
        expect(result.current.canScoreSong('p1', 's1')).toBe(true);
    });

    it('prevents scoring the same song+playlist combo within the cooldown window', () => {
        const { result } = renderHook(() => useRecentScores());
        
        act(() => {
            result.current.recordScore('p1', 's1');
        });

        expect(result.current.canScoreSong('p1', 's1')).toBe(false);
        // Different song or playlist should still be allowed
        expect(result.current.canScoreSong('p1', 's2')).toBe(true);
        expect(result.current.canScoreSong('p2', 's1')).toBe(true);
    });

    it('allows scoring the same combo after the cooldown window expires', () => {
        const { result } = renderHook(() => useRecentScores());
        
        act(() => {
            result.current.recordScore('p1', 's1');
        });

        expect(result.current.canScoreSong('p1', 's1')).toBe(false);

        // Advance time by slightly more than 10 minutes (600000ms)
        act(() => {
            vi.advanceTimersByTime(600001);
        });

        expect(result.current.canScoreSong('p1', 's1')).toBe(true);
    });

    it('caps the recent history to 20 entries', () => {
        const { result } = renderHook(() => useRecentScores());
        
        act(() => {
            for (let i = 0; i < 25; i++) {
                result.current.recordScore('p1', `s${i}`);
            }
        });

        // The oldest 5 entries (s0 to s4) should have been pushed out, so they are allowed again
        expect(result.current.canScoreSong('p1', 's0')).toBe(true);
        expect(result.current.canScoreSong('p1', 's4')).toBe(true);
        // The newest 20 entries (s5 to s24) are still in cooldown
        expect(result.current.canScoreSong('p1', 's5')).toBe(false);
        expect(result.current.canScoreSong('p1', 's24')).toBe(false);
    });
});
