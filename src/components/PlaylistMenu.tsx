/**
 * PlaylistMenu.tsx
 * Displays user playlists for selection.
 * @version 2026.05.24
 */
import React, { useState } from 'react';

interface PlaylistMenuProps {
    playlists: any[];
    onSelectPlaylist: (id: string) => void;
    isLoading: boolean;
    isGuest?: boolean;
}

const PlaylistMenu: React.FC<PlaylistMenuProps> = ({ playlists, onSelectPlaylist, isLoading, isGuest = false }) => {
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 8;

    return (
        <section className="record-bin">
            <div>
                <span className="eyebrow">Record bin</span>
                <h2 className="section-title">Choose your crate</h2>
                <p className="body-copy">Pick the playlist you know best. We will pull one track and start the quiz stage.</p>
            </div>
            {isLoading ? (
                <div className="loading-card">Loading playlists...</div>
            ) : (
                <>
                    <ul className="record-grid">
                        {playlistPage === 0 && !isGuest && (
                            <li>
                                <button
                                    className="playlist-card playlist-card-featured"
                                    onClick={() => onSelectPlaylist('LIKED_SONGS')}
                                    disabled={isLoading}
                                >
                                    <span className="playlist-label">Spotify shelf</span>
                                    <span className="playlist-name">Liked Songs</span>
                                </button>
                            </li>
                        )}
                        {playlists.slice(playlistPage * PLAYLISTS_PER_PAGE, (playlistPage + 1) * PLAYLISTS_PER_PAGE).map((playlist: any) => (
                            <li key={playlist.id}>
                                <button
                                    className="playlist-card"
                                    onClick={() => onSelectPlaylist(playlist.id)}
                                    disabled={isLoading}
                                >
                                    <span className="playlist-label">Playlist</span>
                                    <span className="playlist-name">{playlist.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {playlists.length > PLAYLISTS_PER_PAGE && (
                        <div className="pagination-row">
                            <button
                                className="button button-quiet"
                                disabled={playlistPage === 0}
                                onClick={() => setPlaylistPage(p => p - 1)}
                            >
                                Previous
                            </button>
                            <span className="snippet-meter">Page {playlistPage + 1} of {Math.ceil(playlists.length / PLAYLISTS_PER_PAGE)}</span>
                            <button
                                className="button button-quiet"
                                disabled={(playlistPage + 1) * PLAYLISTS_PER_PAGE >= playlists.length}
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
