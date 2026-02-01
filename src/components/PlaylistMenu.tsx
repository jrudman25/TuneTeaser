/**
 * PlaylistMenu.tsx
 * Displays user playlists for selection.
 * @version 2026.01.31
 */
import React, { useState } from 'react';
import { Typography, Box } from "@mui/material";

interface PlaylistMenuProps {
    playlists: any[];
    onSelectPlaylist: (id: string) => void;
    isLoading: boolean;
}

const PlaylistMenu: React.FC<PlaylistMenuProps> = ({ playlists, onSelectPlaylist, isLoading }) => {
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 10;

    return (
        <>
            <Typography variant="h4">Select a Playlist to Start Game</Typography>
            {isLoading ? (
                <Typography color="textSecondary">Loading playlists...</Typography>
            ) : (
                <>
                    <ul>
                        {playlistPage === 0 && (
                            <li
                                onClick={() => onSelectPlaylist('LIKED_SONGS')}
                                style={{
                                    cursor: isLoading ? 'default' : 'pointer',
                                    textDecoration: 'underline',
                                    color: isLoading ? 'gray' : 'blue',
                                    fontWeight: 'bold',
                                    marginBottom: '10px'
                                }}
                            >
                                Liked Songs
                            </li>
                        )}
                        {playlists.slice(playlistPage * PLAYLISTS_PER_PAGE, (playlistPage + 1) * PLAYLISTS_PER_PAGE).map((playlist: any) => (
                            <li
                                key={playlist.id}
                                onClick={() => onSelectPlaylist(playlist.id)}
                                style={{
                                    cursor: isLoading ? 'default' : 'pointer',
                                    textDecoration: 'underline',
                                    color: isLoading ? 'gray' : 'blue',
                                    pointerEvents: isLoading ? 'none' : 'auto'
                                }}
                            >
                                {playlist.name}
                            </li>
                        ))}
                    </ul>
                    {playlists.length > PLAYLISTS_PER_PAGE && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 1 }}>
                            <button
                                disabled={playlistPage === 0}
                                onClick={() => setPlaylistPage(p => p - 1)}
                                style={{ padding: '5px 10px', cursor: playlistPage === 0 ? 'default' : 'pointer', opacity: playlistPage === 0 ? 0.5 : 1 }}
                            >
                                Previous
                            </button>
                            <Typography>Page {playlistPage + 1} of {Math.ceil(playlists.length / PLAYLISTS_PER_PAGE)}</Typography>
                            <button
                                disabled={(playlistPage + 1) * PLAYLISTS_PER_PAGE >= playlists.length}
                                onClick={() => setPlaylistPage(p => p + 1)}
                                style={{ padding: '5px 10px', cursor: (playlistPage + 1) * PLAYLISTS_PER_PAGE >= playlists.length ? 'default' : 'pointer', opacity: (playlistPage + 1) * PLAYLISTS_PER_PAGE >= playlists.length ? 0.5 : 1 }}
                            >
                                Next
                            </button>
                        </Box>
                    )}
                </>
            )}
        </>
    );
};

export default PlaylistMenu;
