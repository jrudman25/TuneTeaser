/**
 * Login.tsx
 * Handles users logging in with TuneTeaser, Spotify, or guest mode.
 * @version 2026.05.24
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut } from 'firebase/auth';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { auth, functions } from '../backend/FirebaseConfig';
import { redirectToAuthCodeFlow, getAccessToken, getFreshSpotifyAccessToken } from '../utils/auth';
import NavBar from '../components/NavBar';
import { httpsCallable } from 'firebase/functions';

import { 
  RegExpMatcher, 
  englishDataset, 
  englishRecommendedTransformers 
} from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const containsProfanity = (text: string): boolean => {
    return matcher.hasMatch(text);
};

const getGracefulAuthErrorMessage = (error: any): string => {
    if (!error || !error.code) {
        return error?.message || 'Authentication failed. Please check your connection and try again.';
    }

    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
        case 'auth/wrong-password':
            return 'Incorrect email or password. Please verify your credentials and try again.';
        case 'auth/user-not-found':
            return "No account exists for this email address. Did you mean to Create Account?";
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/email-already-in-use':
            return 'This email address is already in use. Try signing in instead.';
        case 'auth/weak-password':
            return 'Your password is too weak. Please use at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. This account has been temporarily locked. Please try again in a few minutes.';
        default:
            return (error.message || 'Authentication failed.').replace(/^Firebase:\s*/, '');
    }
};

const Login = () => {

    const [accountName, setAccountName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [tuneTeaserAuthError, setTuneTeaserAuthError] = useState('');
    const [isTuneTeaserSubmitting, setIsTuneTeaserSubmitting] = useState(false);

    const clientId = `${import.meta.env.VITE_SPOTIFY_CLIENT_ID}`;
    // Use environment variable if set, otherwise default to current origin + slash
    const redirectUri = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/`;

    const navigate = useNavigate();
    const effectRan = React.useRef(false);

    useEffect(() => {

        if (window.location.hostname === 'localhost') {
            window.location.href = window.location.href.replace('localhost', '127.0.0.1');
            return;
        }

        let unsubscribeTuneTeaserAuth: (() => void) | undefined;

        const handleAuthCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code && !effectRan.current) {
                effectRan.current = true; // Prevent double firing in Strict Mode

                try {
                    const data = await getAccessToken(clientId, code, redirectUri);
                    if (data.access_token) {
                        const { access_token, refresh_token, expires_in } = data;
                        localStorage.setItem('accessToken', access_token);
                        localStorage.setItem('refreshToken', refresh_token);
                        localStorage.setItem('tokenExpiry', (Date.now() + expires_in * 1000).toString());
                        sessionStorage.setItem('accessToken', access_token);

                        window.history.pushState({}, "", "/");

                        const response = await fetch('https://api.spotify.com/v1/me', {
                            headers: { 'Authorization': `Bearer ${access_token}` }
                        });
                        const profileData = await response.json();
                        setAccountName(profileData.display_name);

                        navigate('/home');
                    } else {
                        setIsLoading(false);
                    }
                } catch (error) {
                    console.error("Error during auth callback:", error);
                    setIsLoading(false);
                }
            } else if (!code) {
                const existingToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
                if (existingToken) {
                    const freshToken = await getFreshSpotifyAccessToken(clientId);
                    if (freshToken) {
                        navigate('/home');
                    } else {
                        setIsLoading(false);
                    }
                } else {
                    unsubscribeTuneTeaserAuth = onAuthStateChanged(auth, currentUser => {
                        if (currentUser) {
                            if (sessionStorage.getItem('isSigningUp') === 'true') {
                                return;
                            }
                            if (currentUser.isAnonymous) {
                                navigate('/home?mode=guest');
                            } else {
                                navigate('/home');
                            }
                        } else {
                            setIsLoading(false);
                        }
                    });
                }
            }
        };

        handleAuthCallback();

        return () => {
            if (unsubscribeTuneTeaserAuth) {
                unsubscribeTuneTeaserAuth();
            }
        };
    }, [clientId, navigate, redirectUri]);

    const handleLogin = async () => {
        await redirectToAuthCodeFlow(clientId, redirectUri);
    };

    const handleGuestLogin = async () => {
        try {
            await signInAnonymously(auth);
            navigate('/home?mode=guest');
        } catch (error) {
            console.error("Failed to sign in guest anonymously:", error);
            navigate('/home?mode=guest');
        }
    };

    const handleAuthModeChange = (mode: 'login' | 'signup') => {
        setAuthMode(mode);
        setTuneTeaserAuthError('');
        setConfirmPassword('');
        setShowPassword(false);
    };

    const handleTuneTeaserAuth = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setTuneTeaserAuthError('');
        setIsTuneTeaserSubmitting(true);
        if (authMode === 'signup') {
            sessionStorage.setItem('isSigningUp', 'true');
        }

        try {
            if (authMode === 'signup') {
                const trimmedUsername = username.trim();

                if (!trimmedUsername) {
                    setTuneTeaserAuthError('Username is required.');
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                // Alphanumeric, spaces, underscores, hyphens, 3-20 chars
                const usernameRegex = /^[a-zA-Z0-9_ -]{3,20}$/;
                if (!usernameRegex.test(trimmedUsername)) {
                    setTuneTeaserAuthError('Username must be 3-20 characters long and contain only letters, numbers, spaces, underscores, or hyphens.');
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                if (trimmedUsername.includes('  ')) {
                    setTuneTeaserAuthError('Username cannot contain consecutive spaces.');
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                // 1. Check for profanity
                if (containsProfanity(trimmedUsername)) {
                    setTuneTeaserAuthError('Username contains offensive or inappropriate language. Please choose a different one.');
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                if (password !== confirmPassword) {
                    setTuneTeaserAuthError('Passwords do not match.');
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                // 2. Create the user in Firebase Auth
                let userCredential;
                try {
                    userCredential = await createUserWithEmailAndPassword(auth, email, password);
                } catch (createError: any) {
                    setTuneTeaserAuthError(getGracefulAuthErrorMessage(createError));
                    setIsTuneTeaserSubmitting(false);
                    return;
                }

                // 3. Post-creation setup: username reservation, profile, leaderboard.
                // If ANY step fails, roll back by deleting the account and signing
                // out so the user can retry cleanly without hitting
                // auth/email-already-in-use on their next attempt.
                try {
                    const initializeAccount = httpsCallable<{ username: string }, { displayName: string }>(
                        functions,
                        'initializeTuneTeaserAccount'
                    );
                    await initializeAccount({ username: trimmedUsername });
                    await userCredential.user.reload();

                    sessionStorage.removeItem('isSigningUp');
                    navigate('/home');
                } catch (setupError: any) {
                    // Roll back the Firebase Auth account
                    try {
                        await userCredential.user.delete();
                    } catch (deleteError) {
                        console.error('Failed to roll back user after setup failure:', deleteError);
                    }
                    // Clear auth state so onAuthStateChanged does not redirect
                    try {
                        await signOut(auth);
                    } catch { /* already signed out via delete */ }

                    if (setupError._isUserFacing || setupError.code) {
                        setTuneTeaserAuthError(getGracefulAuthErrorMessage(setupError));
                    } else {
                        console.error('Account setup failed:', setupError);
                        setTuneTeaserAuthError('Account setup failed. Please try again.');
                    }
                    setIsTuneTeaserSubmitting(false);
                    return;
                }
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/home');
            }
        } catch (error: any) {
            setTuneTeaserAuthError(getGracefulAuthErrorMessage(error));
        } finally {
            sessionStorage.removeItem('isSigningUp');
            setIsTuneTeaserSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <>
                <NavBar />
                <main className="page hero-page">
                    <div className="loading-card">Loading...</div>
                </main>
            </>
        );
    }

    return (
        <>
            <NavBar />
            <main className="page hero-page">
                <section className="hero-card">
                    <div className="hero-copy">
                        <span className="eyebrow">Name that tune from your own playlists</span>
                        <h1 className="title">TuneTeaser</h1>
                        <p className="lede">
                            Drop the needle on a tiny song snippet, race the clock in your head, and prove you know your playlists better than anyone.
                        </p>
                        <div className="how-to-card">
                            <span className="kicker">How it works</span>
                            <ol className="how-to-list">
                                <li><span className="number-chip">1</span><span>Create an account, or play instantly in Guest Mode.</span></li>
                                <li><span className="number-chip">2</span><span>Import playlists from Spotify URLs, a Spotify profile, or a custom track list.</span></li>
                                <li><span className="number-chip">3</span><span>Pick a playlist, hear a short snippet, and guess the track title.</span></li>
                            </ol>
                        </div>
                        <div className="hero-actions">
                                {accountName ? (
                                    <p className="lede">Welcome, {accountName}!</p>
                                ) : (
                                        <>
                                            <div className="auth-panel">
                                                <div className="auth-toggle-row">
                                                    <button
                                                        type="button"
                                                        className={`button ${authMode === 'login' ? 'button-tertiary' : 'button-secondary'}`}
                                                        onClick={() => handleAuthModeChange('login')}
                                                    >
                                                        Sign In
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`button ${authMode === 'signup' ? 'button-tertiary' : 'button-secondary'}`}
                                                        onClick={() => handleAuthModeChange('signup')}
                                                    >
                                                        Create Account
                                                    </button>
                                                </div>
                                                <form className="auth-form" onSubmit={handleTuneTeaserAuth}>
                                                    {authMode === 'signup' && (
                                                        <label className="form-label">
                                                            Username (Leaderboard Display Name)
                                                            <input
                                                                className="text-input"
                                                                type="text"
                                                                value={username}
                                                                onChange={(event) => setUsername(event.target.value)}
                                                                placeholder="Username"
                                                                required
                                                                maxLength={20}
                                                            />
                                                        </label>
                                                    )}
                                                    <label className="form-label">
                                                        Email
                                                        <input
                                                            className="text-input"
                                                            type="email"
                                                            value={email}
                                                            onChange={(event) => setEmail(event.target.value)}
                                                            required
                                                        />
                                                    </label>
                                                    <label className="form-label">
                                                        Password
                                                        <span className="password-field">
                                                            <input
                                                                className="text-input"
                                                                type={showPassword ? 'text' : 'password'}
                                                                value={password}
                                                                onChange={(event) => setPassword(event.target.value)}
                                                                required
                                                                minLength={6}
                                                            />
                                                            <button
                                                                className="icon-button"
                                                                type="button"
                                                                onClick={() => setShowPassword((isShowing) => !isShowing)}
                                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                            >
                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                                            </button>
                                                        </span>
                                                    </label>
                                                    {authMode === 'signup' && (
                                                        <label className="form-label">
                                                            Confirm password
                                                            <input
                                                                className="text-input"
                                                                type={showPassword ? 'text' : 'password'}
                                                                value={confirmPassword}
                                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                                required
                                                                minLength={6}
                                                            />
                                                        </label>
                                                    )}
                                                    {tuneTeaserAuthError && <div className="error-banner">{tuneTeaserAuthError}</div>}
                                                    <button className="button button-large" type="submit" disabled={isTuneTeaserSubmitting}>
                                                        {isTuneTeaserSubmitting ? 'Working...' : authMode === 'signup' ? 'Create Account' : 'Sign In'}
                                                    </button>
                                                </form>
                                            </div>
                                            <div className="auth-alt-links">
                                                <button className="text-link" type="button" onClick={handleGuestLogin}>
                                                    Play as Guest
                                                </button>
                                                <span className="auth-alt-sep">{'\u00B7'}</span>
                                                <button className="text-link" type="button" onClick={handleLogin}>
                                                    Sign In with Spotify (invite only)
                                                </button>
                                            </div>
                                        </>
                                    )}
                        </div>
                    </div>
                    <div className="record-visual" aria-hidden="true" />
                </section>
            </main>
        </>
    );
};

export default Login;
