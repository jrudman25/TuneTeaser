/**
 * PlaylistMenu.tsx
 * Displays user playlists for selection.
 * @version 2026.05.24
 */
import React, { useState, useMemo } from 'react';

interface PlaylistMenuProps {
    playlists: any[];
    onSelectPlaylist: (id: string) => void;
    isLoading: boolean;
    isGuest?: boolean;
}

const PlaylistMenu: React.FC<PlaylistMenuProps> = ({ playlists, onSelectPlaylist, isLoading, isGuest = false }) => {
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 8;

    const formatPlaylistDate = (value: any) => {
        const date = value?.toDate ? value.toDate() : null;
        return date ? date.toLocaleDateString() : 'Just now';
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'name' | 'tracks'>('default');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const filteredAndSortedPlaylists = useMemo(() => {
        let result = playlists.map((p, index) => ({ ...p, originalIndex: index }));

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
    }, [playlists, searchQuery, sortBy, sortDir]);

    // Reset pagination when filter/sort changes
    React.useEffect(() => {
        setPlaylistPage(0);
    }, [searchQuery, sortBy, sortDir]);

    return (
        <section className="record-bin">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <span className="eyebrow">Record bin</span>
                    <h2 className="section-title">Choose your crate</h2>
                    <p className="body-copy">Pick the playlist you know best. We will pull one track and start the quiz stage.</p>
                </div>

                {!isLoading && playlists.length > 0 && (
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
            </div>
            {isLoading ? (
                <div className="loading-card">Loading playlists...</div>
            ) : (
                <>
                    <ul className="record-grid">
                        {playlistPage === 0 && !isGuest && !searchQuery && sortBy === 'default' && sortDir === 'asc' && (
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
                        {filteredAndSortedPlaylists.slice(playlistPage * PLAYLISTS_PER_PAGE, (playlistPage + 1) * PLAYLISTS_PER_PAGE).map((playlist: any) => (
                            <li key={playlist.id}>
                                <button
                                    className="playlist-card"
                                    onClick={() => onSelectPlaylist(playlist.id)}
                                    disabled={isLoading}
                                >
                                    <span className="playlist-label">Playlist</span>
                                    <span className="playlist-name">{playlist.name}</span>
                                    <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>
                                        {playlist.tracks?.total ?? playlist.tracks?.length ?? 0} tracks
                                    </span>
                                    {playlist.createdAt && (
                                        <span className="playlist-meta" style={{ fontSize: '0.85rem' }}>
                                            Added {formatPlaylistDate(playlist.createdAt)}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {filteredAndSortedPlaylists.length === 0 && searchQuery && (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
                            No playlists found matching "{searchQuery}"
                        </div>
                    )}
                    {filteredAndSortedPlaylists.length > PLAYLISTS_PER_PAGE && (
                        <div className="pagination-row">
                            <button
                                className="button button-quiet"
                                disabled={playlistPage === 0}
                                onClick={() => setPlaylistPage(p => p - 1)}
                            >
                                Previous
                            </button>
                            <span className="snippet-meter">Page {playlistPage + 1} of {Math.ceil(filteredAndSortedPlaylists.length / PLAYLISTS_PER_PAGE)}</span>
                            <button
                                className="button button-quiet"
                                disabled={(playlistPage + 1) * PLAYLISTS_PER_PAGE >= filteredAndSortedPlaylists.length}
                                onClick={() => setPlaylistPage(p => p + 1)}
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
