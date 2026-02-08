/**
 * useGameLogic.ts
 * Handles the core game logic, including track selection, scoring, and state management.
 * @version 2026.02.07
 */
import { useState } from 'react';
import usePreviewPlayer from './usePreviewPlayer';
import { getItunesPreview } from '../utils/itunes';

export const useGameLogic = (accessToken: string | null) => {
    const { playPreview, pause, isPlaying, error: playerError, volume, setVolume } = usePreviewPlayer();

    const [currentTracks, setCurrentTracks] = useState<any[]>([]);
    const [recentTracks, setRecentTracks] = useState<string[]>([]);
    const [targetSong, setTargetSong] = useState<any | null>(null);
    const [snippetDuration, setSnippetDuration] = useState<number>(1000); // ms
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'end'>('idle');
    const [userGuess, setUserGuess] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [isLoadingGame, setIsLoadingGame] = useState(false);

    const startGame = (tracks: any[]) => {
        pause();
        let candidates = tracks.filter(t => !recentTracks.includes(t.track.id));

        if (candidates.length === 0 && tracks.length > 0) {
            console.log("All tracks played, resetting history.");
            setRecentTracks([]);
            candidates = tracks;
        }

        if (candidates.length > 0) {
            const randomIndex = Math.floor(Math.random() * candidates.length);
            const selectedTrack = candidates[randomIndex].track;
            console.log("Selected track:", selectedTrack.name, selectedTrack.uri);

            setTargetSong(selectedTrack);
            setGameState('playing');
            setSnippetDuration(2000);
            setFeedbackMessage('');
            setUserGuess('');

            setRecentTracks(prev => {
                const newRecent = [...prev, selectedTrack.id];
                const limit = Math.min(50, Math.ceil(tracks.length * 0.5));
                if (newRecent.length > limit) {
                    return newRecent.slice(newRecent.length - limit);
                }
                return newRecent;
            });
        } else {
            console.warn("No valid tracks.");
            setFeedbackMessage('No playable tracks found in this playlist.');
            setTargetSong(null);
            setGameState('idle');
        }
    };

    const handleGuessSubmit = () => {
        if (!targetSong) return;

        const normalizeString = (str: string) => {
            return str.toLowerCase().replace(/[^a-z0-9]/g, '');
        };

        const checkGuess = normalizeString(userGuess);
        const checkTitle = normalizeString(targetSong.name);

        const isCorrect = (checkTitle.includes(checkGuess) && checkGuess.length > 2) || (checkTitle === checkGuess && checkGuess.length > 0);

        if (isCorrect) {
            pause();
            setGameState('end');
            setFeedbackMessage(`Correct! You won! Guessed the song in ${snippetDuration / 1000} seconds.`);
        } else {
            if (snippetDuration >= 30000) {
                pause();
                setGameState('end');
                setFeedbackMessage(`Game Over! You didn't get it. The song was: ${targetSong.name}`);
            } else {
                setFeedbackMessage('Incorrect. Increasing snippet length!');
                setSnippetDuration(prev => Math.min(prev + 2000, 30000));
            }
        }
    };

    const playSnippet = async () => {
        if (!targetSong) {
            setFeedbackMessage("No song selected.");
            return;
        }

        setFeedbackMessage("Loading preview...");

        try {
            console.log("Looking for iTunes preview...");
            const artistName = targetSong.artists[0]?.name || "";
            const trackName = targetSong.name;
            let previewUrl = await getItunesPreview(trackName, artistName);

            if (!previewUrl) {
                setFeedbackMessage("No preview available for this track. Try 'Give up' to skip.");
                return;
            }

            setFeedbackMessage('');
            playPreview(previewUrl, snippetDuration);

        } catch (e) {
            console.error("Playback error", e);
            setFeedbackMessage("Error playing snippet. Please try again.");
        }
    };

    const handleGiveUp = () => {
        pause();
        setGameState('end');
        setFeedbackMessage(`The song was: ${targetSong.name}`);
    };

    const handlePlayAgain = () => {
        startGame(currentTracks);
    };

    const handleSelectNewPlaylist = () => {
        pause();
        setGameState('idle');
        setTargetSong(null);
        setCurrentTracks([]);
        setFeedbackMessage('');
        setSelectedPlaylistName('');
    };

    const loadPlaylist = async (playlistId: string, playlistName: string) => {
        if (isLoadingGame) return;
        console.log("Loading playlist:", playlistId);

        setSelectedPlaylistName(playlistName);
        setIsLoadingGame(true);
        setFeedbackMessage("Loading tracks... Game will start soon.");

        if (accessToken) {
            try {
                let initialUrl = '';
                if (playlistId === 'LIKED_SONGS') {
                    initialUrl = 'https://api.spotify.com/v1/me/tracks?market=from_token&limit=50';
                } else {
                    initialUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=from_token&limit=100`;
                }

                const response = await fetch(initialUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    let fetchedTracks = [...data.items];
                    const total = data.total;
                    console.log(`Initial fetch: ${fetchedTracks.length} of ${total} tracks`);

                    const validInitialTracks = fetchedTracks.filter((item: any) =>
                        item.track && item.track.id && !item.is_local
                    );

                    if (validInitialTracks.length === 0 && total === 0) {
                        setFeedbackMessage('No playable tracks found in this playlist.');
                        setIsLoadingGame(false);
                        return;
                    }

                    setCurrentTracks(validInitialTracks);
                    startGame(validInitialTracks);
                    setIsLoadingGame(false);

                    if (total > fetchedTracks.length) {
                        console.log("Starting background fetch for remaining tracks...");
                        const limit = playlistId === 'LIKED_SONGS' ? 50 : 100;
                        const BATCH_SIZE = 3;
                        const requests = [];

                        for (let offset = fetchedTracks.length; offset < total; offset += limit) {
                            let url = '';
                            if (playlistId === 'LIKED_SONGS') {
                                url = `https://api.spotify.com/v1/me/tracks?market=from_token&limit=${limit}&offset=${offset}`;
                            } else {
                                url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=from_token&limit=${limit}&offset=${offset}`;
                            }
                            requests.push(url);
                        }

                        for (let i = 0; i < requests.length; i += BATCH_SIZE) {
                            const batchUrls = requests.slice(i, i + BATCH_SIZE);
                            const batchPromises = batchUrls.map(url =>
                                fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
                                    .then(res => res.json())
                            );

                            const results = await Promise.all(batchPromises);
                            const newTracks: any[] = [];
                            results.forEach((res: any) => {
                                if (res && res.items) {
                                    newTracks.push(...res.items);
                                }
                            });

                            const validNewTracks = newTracks.filter((item: any) =>
                                item.track && item.track.id && !item.is_local
                            );

                            setCurrentTracks(prev => [...prev, ...validNewTracks]);
                            console.log(`Background fetched batch ${i / BATCH_SIZE + 1}. Total tracks: ${fetchedTracks.length + newTracks.length}`);
                        }
                    }

                } else {
                    console.error('Failed to fetch playlist tracks:', response.statusText);
                    setFeedbackMessage(`Error fetching tracks: ${response.status} ${response.statusText}`);
                    setIsLoadingGame(false);
                }
            } catch (error) {
                console.error('Error fetching playlist tracks:', error);
                setFeedbackMessage(`Error: ${error}`);
                setIsLoadingGame(false);
            }
        } else {
            console.error("No access token provided to useGameLogic");
            setFeedbackMessage("Authentication error. Please refresh.");
            setIsLoadingGame(false);
        }
    };

    return {
        gameState,
        setGameState,
        targetSong,
        snippetDuration,
        userGuess,
        setUserGuess,
        feedbackMessage,
        setFeedbackMessage,
        isLoadingGame,
        selectedPlaylistName,
        currentTracks,
        loadPlaylist,
        startGame,
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
