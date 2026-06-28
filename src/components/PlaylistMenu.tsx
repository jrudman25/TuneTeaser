/**
 * PlaylistMenu.tsx
 * Displays user playlists for selection.
 * @version 2026.05.24
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

interface PlaylistMenuProps {
    playlists: any[];
    onSelectPlaylist: (id: string) => void;
    isLoading: boolean;
    isGuest?: boolean;
}

const PlaylistMenu: React.FC<PlaylistMenuProps> = ({ playlists, onSelectPlaylist, isLoading, isGuest = false }) => {
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 8;

    const [showPremadePlaylists, setShowPremadePlaylists] = useState(() => {
        return localStorage.getItem('showPremadePlaylists') !== 'false';
    });

    const handleTogglePremade = (checked: boolean) => {
        setShowPremadePlaylists(checked);
        localStorage.setItem('showPremadePlaylists', String(checked));
        setPlaylistPage(0);
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

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'name' | 'tracks'>('default');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const filteredAndSortedPlaylists = useMemo(() => {
        let list = playlists;
        if (!showPremadePlaylists) {
            list = playlists.filter(p => !(p.id.startsWith('guest_') && !p.id.startsWith('guest_manual_')));
        }

        let result = list.map((p, index) => ({ ...p, originalIndex: index }));

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name?.toLowerCase().includes(lowerQuery));
        }

        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'name') {
                cmp = (a.name || '').localeCompare(b.name || '');
            } else if (sortBy === 'tracks') {
                const aCount = a.tracks?.total || 0;
                const bCount = b.tracks?.total || 0;
                cmp = aCount - bCount;
            } else {
                cmp = a.originalIndex - b.originalIndex;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [playlists, showPremadePlaylists, searchQuery, sortBy, sortDir]);

    const playlistPageCount = Math.ceil(filteredAndSortedPlaylists.length / PLAYLISTS_PER_PAGE);
    const clampedPage = playlistPageCount > 0 ? Math.min(playlistPage, playlistPageCount - 1) : 0;

    const currentPagePlaylists = filteredAndSortedPlaylists.slice(clampedPage * PLAYLISTS_PER_PAGE, (clampedPage + 1) * PLAYLISTS_PER_PAGE);
    const hasLikedSongs = clampedPage === 0 && !isGuest && !searchQuery && sortBy === 'default' && sortDir === 'asc';
    const visibleItemsCount = currentPagePlaylists.length + (hasLikedSongs ? 1 : 0);
    const placeholdersNeeded = visibleItemsCount > 0 ? Math.max(0, PLAYLISTS_PER_PAGE - visibleItemsCount) : 0;
    const placeholders = Array.from({ length: placeholdersNeeded });

    return (
        <section className="record-bin">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <span className="eyebrow">Record bin</span>
                    <h2 className="section-title">Choose your playlist</h2>
                    <p className="body-copy">Pick the playlist you know best. We will pull one track and start the quiz stage.</p>
                </div>

                {!isLoading && playlists.length > 0 && (
                    <div className="filter-controls" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.9 }}>
                            <input
                                type="checkbox"
                                checked={showPremadePlaylists}
                                onChange={e => handleTogglePremade(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            <span>Include Premades</span>
                        </label>
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
                            aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                            title={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                            type="button"
                        >
                            {sortDir === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                    </div>
                )}
            </div>
            {isLoading ? (
                <div className="loading-card">Loading playlists...</div>
            ) : (
                <>
                    <ul className="record-grid">
                        {clampedPage === 0 && !isGuest && !searchQuery && sortBy === 'default' && sortDir === 'asc' && (
                            <li>
                                <button
                                    className="playlist-card playlist-card-featured"
                                    onClick={() => onSelectPlaylist('LIKED_SONGS')}
                                    disabled={isLoading}
                                >
                                    <span className="playlist-label">Spotify shelf</span>
                                    <span className="playlist-name">Liked Songs</span>
                                    <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>Your library</span>
                                </button>
                            </li>
                        )}
                        {currentPagePlaylists.map((playlist: any) => {
                            const isImporting = playlist.status === 'importing';
                            const hasImportError = playlist.status === 'error';
                            return (
                                <li key={playlist.id}>
                                    <button
                                        className="playlist-card"
                                        onClick={() => {
                                            if (isImporting || hasImportError) return;
                                            onSelectPlaylist(playlist.id);
                                        }}
                                        disabled={isLoading || isImporting || hasImportError}
                                    >
                                        {(isImporting || hasImportError) && (
                                            <div className="playlist-card-importing-overlay">
                                                <span>{hasImportError ? 'Import Error' : 'Importing'}</span>
                                                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--body)', fontWeight: 900, color: 'var(--cream)' }}>
                                                    {hasImportError ? (playlist.importError || 'Import failed') : `${playlist.importedCount || 0} / ${playlist.totalCount || 100} tracks`}
                                                </span>
                                            </div>
                                        )}
                                        <span className="playlist-label">Playlist</span>
                                        <span className="playlist-name">{playlist.name}</span>
                                        <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>
                                            {playlist.tracks?.total ?? playlist.tracks?.length ?? 0} tracks
                                        </span>
                                        {playlist.id.startsWith('guest_') && !playlist.id.startsWith('guest_manual_') ? (
                                            <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>
                                                Premade
                                            </span>
                                        ) : (
                                            playlist.createdAt && (
                                                <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>
                                                    Added {formatPlaylistDate(playlist.createdAt)}
                                                </span>
                                            )
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                        {placeholders.map((_, i) => (
                            <li key={`placeholder-${i}`} style={{ visibility: 'hidden' }} aria-hidden="true">
                                <article className="playlist-card">
                                    <span className="playlist-label">&nbsp;</span>
                                    <span className="playlist-name">&nbsp;</span>
                                    <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>&nbsp;</span>
                                    <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>&nbsp;</span>
                                </article>
                            </li>
                        ))}
                    </ul>
                    {visibleItemsCount === 0 && searchQuery && (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
                            No playlists found matching "{searchQuery}"
                        </div>
                    )}
                    {visibleItemsCount === 0 && !searchQuery && !showPremadePlaylists && (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.8, border: '2px dashed var(--ink-soft)', borderRadius: '12px', marginTop: '1rem' }}>
                            <p style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>You don't have any playlists yet.</p>
                            <p style={{ lineHeight: 1.5 }}>
                                Check the <strong>"Include Premades"</strong> box above to play with our curated mixes, or go to{' '}
                                <Link to={isGuest ? "/playlists?mode=guest" : "/playlists"} style={{ fontWeight: 700, textDecoration: 'underline' }}>
                                    Manage Playlists
                                </Link>{' '}
                                to add your own music.
                            </p>
                        </div>
                    )}
                    {filteredAndSortedPlaylists.length > PLAYLISTS_PER_PAGE && (
                        <div className="pagination-row">
                            <button
                                className="button button-quiet"
                                disabled={clampedPage === 0}
                                onClick={() => setPlaylistPage(clampedPage - 1)}
                            >
                                Previous
                            </button>
                            <span className="snippet-meter">Page {clampedPage + 1} of {playlistPageCount}</span>
                            <button
                                className="button button-quiet"
                                disabled={(clampedPage + 1) * PLAYLISTS_PER_PAGE >= filteredAndSortedPlaylists.length}
                                onClick={() => setPlaylistPage(clampedPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default PlaylistMenu;
