import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ManualTrack, parseTrackImportInput } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { resolveSpotifyTracks } from '../utils/spotifyTrackResolver';
import { fetchSpotifyPlaylistName, extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';
import { importSpotifyPlaylist } from '../utils/spotifyPlaylistImporter';

const Playlists = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const {
        manualPlaylists,
        isLoadingManualPlaylists,
        manualPlaylistError,
        addManualPlaylist,
        deleteManualPlaylist
    } = useManualPlaylists(user);

    const [isAdding, setIsAdding] = useState(isOnboarding);
    const [playlistName, setPlaylistName] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const nameWasAutoFilled = useRef(false);
    const [trackLines, setTrackLines] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isResolvingTracks, setIsResolvingTracks] = useState(false);
    const [resolvedSpotifyTracks, setResolvedSpotifyTracks] = useState<ManualTrack[]>([]);
    const [resolvedSpotifyTrackIdsKey, setResolvedSpotifyTrackIdsKey] = useState('');
    const [resolverErrors, setResolverErrors] = useState<string[]>([]);
    const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);
    const [importedPlaylistTracks, setImportedPlaylistTracks] = useState<ManualTrack[]>([]);
    const [importedForUrl, setImportedForUrl] = useState('');

    const parsedImport = useMemo(() => parseTrackImportInput(trackLines), [trackLines]);
    const spotifyTrackIdsKey = parsedImport.spotifyTrackIds.join(',');
    const resolvedTracksAreCurrent = spotifyTrackIdsKey === resolvedSpotifyTrackIdsKey;
    const resolvedCurrentSpotifyTracks = resolvedTracksAreCurrent ? resolvedSpotifyTracks : [];
    const playlistImportIsCurrent = importedForUrl === sourceUrl.trim();
    const currentImportedTracks = playlistImportIsCurrent ? importedPlaylistTracks : [];
    const tracksToSave = [...currentImportedTracks, ...parsedImport.manualTracks, ...resolvedCurrentSpotifyTracks];
    const sourcePlaylistId = extractSpotifyPlaylistId(sourceUrl);
    const hasPlaylists = manualPlaylists.length > 0;

    React.useEffect(() => {
        if (!isLoadingUser && !user) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user]);

    const resetForm = () => {
        setPlaylistName('');
        setSourceUrl('');
        setTrackLines('');
        setFormError('');
        setResolverErrors([]);
        setResolvedSpotifyTracks([]);
        setResolvedSpotifyTrackIdsKey('');
        setImportedPlaylistTracks([]);
        setImportedForUrl('');
        nameWasAutoFilled.current = false;
    };

    // Auto-populate playlist name from Spotify playlist URL
    useEffect(() => {
        if (!sourceUrl.trim()) return;

        let cancelled = false;
        fetchSpotifyPlaylistName(sourceUrl).then(name => {
            if (cancelled || !name) return;

            // Only auto-fill if the name is empty or was previously auto-filled
            if (!playlistName.trim() || nameWasAutoFilled.current) {
                setPlaylistName(name);
                nameWasAutoFilled.current = true;
            }
        });

        return () => { cancelled = true; };
    }, [sourceUrl]); // intentionally omit playlistName to avoid re-triggering on name edits

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

    const handleImportPlaylist = async () => {
        if (!sourcePlaylistId) {
            setFormError('Enter a valid Spotify playlist URL first.');
            return;
        }

        setFormError('');
        setResolverErrors([]);
        setIsImportingPlaylist(true);
        try {
            const result = await importSpotifyPlaylist(sourcePlaylistId);
            setImportedPlaylistTracks(result.tracks);
            setImportedForUrl(sourceUrl.trim());
            setResolverErrors(result.errors || []);

            // Auto-fill name if empty or was auto-filled
            if (result.name && (!playlistName.trim() || nameWasAutoFilled.current)) {
                setPlaylistName(result.name);
                nameWasAutoFilled.current = true;
            }
        } catch (error: any) {
            setFormError(error.message || 'Could not import playlist.');
        } finally {
            setIsImportingPlaylist(false);
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

        if (parsedImport.errors.length > 0) {
            setFormError('Fix the track list errors before saving.');
            return;
        }

        if (parsedImport.spotifyTrackIds.length > 0 && !resolvedTracksAreCurrent) {
            setFormError('Resolve the Spotify track links before saving.');
            return;
        }

        if (sourcePlaylistId && !playlistImportIsCurrent && currentImportedTracks.length === 0 && tracksToSave.length < 2) {
            setFormError('Import tracks from the playlist or add them manually.');
            return;
        }

        if (tracksToSave.length < 2) {
            setFormError('Add at least 2 valid tracks.');
            return;
        }

        setIsSaving(true);
        try {
            await addManualPlaylist(playlistName, sourceUrl, tracksToSave);
            resetForm();
            setIsAdding(false);
        } catch (error: any) {
            setFormError(error.message || 'Could not save playlist.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (playlistId: string, name: string) => {
        const confirmed = window.confirm(`Delete "${name}" from TuneTeaser?`);
        if (!confirmed) return;

        await deleteManualPlaylist(playlistId);
    };

    const formatPlaylistDate = (value: any) => {
        const date = value?.toDate ? value.toDate() : null;
        return date ? date.toLocaleDateString() : 'Just now';
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
                <span className="status-badge">{isOnboarding && !hasPlaylists ? 'Add your first playlist' : 'TuneTeaser playlists'}</span>
                {hasPlaylists && (
                    <Link className="button button-secondary" to="/home">
                        Back to Game
                    </Link>
                )}
            </section>

            {manualPlaylistError && <div className="error-banner">{manualPlaylistError}</div>}

            <section className="record-bin">
                <div>
                    <span className="eyebrow">Your library</span>
                    <h2 className="section-title">Manual playlists</h2>
                    <p className="body-copy">
                        Save a Spotify playlist link as the source, then paste Spotify track links or Song - Artist lines so TuneTeaser can build games from your saved snapshot.
                    </p>
                </div>

                {!isAdding && (
                    <button className="button button-large" onClick={() => setIsAdding(true)}>
                        Add Playlist
                    </button>
                )}

                {isAdding && (
                    <form className="playlist-form" onSubmit={handleSubmit}>
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
                                    onClick={handleImportPlaylist}
                                    disabled={isImportingPlaylist}
                                >
                                    {isImportingPlaylist ? 'Importing...' : 'Import Tracks from Playlist'}
                                </button>
                                {playlistImportIsCurrent && currentImportedTracks.length > 0 && (
                                    <span className="snippet-meter">{currentImportedTracks.length} tracks imported</span>
                                )}
                            </div>
                        )}
                        <label className="form-label">
                            Additional tracks (optional)
                            <textarea
                                className="text-area"
                                value={trackLines}
                                onChange={(event) => handleTrackLinesChange(event.target.value)}
                                placeholder={"https://open.spotify.com/track/76GlO5H5RT6g7y0gev86Nk\nspotify:track:4PTG3Z6ehGkBFwjybzWkR8\nSong Two - Artist Two"}
                                rows={6}
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
                        {formError && <div className="error-banner">{formError}</div>}
                        <div className="action-row">
                            <button className="button button-large" type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Playlist'}
                            </button>
                            {hasPlaylists && (
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    onClick={() => {
                                        resetForm();
                                        setIsAdding(false);
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}

                {isLoadingManualPlaylists ? (
                    <div className="loading-card">Loading playlists...</div>
                ) : hasPlaylists ? (
                    <ul className="record-grid">
                        {manualPlaylists.map(playlist => (
                            <li key={playlist.id}>
                                <article className="playlist-card playlist-library-card">
                                    <span className="playlist-label">Manual</span>
                                    <h3 className="playlist-name">{playlist.name}</h3>
                                    <p className="playlist-meta">{playlist.tracks.length} tracks</p>
                                    <p className="playlist-meta">Added {formatPlaylistDate(playlist.createdAt)}</p>
                                    <a className="text-link" href={playlist.sourceUrl} target="_blank" rel="noreferrer">
                                        Spotify source
                                    </a>
                                    <button
                                        className="button button-danger"
                                        type="button"
                                        onClick={() => handleDelete(playlist.id, playlist.name)}
                                    >
                                        Delete
                                    </button>
                                </article>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="loading-card">Add a playlist to unlock your TuneTeaser library.</div>
                )}
            </section>
        </main>
    );
};

export default Playlists;
