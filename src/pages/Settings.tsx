import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { doc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSearchParams, Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import SignedInBadge from '../components/SignedInBadge';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const Settings = () => {
    const navigate = useNavigate();
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const { isDarkMode, toggleTheme } = useDarkMode();

    const [searchParams] = useSearchParams();
    const isGuest = searchParams.get('mode') === 'guest';

    const [newUsername, setNewUsername] = useState<string | null>(null);
    const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameSuccess, setUsernameSuccess] = useState('');

    const [isDeleting, setIsDeleting] = useState(false);

    // Track which accordion sections are open
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        profile: true,
        appearance: true,
        dangerZone: false
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    if (isLoadingUser) {
        return (
            <div className="page home-page">
                <NavBar />
                <div className="loading-card" style={{ marginTop: '32px' }}>Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="page home-page">
                <NavBar />
                <div className="error-card" style={{ marginTop: '32px' }}>
                    <p className="body-copy">You must be logged in to view settings.</p>
                </div>
            </div>
        );
    }

    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameError('');
        setUsernameSuccess('');

        const trimmedName = (newUsername ?? user.displayName ?? '').trim();
        if (!trimmedName) {
            setUsernameError('Username cannot be empty.');
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(trimmedName)) {
            setUsernameError('Username must be 3-20 characters long and contain only letters, numbers, underscores, or hyphens.');
            return;
        }

        if (trimmedName.toLowerCase() === (user.displayName || '').toLowerCase()) {
            setUsernameError('That is already your username.');
            return;
        }

        setIsUpdatingUsername(true);

        try {
            // Check uniqueness in leaderboard
            const leaderboardQuery = query(
                collection(db, 'leaderboard'),
                where('displayName', '==', trimmedName)
            );
            const querySnapshot = await getDocs(leaderboardQuery);

            // Wait, Firestore equality is case sensitive. So if we want case-insensitive uniqueness we'd need another field.
            // For now, exact match is fine, but we'll check manually if we get results.
            if (!querySnapshot.empty) {
                // Technically someone could have "User" and we try "user", but standard Firestore doesn't do case-insensitive search easily
                // without a lowercase field. This is a basic check.
                setUsernameError(`The username "${trimmedName}" is already taken.`);
                setIsUpdatingUsername(false);
                return;
            }

            // Update Auth Profile
            await updateProfile(user, { displayName: trimmedName });

            // Update Leaderboard Document (if it exists)
            try {
                const leaderboardDoc = doc(db, 'leaderboard', user.uid);
                await updateDoc(leaderboardDoc, { displayName: trimmedName });
            } catch {
                // Might not exist if they never played a game. That's fine.
            }

            setUsernameSuccess('Username updated successfully!');
        } catch (err: any) {
            console.error('Failed to update username:', err);
            setUsernameError(err.message || 'Could not update username.');
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmDelete = window.confirm(
            "WARNING: This action is irreversible.\n\n" +
            "All your playlists, high scores, and account data will be permanently deleted.\n" +
            "Are you absolutely sure you want to delete your account?"
        );

        if (!confirmDelete) return;

        setIsDeleting(true);
        try {
            await deleteUser(user);
            // User is deleted, the Firebase Function cleanupUserOnDelete will run in the background
            // and we will be automatically logged out and redirected by the auth state listener.
            navigate('/');
        } catch (err: any) {
            console.error("Failed to delete account:", err);
            if (err.code === 'auth/requires-recent-login') {
                alert("For security reasons, please log out and log back in before deleting your account.");
            } else {
                alert("Failed to delete account: " + err.message);
            }
            setIsDeleting(false);
        }
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

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Failed to sign out user from settings page:", err);
        }
        navigate('/');
    };

    const backPath = isGuest ? '/home?mode=guest' : user ? '/home' : '/';
    const backLabel = user || isGuest ? 'Back to Home' : 'Back to Login';
    const displayedUsername = newUsername ?? user.displayName ?? '';

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={backPath}>
                {backLabel}
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    {isGuest ? 'Exit Guest Mode' : 'Logout'}
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

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">
                <section className="record-bin help-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div>
                        <span className="eyebrow">Account Preferences</span>
                        <h1 className="section-title">Settings</h1>
                    </div>

                    <div className="faq-stack" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Section 1: Profile Settings */}
                        <article
                            className={`faq-card ${openSections.profile ? 'open' : ''}`}
                            style={cardStyle}
                        >
                            <header
                                onClick={() => toggleSection('profile')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.profile ? 'var(--teal)' : 'var(--ink)' }}>Profile</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.profile ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.profile && (
                                <div className="faq-content" style={{ marginTop: '16px' }}>
                                    <form onSubmit={handleUpdateUsername} className="playlist-form">
                                        <label className="form-label">
                                            Display Name
                                            <input
                                                type="text"
                                                className="text-input"
                                                value={displayedUsername}
                                                onChange={(e) => setNewUsername(e.target.value)}
                                                placeholder="Enter new username"
                                                maxLength={20}
                                                required
                                            />
                                        </label>
                                        <div className="helper-text">
                                            3-20 characters. Letters, numbers, underscores, and hyphens only.
                                        </div>
                                        {usernameError && <div className="inline-error" style={{ marginTop: '8px' }}>{usernameError}</div>}
                                        {usernameSuccess && <div style={{ color: 'var(--green)', fontWeight: 'bold', marginTop: '8px' }}>{usernameSuccess}</div>}

                                        <div className="action-row" style={{ marginTop: '12px', justifyContent: 'flex-start' }}>
                                            <button
                                                type="submit"
                                                className="button button-primary"
                                                disabled={isUpdatingUsername || displayedUsername.trim() === user.displayName}
                                            >
                                                {isUpdatingUsername ? 'Saving...' : 'Update Username'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </article>

                        {/* Section 2: Appearance */}
                        <article
                            className={`faq-card ${openSections.appearance ? 'open' : ''}`}
                            style={cardStyle}
                        >
                            <header
                                onClick={() => toggleSection('appearance')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.appearance ? 'var(--teal)' : 'var(--ink)' }}>Appearance</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.appearance ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--teal)'
                                    }}
                                />
                            </header>
                            {openSections.appearance && (
                                <div className="faq-content" style={{ marginTop: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 900 }}>Dark Mode</h4>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-soft)', fontWeight: 800 }}>
                                                Switch to a darker neon arcade theme.
                                            </p>
                                        </div>
                                        <button
                                            className="button button-secondary"
                                            onClick={toggleTheme}
                                        >
                                            {isDarkMode ? 'Enable Light Mode' : 'Enable Dark Mode'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>

                        {/* Section 3: Danger Zone */}
                        <article
                            className={`faq-card ${openSections.dangerZone ? 'open' : ''}`}
                            style={{ ...cardStyle, border: '3px solid var(--red)' }}
                        >
                            <header
                                onClick={() => toggleSection('dangerZone')}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            >
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--red)' }}>Danger Zone</h3>
                                <ArrowForwardIosIcon
                                    style={{
                                        transform: openSections.dangerZone ? 'rotate(90deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease',
                                        fontSize: '1rem',
                                        color: 'var(--red)'
                                    }}
                                />
                            </header>
                            {openSections.dangerZone && (
                                <div className="faq-content" style={{ marginTop: '24px' }}>
                                    <div style={{ padding: '16px', background: 'rgba(215, 67, 50, 0.1)', borderRadius: '12px', border: '2px solid rgba(215, 67, 50, 0.3)' }}>
                                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--red)', fontSize: '1.1rem', fontWeight: 900 }}>Delete Account</h4>
                                        <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 700 }}>
                                            Permanently delete your TuneTeaser account, all saved playlists, and your leaderboard history.
                                            <strong> This action cannot be undone.</strong>
                                        </p>
                                        <button
                                            className="button button-danger"
                                            onClick={handleDeleteAccount}
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? 'Deleting...' : 'Delete My Account'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>

                    </div>
                </section>
            </main>
        </>
    );
};

export default Settings;
