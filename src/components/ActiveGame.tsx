/**
 * ActiveGame.tsx
 * Handles the active game state, including song snippets and user input.
 * @version 2026.05.14
 */
import React from 'react';
import { Autocomplete, TextField, Slider } from "@mui/material";
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

interface ActiveGameProps {
    targetSong: any;
    snippetDuration: number;
    userGuess: string;
    setUserGuess: (guess: string) => void;
    onGuessSubmit: (specificGuess?: string) => void;
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
    const songOptions = React.useMemo(() => {
        return Array.from(new Set(songs.map((s: any) => {
            const artist = s.track.artists?.[0]?.name;
            return artist ? `${s.track.name} - ${artist}` : s.track.name;
        })));
    }, [songs]);

    const [inputValue, setInputValue] = React.useState('');
    const [open, setOpen] = React.useState(false);
    const [highlightedOption, setHighlightedOption] = React.useState<string | null>(null);

    const handleVolumeChange = (event: Event, newValue: number | number[]) => {
        setVolume(newValue as number / 100);
    };

    return (
        <section className="stage-card">
            <div className="stage-header">
                {selectedPlaylistName && (
                    <span className="eyebrow">Playing: {selectedPlaylistName}</span>
                )}
                <h2 className="section-title">Guess the song</h2>
                <span className="snippet-meter">Snippet length: {snippetDuration / 1000} seconds</span>
            </div>

            <div className="volume-console">
                <VolumeDown />
                <Slider
                    aria-label="Volume"
                    value={volume * 100}
                    onChange={handleVolumeChange}
                    sx={{
                        color: 'var(--gold)',
                        '& .MuiSlider-thumb': {
                            border: '3px solid var(--ink)',
                            backgroundColor: 'var(--cream)'
                        },
                        '& .MuiSlider-rail': {
                            opacity: 0.45
                        }
                    }}
                />
                <VolumeUp />
            </div>

            <div className="play-row">
                <button className="button button-large" onClick={onPlaySnippet} disabled={isPlaying}>Play Snippet</button>
                {isPlaying && <span className="playing-badge">Playing...</span>}
            </div>

            <div className="guess-row">
                <Autocomplete
                    className="guess-input"
                    freeSolo
                    open={open}
                    onOpen={() => {
                        if (inputValue.length > 0) {
                            setOpen(true);
                        }
                    }}
                    openOnFocus
                    onClose={() => {
                        setOpen(false);
                        setHighlightedOption(null);
                    }}
                    onHighlightChange={(event, option) => {
                        setHighlightedOption(option);
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
                        setHighlightedOption(null);
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
                            sx={{
                                width: '100%',
                                backgroundColor: 'var(--cream)',
                                borderRadius: '16px',
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '16px',
                                    fontFamily: 'var(--body)',
                                    fontWeight: 800,
                                    '& fieldset': {
                                        border: '3px solid var(--ink)'
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'var(--red)'
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--teal)'
                                    }
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'var(--ink-soft)',
                                    fontFamily: 'var(--body)',
                                    fontWeight: 900
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (open && highlightedOption) {
                                        if (inputValue === highlightedOption) {
                                            e.preventDefault();
                                            onGuessSubmit();
                                            return;
                                        }
                                        e.preventDefault();
                                        setInputValue(highlightedOption);
                                        setUserGuess(highlightedOption);
                                        setOpen(false);
                                        return;
                                    }
                                    e.preventDefault();
                                    onGuessSubmit();
                                }
                            }}
                        />
                    )}
                />
                <button className="button button-tertiary" onClick={() => onGuessSubmit()}>Guess</button>
            </div>

            {feedbackMessage && <div className="feedback-pill">{feedbackMessage}</div>}

            <button className="button button-quiet" onClick={onGiveUp}>Give Up</button>
        </section>
    );
};

export default ActiveGame;
