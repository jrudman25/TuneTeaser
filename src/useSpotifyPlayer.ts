/**
 * useSpotifyPlayer.ts
 * Handles using the Spotify player for tracks.
 * @version 2026.01.11
 */
import { useState, useEffect } from 'react';

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: any;
    }
}

const useSpotifyPlayer = (accessToken: string | null) => {
    const [player, setPlayer] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [isPaused, setPaused] = useState(true);
    const [isActive, setActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let playerInstance: any = null;

        if (!accessToken) {
            console.warn("useSpotifyPlayer: No access token provided.");
            return;
        }

        const initializePlayer = () => {
            console.log("useSpotifyPlayer: Initializing Spotify Player...");
            const player = new window.Spotify.Player({
                name: 'TuneTeaser Web Player',
                getOAuthToken: (cb: (token: string) => void) => { cb(accessToken); },
                volume: 0.5
            });

            playerInstance = player;

            player.addListener('ready', ({ device_id }: { device_id: string }) => {
                console.log('useSpotifyPlayer: Ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
                console.log('useSpotifyPlayer: Device ID has gone offline', device_id);
            });

            player.addListener('player_state_changed', (state: any) => {
                if (!state) return;
                setPaused(state.paused);
                setActive(state.active);
            });

            player.addListener('initialization_error', ({ message }: { message: string }) => {
                console.error('useSpotifyPlayer: Failed to initialize player', message);
                setError(message);
            });

            player.addListener('authentication_error', ({ message }: { message: string }) => {
                console.error('useSpotifyPlayer: Failed to authenticate (Check Scopes/Premium)', message);
                setError("Authentication failed. Token may be expired.");
            });

            player.addListener('account_error', ({ message }: { message: string }) => {
                console.error('useSpotifyPlayer: Account error (likely non-premium)', message);
                setError("Account error. Premium required.");
            });

            player.connect().then((success: boolean) => {
                if (success) {
                    console.log('useSpotifyPlayer: Player connected successfully');
                } else {
                    console.error('useSpotifyPlayer: Player failed to connect');
                    setError("Failed to connect to Spotify.");
                }
            });

            setPlayer(player);
        };

        if (window.Spotify) {
            initializePlayer();
        } else {
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;

            if (!document.getElementById('spotify-player-script')) {
                const script = document.createElement("script");
                script.id = 'spotify-player-script';
                script.src = "https://sdk.scdn.co/spotify-player.js";
                script.async = true;
                document.body.appendChild(script);
            }
        }

        return () => {
            if (playerInstance) {
                playerInstance.disconnect();
            }
        };
    }, [accessToken]);

    return { player, deviceId, isPaused, isActive, error };
};

export default useSpotifyPlayer;
