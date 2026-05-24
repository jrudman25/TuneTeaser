import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ManualTrack } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';
import { importSpotifyPlaylist } from '../utils/spotifyPlaylistImporter';

const PlaylistImportSpotify = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const { addManualPlaylist } = useManualPlaylists(user);

    const [sourceUrl, setSourceUrl] = useState('');
    const [playlistName, setPlaylistName] = useState('');
    const nameWasAutoFilled = useRef(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importedTracks, setImportedTracks] = useState<ManualTrack[]>([]);
    const [importedForUrl, setImportedForUrl] = useState('');
    const [formError, setFormError] = useState('');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const sourcePlaylistId = extractSpotifyPlaylistId(sourceUrl);
    const importIsCurrent = importedForUrl === sourceUrl.trim();
    const currentTracks = importIsCurrent ? importedTracks : [];

    useEffect(() => {
        if (!isLoadingUser && !user) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user]);

    const handleImport = async () => {
        if (!sourcePlaylistId) {
            setFormError('Enter a valid Spotify playlist URL first.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setIsImporting(true);
        try {
            const result = await importSpotifyPlaylist(sourcePlaylistId);
            setImportedTracks(result.tracks);
            setImportedForUrl(sourceUrl.trim());
            setImportErrors(result.errors || []);

            if (result.name && (!playlistName.trim() || nameWasAutoFilled.current)) {
                setPlaylistName(result.name);
                nameWasAutoFilled.current = true;
            }
        } catch (error: any) {
            setFormError(error.message || 'Could not import playlist.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');

        if (!playlistName.trim()) {
            setFormError('Playlist name is required.');
            return;
        }

        if (!sourceUrl.trim()) {
            setFormError('Spotify playlist URL is required.');
            return;
        }

        if (currentTracks.length < 2) {
            setFormError('Import the playlist first (at least 2 tracks required).');
            return;
        }

        setIsSaving(true);
        try {
            await addManualPlaylist(playlistName, sourceUrl, currentTracks);
            navigate(isOnboarding ? '/home' : '/playlists');
        } catch (error: any) {
            setFormError(error.message || 'Could not save playlist.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingUser) {
        return (
            <main className="page home-page">
                <div className="loading-card">Checking account...</div>
            </main>
        );
    }

    return (
        <main className="page home-page">
            <section className="top-strip">
                <span className="status-badge">Import from Spotify</span>
                <Link className="button button-secondary" to="/playlists">
                    Back to Playlists
                </Link>
            </section>

            <section className="record-bin">
                <div>
                    <span className="eyebrow">Spotify playlist</span>
                    <h2 className="section-title">Import Playlist</h2>
                    <p className="body-copy">
                        Paste a public Spotify playlist URL and TuneTeaser will automatically import the name and all tracks.
                    </p>
                </div>

                <form className="playlist-form" onSubmit={handleSubmit}>
                    <label className="form-label">
                        Spotify playlist URL
                        <input
                            className="text-input"
                            value={sourceUrl}
                            onChange={(event) => setSourceUrl(event.target.value)}
                            placeholder="https://open.spotify.com/playlist/..."
                            required
                        />
                    </label>

                    {sourcePlaylistId && (
                        <div className="action-row">
                            <button
                                className="button button-tertiary"
                                type="button"
                                onClick={handleImport}
                                disabled={isImporting}
                            >
                                {isImporting ? 'Importing...' : 'Import Tracks from Playlist'}
                            </button>
                            {importIsCurrent && currentTracks.length > 0 && (
                                <span className="snippet-meter">{currentTracks.length} tracks imported</span>
                            )}
                        </div>
                    )}

                    {importIsCurrent && currentTracks.length > 0 && (
                        <label className="form-label">
                            Playlist name
                            <input
                                className="text-input"
                                value={playlistName}
                                onChange={(event) => {
                                    setPlaylistName(event.target.value);
                                    nameWasAutoFilled.current = false;
                                }}
                                placeholder="Road Trip Mix"
                                required
                            />
                        </label>
                    )}

                    {importErrors.length > 0 && (
                        <ul className="error-list compact-list">
                            {importErrors.map(error => <li key={error}>{error}</li>)}
                        </ul>
                    )}

                    {currentTracks.length > 0 && (
                        <ul className="resolved-track-list">
                            {currentTracks.slice(0, 12).map(track => (
                                <li key={track.id}>
                                    <span>{track.name}</span>
                                    <span>{track.artists.map(artist => artist.name).join(', ')}</span>
                                </li>
                            ))}
                            {currentTracks.length > 12 && <li>+ {currentTracks.length - 12} more tracks</li>}
                        </ul>
                    )}

                    {formError && <div className="error-banner">{formError}</div>}

                    {importIsCurrent && currentTracks.length >= 2 && (
                        <button className="button button-large" type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Playlist'}
                        </button>
                    )}
                </form>
            </section>
        </main>
    );
};

export default PlaylistImportSpotify;
