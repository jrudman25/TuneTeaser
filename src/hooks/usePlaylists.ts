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

    const derivedPlaylists = useMemo(() => {
        if (isManualMode) {
            return manualPlaylists.map(playlist => ({
                ...playlist,
                tracks: { total: playlist.tracks.length }
            }));
        }
        if (isGuest) {
            return GUEST_PLAYLISTS;
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
                    console.error("401 Unauthorized during playlist fetch");
                    break;
                }

                if (!response.ok) {
                    console.error('Failed to fetch playlists:', response.statusText);
                    break;
                }

                const data = await response.json();
                allPlaylists = [...allPlaylists, ...data.items];
                nextUrl = data.next;
            }

            setFetchedPlaylists(allPlaylists);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        } finally {
            setIsFetchingPlaylists(false);
        }
    }, [accessToken, isGuest, isManualMode]);

    useEffect(() => {
        fetchPlaylists();
    }, [fetchPlaylists]);

    const isLoadingPlaylists = (isManualMode || isGuest) ? false : isFetchingPlaylists;

    return { playlists: derivedPlaylists, isLoadingPlaylists, fetchPlaylists };
};
