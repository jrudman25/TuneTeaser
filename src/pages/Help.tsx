/**
 * Help.tsx
 * Comprehensive Help & FAQ page for TuneTeaser.
 * Explains how to play, how to find Spotify links, limits, and scoring rules.
 * @version 2026.05.28
 */
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import NavBar from '../components/NavBar';
import SignedInBadge from '../components/SignedInBadge';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const Help = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const isGuest = searchParams.get('mode') === 'guest';

    // Track which accordion sections are open
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        howToPlay: true,
        spotifyLinks: true,
        limits: false,
        scoring: false,
        multiplayer: false,
        privacy: false
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const backPath = isGuest ? '/home?mode=guest' : user ? '/home' : '/';
    const backLabel = user || isGuest ? 'Back to Home' : 'Back to Sign In';

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Failed to sign out user from help page:", err);
        }
        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            {isGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : user ? (
                <SignedInBadge user={user} />
            ) : localStorage.getItem('accessToken') ? (
                <span className="account-badge">Signed in with Spotify</span>
            ) : null}
        </div>
    );

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={isGuest ? "/playlists?mode=guest" : "/playlists"}>
                Manage Playlists
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
                </button>
            )}
        </div>
    );

    const cardStyle = {
        background: 'var(--cream)',
        borderRadius: '20px',
        padding: '24px',
        border: '3px solid var(--ink)',
        boxShadow: '6px 6px 0 var(--ink)',
        transition: 'all 0.2s ease',
        color: 'var(--ink)'
    };

    const subBoxStyle = {
        background: 'rgba(22, 140, 132, 0.06)',
        borderRadius: '14px',
        padding: '16px',
        border: '2px solid var(--ink)',
        color: 'var(--ink)'
    };

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">
                <section className="record-bin help-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div>
                        <span className="eyebrow">Onboarding Guide</span>
                        <h1 className="section-title">Help & FAQ</h1>
                        <p className="body-copy">
                            Welcome to TuneTeaser. Here you will find everything you need to know about setting up playlists, importing Spotify music, playing solo or multiplayer rounds, managing limits, earning points, and climbing the leaderboard.
                        </p>
                    </div>

                    <div className="faq-stack" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Section 1: How to Play */}
                        <article
                            className={`faq-card ${openSections.howToPlay ? 'open' : ''}`}
                            onClick={() => toggleSection('howToPlay')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.howToPlay ? 'var(--teal)' : 'var(--ink)' }}>How to Play</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.howToPlay ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.howToPlay && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        TuneTeaser tests your musical recall using song previews from your chosen playlist.
                                    </p>
                                    <ul className="compact-list" style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                        <li><strong>Select a Playlist:</strong> Choose a playlist from your library, a featured guest playlist, or the host playlist in a multiplayer room.</li>
                                        <li><strong>Hear the Snippet:</strong> A random track is chosen, and a short audio preview will play.</li>
                                        <li><strong>Guess the Title:</strong> Type the song title. In solo play, incorrect guesses increase the snippet length. In multiplayer, race the shared round timer.</li>
                                        <li><strong>Earn Points:</strong> Correct guesses can reward points for registered TuneTeaser accounts, and answering quickly earns more.</li>
                                    </ul>
                                </div>
                            )}
                        </article>

                        {/* Section 2: Finding Spotify Links */}
                        <article
                            className={`faq-card ${openSections.spotifyLinks ? 'open' : ''}`}
                            onClick={() => toggleSection('spotifyLinks')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.spotifyLinks ? 'var(--teal)' : 'var(--ink)' }}>Finding Spotify Links</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.spotifyLinks ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.spotifyLinks && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        You can search public Spotify playlists, import a single public playlist URL, or browse public playlists from a Spotify profile URL. Follow these simple steps:
                                    </p>

                                    <div className="help-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
                                        {/* Playlist URL guide */}
                                        <div style={subBoxStyle}>
                                            <h4 style={{ margin: '0 0 8px 0', color: 'var(--teal)', fontSize: '1.1rem', fontWeight: 900 }}>Playlist URLs</h4>
                                            <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink-soft)' }}>Use to import a single public playlist.</p>
                                            <ul style={{ paddingLeft: '16px', fontSize: '0.88rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700 }}>
                                                <li><strong>On Desktop:</strong> Right-click the playlist title in the sidebar, hover over <em>Share</em>, and click <em>Copy link to playlist</em>.</li>
                                                <li><strong>On Mobile:</strong> Tap the three dots icon under the playlist banner, select <em>Share</em>, and choose <em>Copy link</em>.</li>
                                            </ul>
                                        </div>

                                        {/* Profile URL guide */}
                                        <div style={subBoxStyle}>
                                            <h4 style={{ margin: '0 0 8px 0', color: 'var(--teal)', fontSize: '1.1rem', fontWeight: 900 }}>Profile URLs</h4>
                                            <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ink-soft)' }}>Use to browse and import public playlists.</p>
                                            <ul style={{ paddingLeft: '16px', fontSize: '0.88rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700 }}>
                                                <li><strong>On Desktop:</strong> Click your username in the top right of Spotify, click <em>Profile</em>, click the three dots icon under your profile photo, hover over <em>Share</em>, and click <em>Copy link to profile</em>.</li>
                                                <li><strong>On Mobile:</strong> Tap your profile picture, select <em>View Profile</em>, tap the three dots in the top right corner, select <em>Share</em>, and choose <em>Copy link</em>.</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <p className="helper-text" style={{ margin: 0, color: 'var(--ink-soft)', fontWeight: 800 }}>
                                        Note: Search, playlist URL import, and profile URL import only show public Spotify data. Secret, private, or collaborative playlists require Spotify sign-in access.
                                    </p>
                                </div>
                            )}
                        </article>

                        {/* Section 3: Storage Limits & Data Caps */}
                        <article
                            className={`faq-card ${openSections.limits ? 'open' : ''}`}
                            onClick={() => toggleSection('limits')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.limits ? 'var(--teal)' : 'var(--ink)' }}>Storage & Playlist Limits</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.limits ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.limits && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        To maintain high performance and optimize cloud storage, the following resource caps are enforced:
                                    </p>
                                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                        <li><strong>Playlist Limit:</strong> Each user (including guest sessions) can save a maximum of <strong>30</strong> active playlists in their library. To add more, simply delete an old playlist from your Music Library.</li>
                                        <li><strong>Track Cap:</strong> A single playlist is limited to a maximum of <strong>5,000</strong> tracks. Any import exceeding this length will be sliced and capped at the first 5,000 songs.</li>
                                        <li><strong>Background Imports:</strong> Large Spotify imports may load the first batch immediately, then continue importing in the background. If a later batch fails, the playlist is marked with an import error instead of appearing ready.</li>
                                        <li><strong>Static Snapshots:</strong> When you import from Spotify, it creates a static snapshot of your tracks at that specific moment. If you subsequently add or delete tracks on Spotify, the changes will not sync automatically. You can update your playlist easily by deleting it from TuneTeaser and importing the link again.</li>
                                    </ul>
                                </div>
                            )}
                        </article>

                        {/* Section 4: Leaderboard Rules */}
                        <article
                            className={`faq-card ${openSections.scoring ? 'open' : ''}`}
                            onClick={() => toggleSection('scoring')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.scoring ? 'var(--teal)' : 'var(--ink)' }}>Leaderboard & Scoring</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.scoring ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.scoring && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        Score points by proving your playlist knowledge. Climb the global ranks with these rules:
                                    </p>
                                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                        <li><strong>Eligible Playlists:</strong> To qualify for the global leaderboard, you must play on a playlist containing at least <strong>10</strong> tracks. Smaller mixes can be played for fun, but scores will not be uploaded.</li>
                                        <li><strong>Speed Bonus:</strong> Points are calculated based on your guess speed. Guessing a track title immediately awards 25 points, which decreases by 1 point for every additional 2 seconds of snippet length you need (4s = 24 points, 6s = 23 points, etc.).</li>
                                        <li><strong>Fair Play Cooldown:</strong> The same account cannot repeatedly score the same song from the same playlist within a short cooldown window.</li>
                                        <li><strong>Account Required:</strong> You must be signed into a registered TuneTeaser email account to upload solo scores. Guest Mode and invite-only Spotify login games do not submit scores to the cloud leaderboard yet.</li>
                                    </ul>
                                </div>
                            )}
                        </article>

                        <article
                            className={`faq-card ${openSections.multiplayer ? 'open' : ''}`}
                            onClick={() => toggleSection('multiplayer')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.multiplayer ? 'var(--teal)' : 'var(--ink)' }}>Multiplayer Rooms</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.multiplayer ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.multiplayer && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        Multiplayer uses private invite rooms. Create a room, share the six-character code or room link, choose a playlist, set the point goal and round timer, then start synchronized rounds.
                                    </p>
                                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                        <li><strong>Private Codes:</strong> Public lobby browsing is not available. Players join by invite code or direct room link.</li>
                                        <li><strong>Host Controls:</strong> The host picks playlists, saves settings, starts games, kicks players from the lobby, and decides whether to play again or return to the lobby after a win.</li>
                                        <li><strong>Round Flow:</strong> Players guess on their own device, can give up, and may time out. When everyone is done, the answer is revealed before the next round starts.</li>
                                        <li><strong>Scoring:</strong> Multiplayer uses the same 10 to 25 point speed formula, but multiplayer room scores are separate from the global solo leaderboard.</li>
                                    </ul>
                                </div>
                            )}
                        </article>

                        <article
                            className={`faq-card ${openSections.privacy ? 'open' : ''}`}
                            onClick={() => toggleSection('privacy')}
                            style={{ ...cardStyle, cursor: 'pointer' }}
                        >
                            <header
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.privacy ? 'var(--teal)' : 'var(--ink)' }}>Account Modes & Security</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.privacy ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.privacy && (
                                <div
                                    className="faq-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                >
                                    <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                        TuneTeaser supports these account modes and storage behaviors:
                                    </p>
                                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                        <li><strong>TuneTeaser Account:</strong> Create an account with an email, password, and reserved username to back up playlists, sync multiple devices, and climb the leaderboard. Username changes in Settings use the same reserved-name check as signup.</li>
                                        <li><strong>Spotify Sign In:</strong> Sign in directly via Spotify to use your Spotify library without pasting links manually. Only available via invite, and leaderboard scoring is not enabled for Spotify-only sessions yet.</li>
                                        <li><strong>Guest Mode:</strong> Play immediately. We sign you in anonymously behind the scenes using secure isolated tokens to separate your session. Playlist metadata is saved in your local browser storage, while track snapshots may be uploaded to cloud storage under your anonymous Firebase UID so the game can load them. No email is collected and no scores go to the global leaderboard.</li>
                                        <li><strong>Cleanup:</strong> Inactive anonymous guest users and expired multiplayer rooms are cleaned up automatically to limit retained data.</li>
                                    </ul>
                                </div>
                            )}
                        </article>
                    </div>

                    <div className="action-row" style={{ marginTop: '32px', justifyContent: 'center' }}>
                        <Link to={backPath} className="button button-large button-primary">
                            {backLabel}
                        </Link>
                    </div>
                </section>
            </main>
        </>
    );
};

export default Help;
