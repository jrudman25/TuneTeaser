/**
 * Login.tsx
 * Handles users logging in with a Spotify account.
 * @version 2026.05.14
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { redirectToAuthCodeFlow, getAccessToken } from '../utils/auth';

const Login = () => {

    const [accountName, setAccountName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

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

                        setTimeout(() => {
                            navigate('/home');
                        }, 1500);
                    } else {
                        setIsLoading(false);
                    }
                } catch (error) {
                    console.error("Error during auth callback:", error);
                    setIsLoading(false);
                }
            } else if (!code) {
                const existingToken = sessionStorage.getItem('accessToken');
                if (existingToken) {
                    navigate('/home');
                } else {
                    setIsLoading(false);
                }
            }
        };

        handleAuthCallback();
    }, [clientId, navigate, redirectUri]);

    const handleLogin = async () => {
        await redirectToAuthCodeFlow(clientId, redirectUri);
    };

    const handleGuestLogin = () => {
        navigate('/home?mode=guest');
    };

    return (
        <main className="page hero-page">
            <section className="hero-card">
                <div className="hero-copy">
                    <span className="eyebrow">Name that tune from your own crates</span>
                    <h1 className="title">TuneTeaser</h1>
                    <p className="lede">
                        Drop the needle on a tiny song snippet, race the clock in your head, and prove you know your playlists better than anyone.
                    </p>
                    <div className="how-to-card">
                        <span className="kicker">How it works</span>
                        <ol className="how-to-list">
                            <li><span className="number-chip">1</span><span>Choose Spotify or jump into featured guest playlists.</span></li>
                            <li><span className="number-chip">2</span><span>Pick a playlist from the record bin.</span></li>
                            <li><span className="number-chip">3</span><span>Hear a short snippet and guess the track title.</span></li>
                        </ol>
                    </div>
                    <div className="hero-actions">
                        {isLoading ? (
                            <div className="loading-card">Checking authentication...</div>
                        ) : (
                            <>
                                {accountName ? (
                                    <p className="lede">Welcome, {accountName}!</p>
                                ) : (
                                    <>
                                        <button className="button button-large" onClick={handleLogin}>Login with Spotify</button>
                                        <button className="button button-secondary button-large" onClick={handleGuestLogin}>
                                            Play as Guest
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="record-visual" aria-hidden="true" />
            </section>
        </main>
    );
};

export default Login;
