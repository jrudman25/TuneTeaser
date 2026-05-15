/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.05.14
 */
import React, { useEffect, useState } from 'react';
import { refreshAccessToken } from '../utils/auth';
import { usePlaylists } from '../hooks/usePlaylists';
import { useGameLogic } from '../hooks/useGameLogic';
import PlaylistMenu from '../components/PlaylistMenu';
import ActiveGame from '../components/ActiveGame';
import GameResult from '../components/GameResult';

const Home = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const isGuest = searchParams.get('mode') === 'guest';
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));

    useEffect(() => {
        if (isGuest) return;

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
    }, [isGuest]);

    const { playlists, isLoadingPlaylists } = usePlaylists(accessToken, isGuest);
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
    } = useGameLogic(accessToken, isGuest);

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
        if (isGuest) {
            window.location.href = '/';
            return;
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');
        window.location.href = '/';
    };

    return (
        <main className="page home-page">
            <section className="top-strip">
                <span className="status-badge">
                    {isGuest ? 'Guest mode' : 'Logged in with Spotify'}
                </span>
                <button className="button button-danger" onClick={handleLogout}>
                    {isGuest ? 'Exit Guest Mode' : 'Logout / Reset Token'}
                </button>
            </section>

            {playerError && (
                <div className="error-banner">
                    <strong>Error:</strong> {playerError}
                    <br />
                    <small>Please try logging out and logging in again.</small>
                </div>
            )}

            {gameState === 'idle' && (
                <PlaylistMenu
                    playlists={playlists}
                    isLoading={isLoadingPlaylists || isLoadingGame}
                    onSelectPlaylist={onSelectPlaylist}
                    isGuest={isGuest}
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
                    isLoading={isLoadingGame}
                />
            )}
        </main>
    );
};

export default Home;
