/**
 * useGameLogic.ts
 * Handles the core game logic. Rounds are started, judged, and ended by the
 * server callables in utils/soloRounds; the client never sees the answer early.
 * @version 2026.06.01
 */
import { useState, useRef, useEffect } from 'react';
import usePreviewPlayer from './usePreviewPlayer';
import { GUEST_TRACKS } from '../utils/guestData';
import { ManualPlaylist, ManualTrack, manualTracksToGameItems } from '../utils/manualPlaylists';
import { getManualPlaylistTracks } from '../utils/spotifyPlaylistImporter';
import { startSoloRound, submitSoloGuess, giveUpSoloRound, SubmitSoloGuessResponse } from '../utils/soloRounds';

const getErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error && error.message ? error.message : fallback;
};

export const useGameLogic = (
    isGuest: boolean,
    manualPlaylists: ManualPlaylist[] = [],
    isManualMode: boolean = false
) => {
    const manualPlaylistsRef = useRef(manualPlaylists);
    const playlistLoadGenerationRef = useRef(0);
    useEffect(() => {
        manualPlaylistsRef.current = manualPlaylists;
    }, [manualPlaylists]);
    useEffect(() => () => {
        playlistLoadGenerationRef.current += 1;
    }, []);

    const { playPreview, pause, isPlaying, error: playerError, volume, setVolume } = usePreviewPlayer();
    const [currentTracks, setCurrentTracks] = useState<any[]>([]);
    const [targetSong, setTargetSong] = useState<any | null>(null);
    const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
    const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
    const [snippetDuration, setSnippetDuration] = useState<number>(2000); // ms
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'end'>('idle');
    const [userGuess, setUserGuess] = useState('');
    const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [isLoadingGame, setIsLoadingGame] = useState(false);
    const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
    const isSubmittingGuessRef = useRef(false);
    const selectedPlaylistIdRef = useRef('');
    useEffect(() => {
        selectedPlaylistIdRef.current = selectedPlaylistId;
    }, [selectedPlaylistId]);

    const startRound = async (playlistId: string, loadGeneration?: number) => {
        const isStaleLoad = () => loadGeneration !== undefined && playlistLoadGenerationRef.current !== loadGeneration;
        if (isStaleLoad()) return;
        setIsLoadingGame(true);
        pause();

        try {
            const round = await startSoloRound(playlistId);
            if (isStaleLoad()) return;
            setCurrentRoundId(round.roundId);
            setCurrentPreviewUrl(round.previewUrl);
            setSnippetDuration(round.snippetDurationMs);
            setTargetSong(null);
            setWrongGuesses([]);
            setUserGuess('');
            setFeedbackMessage('');
            setGameState('playing');
        } catch (error) {
            if (isStaleLoad()) return;
            setFeedbackMessage(getErrorMessage(error, 'Could not start a round. Try again.'));
            setGameState('idle');
            setTargetSong(null);
            setCurrentPreviewUrl(null);
            setCurrentRoundId(null);
        } finally {
            if (!isStaleLoad()) {
                setIsLoadingGame(false);
            }
        }
    };

    const handleGuessSubmit = async (specificGuess?: string): Promise<SubmitSoloGuessResponse | null> => {
        if (isSubmittingGuessRef.current || !currentRoundId || gameState !== 'playing') return null;
        isSubmittingGuessRef.current = true;
        setIsSubmittingGuess(true);

        const guessToCheck = specificGuess !== undefined ? specificGuess : userGuess;
        const guessText = guessToCheck.trim();

        try {
            const result = await submitSoloGuess(currentRoundId, guessText);

            if (result.result === 'correct') {
                setTargetSong(result.answer);
                setGameState('end');
                setFeedbackMessage(`Correct! You won! Guessed the song in ${result.snippetDurationMs / 1000} seconds.`);
            } else if (result.result === 'out-of-snippet') {
                setTargetSong(result.answer);
                setGameState('end');
                setFeedbackMessage(`Game Over! You didn't get it. The song was: ${result.answer?.name || 'unknown'}`);
            } else {
                setSnippetDuration(result.snippetDurationMs);
                if (guessText) {
                    setWrongGuesses(prev => (
                        prev.some(guess => guess.toLowerCase() === guessText.toLowerCase())
                            ? prev
                            : [...prev, guessText]
                    ));
                    setFeedbackMessage('Incorrect. Increasing snippet length!');
                } else {
                    setFeedbackMessage(`Snippet extended to ${result.snippetDurationMs / 1000} seconds.`);
                }
            }

            return result;
        } catch (error) {
            setFeedbackMessage(getErrorMessage(error, 'Could not submit your guess. Try again.'));
            return null;
        } finally {
            isSubmittingGuessRef.current = false;
            setIsSubmittingGuess(false);
        }
    };

    const playSnippet = async () => {
        if (gameState !== 'playing') {
            setFeedbackMessage('No song playing.');
            return;
        }

        if (!currentPreviewUrl) {
            setFeedbackMessage('Error: Preview URL missing. Loading another track...');
            await startRound(selectedPlaylistIdRef.current);
            return;
        }

        setFeedbackMessage('');
        playPreview(currentPreviewUrl, snippetDuration);
    };

    const handleGiveUp = async () => {
        if (!currentRoundId) return;

        try {
            const result = await giveUpSoloRound(currentRoundId);
            setTargetSong(result.answer);
            setGameState('end');
            setFeedbackMessage(`The song was: ${result.answer.name}`);
        } catch (error) {
            setFeedbackMessage(getErrorMessage(error, 'Could not reveal the song. Try again.'));
        }
    };

    const handlePlayAgain = () => {
        startRound(selectedPlaylistIdRef.current);
    };

    const handleSelectNewPlaylist = () => {
        playlistLoadGenerationRef.current += 1;
        pause();
        setIsLoadingGame(false);
        setGameState('idle');
        setTargetSong(null);
        setCurrentTracks([]);
        setFeedbackMessage('');
        setSelectedPlaylistId('');
        setSelectedPlaylistName('');
        setCurrentRoundId(null);
        setCurrentPreviewUrl(null);
        setWrongGuesses([]);
    };

    const loadPlaylist = async (playlistId: string, playlistName: string) => {
        if (isLoadingGame) return;

        const loadGeneration = ++playlistLoadGenerationRef.current;
        const isStaleLoad = () => playlistLoadGenerationRef.current !== loadGeneration;
        setSelectedPlaylistName(playlistName);
        setSelectedPlaylistId(playlistId);
        setIsLoadingGame(true);
        setFeedbackMessage('Loading tracks... Game will start soon.');

        const featuredTracks = GUEST_TRACKS[playlistId];
        if (featuredTracks) {
            if (isStaleLoad()) return;
            setCurrentTracks(featuredTracks);
            await startRound(playlistId, loadGeneration);
            return;
        }

        const playlist = (isGuest || isManualMode)
            ? manualPlaylistsRef.current.find((manualPlaylist) => manualPlaylist.id === playlistId)
            : undefined;
        if (playlist) {
            let rawTracks: ManualTrack[] = [];
            if (playlist.tracksUrl) {
                try {
                    rawTracks = await getManualPlaylistTracks(playlist.id);
                } catch (e) {
                    console.error('Failed to load tracks from Storage URL:', e);
                    rawTracks = playlist.tracks || [];
                }
            } else {
                rawTracks = playlist.tracks || [];
            }
            if (isStaleLoad()) return;
            const tracks = manualTracksToGameItems(rawTracks);
            setCurrentTracks(tracks);
            await startRound(playlistId, loadGeneration);
            return;
        }

        setFeedbackMessage('Error: Playlist not found.');
        setIsLoadingGame(false);
    };

    return {
        gameState,
        setGameState,
        targetSong,
        snippetDuration,
        userGuess,
        setUserGuess,
        wrongGuesses,
        feedbackMessage,
        setFeedbackMessage,
        isLoadingGame,
        isSubmittingGuess,
        selectedPlaylistId,
        selectedPlaylistName,
        currentTracks,
        currentRoundId,
        loadPlaylist,
        handleGuessSubmit,
        handleGiveUp,
        playSnippet,
        handlePlayAgain,
        handleSelectNewPlaylist,
        isPlaying,
        playerError,
        volume,
        setVolume
    };
};
