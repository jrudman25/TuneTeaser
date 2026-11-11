import { describe, it, expect, beforeEach } from 'vitest';
import { clearLegacySpotifySession } from '../utils/auth';

describe('clearLegacySpotifySession', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('removes all legacy Spotify session keys', () => {
        localStorage.setItem('accessToken', 'a');
        localStorage.setItem('refreshToken', 'r');
        localStorage.setItem('tokenExpiry', '1');
        localStorage.setItem('verifier', 'v');
        localStorage.setItem('tuneteaserFailedItunesLookups', '[]');
        sessionStorage.setItem('accessToken', 'a');
        localStorage.setItem('unrelated', 'keep');

        clearLegacySpotifySession();

        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
        expect(localStorage.getItem('tokenExpiry')).toBeNull();
        expect(localStorage.getItem('verifier')).toBeNull();
        expect(localStorage.getItem('tuneteaserFailedItunesLookups')).toBeNull();
        expect(sessionStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('keep');
    });
});
