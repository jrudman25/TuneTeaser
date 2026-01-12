/**
 * Auth.ts
 * Handles auth on logging in
 * @version 2026.01.11
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

    const scopeString = "playlist-read-private playlist-modify-public playlist-modify-private user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state";

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}&scope=${encodeURIComponent(scopeString)}`;
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
    console.log("Token response:", data);
    // Scope is optional in response if it is identical to requested scopes
    if (data.scope && !data.scope.includes("streaming")) {
        console.error("WARNING: 'streaming' scope is MISSING! The player will fail.");
    }
    const { access_token } = data;
    return access_token;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
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
