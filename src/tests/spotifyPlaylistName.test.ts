import { describe, it, expect } from 'vitest';
import { extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';

describe('extractSpotifyPlaylistId', () => {
    it('extracts ID from standard playlist URL', () => {
        const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
        expect(extractSpotifyPlaylistId(url)).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('extracts ID from URL with query parameters', () => {
        const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123';
        expect(extractSpotifyPlaylistId(url)).toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('returns null for invalid domains', () => {
        const url = 'https://open.apple.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
        expect(extractSpotifyPlaylistId(url)).toBeNull();
    });

    it('returns null for track URLs instead of playlist URLs', () => {
        const url = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
        expect(extractSpotifyPlaylistId(url)).toBeNull();
    });

    it('returns null for artist URLs instead of playlist URLs', () => {
        const url = 'https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT';
        expect(extractSpotifyPlaylistId(url)).toBeNull();
    });

    it('returns null for poorly formatted playlist IDs', () => {
        // ID is too short
        expect(extractSpotifyPlaylistId('https://open.spotify.com/playlist/123')).toBeNull();
        // ID contains special characters
        expect(extractSpotifyPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5!')).toBeNull();
    });

    it('returns null for random text', () => {
        expect(extractSpotifyPlaylistId('not a url')).toBeNull();
        expect(extractSpotifyPlaylistId('')).toBeNull();
    });
});
