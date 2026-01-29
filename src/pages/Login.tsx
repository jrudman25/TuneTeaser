/**
 * Login.tsx
 * Handles users logging in with a Spotify account.
 * @version 2026.01.11
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
                    const accessToken = await getAccessToken(clientId, code, redirectUri);
                    if (accessToken) {
                        sessionStorage.setItem('accessToken', accessToken);
                        // Clean URL
                        window.history.pushState({}, "", "/");

                        // Fetch profile to verify and welcome
                        const response = await fetch('https://api.spotify.com/v1/me', {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        const data = await response.json();
                        setAccountName(data.display_name);

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
