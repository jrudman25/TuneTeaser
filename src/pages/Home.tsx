/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.05.27
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, signInAnonymously } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import { usePlaylists } from '../hooks/usePlaylists';
import { useGameLogic } from '../hooks/useGameLogic';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
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

        if (localStorage.getItem('onboardingComplete') === 'true') return false;

        // Show for new email users with no playlists, or first-visit guests
        return (isManualMode && manualPlaylists.length === 0) || isGuest;
    }, [onboardingDismissed, isLoadingUser, isLoadingManualPlaylists, isManualMode, isGuest, manualPlaylists.length]);

    useEffect(() => {
        if (isGuest && !isLoadingUser && !user) {
            signInAnonymously(auth).catch(err => {
                console.error("Failed to sign in guest anonymously:", err);
            });
        }
    }, [isGuest, isLoadingUser, user]);

    useEffect(() => {
        if (!isLoadingUser && !isGuest && !isManualMode) {
            navigate('/');
        }
    }, [isLoadingUser, isGuest, isManualMode, navigate]);

    const { playlists, isLoadingPlaylists, playlistError } = usePlaylists(isGuest, manualPlaylists, isManualMode);
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
        handleGiveUp: originalHandleGiveUp,
        playSnippet,
        handlePlayAgain: originalHandlePlayAgain,
        handleSelectNewPlaylist: originalHandleSelectNewPlaylist,
        isPlaying,
        playerError,
        currentTracks,
        wrongGuesses,
        isSubmittingGuess,
        volume,
        setVolume
    } = useGameLogic(isGuest, manualPlaylists, isManualMode);

    const [displayedPoints, setDisplayedPoints] = useState<number | null>(null);
    const [pointsNote, setPointsNote] = useState<string | null>(null);

    const handleGiveUp = () => {
        setDisplayedPoints(null);
        setPointsNote(null);
        originalHandleGiveUp();
    };

    const handlePlayAgain = () => {
        setDisplayedPoints(null);
        setPointsNote(null);
        originalHandlePlayAgain();
    };

    const handleSelectNewPlaylist = () => {
        setDisplayedPoints(null);
        setPointsNote(null);
        originalHandleSelectNewPlaylist();
    };

    const handleGuessWithScoring = async (specificGuess?: string) => {
        const result = await handleGuessSubmit(specificGuess);

        if (result?.result !== 'correct') {
            setDisplayedPoints(null);
            setPointsNote(null);
            return;
        }

        setDisplayedPoints(result.pointsAwarded);
        setPointsNote(
            result.pointsNote === 'cooldown'
                ? 'No points: you scored this song recently.'
                : result.pointsNote === 'daily-cap'
                    ? 'No points: daily points limit reached.'
                    : null
        );
    };

    const onSelectPlaylist = (playlistId: string) => {
        const p = playlists.find((pl: any) => pl.id === playlistId);
        loadPlaylist(playlistId, p ? p.name : '');
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);

        try {
            await signOut(auth);
        } catch { /* no active Firebase session */ }

        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            {isProbablyGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : isProbablyManualMode ? (
                <SignedInBadge user={user} />
            ) : null}
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
                {isProbablyGuest ? 'Exit Guest Mode' : 'Sign Out'}
            </button>
        </div>
    );

    if (isLoggingOut || isLoadingUser || (user && !user.isAnonymous && isLoadingManualPlaylists)) {
        return (
            <>
                <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
                <main className="page home-page">
                    <div className="loading-card">{isLoggingOut ? 'Signing out...' : 'Loading...'}</div>
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
                        feedbackMessage={feedbackMessage}
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
                        wrongGuesses={wrongGuesses}
                        isSubmittingGuess={isSubmittingGuess}
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
                        pointsNote={pointsNote}
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
