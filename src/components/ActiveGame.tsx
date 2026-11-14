/**
 * ActiveGame.tsx
 * Handles the active game state, including song snippets and user input.
 * @version 2026.11.13
 */
import React from 'react';
import { Autocomplete, TextField, Slider } from "@mui/material";
import ArrowBack from '@mui/icons-material/ArrowBack';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import GraphicEq from '@mui/icons-material/GraphicEq';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';
import ConfirmDialog from './ConfirmDialog';
import SnippetProgress from './SnippetProgress';
import { useGameShortcuts } from '../hooks/useGameShortcuts';

interface ActiveGameProps {
    targetSong: any;
    snippetDuration: number;
    userGuess: string;
    setUserGuess: (guess: string) => void;
    onGuessSubmit: (specificGuess?: string) => void;
    onPlaySnippet: () => void;
    onGiveUp: () => void;
    onBack: () => void;
    feedbackMessage: string;
    isPlaying: boolean;
    isAdvancing?: boolean;
    positionMs?: number;
    playbackDurationMs?: number;
    selectedPlaylistName: string;
    songs: any[];
    wrongGuesses?: string[];
    isSubmittingGuess?: boolean;
    volume: number;
    setVolume: (volume: number) => void;
    shortcutsEnabled?: boolean;
}

const ActiveGame: React.FC<ActiveGameProps> = ({
    snippetDuration,
    userGuess,
    setUserGuess,
    onGuessSubmit,
    onPlaySnippet,
    onGiveUp,
    onBack,
    feedbackMessage,
    isPlaying,
    isAdvancing,
    positionMs = 0,
    playbackDurationMs = 0,
    selectedPlaylistName,
    songs,
    wrongGuesses = [],
    isSubmittingGuess = false,
    volume,
    setVolume,
    shortcutsEnabled = true
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
    const [isGiveUpConfirmOpen, setIsGiveUpConfirmOpen] = React.useState(false);

    const guessInputRef = React.useRef<HTMLInputElement>(null);

    useGameShortcuts({
        enabled: shortcutsEnabled && !isGiveUpConfirmOpen,
        onPlay: () => {
            if (!isPlaying) {
                onPlaySnippet();
            }
        },
        onGiveUpRequest: () => setIsGiveUpConfirmOpen(true),
        onFocusGuess: () => guessInputRef.current?.focus()
    });

    const handleVolumeChange = (event: Event, newValue: number | number[]) => {
        setVolume(newValue as number / 100);
    };

    return (
        <div className="stage-wrap">
            <button
                className="button button-quiet stage-back-button"
                type="button"
                onClick={onBack}
                aria-label="Back to playlist selection"
                title="Back to playlists"
            >
                <ArrowBack aria-hidden="true" fontSize="small" />
            </button>
            <section className="stage-card">
                <div className="stage-inner">
                <div className="stage-header">
                    <div className="stage-header-copy">
                        {selectedPlaylistName && (
                            <span className="eyebrow">Playing: {selectedPlaylistName}</span>
                        )}
                        <h2 className="section-title">Guess the song</h2>
                    </div>
                    <button
                        className="button button-quiet"
                        type="button"
                        onClick={() => setIsGiveUpConfirmOpen(true)}
                        aria-keyshortcuts="Escape"
                        title="Give up (Esc)"
                    >
                        Give up
                    </button>
                </div>

                <div className="game-deck">
                    <button
                        className="game-deck-play"
                        type="button"
                        onClick={onPlaySnippet}
                        disabled={isPlaying}
                        aria-label="Play snippet"
                        aria-keyshortcuts="Space"
                        title="Play snippet (Space)"
                    >
                        {isPlaying ? <GraphicEq aria-hidden="true" /> : <PlayArrow aria-hidden="true" />}
                    </button>
                    <div className="game-deck-progress">
                        <SnippetProgress
                            isPlaying={isPlaying}
                            isAdvancing={isAdvancing}
                            positionMs={positionMs}
                            durationMs={isPlaying && playbackDurationMs ? playbackDurationMs : snippetDuration}
                            idleText={`${snippetDuration / 1000}s snippet`}
                            hint="Space to play"
                        />
                    </div>
                    <div className="game-deck-volume">
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
                </div>

                <div className="guess-row">
                    <Autocomplete
                        className="guess-input"
                        slotProps={{ popper: { className: 'guess-suggestion-popper' } }}
                        freeSolo
                        open={open}
                        onOpen={() => {
                            if (inputValue.length >= 3) {
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
                            if (state.inputValue.length < 3) return [];
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
                            if (newInputValue.length >= 3) {
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
                                inputRef={guessInputRef}
                                slotProps={{ htmlInput: { ...params.inputProps, maxLength: 200 } }}
                                label="Enter song title..."
                                variant="outlined"
                                sx={{
                                    width: '100%',
                                    backgroundColor: 'var(--cream)',
                                    borderRadius: '16px',
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '16px',
                                        color: 'var(--ink)',
                                        fontFamily: 'var(--body)',
                                        fontWeight: 800,
                                        '& fieldset': {
                                            border: '3px solid var(--ink)'
                                        },
                                        '&:hover fieldset': {
                                            borderColor: 'var(--ink)'
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
                    <button className="button button-tertiary" onClick={() => onGuessSubmit()} disabled={isSubmittingGuess}>Guess</button>
                </div>

                <div className="guess-helper">
                    <LightbulbOutlined aria-hidden fontSize="small" /> Guess with nothing typed to hear 2 more seconds (up to 30s).
                </div>

                <div className="shortcut-hint">
                    Shortcuts: Space plays the snippet, Enter focuses the guess field, Esc gives up.
                </div>

                {feedbackMessage && <div className="feedback-pill" role="status" aria-live="polite">{feedbackMessage}</div>}

                {wrongGuesses.length > 0 && (
                    <div className="guess-history" aria-label="Previous guesses">
                        <span className="guess-history-label">Previous guesses:</span>
                        <ul className="guess-history-list">
                            {wrongGuesses.map((guess, index) => (
                                <li key={`${guess}-${index}`} className="guess-history-item" title={guess}>{guess}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={isGiveUpConfirmOpen}
                title="Give up this round?"
                message="The answer will be revealed and this round will not score."
                confirmLabel="Give Up"
                variant="danger"
                onConfirm={() => {
                    setIsGiveUpConfirmOpen(false);
                    onGiveUp();
                }}
                onCancel={() => setIsGiveUpConfirmOpen(false)}
            />
            </section>
        </div>
    );
};

export default ActiveGame;
