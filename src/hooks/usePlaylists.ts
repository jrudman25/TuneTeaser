/**
 * usePlaylists.ts
 * Provides the playlist picker list: the user's saved playlists plus featured playlists.
 * @version 2026.06.01
 */
import { useMemo } from 'react';
import { GUEST_PLAYLISTS } from '../utils/guestData';
import { ManualPlaylist } from '../utils/manualPlaylists';

export const usePlaylists = (
    isGuest: boolean = false,
    manualPlaylists: ManualPlaylist[] = [],
    isManualMode: boolean = false
) => {
    const playlists = useMemo(() => {
        if (isManualMode || isGuest) {
            return [
                ...manualPlaylists.map(playlist => ({
                    ...playlist,
                    tracks: { total: playlist.importedCount !== undefined ? playlist.importedCount : playlist.tracks.length }
                })),
                ...GUEST_PLAYLISTS
            ];
        }
        return GUEST_PLAYLISTS;
    }, [isManualMode, manualPlaylists, isGuest]);

    return { playlists, isLoadingPlaylists: false, playlistError: null };
};
