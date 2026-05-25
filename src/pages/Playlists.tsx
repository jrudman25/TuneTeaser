import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';

const MANUAL_PLAYLISTS_PER_PAGE = 10;

const Playlists = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const [playlistPage, setPlaylistPage] = React.useState(0);
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const {
        manualPlaylists,
        isLoadingManualPlaylists,
        manualPlaylistError,
        deleteManualPlaylist
    } = useManualPlaylists(user);

    const hasPlaylists = manualPlaylists.length > 0;
    const playlistPageCount = Math.ceil(manualPlaylists.length / MANUAL_PLAYLISTS_PER_PAGE);
    const paginatedManualPlaylists = manualPlaylists.slice(
        playlistPage * MANUAL_PLAYLISTS_PER_PAGE,
        (playlistPage + 1) * MANUAL_PLAYLISTS_PER_PAGE
    );

    React.useEffect(() => {
        if (!isLoadingUser && !user) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user]);

    React.useEffect(() => {
        if (playlistPageCount > 0 && playlistPage >= playlistPageCount) {
            setPlaylistPage(playlistPageCount - 1);
        }
    }, [playlistPage, playlistPageCount]);

    const handleDelete = async (playlistId: string, name: string) => {
        const confirmed = window.confirm(`Delete "${name}" from TuneTeaser?`);
        if (!confirmed) return;

        await deleteManualPlaylist(playlistId);
    };

    const formatPlaylistDate = (value: any) => {
        const date = value?.toDate ? value.toDate() : null;
        return date ? date.toLocaleDateString() : 'Just now';
    };

    const onboardingParam = isOnboarding ? '?onboarding=1' : '';

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
                    <h2 className="section-title">Playlists</h2>
                    <p className="body-copy">
                        Import a Spotify playlist or build one from scratch so TuneTeaser can quiz you on your music.
                    </p>
                </div>

                <div className="action-row">
                    <Link className="button button-large" to={`/playlists/import${onboardingParam}`}>
                        Import Spotify Playlist
                    </Link>
                    <Link className="button button-large button-secondary" to={`/playlists/custom${onboardingParam}`}>
                        Build Custom Playlist
                    </Link>
                </div>

                {isLoadingManualPlaylists ? (
                    <div className="loading-card">Loading playlists...</div>
                ) : hasPlaylists ? (
                    <>
                        <ul className="record-grid">
                            {paginatedManualPlaylists.map(playlist => (
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
                        {playlistPageCount > 1 && (
                            <div className="pagination-row">
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    disabled={playlistPage === 0}
                                    onClick={() => setPlaylistPage(page => page - 1)}
                                >
                                    Previous
                                </button>
                                <span className="snippet-meter">Page {playlistPage + 1} of {playlistPageCount}</span>
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    disabled={playlistPage + 1 >= playlistPageCount}
                                    onClick={() => setPlaylistPage(page => page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="loading-card">Add a playlist to unlock your TuneTeaser library.</div>
                )}
            </section>
        </main>
    );
};

export default Playlists;
