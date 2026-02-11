/**
 * usePlaylists.ts
 * Handles fetching user playlists from Spotify.
 * @version 2026.02.10
 */
import { useState, useEffect, useCallback } from 'react';
import { GUEST_PLAYLISTS } from '../utils/guestData';

export const usePlaylists = (accessToken: string | null, isGuest: boolean = false) => {
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);

    const fetchPlaylists = useCallback(async () => {
        if (isGuest) {
            setPlaylists(GUEST_PLAYLISTS);
            setIsLoadingPlaylists(false);
            return;
        }

        if (!accessToken) {
            setIsLoadingPlaylists(false);
            return;
        }

        setIsLoadingPlaylists(true);
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

            setPlaylists(allPlaylists);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        } finally {
            setIsLoadingPlaylists(false);
        }
    }, [accessToken, isGuest]);

    useEffect(() => {
        fetchPlaylists();
    }, [fetchPlaylists]);

    return { playlists, isLoadingPlaylists, fetchPlaylists };
};
