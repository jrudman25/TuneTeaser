/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.02.05
 */
import React, { useEffect, useState } from 'react';
import { Typography, Box } from "@mui/material";
import { refreshAccessToken } from '../utils/auth';
import { usePlaylists } from '../hooks/usePlaylists';
import { useGameLogic } from '../hooks/useGameLogic';
import PlaylistMenu from '../components/PlaylistMenu';
import ActiveGame from '../components/ActiveGame';
import GameResult from '../components/GameResult';

const Home = () => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));

    useEffect(() => {
        const checkToken = async () => {
            const tokenExpiry = localStorage.getItem('tokenExpiry');
            const refreshToken = localStorage.getItem('refreshToken');
            const clientId = `${import.meta.env.VITE_SPOTIFY_CLIENT_ID}`;

            if (tokenExpiry && refreshToken && Date.now() > parseInt(tokenExpiry)) {
                console.log("Token expired, refreshing...");
                try {
                    const data = await refreshAccessToken(clientId, refreshToken);
                    if (data.access_token) {
                        const { access_token, expires_in, refresh_token: newRefreshToken } = data;
                        localStorage.setItem('accessToken', access_token);
                        sessionStorage.setItem('accessToken', access_token);
                        localStorage.setItem('tokenExpiry', (Date.now() + expires_in * 1000).toString());
                        if (newRefreshToken) {
                            localStorage.setItem('refreshToken', newRefreshToken);
                        }
                        setAccessToken(access_token);
                    }
                } catch (e) {
                    console.error("Failed to refresh token", e);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('tokenExpiry');
                    localStorage.removeItem('verifier');
                    sessionStorage.removeItem('accessToken');
                    window.location.href = '/';
                }
            }
        };
        checkToken();
    }, []);

    const { playlists, isLoadingPlaylists } = usePlaylists(accessToken);
    const {
        gameState,
        targetSong,
        snippetDuration,
        userGuess,
        setUserGuess,
        feedbackMessage,
        isLoadingGame,
        selectedPlaylistName,
        loadPlaylist,
        handleGuessSubmit,
        handleGiveUp,
        playSnippet,
        handlePlayAgain,
        handleSelectNewPlaylist,
        isPlaying,
        playerError,
        currentTracks,
        volume,
        setVolume
    } = useGameLogic(accessToken);

    const onSelectPlaylist = (playlistId: string) => {
        let name = '';
        if (playlistId === 'LIKED_SONGS') {
            name = 'Liked Songs';
        } else {
            const p = playlists.find((pl: any) => pl.id === playlistId);
            if (p) name = p.name;
        }
        loadPlaylist(playlistId, name);
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');
        window.location.href = '/';
    };

    return (
        <div>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Typography color='black' marginBottom='0.5rem'>
                    Home
                </Typography>

                <button
                    onClick={handleLogout}
                    style={{ marginBottom: '1rem', padding: '5px 10px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Logout / Reset Token
                </button>

                {playerError && (
                    <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', border: '1px solid #ef9a9a' }}>
                        <strong>Error:</strong> {playerError}
                        <br />
                        <small>Please try logging out and logging in again.</small>
                    </div>
                )}

                {/* GAME STATE RENDERER */}
                {gameState === 'idle' && (
                    <PlaylistMenu
                        playlists={playlists}
                        isLoading={isLoadingPlaylists || isLoadingGame}
                        onSelectPlaylist={onSelectPlaylist}
                    />
                )}

                {gameState === 'playing' && (
                    <ActiveGame
                        targetSong={targetSong}
                        snippetDuration={snippetDuration}
                        userGuess={userGuess}
                        setUserGuess={setUserGuess}
                        onGuessSubmit={handleGuessSubmit}
                        onPlaySnippet={playSnippet}
                        onGiveUp={handleGiveUp}
                        feedbackMessage={feedbackMessage}
                        isPlaying={isPlaying}
                        selectedPlaylistName={selectedPlaylistName}
                        songs={currentTracks}
                        volume={volume}
                        setVolume={setVolume}
                    />
                )}

                {gameState === 'end' && (
                    <GameResult
                        targetSong={targetSong}
                        feedbackMessage={feedbackMessage}
                        onPlayAgain={handlePlayAgain}
                        onSelectNewPlaylist={handleSelectNewPlaylist}
                    />
                )}
            </Box>
        </div>
    );
};

export default Home;
