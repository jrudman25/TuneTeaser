import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { parsePlaylistLines } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';

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
    const [trackLines, setTrackLines] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const parsedLines = useMemo(() => parsePlaylistLines(trackLines), [trackLines]);
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

        if (parsedLines.errors.length > 0) {
            setFormError('Fix the track list errors before saving.');
            return;
        }

        if (parsedLines.tracks.length < 2) {
            setFormError('Add at least 2 valid tracks.');
            return;
        }

        setIsSaving(true);
        try {
            await addManualPlaylist(playlistName, sourceUrl, parsedLines.tracks);
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
                        Save a Spotify playlist link as the source, then paste tracks as Song - Artist so TuneTeaser can build games from your saved snapshot.
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
                                onChange={(event) => setPlaylistName(event.target.value)}
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
                        <label className="form-label">
                            Tracks
                            <textarea
                                className="text-area"
                                value={trackLines}
                                onChange={(event) => setTrackLines(event.target.value)}
                                placeholder={"Song One - Artist One\nSong Two - Artist Two"}
                                rows={9}
                                required
                            />
                        </label>
                        <div className="import-summary">
                            <span className="snippet-meter">{parsedLines.tracks.length} valid tracks</span>
                            {parsedLines.errors.length > 0 && (
                                <ul className="error-list compact-list">
                                    {parsedLines.errors.map(error => <li key={error}>{error}</li>)}
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
