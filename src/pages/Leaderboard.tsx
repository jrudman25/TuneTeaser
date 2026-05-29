/**
 * Leaderboard.tsx
 * Displays the top 10 players and the current user's rank and stats.
 * @version 2026.05.27
 */
import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import NavBar from '../components/NavBar';
import SignedInBadge from '../components/SignedInBadge';

const RANK_LABELS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

const Leaderboard = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isLoadingUser } = useTuneTeaserAuth();

    // Compute probable login state to prevent header buttons/badges flickering/disappearing during page loading states
    const isGuest = searchParams.get('mode') === 'guest';
    const hasFirebaseUser = Object.keys(localStorage).some(key => key.startsWith('firebase:authUser'));
    const isProbablyLoggedIn = !!user || hasFirebaseUser || !!localStorage.getItem('accessToken') || isGuest;
    const isProbablyGuest = isGuest || (user && user.isAnonymous);
    const {
        topPlayers,
        currentUserEntry,
        currentUserRank,
        isLoading
    } = useLeaderboard(user);

    const isLoggedIn = !!user && !user.isAnonymous;

    React.useEffect(() => {
        if (!isLoadingUser && !user && !isGuest) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user, isGuest]);

    const isInTop10 = isLoggedIn && topPlayers.some(p => p.uid === user?.uid);

    const backPath = isProbablyLoggedIn ? (isProbablyGuest ? '/home?mode=guest' : '/home') : '/';
    const backLabel = isProbablyLoggedIn ? 'Back to Home' : 'Back to Login';

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Failed to sign out user from leaderboard:", err);
        }
        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            {isProbablyGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : user ? (
                <SignedInBadge user={user} />
            ) : !isProbablyGuest && localStorage.getItem('accessToken') ? (
                <span className="account-badge">Signed in with Spotify</span>
            ) : null}
        </div>
    );

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={isProbablyGuest ? "/playlists?mode=guest" : "/playlists"}>
                Manage Playlists
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    {isProbablyGuest ? 'Exit Guest Mode' : 'Logout'}
                </button>
            )}
        </div>
    );

    if (isLoadingUser || isLoading) {
        return (
            <>
                <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
                <main className="page home-page">
                    <div className="loading-card">Loading leaderboard...</div>
                </main>
            </>
        );
    }

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">

                <section className="leaderboard-card">
                    <div>
                        <span className="eyebrow">Leaderboard</span>
                        <h1 className="section-title">Top players</h1>
                        <p className="body-copy">
                            Earn points by guessing songs correctly. Faster guesses earn more points.
                            Playlists must have at least 10 tracks to be eligible.
                            {!isLoggedIn && (
                                <span style={{ display: 'block', marginTop: '10px', fontSize: '0.95rem', color: 'var(--ink-soft)', fontWeight: 800 }}>
                                    {user?.isAnonymous
                                        ? 'You are playing in Guest Mode. Log in to a TuneTeaser account to save your stats and join the board!'
                                        : 'Log in to save your stats and claim a spot on the leaderboard!'}
                                </span>
                            )}
                        </p>
                    </div>

                    {isLoggedIn && currentUserEntry && (
                        <div className="your-stats-card">
                            <span className="kicker">Your stats</span>
                            <div className="your-stats-grid">
                                <div className="stat-block">
                                    <span className="stat-value">{currentUserRank != null ? currentUserRank : <span className="playing-badge">...</span>}</span>
                                    <span className="stat-label">Rank</span>
                                </div>
                                <div className="stat-block">
                                    <span className="stat-value">{currentUserEntry.totalPoints.toLocaleString()}</span>
                                    <span className="stat-label">Points</span>
                                </div>
                                <div className="stat-block">
                                    <span className="stat-value">{currentUserEntry.gamesWon.toLocaleString()}</span>
                                    <span className="stat-label">Wins</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {isLoggedIn && !currentUserEntry && (
                        <div className="your-stats-card">
                            <span className="kicker">Your stats</span>
                            <p className="body-copy" style={{ marginTop: '8px' }}>
                                You have not earned any points yet. Play a game to get started!
                            </p>
                        </div>
                    )}



                    {topPlayers.length > 0 ? (
                        <div className="leaderboard-table-wrapper">
                            <table className="leaderboard-table">
                                <thead>
                                    <tr>
                                        <th className="col-rank">Rank</th>
                                        <th className="col-name">Player</th>
                                        <th className="col-points">Points</th>
                                        <th className="col-wins">Wins</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPlayers.map((player, index) => {
                                        const isCurrentUser = isLoggedIn && player.uid === user?.uid;
                                        return (
                                            <tr
                                                key={player.uid}
                                                className={`leaderboard-row ${isCurrentUser ? 'current-user-row' : ''} ${index < 3 ? `rank-${index + 1}` : ''}`}
                                            >
                                                <td className="col-rank">
                                                    <span className={`rank-badge ${index < 3 ? `rank-badge-${index + 1}` : ''}`}>
                                                        {index < 3 ? RANK_LABELS[index] : index + 1}
                                                    </span>
                                                </td>
                                                <td className="col-name">
                                                    {player.displayName}
                                                    {isCurrentUser && <span className="you-tag">you</span>}
                                                </td>
                                                <td className="col-points">
                                                    <span className="points-badge">{player.totalPoints.toLocaleString()}</span>
                                                </td>
                                                <td className="col-wins">{player.gamesWon.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {isLoggedIn && currentUserEntry && !isInTop10 && currentUserRank && (
                                <div className="below-table-user">
                                    <span className="rank-badge">#{currentUserRank}</span>
                                    <span className="below-table-name">
                                        {currentUserEntry.displayName}
                                        <span className="you-tag">you</span>
                                    </span>
                                    <span className="points-badge">{currentUserEntry.totalPoints.toLocaleString()}</span>
                                    <span>{currentUserEntry.gamesWon.toLocaleString()} wins</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="loading-card">
                            No scores yet. Be the first to play!
                        </div>
                    )}

                    <div className="action-row" style={{ marginTop: '8px' }}>
                        <Link to={backPath} className="button button-secondary">
                            {backLabel}
                        </Link>
                        <Link to="/home" className="button button-tertiary">Play Now</Link>
                    </div>
                </section>
            </main>
        </>
    );
};

export default Leaderboard;
