/**
 * useRecentScores.ts
 * Session-scoped anti-abuse tracking for leaderboard scoring.
 * Prevents re-scoring the same song on the same playlist within a cooldown window.
 * @version 2026.05.27
 */
import { useCallback, useRef } from 'react';

interface ScoreEntry {
    playlistId: string;
    songId: string;
    timestamp: number;
}

/** Cooldown window in milliseconds (10 minutes). */
const COOLDOWN_MS = 10 * 60 * 1000;

/** Maximum recent entries to keep in memory. */
const MAX_ENTRIES = 20;

export const useRecentScores = () => {
    const recentRef = useRef<ScoreEntry[]>([]);

    /**
     * Check whether this song+playlist combo can earn points right now.
     * Returns false if the same combo was scored within the cooldown window.
     */
    const canScoreSong = useCallback((playlistId: string, songId: string): boolean => {
        const now = Date.now();
        return !recentRef.current.some(
            entry =>
                entry.playlistId === playlistId &&
                entry.songId === songId &&
                now - entry.timestamp < COOLDOWN_MS
        );
    }, []);

    /** Record that a score was just awarded for this song+playlist combo. */
    const recordScore = useCallback((playlistId: string, songId: string): void => {
        const entry: ScoreEntry = { playlistId, songId, timestamp: Date.now() };
        recentRef.current = [entry, ...recentRef.current].slice(0, MAX_ENTRIES);
    }, []);

    return { canScoreSong, recordScore };
};
