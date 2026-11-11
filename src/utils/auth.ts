/**
 * Auth.ts
 * Legacy Spotify session cleanup. TuneTeaser no longer signs in with Spotify,
 * so stale OAuth tokens left in storage by older versions are removed at startup.
 * @version 2026.06.01
 */
export function clearLegacySpotifySession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('verifier');
    localStorage.removeItem('tuneteaserFailedItunesLookups');
    sessionStorage.removeItem('accessToken');
}
