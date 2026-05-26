import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import SignedInBadge from '../components/SignedInBadge';

const MANUAL_PLAYLISTS_PER_PAGE = 8;

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

    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<'default' | 'name' | 'tracks'>('default');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc'); // Default to newest for added date

    const filteredAndSortedPlaylists = React.useMemo(() => {
        let result = manualPlaylists.map((p, index) => ({ ...p, originalIndex: index }));

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name?.toLowerCase().includes(lowerQuery));
        }

        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'name') {
                cmp = (a.name || '').localeCompare(b.name || '');
            } else if (sortBy === 'tracks') {
                const aCount = a.tracks?.length || 0;
                const bCount = b.tracks?.length || 0;
                cmp = aCount - bCount;
            } else {
                // For 'default' (add date), rely on the original index (or createdAt if available)
                // Assuming original index represents order fetched, typically chronological or reverse
                const aTime = a.createdAt?.seconds || a.originalIndex;
                const bTime = b.createdAt?.seconds || b.originalIndex;
                cmp = aTime - bTime;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [manualPlaylists, searchQuery, sortBy, sortDir]);

    const hasPlaylists = manualPlaylists.length > 0;
    const playlistPageCount = Math.ceil(filteredAndSortedPlaylists.length / MANUAL_PLAYLISTS_PER_PAGE);
    const paginatedManualPlaylists = filteredAndSortedPlaylists.slice(
        playlistPage * MANUAL_PLAYLISTS_PER_PAGE,
        (playlistPage + 1) * MANUAL_PLAYLISTS_PER_PAGE
    );

    // Reset pagination when filter/sort changes
    React.useEffect(() => {
        setPlaylistPage(0);
    }, [searchQuery, sortBy, sortDir]);

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

    const getPlaylistSourceLabel = (sourceUrl: string) => {
        return sourceUrl ? 'Spotify import' : 'Custom mix';
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
                <div className="status-stack">
                    <span className="status-badge">{isOnboarding && !hasPlaylists ? 'Add your first playlist' : 'TuneTeaser playlists'}</span>
                    <SignedInBadge user={user} />
                </div>
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

                {hasPlaylists && (
                    <div className="filter-controls">
                        <input
                            type="text"
                            className="text-input"
                            placeholder="Search playlists..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <select
                            className="text-input"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                        >
                            <option value="default">Date Added</option>
                            <option value="name">Name</option>
                            <option value="tracks">Track Count</option>
                        </select>
                        <button
                            className="button button-quiet"
                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                            title="Toggle Sort Direction"
                            type="button"
                        >
                            {sortDir === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>
                )}

                {isLoadingManualPlaylists ? (
                    <div className="loading-card">Loading playlists...</div>
                ) : hasPlaylists ? (
                    <>
                        <ul className="record-grid">
                            {paginatedManualPlaylists.map(playlist => (
                                <li key={playlist.id}>
                                    <article className="playlist-card playlist-library-card">
                                        <span className="playlist-label">{getPlaylistSourceLabel(playlist.sourceUrl)}</span>
                                        <h3 className="playlist-name">{playlist.name}</h3>
                                        <p className="playlist-meta">{playlist.tracks.length} tracks</p>
                                        <p className="playlist-meta">Added {formatPlaylistDate(playlist.createdAt)}</p>
                                        {playlist.sourceUrl && (
                                            <a className="text-link" href={playlist.sourceUrl} target="_blank" rel="noreferrer">
                                                Spotify source
                                            </a>
                                        )}
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
                        {filteredAndSortedPlaylists.length === 0 && searchQuery && (
                            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
                                No playlists found matching "{searchQuery}"
                            </div>
                        )}
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
