/**
 * useGameLogic.ts
 * Handles the core game logic, including track selection, scoring, and state management.
 * @version 2026.02.11
 */
import { useState } from 'react';
import usePreviewPlayer from './usePreviewPlayer';
import { getItunesPreview } from '../utils/itunes';
import { normalizeString } from '../utils/stringUtils';
import { GUEST_TRACKS } from '../utils/guestData';

export const useGameLogic = (accessToken: string | null, isGuest: boolean) => {
    const { playPreview, pause, isPlaying, error: playerError, volume, setVolume } = usePreviewPlayer();
    const [currentTracks, setCurrentTracks] = useState<any[]>([]);
    const [recentTracks, setRecentTracks] = useState<string[]>([]);
    const [failedTracks, setFailedTracks] = useState<string[]>([]);
    const [targetSong, setTargetSong] = useState<any | null>(null);
    const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
    const [snippetDuration, setSnippetDuration] = useState<number>(1000); // ms
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'end'>('idle');
    const [userGuess, setUserGuess] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [isLoadingGame, setIsLoadingGame] = useState(false);

    const startGame = async (tracks: any[], explicitSkipId?: string) => {
        if (isLoadingGame && !explicitSkipId) return;
        setIsLoadingGame(true);
        pause();

        const isCandidateValid = (t: any) => {
            const id = t.track.id;
            if (recentTracks.includes(id)) return false;
            if (failedTracks.includes(id)) return false;
            if (explicitSkipId && id === explicitSkipId) return false;
            return true;
        };

        let candidates = tracks.filter(isCandidateValid);

        if (candidates.length === 0 && tracks.length > 0) {

            setRecentTracks([]);
            // allow recent tracks again, but maintain failedTracks blacklist
            candidates = tracks.filter(t =>
                !failedTracks.includes(t.track.id) &&
                (!explicitSkipId || t.track.id !== explicitSkipId)
            );
        }

        let selectedTrack: any | null = null;
        let previewUrl = null;

        const shuffled = [...candidates].sort(() => 0.5 - Math.random());

        for (const candidate of shuffled) {
            const track = candidate.track;
            const artistName = track.artists[0]?.name || "";
            const albumName = track.album?.name || "";
            const data = await getItunesPreview(track.name, artistName, albumName);

            if (data && data.previewUrl) {
                selectedTrack = track;
                previewUrl = data.previewUrl;

                // For Guest Mode or missing artwork, use iTunes artwork
                if (data.artworkUrl) {
                    if (!selectedTrack.album) selectedTrack.album = { images: [] };
                    if (!selectedTrack.album.images) selectedTrack.album.images = [];

                    if (isGuest || selectedTrack.album.images.length === 0) {
                        // Clear any existing (potentially broken) URLs if Guest
                        selectedTrack.album.images = [{ url: data.artworkUrl }];
                    }
                }
                break;
            } else {

                setFailedTracks(prev => [...prev, track.id]);
            }
        }

        if (selectedTrack && previewUrl) {

            setTargetSong(selectedTrack);
            setCurrentPreviewUrl(previewUrl);
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

            setFeedbackMessage('No playable tracks found in this playlist (checked all).');
            setTargetSong(null);
            setCurrentPreviewUrl(null);
            setGameState('idle');
        }
        setIsLoadingGame(false);
    };

    const handleGuessSubmit = (specificGuess?: string) => {
        const guessToCheck = specificGuess !== undefined ? specificGuess : userGuess;
        if (!targetSong) return;

        const checkGuess = normalizeString(guessToCheck);
        const checkTitle = normalizeString(targetSong.name);

        const isCorrect = (checkTitle.includes(checkGuess) && checkGuess.length > 2) || (checkTitle === checkGuess && checkGuess.length > 0);

        if (isCorrect) {
            setGameState('end');
            setFeedbackMessage(`Correct! You won! Guessed the song in ${snippetDuration / 1000} seconds.`);
        } else {
            if (snippetDuration >= 30000) {
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

        if (!currentPreviewUrl) {
            setFeedbackMessage("Error: Preview URL missing. Skipping...");
            await startGame(currentTracks, targetSong.id);
            return;
        }

        setFeedbackMessage('');
        playPreview(currentPreviewUrl, snippetDuration);
    };

    const handleGiveUp = () => {
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
        setFailedTracks([]);
    };

    const loadPlaylist = async (playlistId: string, playlistName: string) => {
        if (isLoadingGame) return;


        setSelectedPlaylistName(playlistName);
        setIsLoadingGame(true);
        setFeedbackMessage("Loading tracks... Game will start soon.");

        setFeedbackMessage("Loading tracks... Game will start soon.");

        if (isGuest) {
            // Guest Mode Loading
            const tracks = GUEST_TRACKS[playlistId];
            if (tracks) {
                setCurrentTracks(tracks);
                await startGame(tracks);
            } else {
                setFeedbackMessage("Error: Playlist not found.");
                setIsLoadingGame(false);
            }
            return;
        }

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


                    const validInitialTracks = fetchedTracks.filter((item: any) =>
                        item.track && item.track.id && !item.is_local
                    );

                    if (validInitialTracks.length === 0 && total === 0) {
                        setFeedbackMessage('No playable tracks found in this playlist.');
                        setIsLoadingGame(false);
                        return;
                    }

                    setCurrentTracks(validInitialTracks);
                    await startGame(validInitialTracks);
                    setIsLoadingGame(false);

                    if (total > fetchedTracks.length) {

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
