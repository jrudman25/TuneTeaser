import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ManualTrack, parseTrackImportInput } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { resolveSpotifyTracks } from '../utils/spotifyTrackResolver';
import SignedInBadge from '../components/SignedInBadge';
import NavBar from '../components/NavBar';
import { signOut } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';

const PlaylistCreateCustom = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const { addManualPlaylist, manualPlaylists } = useManualPlaylists(user);
    const currentCount = manualPlaylists.length;
    const [playlistName, setPlaylistName] = useState('');
    const [trackLines, setTrackLines] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isResolvingTracks, setIsResolvingTracks] = useState(false);
    const [resolvedSpotifyTracks, setResolvedSpotifyTracks] = useState<ManualTrack[]>([]);
    const [resolvedSpotifyTrackIdsKey, setResolvedSpotifyTrackIdsKey] = useState('');
    const [resolverErrors, setResolverErrors] = useState<string[]>([]);

    const parsedImport = useMemo(() => parseTrackImportInput(trackLines), [trackLines]);
    const spotifyTrackIdsKey = parsedImport.spotifyTrackIds.join(',');
    const resolvedTracksAreCurrent = spotifyTrackIdsKey === resolvedSpotifyTrackIdsKey;
    const resolvedCurrentSpotifyTracks = resolvedTracksAreCurrent ? resolvedSpotifyTracks : [];
    const tracksToSave = [...parsedImport.manualTracks, ...resolvedCurrentSpotifyTracks];

    React.useEffect(() => {
        if (!isLoadingUser && !user) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user]);

    const handleTrackLinesChange = (value: string) => {
        setTrackLines(value);
        setFormError('');
        setResolverErrors([]);
    };

    const handleResolveTracks = async () => {
        setFormError('');
        setResolverErrors([]);

        if (parsedImport.errors.length > 0) {
            setFormError('Fix the track list errors before resolving.');
            return;
        }

        if (parsedImport.spotifyTrackIds.length === 0) {
            setFormError('Paste at least one Spotify track URL to resolve.');
            return;
        }

        if (parsedImport.spotifyTrackIds.length > 200) {
            setFormError('A single import can resolve up to 200 Spotify track links.');
            return;
        }

        setIsResolvingTracks(true);
        try {
            const response = await resolveSpotifyTracks(parsedImport.spotifyTrackIds);
            setResolvedSpotifyTracks(response.tracks);
            setResolvedSpotifyTrackIdsKey(spotifyTrackIdsKey);
            setResolverErrors(response.errors || []);
        } catch (error: any) {
            setFormError(error.message || 'Could not resolve Spotify track links.');
        } finally {
            setIsResolvingTracks(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');

        if (currentCount >= 30) {
            setFormError('You have reached the limit of 30 playlists. Please delete an existing playlist to create more.');
            return;
        }

        if (!playlistName.trim()) {
            setFormError('Playlist name is required.');
            return;
        }

        if (parsedImport.errors.length > 0) {
            setFormError('Fix the track list errors before saving.');
            return;
        }

        if (parsedImport.spotifyTrackIds.length > 0 && !resolvedTracksAreCurrent) {
            setFormError('Resolve the Spotify track links before saving.');
            return;
        }

        if (tracksToSave.length < 2) {
            setFormError('Add at least 2 valid tracks.');
            return;
        }

        setIsSaving(true);
        try {
            await addManualPlaylist(playlistName, '', tracksToSave);
            navigate(isOnboarding ? '/home' : '/playlists');
        } catch (error: any) {
            setFormError(error.message || 'Could not save playlist.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        await signOut(auth);
        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            <SignedInBadge user={user} />
        </div>
    );

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to="/playlists">
                Manage Playlists
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    Sign Out
                </button>
            )}
        </div>
    );

    if (isLoadingUser) {
        return (
            <>
                <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
                <main className="page home-page">
                    <div className="loading-card">Checking account...</div>
                </main>
            </>
        );
    }

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">

                <section className="record-bin">
                    <div>
                        <span className="eyebrow">Custom tracks</span>
                        <h2 className="section-title">Build a Playlist</h2>
                        <p className="body-copy">
                            Enter a playlist name and paste Spotify track URLs or type Song - Artist lines. Great for building a custom mix from scratch.
                        </p>
                    </div>

                    <form className="playlist-form" onSubmit={handleSubmit}>
                        <label className="form-label">
                            Playlist name
                            <input
                                className="text-input"
                                value={playlistName}
                                onChange={(event) => setPlaylistName(event.target.value)}
                                placeholder="Road Trip Mix"
                                required
                                maxLength={100}
                            />
                        </label>
                        <label className="form-label">
                            Tracks
                            <textarea
                                className="text-area"
                                value={trackLines}
                                onChange={(event) => handleTrackLinesChange(event.target.value)}
                                placeholder={"https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk\nspotify:track:4PTG3Z6ehGkBFwjybzWkR8\nSong Two - Artist Two"}
                                rows={9}
                                required
                            />
                        </label>
                        <div className="import-summary">
                            <div className="action-row">
                                <span className="snippet-meter">{tracksToSave.length} ready tracks</span>
                                {parsedImport.spotifyTrackIds.length > 0 && (
                                    <span className="snippet-meter">{parsedImport.spotifyTrackIds.length} Spotify links found</span>
                                )}
                                {parsedImport.duplicateCount > 0 && (
                                    <span className="snippet-meter">{parsedImport.duplicateCount} duplicate links ignored</span>
                                )}
                            </div>
                            {parsedImport.spotifyTrackIds.length > 0 && (
                                <button
                                    className="button button-tertiary"
                                    type="button"
                                    onClick={handleResolveTracks}
                                    disabled={isResolvingTracks || parsedImport.errors.length > 0}
                                >
                                    {isResolvingTracks ? 'Resolving...' : 'Resolve Tracks'}
                                </button>
                            )}
                            {parsedImport.errors.length > 0 && (
                                <ul className="error-list compact-list">
                                    {parsedImport.errors.map(error => <li key={error}>{error}</li>)}
                                </ul>
                            )}
                            {resolverErrors.length > 0 && (
                                <ul className="error-list compact-list">
                                    {resolverErrors.map(error => <li key={error}>{error}</li>)}
                                </ul>
                            )}
                            {tracksToSave.length > 0 && (
                                <ul className="resolved-track-list">
                                    {tracksToSave.slice(0, 12).map(track => (
                                        <li key={track.id}>
                                            <span>{track.name}</span>
                                            <span>{track.artists.map(artist => artist.name).join(', ')}</span>
                                        </li>
                                    ))}
                                    {tracksToSave.length > 12 && <li>+ {tracksToSave.length - 12} more tracks</li>}
                                </ul>
                            )}
                        </div>
                        {currentCount >= 30 && (
                            <div className="error-banner" style={{ marginBottom: '16px' }}>
                                <strong>Library Full:</strong> You have reached your limit of 30 playlists. Please delete some existing playlists from your Library to create a custom mix.
                            </div>
                        )}
                        {formError && <div className="error-banner">{formError}</div>}
                        <button className="button button-large" type="submit" disabled={isSaving || currentCount >= 30}>
                            {isSaving ? 'Saving...' : 'Save Playlist'}
                        </button>
                    </form>
                </section>
            </main>
        </>
    );
};

export default PlaylistCreateCustom;
