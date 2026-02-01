/**
 * Login.tsx
 * Handles users logging in with a Spotify account.
 * @version 2026.01.31
 */
import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { redirectToAuthCodeFlow, getAccessToken } from '../utils/auth';

const Login = () => {

    const [accountName, setAccountName] = useState('');
    const clientId = `${process.env.REACT_APP_SPOTIFY_CLIENT_ID}`;
    // Use environment variable if set, otherwise default to current origin + slash
    const redirectUri = process.env.REACT_APP_REDIRECT_URI || `${window.location.origin}/`;

    const navigate = useNavigate();
    const effectRan = React.useRef(false);

    useEffect(() => {

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

                        // Support legacy session storage for now if other parts use it, but localStorage is primary
                        sessionStorage.setItem('accessToken', access_token);

                        // Clean URL
                        window.history.pushState({}, "", "/");

                        // Fetch profile to verify and welcome
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
                // Check if we already have a token
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
