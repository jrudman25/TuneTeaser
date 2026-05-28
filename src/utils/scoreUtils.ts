/**
 * scoreUtils.ts
 * Pure scoring functions for the leaderboard system.
 * Points scale: 10 (base, slowest) to 25 (fastest at 2s snippet).
 * @version 2026.05.27
 */

/** Minimum number of tracks a playlist must have to be eligible for scoring. */
export const MIN_TRACKS_FOR_POINTS = 10;

/**
 * Calculate points earned for a correct guess.
 *
 * Base: 10 pts. Speed bonus: up to +15 pts.
 * Fastest possible (2s snippet) = 25 pts, slowest (30s) = 10 pts.
 * Linear interpolation between 2000ms and 30000ms.
 */
export const calculatePoints = (snippetDurationMs: number): number => {
    const BASE = 10;
    const MAX_BONUS = 15;
    const MIN_DURATION = 2000;
    const MAX_DURATION = 30000;

    const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, snippetDurationMs));
    const fraction = 1 - (clamped - MIN_DURATION) / (MAX_DURATION - MIN_DURATION);
    return BASE + Math.round(MAX_BONUS * fraction);
};

/**
 * Check whether a round is eligible for leaderboard points.
 * Guests, anonymous users, and playlists with fewer than MIN_TRACKS_FOR_POINTS
 * tracks are ineligible.
 */
export const isEligibleForPoints = (
    playlistTrackCount: number,
    isGuest: boolean,
    isAnonymous: boolean
): boolean => {
    if (isGuest || isAnonymous) return false;
    return playlistTrackCount >= MIN_TRACKS_FOR_POINTS;
};
