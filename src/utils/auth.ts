/**
 * Auth.ts
 * Handles auth on logging in
 * @version 2026.01.30
 */
export async function redirectToAuthCodeFlow(clientId: string, redirectUri: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    const scopeString = "playlist-read-private user-read-private user-read-email user-library-read";

    window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}&scope=${encodeURIComponent(scopeString)}`);
}

export async function getAccessToken(clientId: string, code: string, redirectUri: string) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const data = await result.json();
    if (!result.ok) {
        throw new Error(getSpotifyTokenErrorMessage(data, result.status));
    }
    return data; // Returns access_token, refresh_token, expires_in
}

export async function refreshAccessToken(clientId: string, refreshToken: string) {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const data = await result.json();
    if (!result.ok) {
        throw new Error(getSpotifyTokenErrorMessage(data, result.status));
    }
    return data;
}

export function clearSpotifySession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('verifier');
    sessionStorage.removeItem('accessToken');
}

export async function getFreshSpotifyAccessToken(clientId: string) {
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const parsedTokenExpiry = tokenExpiry ? Number.parseInt(tokenExpiry, 10) : Number.NaN;

    if (!accessToken) {
        return null;
    }

    if (Number.isFinite(parsedTokenExpiry) && Date.now() < parsedTokenExpiry) {
        return accessToken;
    }

    if (!refreshToken) {
        clearSpotifySession();
        return null;
    }

    try {
        const data = await refreshAccessToken(clientId, refreshToken);
        if (!data.access_token) {
            clearSpotifySession();
            return null;
        }

        localStorage.setItem('accessToken', data.access_token);
        sessionStorage.setItem('accessToken', data.access_token);
        localStorage.setItem('tokenExpiry', (Date.now() + data.expires_in * 1000).toString());

        if (data.refresh_token) {
            localStorage.setItem('refreshToken', data.refresh_token);
        }

        return data.access_token;
    } catch (error) {
        console.error('Failed to refresh Spotify session:', error);
        clearSpotifySession();
        return null;
    }
}

function getSpotifyTokenErrorMessage(data: any, status: number) {
    if (data?.error_description) {
        return data.error_description;
    }

    if (data?.error) {
        return `Spotify token request failed: ${data.error}`;
    }

    return `Spotify token request failed with status ${status}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        text += possible.charAt(randomValues[i] % possible.length);
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
