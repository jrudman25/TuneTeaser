/**
 * useGameLogic.ts
 * Handles the core game logic. Rounds are started, judged, and ended by the
 * server callables in utils/soloRounds; the client never sees the answer early.
 * @version 2026.11.13
 */
import { useState, useRef, useEffect } from 'react';
import usePreviewPlayer from './usePreviewPlayer';
import { GUEST_TRACKS } from '../utils/guestData';
import { ManualPlaylist, ManualTrack, manualTracksToGameItems } from '../utils/manualPlaylists';
import { getManualPlaylistTracks } from '../utils/spotifyPlaylistImporter';
import { startSoloRound, submitSoloGuess, giveUpSoloRound, SubmitSoloGuessResponse, StartSoloRoundResponse } from '../utils/soloRounds';
import { trackEvent } from '../utils/analytics';
import { logger } from '../utils/logger';

const getErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error && error.message ? error.message : fallback;
};

// The server keeps a solo round alive for 30 minutes; give the prefetch a
// slightly shorter window so a stale promise is never consumed.
const PREFETCH_MAX_AGE_MS = 25 * 60 * 1000;

// iTunes previews run about 30 seconds; the result screen replays the whole
// clip once the answer is revealed.
export const RESULT_PREVIEW_MS = 30 * 1000;

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

    const { playPreview, pause, isPlaying, isAdvancing, error: playerError, volume, setVolume, positionMs, playbackDurationMs, preloadPreview } = usePreviewPlayer();
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
    const gameStateRef = useRef(gameState);
    const currentRoundIdRef = useRef(currentRoundId);
    const startInFlightRef = useRef<{ playlistId: string; generation: number } | null>(null);
    useEffect(() => {
        selectedPlaylistIdRef.current = selectedPlaylistId;
    }, [selectedPlaylistId]);
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);
    useEffect(() => {
        currentRoundIdRef.current = currentRoundId;
    }, [currentRoundId]);

    const prefetchRef = useRef<{
        playlistId: string;
        generation: number;
        startedAt: number;
        promise: Promise<StartSoloRoundResponse>;
    } | null>(null);

    const prefetchNextRound = () => {
        const playlistId = selectedPlaylistIdRef.current;
        if (!playlistId) return;
        const prefetch = {
            playlistId,
            generation: playlistLoadGenerationRef.current,
            startedAt: Date.now(),
            promise: startSoloRound(playlistId)
        };
        prefetchRef.current = prefetch;
        prefetch.promise.then(round => {
            if (prefetchRef.current === prefetch) {
                preloadPreview(round.previewUrl);
            }
        }).catch(() => {
            // Consumed prefetches fall back to a fresh startSoloRound call.
        });
    };

    const startRound = async (playlistId: string, loadGeneration: number = playlistLoadGenerationRef.current) => {
        const isStaleLoad = () => playlistLoadGenerationRef.current !== loadGeneration;
        if (isStaleLoad()) return;
        // A duplicate start for the same round in flight (for example a
        // double-click on Next Track) would create a second server round that
        // races the first; the slower one wins and the client ends up holding
        // a round the server has already replaced.
        const inFlight = startInFlightRef.current;
        if (inFlight && inFlight.playlistId === playlistId && inFlight.generation === loadGeneration) return;
        startInFlightRef.current = { playlistId, generation: loadGeneration };
        setIsLoadingGame(true);
        pause();

        const prefetch = prefetchRef.current;
        const canUsePrefetch = !!prefetch
            && prefetch.playlistId === playlistId
            && prefetch.generation === playlistLoadGenerationRef.current
            && Date.now() - prefetch.startedAt < PREFETCH_MAX_AGE_MS;
        prefetchRef.current = null;

        try {
            let round: StartSoloRoundResponse | null = null;
            if (canUsePrefetch && prefetch) {
                try {
                    round = await prefetch.promise;
                } catch {
                    round = null;
                }
            }
            if (!round) {
                round = await startSoloRound(playlistId);
            }
            if (isStaleLoad()) return;
            setCurrentRoundId(round.roundId);
            setCurrentPreviewUrl(round.previewUrl);
            setSnippetDuration(round.snippetDurationMs);
            setTargetSong(null);
            setWrongGuesses([]);
            setUserGuess('');
            setFeedbackMessage('');
            setGameState('playing');
            preloadPreview(round.previewUrl);
            trackEvent('solo-round-start');
        } catch (error) {
            if (isStaleLoad()) return;
            setFeedbackMessage(getErrorMessage(error, 'Could not start a round. Try again.'));
            setGameState('idle');
            setTargetSong(null);
            setCurrentPreviewUrl(null);
            setCurrentRoundId(null);
        } finally {
            if (startInFlightRef.current?.playlistId === playlistId
                && startInFlightRef.current.generation === loadGeneration) {
                startInFlightRef.current = null;
            }
            if (!isStaleLoad()) {
                setIsLoadingGame(false);
            }
        }
    };

    // Replays the revealed track's full preview on the result screen. Only the
    // current round's URL is used, and startRound/handleSelectNewPlaylist
    // already pause it when the player moves on.
    const playResultPreview = () => {
        if (!currentPreviewUrl) return;
        playPreview(currentPreviewUrl, RESULT_PREVIEW_MS);
    };

    const handleGuessSubmit = async (specificGuess?: string): Promise<SubmitSoloGuessResponse | null> => {
        if (isSubmittingGuessRef.current || !currentRoundId || gameState !== 'playing') return null;
        const roundId = currentRoundId;
        isSubmittingGuessRef.current = true;
        setIsSubmittingGuess(true);

        const guessToCheck = specificGuess !== undefined ? specificGuess : userGuess;
        const guessText = guessToCheck.trim();
        // While the guess is in flight the round can move on (give up, a new
        // round starting, or a server round replaced by a newer start). Only
        // apply the result, or show an error, if this is still the live round.
        const isLiveRound = () => currentRoundIdRef.current === roundId && gameStateRef.current === 'playing';

        try {
            const result = await submitSoloGuess(roundId, guessText);
            if (!isLiveRound()) return null;

            if (result.result === 'correct') {
                setTargetSong(result.answer);
                setGameState('end');
                setFeedbackMessage(`Correct! You guessed the song in ${result.snippetDurationMs / 1000} seconds.`);
                trackEvent('solo-game-end', { result: 'correct' });
                playResultPreview();
                prefetchNextRound();
            } else if (result.result === 'out-of-snippet') {
                setTargetSong(result.answer);
                setGameState('end');
                setFeedbackMessage(`Game Over! You didn't get it. The song was: ${result.answer?.name || 'unknown'}`);
                trackEvent('solo-game-end', { result: 'out-of-snippet' });
                playResultPreview();
                prefetchNextRound();
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
            if (isLiveRound()) {
                setFeedbackMessage(getErrorMessage(error, 'Could not submit your guess. Try again.'));
            }
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
        if (!currentRoundId || gameStateRef.current !== 'playing') return;
        const roundId = currentRoundId;
        const isLiveRound = () => currentRoundIdRef.current === roundId && gameStateRef.current === 'playing';

        try {
            const result = await giveUpSoloRound(roundId);
            if (!isLiveRound()) return;
            setTargetSong(result.answer);
            setGameState('end');
            setFeedbackMessage(`The song was: ${result.answer.name}`);
            trackEvent('solo-game-end', { result: 'gave-up' });
            playResultPreview();
            prefetchNextRound();
        } catch (error) {
            if (isLiveRound()) {
                setFeedbackMessage(getErrorMessage(error, 'Could not reveal the song. Try again.'));
            }
        }
    };

    const handlePlayAgain = () => {
        startRound(selectedPlaylistIdRef.current);
    };

    const handleSelectNewPlaylist = () => {
        playlistLoadGenerationRef.current += 1;
        prefetchRef.current = null;
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
        prefetchRef.current = null;
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
                    logger.error('Failed to load tracks from Storage URL:', e);
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
        playResultPreview,
        stopPreview: pause,
        handlePlayAgain,
        handleSelectNewPlaylist,
        isPlaying,
        isAdvancing,
        playerError,
        volume,
        setVolume,
        positionMs,
        playbackDurationMs
    };
};
