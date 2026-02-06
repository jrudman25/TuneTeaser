/**
 * ActiveGame.tsx
 * Handles the active game state, including song snippets and user input.
 * @version 2026.02.05
 */
import React from 'react';
import { Typography, Box, Autocomplete, TextField, Slider, Stack } from "@mui/material";
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

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
    songs: any[];
    volume: number;
    setVolume: (volume: number) => void;
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
    selectedPlaylistName,
    songs,
    volume,
    setVolume
}) => {
    const songOptions = Array.from(new Set(songs.map((s: any) => s.track.name)));
    const [inputValue, setInputValue] = React.useState('');
    const [open, setOpen] = React.useState(false);
    const [highlighted, setHighlighted] = React.useState(false);

    const handleVolumeChange = (event: Event, newValue: number | number[]) => {
        setVolume(newValue as number / 100);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: '600px' }}>
            {selectedPlaylistName && (
                <Typography variant="h6" color="textSecondary">
                    Playing: {selectedPlaylistName}
                </Typography>
            )}
            <Typography variant="h5">Guess the Song!</Typography>

            <Box sx={{ width: 200, display: 'flex', alignItems: 'center', gap: 1 }}>
                <VolumeDown />
                <Slider aria-label="Volume" value={volume * 100} onChange={handleVolumeChange} />
                <VolumeUp />
            </Box>

            <Typography>Snippet Length: {snippetDuration / 1000} seconds</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button onClick={onPlaySnippet} style={{ padding: '10px 20px', fontSize: '1.2rem' }}>Play Snippet</button>
                {isPlaying && <Typography variant="body1" color="primary" sx={{ animation: 'pulse 1s infinite' }}>🎵 Playing...</Typography>}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'center' }}>
                <Autocomplete
                    freeSolo
                    open={open}
                    onOpen={() => {
                        if (inputValue.length > 0) {
                            setOpen(true);
                        }
                    }}
                    openOnFocus
                    onClose={() => setOpen(false)}
                    onHighlightChange={(event, option) => {
                        setHighlighted(!!option);
                    }}
                    options={songOptions}
                    filterOptions={(options, state) => {
                        if (state.inputValue.length === 0) return [];
                        return options.filter(option =>
                            option.toLowerCase().includes(state.inputValue.toLowerCase())
                        );
                    }}
                    value={userGuess}
                    inputValue={inputValue}
                    onInputChange={(_, newInputValue) => {
                        setInputValue(newInputValue);
                        setUserGuess(newInputValue);
                        if (newInputValue.length > 0) {
                            setOpen(true);
                        } else {
                            setOpen(false);
                        }
                    }}
                    onChange={(_, newValue) => {
                        setUserGuess(newValue || '');
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Enter song title..."
                            variant="outlined"
                            sx={{ width: '300px', backgroundColor: 'white' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (open && highlighted) {
                                        return;
                                    }
                                    onGuessSubmit();
                                }
                            }}
                        />
                    )}
                />
                <button onClick={onGuessSubmit} style={{ padding: '5px 10px', height: '56px' }}>Guess</button>
            </Box>

            {feedbackMessage && <Typography color="error">{feedbackMessage}</Typography>}

            <button onClick={onGiveUp} style={{ marginTop: '20px' }}>Give Up</button>
        </Box>
    );
};

export default ActiveGame;
