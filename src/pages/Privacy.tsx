import React from 'react';
import NavBar from '../components/NavBar';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useSearchParams, Link } from 'react-router-dom';
import SignedInBadge from '../components/SignedInBadge';

const Privacy = () => {
    const [searchParams] = useSearchParams();
    const { user } = useTuneTeaserAuth();
    const isGuest = searchParams.get('mode') === 'guest';
    
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
        </div>
    );

    const cardStyle = {
        background: 'var(--cream)',
        borderRadius: '20px',
        padding: '24px',
        border: '3px solid var(--ink)',
        boxShadow: '6px 6px 0 var(--ink)',
        color: 'var(--ink)'
    };

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            
            <main className="page home-page">
                <section className="record-bin help-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div>
                        <span className="eyebrow">Legal Information</span>
                        <h1 className="section-title">Privacy Policy</h1>
                        <p className="body-copy" style={{ color: 'var(--ink-soft)' }}>
                            Last Updated: June 2026
                        </p>
                    </div>

                    <div className="faq-stack" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        <article style={cardStyle}>
                            <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--teal)' }}>What information do we collect?</h3>
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                    We collect information you provide directly to us when you create an account, such as your email address and username (via Firebase Authentication and username reservation records). If you play in Guest Mode, playlist metadata is stored locally on your device, while track snapshots may be uploaded to cloud storage under your anonymous Firebase UID so the game can load imported playlists.
                                </p>
                            </div>
                        </article>

                        <article style={cardStyle}>
                            <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--teal)' }}>How do we use your information?</h3>
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="body-copy" style={{ fontSize: '1.05rem' }}>We use the information we collect to:</p>
                                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                    <li>Provide, maintain, and improve the TuneTeaser game experience.</li>
                                    <li>Save your imported playlists, custom mixes, and eligible solo high scores to your account.</li>
                                    <li>Display your username and score on the public Real-Time Leaderboard.</li>
                                    <li>Run private multiplayer rooms, player lists, synchronized rounds, and room scoreboards.</li>
                                </ul>
                            </div>
                        </article>

                        <article style={cardStyle}>
                            <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--teal)' }}>Third-Party Services</h3>
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="body-copy" style={{ fontSize: '1.05rem' }}>We utilize the following third-party services that may collect data in accordance with their respective privacy policies:</p>
                                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 700, color: 'var(--ink-soft)' }}>
                                    <li><strong>Google Firebase:</strong> Used for secure authentication, App Check, database storage (leaderboard, username reservation, playlist metadata, and multiplayer rooms), cloud storage for imported track snapshots, scheduled cleanup jobs, and hosting.</li>
                                    <li><strong>Spotify API:</strong> Used to search public playlists, fetch public playlist information from links you provide, load public playlists from profile URLs you provide, or access your Spotify library if you use invite-only Spotify login.</li>
                                    <li><strong>Apple iTunes API:</strong> Used anonymously to search for and retrieve the 30-second song preview snippets.</li>
                                </ul>
                            </div>
                        </article>

                        <article style={cardStyle}>
                            <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--teal)' }}>Data Security and Retention</h3>
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="body-copy" style={{ fontSize: '1.05rem' }}>
                                    We implement standard security measures to protect your information. TuneTeaser email passwords are handled by Google Firebase. Invite-only Spotify login tokens are stored in browser storage so the app can refresh your session. We retain your profile and playlist data for as long as your account is active. Inactive anonymous guest accounts and expired multiplayer rooms are cleaned up automatically, including related playlist snapshots and private round data where applicable.
                                </p>
                            </div>
                        </article>

                    </div>
                </section>
            </main>
        </>
    );
};

export default Privacy;
