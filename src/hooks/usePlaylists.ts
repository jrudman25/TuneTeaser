/**
 * usePlaylists.ts
 * Handles fetching user playlists from Spotify.
 * @version 2026.02.10
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { GUEST_PLAYLISTS } from '../utils/guestData';
import { ManualPlaylist } from '../utils/manualPlaylists';

export const usePlaylists = (
    accessToken: string | null,
    isGuest: boolean = false,
    manualPlaylists: ManualPlaylist[] = [],
    isManualMode: boolean = false
) => {
    const [fetchedPlaylists, setFetchedPlaylists] = useState<any[]>([]);
    const [isFetchingPlaylists, setIsFetchingPlaylists] = useState(true);
    const [playlistError, setPlaylistError] = useState<string | null>(null);

    const derivedPlaylists = useMemo(() => {
        if (isManualMode || isGuest) {
            return [
                ...manualPlaylists.map(playlist => ({
                    ...playlist,
                    tracks: { total: playlist.tracks.length }
                })),
                ...GUEST_PLAYLISTS
            ];
        }
        return fetchedPlaylists;
    }, [isManualMode, manualPlaylists, isGuest, fetchedPlaylists]);

    const fetchPlaylists = useCallback(async () => {
        if (isManualMode || isGuest) {
            // No fetching needed for these modes
            setIsFetchingPlaylists(false);
            return;
        }

        if (!accessToken) {
            setIsFetchingPlaylists(false);
            return;
        }

        setIsFetchingPlaylists(true);
        setPlaylistError(null);
        try {
            let allPlaylists: any[] = [];
            let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

            while (nextUrl) {
                const response = await fetch(nextUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.status === 401) {
                    setPlaylistError('Your Spotify session has expired. Please log in again.');
                    break;
                }

                if (!response.ok) {
                    setPlaylistError(`Failed to load playlists (${response.status}). Please try again.`);
                    break;
                }

                const data = await response.json();
                allPlaylists = [...allPlaylists, ...data.items];
                nextUrl = data.next;
            }

            setFetchedPlaylists(allPlaylists);
        } catch {
            setPlaylistError('Could not connect to Spotify. Check your network and try again.');
        } finally {
            setIsFetchingPlaylists(false);
        }
    }, [accessToken, isGuest, isManualMode]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPlaylists();
    }, [fetchPlaylists]);

    const isLoadingPlaylists = (isManualMode || isGuest) ? false : isFetchingPlaylists;

    return { playlists: derivedPlaylists, isLoadingPlaylists, fetchPlaylists, playlistError };
};
