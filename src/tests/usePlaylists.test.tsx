import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlaylists } from '../hooks/usePlaylists';
import { GUEST_PLAYLISTS } from '../utils/guestData';

describe('usePlaylists hook', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns guest playlists immediately if in guest mode', () => {
        const { result } = renderHook(() => usePlaylists(true));

        expect(result.current.isLoadingPlaylists).toBe(false);
        expect(result.current.playlists).toEqual(GUEST_PLAYLISTS);
    });

    it('returns manual playlists immediately if in manual mode', () => {
        const mockManualPlaylists = [
            { id: '1', name: 'Manual 1', tracks: [{ track: { id: 't1' } }] } as any
        ];
        
        const { result } = renderHook(() => usePlaylists(false, mockManualPlaylists, true));

        expect(result.current.isLoadingPlaylists).toBe(false);
        expect(result.current.playlists.length).toBe(1 + GUEST_PLAYLISTS.length);
        expect(result.current.playlists[0].name).toBe('Manual 1');
        expect(result.current.playlists[0].tracks.total).toBe(1);
    });

    it('sets tracks.total from importedCount when defined (Cloud Storage offload)', () => {
        const mockManualPlaylists = [
            { id: '1', name: 'Manual 1', tracks: [], importedCount: 42 } as any
        ];
        
        const { result } = renderHook(() => usePlaylists(false, mockManualPlaylists, true));

        expect(result.current.playlists[0].tracks.total).toBe(42);
    });

    it('returns featured playlists when not in guest or manual mode', () => {
        const { result } = renderHook(() => usePlaylists(false, [], false));

        expect(result.current.isLoadingPlaylists).toBe(false);
        expect(result.current.playlists).toEqual(GUEST_PLAYLISTS);
        expect(result.current.playlistError).toBeNull();
    });
});
