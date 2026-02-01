/**
 * ActiveGame.tsx
 * Handles the active game state, including song snippets and user input.
 * @version 2026.01.31
 */
import React from 'react';
import { Typography, Box } from "@mui/material";

interface ActiveGameProps {
    targetSong: any;
    snippetDuration: number;
    userGuess: string;
    setUserGuess: (guess: string) => void;
    onGuessSubmit: () => void;
    onPlaySnippet: () => void;
    onGiveUp: () => void;
    feedbackMessage: string;
    isPlaying: boolean;
    selectedPlaylistName: string;
}

const ActiveGame: React.FC<ActiveGameProps> = ({
    targetSong,
    snippetDuration,
    userGuess,
    setUserGuess,
    onGuessSubmit,
    onPlaySnippet,
    onGiveUp,
    feedbackMessage,
    isPlaying,
    selectedPlaylistName
}) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {selectedPlaylistName && (
                <Typography variant="h6" color="textSecondary">
                    Playing: {selectedPlaylistName}
                </Typography>
            )}
            <Typography variant="h5">Guess the Song!</Typography>
            <Typography>Snippet Length: {snippetDuration / 1000} seconds</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button onClick={onPlaySnippet} style={{ padding: '10px 20px', fontSize: '1.2rem' }}>Play Snippet</button>
                {isPlaying && <Typography variant="body1" color="primary" sx={{ animation: 'pulse 1s infinite' }}>🎵 Playing...</Typography>}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <input
                    type="text"
                    value={userGuess}
                    onChange={(e) => setUserGuess(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onGuessSubmit();
                        }
                    }}
                    placeholder="Enter song title..."
                    style={{ padding: '5px' }}
                />
                <button onClick={onGuessSubmit} style={{ padding: '5px 10px' }}>Guess</button>
            </Box>

            {feedbackMessage && <Typography color="error">{feedbackMessage}</Typography>}

            <button onClick={onGiveUp} style={{ marginTop: '20px' }}>Give Up</button>
        </Box>
    );
};

export default ActiveGame;
