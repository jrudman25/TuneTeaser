/**
 * Login.tsx
 * Handles users logging in with a Spotify account.
 * @version 2026.02.01
 */
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { redirectToAuthCodeFlow, getAccessToken } from '../utils/auth';

const Login = () => {

    const [accountName, setAccountName] = useState('');
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
                    }
                } catch (error) {
                    console.error("Error during auth callback:", error);
                }
            } else if (!code) {
                const existingToken = sessionStorage.getItem('accessToken');
                if (existingToken) {
                    navigate('/home');
                }
            }
        };

        handleAuthCallback();
    }, [clientId, navigate, redirectUri]);

    const handleLogin = async () => {
        await redirectToAuthCodeFlow(clientId, redirectUri);
    };

    return (
        <div>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <h1>Login with Spotify</h1>
                {accountName ? (
                    <p>Welcome, {accountName}!</p>
                ) : (
                    <button onClick={handleLogin}>Login with Spotify</button>
                )}
            </Box>
        </div>
    );
};

export default Login;
