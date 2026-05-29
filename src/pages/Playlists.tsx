import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { signInAnonymously, signOut } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SignedInBadge from '../components/SignedInBadge';
import NavBar from '../components/NavBar';

const MANUAL_PLAYLISTS_PER_PAGE = 8;

const Playlists = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const isGuest = searchParams.get('mode') === 'guest';
    const [playlistPage, setPlaylistPage] = React.useState(0);
    const { user, isLoadingUser } = useTuneTeaserAuth();

    // Compute probable login state to prevent header buttons/badges flickering/disappearing during page loading states
    const isProbablyGuest = isGuest || (user && user.isAnonymous);
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
        if (!value) return 'Just now';
        let date: Date | null = null;
        if (typeof value.toDate === 'function') {
            date = value.toDate();
        } else if (typeof value.seconds === 'number') {
            date = new Date(value.seconds * 1000);
        } else if (value instanceof Date) {
            date = value;
        } else if (typeof value === 'number') {
            date = new Date(value);
        }
        return date ? date.toLocaleDateString() : 'Just now';
    };

    const getPlaylistSourceLabel = (sourceUrl: string) => {
        return sourceUrl ? 'Spotify import' : 'Custom mix';
    };

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        if (!isGuest || (isGuest && user?.isAnonymous)) {
            await signOut(auth);
        }

        navigate('/');
    };

    const statusBadge = (
        <div className="status-stack">
            {isProbablyGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : (
                <SignedInBadge user={user} />
            )}
        </div>
    );

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={isProbablyGuest ? "/playlists?mode=guest" : "/playlists"}>
                Manage Playlists
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    {isProbablyGuest ? 'Exit Guest Mode' : 'Logout'}
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
                {authError && (
                    <div className="error-banner">
                        <strong>Authentication Error:</strong> {authError}
                    </div>
                )}

                {manualPlaylistError && (
                    <div className="error-banner">
                        <strong>Error:</strong> {manualPlaylistError}
                    </div>
                )}

                <section className="record-bin">
                    <div>
                        <span className="eyebrow">{isGuest ? 'Guest playlists' : 'Your playlists'}</span>
                        <h2 className="section-title">Music Library</h2>

                        <div className="action-row" style={{ marginTop: '12px', marginBottom: '20px' }}>
                            <Link className="button button-large button-primary" to={isGuest ? "/playlists/import?mode=guest" : "/playlists/import"}>
                                Import Spotify Playlist
                            </Link>
                            {!isGuest && (
                                <Link className="button button-large button-secondary" to="/playlists/custom">
                                    Build Custom Playlist
                                </Link>
                            )}
                        </div>

                        {manualPlaylists.length > 0 && (
                            <div className="filter-controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="text-input"
                                    placeholder="Search playlists..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPlaylistPage(0);
                                    }}
                                />
                                <select
                                    className="text-input"
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(e.target.value as any);
                                        setPlaylistPage(0);
                                    }}
                                >
                                    <option value="default">Date Added</option>
                                    <option value="name">Name</option>
                                    <option value="tracks">Track Count</option>
                                </select>
                                <button
                                    type="button"
                                    className="button button-quiet"
                                    onClick={() => {
                                        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                        setPlaylistPage(0);
                                    }}
                                    aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                                    title={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                                >
                                    {sortDir === 'asc' ? 'Asc' : 'Desc'}
                                </button>
                            </div>
                        )}
                    </div>

                    {isLoadingManualPlaylists && !isOnboarding ? (
                        <div className="loading-card">Loading playlists...</div>
                    ) : filteredAndSortedPlaylists.length > 0 ? (
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
                                                            {(playlist.importedCount !== undefined ? playlist.importedCount : (playlist.tracks?.length || 0))} / {playlist.totalCount || 100} tracks
                                                        </span>
                                                    </div>
                                                )}
                                                <span className="playlist-label">{getPlaylistSourceLabel(playlist.sourceUrl)}</span>
                                                <h3 className="playlist-name">{playlist.name}</h3>
                                                <p className="playlist-meta">
                                                    {playlist.importedCount !== undefined ? playlist.importedCount : (playlist.tracks?.length || 0)} tracks
                                                </p>
                                                <p className="playlist-meta">Added {formatPlaylistDate(playlist.createdAt)}</p>
                                                {playlist.sourceUrl && (
                                                    <a className="text-link external-link" href={playlist.sourceUrl} target="_blank" rel="noreferrer">
                                                        Spotify source <OpenInNewIcon style={{ fontSize: '0.85em', verticalAlign: 'middle' }} />
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
        </>
    );
};

export default Playlists;
