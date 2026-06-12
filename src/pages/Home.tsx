/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.05.27
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, signInAnonymously } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import { getFreshSpotifyAccessToken } from '../utils/auth';
import { isEligibleForPoints } from '../utils/scoreUtils';
import { usePlaylists } from '../hooks/usePlaylists';
import { useGameLogic } from '../hooks/useGameLogic';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useRecentScores } from '../hooks/useRecentScores';
import PlaylistMenu from '../components/PlaylistMenu';
import ActiveGame from '../components/ActiveGame';
import GameResult from '../components/GameResult';
import SignedInBadge from '../components/SignedInBadge';
import NavBar from '../components/NavBar';
import OnboardingTour from '../components/OnboardingTour';

const Home = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const isGuest = searchParams.get('mode') === 'guest';
    const navigate = useNavigate();
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const {
        manualPlaylists,
        isLoadingManualPlaylists,
        manualPlaylistError
    } = useManualPlaylists(user, isGuest);
    const isManualMode = !isGuest && !!user && !user.isAnonymous;
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);

    // Compute probable login state to prevent header buttons/badges flickering/disappearing during page loading states
    const hasFirebaseUser = Object.keys(localStorage).some(key => key.startsWith('firebase:authUser'));
    const isProbablyManualMode = isManualMode || (!isGuest && hasFirebaseUser);
    const isProbablyGuest = isGuest || (user && user.isAnonymous);

    // Derive onboarding visibility from current state (no setState inside useEffect)
    const showOnboarding = React.useMemo(() => {
        if (onboardingDismissed) return false;
        if (isLoadingUser || isLoadingManualPlaylists) return false;

        // Skip onboarding for Spotify-login users
        const isSpotifyUser = !!accessToken && !isManualMode && !isGuest;
        if (isSpotifyUser) return false;

        if (localStorage.getItem('onboardingComplete') === 'true') return false;

        // Show for new email users with no playlists, or first-visit guests
        return (isManualMode && manualPlaylists.length === 0) || isGuest;
    }, [onboardingDismissed, isLoadingUser, isLoadingManualPlaylists, accessToken, isManualMode, isGuest, manualPlaylists.length]);

    useEffect(() => {
        if (isGuest && !isLoadingUser && !user) {
            signInAnonymously(auth).catch(err => {
                console.error("Failed to sign in guest anonymously:", err);
            });
        }
    }, [isGuest, isLoadingUser, user]);

    useEffect(() => {
        if (isGuest) return;

        const checkToken = async () => {
            const tokenExpiry = localStorage.getItem('tokenExpiry');
            const clientId = `${import.meta.env.VITE_SPOTIFY_CLIENT_ID}`;

            if (accessToken && (!tokenExpiry || Date.now() > parseInt(tokenExpiry))) {
                console.log("Token expired, refreshing...");
                const freshToken = await getFreshSpotifyAccessToken(clientId);
                if (freshToken) {
                    setAccessToken(freshToken);
                } else {
                    setAccessToken(null);
                    window.location.href = '/';
                }
            }
        };
        checkToken();
    }, [accessToken, isGuest]);

    useEffect(() => {
        if (!isLoadingUser && !isGuest && !isManualMode && !accessToken) {
            navigate('/');
        }
    }, [isLoadingUser, isGuest, isManualMode, accessToken, navigate]);

    const { playlists, isLoadingPlaylists, playlistError } = usePlaylists(accessToken, isGuest, manualPlaylists, isManualMode);
    const {
        gameState,
        targetSong,
        snippetDuration,
        userGuess,
        setUserGuess,
        feedbackMessage,
        isLoadingGame,
        selectedPlaylistId,
        selectedPlaylistName,
        loadPlaylist,
        handleGuessSubmit,
        handleGiveUp: originalHandleGiveUp,
        playSnippet,
        handlePlayAgain: originalHandlePlayAgain,
        handleSelectNewPlaylist: originalHandleSelectNewPlaylist,
        isPlaying,
        playerError,
        currentTracks,
        volume,
        setVolume
    } = useGameLogic(accessToken, isGuest, manualPlaylists, isManualMode);

    const { submitScore } = useLeaderboard(user);
    const { canScoreSong, recordScore } = useRecentScores();
    const [displayedPoints, setDisplayedPoints] = useState<number | null>(null);

    const handleGiveUp = () => {
        setDisplayedPoints(null);
        originalHandleGiveUp();
    };

    const handlePlayAgain = () => {
        setDisplayedPoints(null);
        originalHandlePlayAgain();
    };

    const handleSelectNewPlaylist = () => {
        setDisplayedPoints(null);
        originalHandleSelectNewPlaylist();
    };

    // Wrap handleGuessSubmit to score points inline (event-driven, not effect-driven)
    const handleGuessWithScoring = async (specificGuess?: string) => {
        const points = handleGuessSubmit(specificGuess);

        if (points == null || points <= 0) {
            setDisplayedPoints(null);
            return;
        }

        const isAnonymous = !user || user.isAnonymous;
        const trackCount = currentTracks.length;
        const songId = targetSong?.id;
        const playlistId = selectedPlaylistId;

        if (!isEligibleForPoints(trackCount, isGuest, isAnonymous)
            || !canScoreSong(playlistId, songId)) {
            setDisplayedPoints(null);
            return;
        }

        const awardedPoints = await submitScore({
            playlistId,
            songId,
            playlistTrackCount: trackCount,
            snippetDurationMs: snippetDuration
        });

        if (awardedPoints == null) {
            setDisplayedPoints(null);
            return;
        }

        recordScore(playlistId, songId);
        setDisplayedPoints(awardedPoints);
    };

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

    const handleLogout = async () => {
        setIsLoggingOut(true);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        if (isManualMode || (isGuest && user?.isAnonymous)) {
            await signOut(auth);
        }

        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            {isProbablyGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : isProbablyManualMode ? (
                <SignedInBadge user={user} />
            ) : (
                <span className="account-badge">Signed in with Spotify</span>
            )}
        </div>
    );

    const actionButtons = (
        <div className="action-row">
            {(isProbablyManualMode || isProbablyGuest) && (
                <Link className="button button-secondary" to={isProbablyGuest ? "/playlists?mode=guest" : "/playlists"}>
                    Manage Playlists
                </Link>
            )}
            <button className="button button-danger" onClick={handleLogout}>
                {isProbablyGuest ? 'Exit Guest Mode' : 'Logout'}
            </button>
        </div>
    );

    if (isLoggingOut || isLoadingUser || (user && !user.isAnonymous && isLoadingManualPlaylists)) {
        return (
            <>
                <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
                <main className="page home-page">
                    <div className="loading-card">{isLoggingOut ? 'Logging out...' : 'Loading...'}</div>
                </main>
            </>
        );
    }

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">
                {manualPlaylistError && (
                    <div className="error-banner">
                        <strong>Error:</strong> {manualPlaylistError}
                    </div>
                )}

                {playerError && (
                    <div className="error-banner">
                        <strong>Error:</strong> {playerError}
                        <br />
                        <small>Please try logging out and logging in again.</small>
                    </div>
                )}

                {playlistError && (
                    <div className="error-banner">
                        <strong>Error:</strong> {playlistError}
                    </div>
                )}

                {gameState === 'idle' && (
                    <PlaylistMenu
                        playlists={playlists}
                        isLoading={isLoadingPlaylists || isLoadingManualPlaylists || isLoadingGame || isLoadingUser}
                        onSelectPlaylist={onSelectPlaylist}
                        isGuest={isGuest || isManualMode}
                    />
                )}

                {gameState === 'playing' && (
                    <ActiveGame
                        targetSong={targetSong}
                        snippetDuration={snippetDuration}
                        userGuess={userGuess}
                        setUserGuess={setUserGuess}
                        onGuessSubmit={handleGuessWithScoring}
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
                        earnedPoints={displayedPoints}
                    />
                )}

                <OnboardingTour
                    open={showOnboarding}
                    isGuest={isGuest}
                    onComplete={() => {
                        setOnboardingDismissed(true);
                        localStorage.setItem('onboardingComplete', 'true');
                    }}
                />
            </main>
        </>
    );
};

export default Home;
