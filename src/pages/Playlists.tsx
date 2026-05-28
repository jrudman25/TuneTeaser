import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import SignedInBadge from '../components/SignedInBadge';

const MANUAL_PLAYLISTS_PER_PAGE = 8;

const Playlists = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const isGuest = searchParams.get('mode') === 'guest';
    const [playlistPage, setPlaylistPage] = React.useState(0);
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const {
        manualPlaylists,
        isLoadingManualPlaylists,
        manualPlaylistError,
        deleteManualPlaylist
    } = useManualPlaylists(user, isGuest);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<'default' | 'name' | 'tracks'>('default');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc'); // Default to newest for added date
    const [authError, setAuthError] = React.useState('');

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
                const aCount = a.importedCount !== undefined ? a.importedCount : (a.tracks?.length || 0);
                const bCount = b.importedCount !== undefined ? b.importedCount : (b.tracks?.length || 0);
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
    const clampedPage = playlistPageCount > 0 ? Math.min(playlistPage, playlistPageCount - 1) : 0;
    const paginatedManualPlaylists = filteredAndSortedPlaylists.slice(
        clampedPage * MANUAL_PLAYLISTS_PER_PAGE,
        (clampedPage + 1) * MANUAL_PLAYLISTS_PER_PAGE
    );

    React.useEffect(() => {
        if (!isLoadingUser && !user && !isGuest) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user, isGuest]);

    React.useEffect(() => {
        if (isGuest && !isLoadingUser && !user) {
            signInAnonymously(auth).catch(err => {
                console.error("Failed to sign in guest anonymously in Playlists:", err);
                setAuthError("Guest Mode authentication failed. Please ensure 'Anonymous sign-in' is enabled in your Firebase console.");
            });
        }
    }, [isGuest, isLoadingUser, user]);

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
                    <span className="status-badge">
                        {isGuest ? 'Guest playlists' : isOnboarding && !hasPlaylists ? 'Add your first playlist' : 'TuneTeaser playlists'}
                    </span>
                    <SignedInBadge user={isGuest ? null : user} />
                </div>
                {(hasPlaylists || isGuest || localStorage.getItem('skipPlaylistOnboarding') === 'true') && (
                    <Link className="button button-secondary" to={isGuest ? "/home?mode=guest" : "/home"}>
                        Back to Game
                    </Link>
                )}
            </section>

            {authError && (
                <div className="error-banner">
                    <strong>Authentication Error:</strong> {authError}
                </div>
            )}

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
                    <Link className="button button-large" to={isGuest ? "/playlists/import?mode=guest" : `/playlists/import${onboardingParam}`}>
                        Import Spotify Playlist
                    </Link>
                    {!isGuest && (
                        <Link className="button button-large button-secondary" to={`/playlists/custom${onboardingParam}`}>
                            Build Custom Playlist
                        </Link>
                    )}
                    {isOnboarding && (
                        <button
                            className="button button-large button-tertiary"
                            type="button"
                            onClick={() => {
                                localStorage.setItem('skipPlaylistOnboarding', 'true');
                                navigate('/home');
                            }}
                        >
                            Skip for Now (Use Premade Playlists)
                        </button>
                    )}
                </div>

                {hasPlaylists && (
                    <div className="filter-controls">
                        <input
                            type="text"
                            className="text-input"
                            placeholder="Search playlists..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setPlaylistPage(0);
                            }}
                        />
                        <select
                            className="text-input"
                            value={sortBy}
                            onChange={e => {
                                setSortBy(e.target.value as any);
                                setPlaylistPage(0);
                            }}
                        >
                            <option value="default">Date Added</option>
                            <option value="name">Name</option>
                            <option value="tracks">Track Count</option>
                        </select>
                        <button
                            className="button button-quiet"
                            onClick={() => {
                                setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                setPlaylistPage(0);
                            }}
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
                            {paginatedManualPlaylists.map(playlist => {
                                const isImporting = playlist.status === 'importing';
                                return (
                                    <li key={playlist.id}>
                                        <article className="playlist-card playlist-library-card" style={{ position: 'relative', overflow: 'hidden' }}>
                                            {isImporting && (
                                                <div className="playlist-card-importing-overlay">
                                                    <span>Importing</span>
                                                    <span style={{ fontSize: '0.85rem', fontFamily: 'var(--body)', fontWeight: 900, color: 'var(--cream)' }}>
                                                        {playlist.importedCount || 0} / {playlist.totalCount || 100} tracks
                                                    </span>
                                                </div>
                                            )}
                                            <span className="playlist-label">{getPlaylistSourceLabel(playlist.sourceUrl)}</span>
                                            <h3 className="playlist-name">{playlist.name}</h3>
                                            <p className="playlist-meta">{playlist.importedCount !== undefined ? playlist.importedCount : playlist.tracks.length} tracks</p>
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
                                                disabled={isImporting}
                                            >
                                                Delete
                                            </button>
                                        </article>
                                    </li>
                                );
                            })}
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
                                    disabled={clampedPage === 0}
                                    onClick={() => setPlaylistPage(clampedPage - 1)}
                                >
                                    Previous
                                </button>
                                <span className="snippet-meter">Page {clampedPage + 1} of {playlistPageCount}</span>
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    disabled={clampedPage + 1 >= playlistPageCount}
                                    onClick={() => setPlaylistPage(clampedPage + 1)}
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
