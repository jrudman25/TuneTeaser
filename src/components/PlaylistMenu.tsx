/**
 * PlaylistMenu.tsx
 * Displays user playlists for selection.
 * @version 2026.06.05
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import FilterChipRow from './FilterChipRow';

type PlaylistSource = 'mine' | 'premade';

interface PlaylistMenuProps {
    playlists: any[];
    onSelectPlaylist: (id: string) => void;
    isLoading: boolean;
    isGuest?: boolean;
    feedbackMessage?: string;
}

const isPremadePlaylist = (playlist: { id: string }) => {
    return playlist.id.startsWith('guest_') && !playlist.id.startsWith('guest_manual_');
};

// Most-tagged first, then alphabetical.
const getTagOptions = (playlists: Array<{ genres?: string[]; decades?: string[] }>, key: 'genres' | 'decades') => {
    const counts = new Map<string, number>();
    playlists.forEach(playlist => {
        const tags = Array.isArray(playlist[key]) ? playlist[key] : [];
        tags.forEach((tag: string) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag]) => tag);
};

const getStoredSource = (): PlaylistSource | null => {
    const stored = localStorage.getItem('playlistMenuSource');
    return stored === 'mine' || stored === 'premade' ? stored : null;
};

const PlaylistMenu: React.FC<PlaylistMenuProps> = ({ playlists, onSelectPlaylist, isLoading, isGuest = false, feedbackMessage = '' }) => {
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 8;

    const [chosenSource, setChosenSource] = useState<PlaylistSource | null>(getStoredSource);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'name' | 'tracks'>('default');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [selectedDecade, setSelectedDecade] = useState<string | null>(null);

    const ownPlaylists = useMemo(() => playlists.filter(playlist => !isPremadePlaylist(playlist)), [playlists]);
    const premadePlaylists = useMemo(() => playlists.filter(isPremadePlaylist), [playlists]);
    const source: PlaylistSource = chosenSource ?? (ownPlaylists.length > 0 ? 'mine' : 'premade');
    const sourcePlaylists = source === 'premade' ? premadePlaylists : ownPlaylists;

    const genreOptions = useMemo(() => getTagOptions(premadePlaylists, 'genres'), [premadePlaylists]);
    const decadeOptions = useMemo(() => getTagOptions(premadePlaylists, 'decades'), [premadePlaylists]);

    const handleSelectSource = (next: PlaylistSource) => {
        setChosenSource(next);
        localStorage.setItem('playlistMenuSource', next);
        setPlaylistPage(0);
        setSearchQuery('');
        setSelectedGenre(null);
        setSelectedDecade(null);
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

    const filteredAndSortedPlaylists = useMemo(() => {
        let result = sourcePlaylists.map((p, index) => ({ ...p, originalIndex: index }));

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p => p.name?.toLowerCase().includes(lowerQuery));
        }

        if (source === 'premade') {
            if (selectedGenre) {
                result = result.filter(p => Array.isArray(p.genres) && p.genres.includes(selectedGenre));
            }
            if (selectedDecade) {
                result = result.filter(p => Array.isArray(p.decades) && p.decades.includes(selectedDecade));
            }
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
    }, [sourcePlaylists, source, searchQuery, sortBy, sortDir, selectedGenre, selectedDecade]);

    const playlistPageCount = Math.ceil(filteredAndSortedPlaylists.length / PLAYLISTS_PER_PAGE);
    const clampedPage = playlistPageCount > 0 ? Math.min(playlistPage, playlistPageCount - 1) : 0;

    const currentPagePlaylists = filteredAndSortedPlaylists.slice(clampedPage * PLAYLISTS_PER_PAGE, (clampedPage + 1) * PLAYLISTS_PER_PAGE);
    const hasLikedSongs = clampedPage === 0 && source === 'mine' && !isGuest && !searchQuery && sortBy === 'default' && sortDir === 'asc';
    const visibleItemsCount = currentPagePlaylists.length + (hasLikedSongs ? 1 : 0);
    const placeholdersNeeded = visibleItemsCount > 0 ? Math.max(0, PLAYLISTS_PER_PAGE - visibleItemsCount) : 0;
    const placeholders = Array.from({ length: placeholdersNeeded });
    const hasActiveFilters = Boolean(searchQuery.trim()) || selectedGenre !== null || selectedDecade !== null;

    return (
        <section className="record-bin">
            <div className="record-bin-header">
                <span className="eyebrow">Record bin</span>
                <h2 className="section-title">Choose your playlist</h2>
                <p className="body-copy">Pick the playlist you know best. We will pull one track and start the quiz stage.</p>
            </div>

            {!isLoading && playlists.length > 0 && (
                <>
                    <div className="playlist-source-tabs" role="tablist" aria-label="Playlist source">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={source === 'mine'}
                            className={`playlist-source-tab${source === 'mine' ? ' playlist-source-tab-selected' : ''}`}
                            onClick={() => handleSelectSource('mine')}
                        >
                            Your playlists
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={source === 'premade'}
                            className={`playlist-source-tab${source === 'premade' ? ' playlist-source-tab-selected' : ''}`}
                            onClick={() => handleSelectSource('premade')}
                        >
                            Premade
                        </button>
                    </div>

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
                            aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                            title={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
                            type="button"
                        >
                            {sortDir === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                    </div>

                    {source === 'premade' && genreOptions.length > 0 && (
                        <FilterChipRow
                            label="Genre"
                            options={genreOptions}
                            selected={selectedGenre}
                            onSelect={value => {
                                setSelectedGenre(value);
                                setPlaylistPage(0);
                            }}
                        />
                    )}
                    {source === 'premade' && decadeOptions.length > 0 && (
                        <FilterChipRow
                            label="Decade"
                            options={decadeOptions}
                            selected={selectedDecade}
                            onSelect={value => {
                                setSelectedDecade(value);
                                setPlaylistPage(0);
                            }}
                        />
                    )}
                </>
            )}
            {!isLoading && feedbackMessage && (
                <div className="error-banner" role="alert">{feedbackMessage}</div>
            )}
            {isLoading ? (
                <div className="loading-card">Loading playlists...</div>
            ) : (
                <>
                    <ul className="record-grid">
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
                                                <span className="playlist-card-importing-detail">
                                                    {hasImportError ? (playlist.importError || 'Import failed') : `${playlist.importedCount || 0} / ${playlist.totalCount || 100} tracks`}
                                                </span>
                                            </div>
                                        )}
                                        <span className="playlist-label">{playlist.sourceUrl && playlist.sourceUrl.includes('spotify.com') ? 'Spotify import' : isPremadePlaylist(playlist) ? 'Playlist' : 'Custom mix'}</span>
                                        <span className="playlist-name">{playlist.name}</span>
                                        {playlist.ownerName && <span className="playlist-meta playlist-meta-sm">by {playlist.ownerName}</span>}
                                        <span className="playlist-meta playlist-meta-sm">
                                            {playlist.tracks?.total ?? playlist.tracks?.length ?? 0} tracks
                                        </span>
                                        {isPremadePlaylist(playlist) ? (
                                            <span className="playlist-meta playlist-meta-sm">
                                                Premade
                                            </span>
                                        ) : (
                                            playlist.createdAt && (
                                                <span className="playlist-meta playlist-meta-sm">
                                                    Added {formatPlaylistDate(playlist.createdAt)}
                                                </span>
                                            )
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                        {placeholders.map((_, i) => (
                            <li key={`placeholder-${i}`} className="record-grid-placeholder" aria-hidden="true">
                                <article className="playlist-card">
                                    <span className="playlist-label">&nbsp;</span>
                                    <span className="playlist-name">&nbsp;</span>
                                    <span className="playlist-meta playlist-meta-sm">&nbsp;</span>
                                    <span className="playlist-meta playlist-meta-sm">&nbsp;</span>
                                </article>
                            </li>
                        ))}
                    </ul>
                    {visibleItemsCount === 0 && hasActiveFilters && (
                        <div className="playlist-menu-empty">
                            {searchQuery.trim()
                                ? `No playlists found matching "${searchQuery}"`
                                : 'No playlists found.'}
                        </div>
                    )}
                    {visibleItemsCount === 0 && !hasActiveFilters && source === 'mine' && (
                        <div className="playlist-menu-empty-card">
                            <p className="playlist-menu-empty-title">You don't have any playlists yet.</p>
                            <p className="playlist-menu-empty-copy">
                                Go to{' '}
                                <Link className="text-link" to={isGuest ? "/playlists?mode=guest" : "/playlists"}>
                                    Manage Playlists
                                </Link>{' '}
                                to add your own music, or browse our curated mixes.
                            </p>
                            <button className="button button-secondary" type="button" onClick={() => handleSelectSource('premade')}>
                                Browse premade playlists
                            </button>
                        </div>
                    )}
                    {visibleItemsCount === 0 && !hasActiveFilters && source === 'premade' && (
                        <div className="playlist-menu-empty">No playlists found.</div>
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
