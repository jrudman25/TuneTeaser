import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
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

    if (isLoadingUser) {
        return (
            <>
                <NavBar />
                <main className="page home-page">
                    <div className="loading-card">Checking account...</div>
                </main>
            </>
        );
    }

    const statusBadge = (
        <div className="status-stack">
            <span className="status-badge">
                {isGuest ? 'Guest playlists' : isOnboarding && !hasPlaylists ? 'Add your first playlist' : 'TuneTeaser playlists'}
            </span>
            <SignedInBadge user={isGuest ? null : user} />
        </div>
    );

    const actionButtons = (hasPlaylists || isGuest || localStorage.getItem('skipPlaylistOnboarding') === 'true') ? (
        <div className="action-row">
            <Link className="button button-secondary" to={isGuest ? "/home?mode=guest" : "/home"}>
                Back to Game
            </Link>
        </div>
    ) : undefined;

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
                        <span className="eyebrow">{isGuest ? 'Guest crates' : 'Your crates'}</span>
                        <div className="header-with-actions">
                            <h2 className="section-title">Music Library</h2>
                            <div className="library-actions">
                                <Link className="button button-primary" to={isGuest ? "/playlists/import?mode=guest" : "/playlists/import"}>
                                    Import Spotify Playlist
                                </Link>
                                {!isGuest && (
                                    <Link className="button button-secondary" to="/playlists/custom">
                                        Build Custom Playlist
                                    </Link>
                                )}
                            </div>
                        </div>

                        {manualPlaylists.length > 0 && (
                            <div className="filter-row">
                                <input
                                    type="text"
                                    placeholder="Search playlists..."
                                    className="text-input search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <div className="sort-controls">
                                    <select
                                        className="text-input sort-select"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                    >
                                        <option value="default">Sort by Date Added</option>
                                        <option value="name">Sort by Name</option>
                                        <option value="tracks">Sort by Track Count</option>
                                    </select>
                                    <button
                                        type="button"
                                        className="button button-quiet"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                                    >
                                        {sortDir === 'asc' ? '↑' : '↓'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isLoadingManualPlaylists ? (
                        <div className="loading-card">Loading playlists...</div>
                    ) : filteredAndSortedPlaylists.length > 0 ? (
                        <>
                            <div className="record-grid">
                                {paginatedManualPlaylists.map((playlist: any) => (
                                    <div key={playlist.id} className="record-card-container">
                                        {playlist.importStatus === 'importing' && (
                                            <div className="playlist-card-importing-overlay">
                                                <div className="spinner" />
                                                <div className="overlay-text">Importing Tracks...</div>
                                                <div className="overlay-progress">{playlist.tracks?.length || 0} tracks loaded</div>
                                            </div>
                                        )}
                                        <div className="record-card">
                                            <div className="record-sleeve">
                                                <div className="record-vinyl" />
                                                <div className="record-center">
                                                    <span className="record-label-text">
                                                        {playlist.tracks?.length || 0} tracks
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="record-info">
                                                <h3 className="record-title">{playlist.name}</h3>
                                                <p className="record-artist">
                                                    {playlist.importStatus === 'importing' ? (
                                                        <span className="importing-status-label">Importing...</span>
                                                    ) : (
                                                        <>Added {playlist.formattedCreatedAt || 'Just now'}</>
                                                    )}
                                                </p>
                                                <div className="record-actions">
                                                    <button
                                                        type="button"
                                                        className="button button-quiet button-danger"
                                                        onClick={() => deleteManualPlaylist(playlist.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

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
