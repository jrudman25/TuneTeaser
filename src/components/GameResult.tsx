/**
 * GameResult.tsx
 * Displays the result of the game (correct/incorrect) and options to play again.
 * @version 2026.02.10
 */
import React from 'react';
import { Typography, Box } from "@mui/material";

interface GameResultProps {
    targetSong: any;
    feedbackMessage: string;
    onPlayAgain: () => void;
    onSelectNewPlaylist: () => void;
    isLoading?: boolean;
}

const GameResult: React.FC<GameResultProps> = ({
    targetSong,
    feedbackMessage,
    onPlayAgain,
    onSelectNewPlaylist,
    isLoading = false
}) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" color="success.main">{feedbackMessage}</Typography>
            <Typography variant="h6">Song: {targetSong.name}</Typography>
            <Typography>Artist: {targetSong.artists.map((a: any) => a.name).join(', ')}</Typography>
            {targetSong.album.images?.[0] && (
                <img src={targetSong.album.images[0].url} alt="Album Art" style={{ width: 200, height: 200 }} />
            )}

            <Box sx={{ display: 'flex', gap: 2, marginTop: '20px', alignItems: 'center' }}>
                <button
                    onClick={onPlayAgain}
                    disabled={isLoading}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    Play Again (Same Playlist)
                </button>
                <button
                    onClick={onSelectNewPlaylist}
                    disabled={isLoading}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        opacity: isLoading ? 0.6 : 1
                    }}
                >
                    Select New Playlist
                </button>
            </Box>
            {isLoading && <Typography variant="body1">Loading next track...</Typography>}
        </Box>
    );
};

export default GameResult;
