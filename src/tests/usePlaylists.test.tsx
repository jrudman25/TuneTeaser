import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlaylists } from '../hooks/usePlaylists';
import { GUEST_PLAYLISTS } from '../utils/guestData';

describe('usePlaylists hook', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns guest playlists immediately if in guest mode', () => {
        const { result } = renderHook(() => usePlaylists(null, true));

        expect(result.current.isLoadingPlaylists).toBe(false);
        expect(result.current.playlists).toEqual(GUEST_PLAYLISTS);
    });

    it('returns manual playlists immediately if in manual mode', () => {
        const mockManualPlaylists = [
            { id: '1', name: 'Manual 1', tracks: [{ track: { id: 't1' } }] } as any
        ];
        
        const { result } = renderHook(() => usePlaylists(null, false, mockManualPlaylists, true));

        expect(result.current.isLoadingPlaylists).toBe(false);
        expect(result.current.playlists.length).toBe(1 + GUEST_PLAYLISTS.length);
        expect(result.current.playlists[0].name).toBe('Manual 1');
        expect(result.current.playlists[0].tracks.total).toBe(1);
    });

    it('sets tracks.total from importedCount when defined (Cloud Storage offload)', () => {
        const mockManualPlaylists = [
            { id: '1', name: 'Manual 1', tracks: [], importedCount: 42 } as any
        ];
        
        const { result } = renderHook(() => usePlaylists(null, false, mockManualPlaylists, true));

        expect(result.current.playlists[0].tracks.total).toBe(42);
    });

    it('fetches Spotify playlists when token is provided', async () => {
        const mockSpotifyResponse = {
            items: [{ id: 'spotify1', name: 'Spotify Playlist 1' }],
            next: null
        };

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockSpotifyResponse)
        });

        const { result } = renderHook(() => usePlaylists('valid-token', false, [], false));

        expect(result.current.isLoadingPlaylists).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoadingPlaylists).toBe(false);
        });

        expect(result.current.playlists.length).toBe(1);
        expect(result.current.playlists[0].name).toBe('Spotify Playlist 1');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://api.spotify.com/v1/me/playlists'),
            expect.objectContaining({
                headers: { Authorization: 'Bearer valid-token' }
            })
        );
    });

    it('handles fetch errors gracefully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        const { result } = renderHook(() => usePlaylists('valid-token', false, [], false));

        await waitFor(() => {
            expect(result.current.isLoadingPlaylists).toBe(false);
        });

        expect(result.current.playlists).toEqual([]);
        expect(result.current.playlistError).toContain('Failed to load playlists');
    });

    it('handles 401 Unauthorized gracefully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        });

        const { result } = renderHook(() => usePlaylists('invalid-token', false, [], false));

        await waitFor(() => {
            expect(result.current.isLoadingPlaylists).toBe(false);
        });

        expect(result.current.playlists).toEqual([]);
        expect(result.current.playlistError).toContain('session has expired');
    });
});
