import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSearchParams, Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import SignedInBadge from '../components/SignedInBadge';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastMessage from '../components/ToastMessage';

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
    const [deleteError, setDeleteError] = useState('');
    const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);

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
            <>
                <NavBar />
                <main className="page home-page">
                    <div className="loading-card">Loading...</div>
                </main>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <NavBar />
                <main className="page home-page">
                    <div className="error-card">
                        <p className="body-copy">You must be signed in to view settings.</p>
                    </div>
                </main>
            </>
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

        const usernameRegex = /^[a-zA-Z0-9_ -]{3,20}$/;
        if (!usernameRegex.test(trimmedName)) {
            setUsernameError('Username must be 3-20 characters long and contain only letters, numbers, spaces, underscores, or hyphens.');
            return;
        }

        if (trimmedName.includes('  ')) {
            setUsernameError('Username cannot contain consecutive spaces.');
            return;
        }

        if (trimmedName === (user.displayName || '')) {
            setUsernameError('That is already your username.');
            return;
        }

        setIsUpdatingUsername(true);

        try {
            const updateUsername = httpsCallable<{ username: string }, { displayName: string }>(
                functions,
                'updateTuneTeaserUsername'
            );

            const result = await updateUsername({ username: trimmedName });
            await user.reload();
            setNewUsername(result.data.displayName);
            setUsernameSuccess('Username updated successfully!');
        } catch (err: any) {
            console.error('Failed to update username:', err);
            setUsernameError(err.message || 'Could not update username.');
        } finally {
            setIsUpdatingUsername(false);
        }
    };

    const handleDeleteAccount = async () => {
        setShowDeleteAccountDialog(false);
        setIsDeleting(true);
        try {
            await deleteUser(user);
            // User is deleted, the Firebase Function cleanupUserOnDelete will run in the background
            // and we will be automatically signed out and redirected by the auth state listener.
            navigate('/');
        } catch (err: any) {
            console.error("Failed to delete account:", err);
            if (err.code === 'auth/requires-recent-login') {
                setDeleteError('For security reasons, please sign out and sign back in before deleting your account.');
            } else {
                setDeleteError('Failed to delete account: ' + err.message);
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
            ) : null}
        </div>
    );

    const handleLogout = async () => {

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Failed to sign out user from settings page:", err);
        }
        navigate('/');
    };

    const displayedUsername = newUsername ?? user.displayName ?? '';

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
                           
                        >
                            <header className="settings-accordion-header" onClick={() => toggleSection('profile')}>
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.profile ? 'var(--teal)' : 'var(--ink)' }}>Profile</h3>
                                <ArrowForwardIosIcon className="settings-accordion-icon" />
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
                                            3-20 characters. Letters, numbers, single spaces, underscores, and hyphens only. Username changes use the same server-controlled reservation check as signup.
                                        </div>
                                        {usernameError && <div className="inline-error" style={{ marginTop: '8px' }}>{usernameError}</div>}
                                        {usernameSuccess && <div className="settings-success-text">{usernameSuccess}</div>}

                                        <div className="action-row" style={{ marginTop: '12px', justifyContent: 'flex-start' }}>
                                            <button
                                                type="submit"
                                                className="button button-primary"
                                                disabled={isUpdatingUsername || displayedUsername.trim() === (user.displayName || '')}
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
                           
                        >
                            <header className="settings-accordion-header" onClick={() => toggleSection('appearance')}>
                                <h3 className="subsection-title" style={{ margin: 0, fontSize: '1.25rem', color: openSections.appearance ? 'var(--teal)' : 'var(--ink)' }}>Appearance</h3>
                                <ArrowForwardIosIcon className="settings-accordion-icon" />
                            </header>
                            {openSections.appearance && (
                                <div className="faq-content" style={{ marginTop: '24px' }}>
                                    <div className="settings-toggle-row">
                                        <div className="settings-toggle-copy">
                                            <h4>Dark Mode</h4>
                                            <p>
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
                            className={`faq-card settings-danger-card ${openSections.dangerZone ? 'open' : ''}`}
                           
                        >
                            <header className="settings-accordion-header" onClick={() => toggleSection('dangerZone')}>
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
                                    <div className="settings-danger-box">
                                        <h4>Delete Account</h4>
                                        <p>
                                            Permanently delete your TuneTeaser account, all saved playlists, and your leaderboard history.
                                            <strong> This action cannot be undone.</strong>
                                        </p>
                                        <button
                                            className="button button-danger"
                                            onClick={() => setShowDeleteAccountDialog(true)}
                                            disabled={isDeleting}
                                        >
                                            {isDeleting ? 'Deleting...' : 'Delete My Account'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>

                    </div>
                    <ConfirmDialog
                        open={showDeleteAccountDialog}
                        title="Delete Account"
                        message={'WARNING: This action is irreversible. All your playlists, high scores, and account data will be permanently deleted. Are you absolutely sure?'}
                        confirmLabel="Delete My Account"
                        cancelLabel="Cancel"
                        variant="danger"
                        onConfirm={handleDeleteAccount}
                        onCancel={() => setShowDeleteAccountDialog(false)}
                        isLoading={isDeleting}
                        loadingLabel="Deleting..."
                    />
                </section>
                            <ToastMessage message={deleteError} type="error" onClose={() => setDeleteError('')} />
            </main>
        </>
    );
};

export default Settings;
