import { describe, it, expect } from 'vitest';
import { calculatePoints, isEligibleForPoints, MIN_TRACKS_FOR_POINTS } from '../utils/scoreUtils';

describe('scoreUtils', () => {
    describe('calculatePoints', () => {
        it('returns maximum points for quickest possible guess', () => {
            expect(calculatePoints(0)).toBe(25);
            expect(calculatePoints(2000)).toBe(25);
        });

        it('returns minimum points for slowest possible guess', () => {
            expect(calculatePoints(30000)).toBe(10);
            expect(calculatePoints(35000)).toBe(10);
        });

        it('returns interpolated points for guesses between min and max duration', () => {
            // Halfway between 2000 and 30000 is 16000
            // Max bonus is 15. Half of 15 is 7.5. 10 + 7.5 = 17.5 ~ 18
            expect(calculatePoints(16000)).toBe(18);
            
            // 9000ms is 25% of the way between 2000 and 30000
            // Fraction = 1 - (7000 / 28000) = 0.75
            // Bonus = 15 * 0.75 = 11.25 -> round 11
            // Total = 10 + 11 = 21
            expect(calculatePoints(9000)).toBe(21);
        });
    });

    describe('isEligibleForPoints', () => {
        it('returns false for guests', () => {
            expect(isEligibleForPoints(20, true, false)).toBe(false);
        });

        it('returns false for anonymous users', () => {
            expect(isEligibleForPoints(20, false, true)).toBe(false);
        });

        it('returns false for guests who are also anonymous', () => {
            expect(isEligibleForPoints(20, true, true)).toBe(false);
        });

        it(`returns false if playlist has fewer than ${MIN_TRACKS_FOR_POINTS} tracks`, () => {
            expect(isEligibleForPoints(MIN_TRACKS_FOR_POINTS - 1, false, false)).toBe(false);
            expect(isEligibleForPoints(0, false, false)).toBe(false);
        });

        it('returns true for authenticated users with large enough playlists', () => {
            expect(isEligibleForPoints(MIN_TRACKS_FOR_POINTS, false, false)).toBe(true);
            expect(isEligibleForPoints(MIN_TRACKS_FOR_POINTS + 10, false, false)).toBe(true);
        });
    });
});
