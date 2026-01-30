/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.01.30
 */
import React, { useEffect, useState } from 'react';
import { Typography, Box } from "@mui/material";
import usePreviewPlayer from '../hooks/usePreviewPlayer';
import { getItunesPreview } from '../utils/itunes';


import { refreshAccessToken } from '../utils/auth';

const Home = () => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken'));
    const { playPreview, isPlaying, error: playerError } = usePreviewPlayer();

    const [playlists, setPlaylists] = useState<any[]>([]);
    const [currentTracks, setCurrentTracks] = useState<any[]>([]);
    const [recentTracks, setRecentTracks] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);

    const [targetSong, setTargetSong] = useState<any | null>(null);
    const [snippetDuration, setSnippetDuration] = useState<number>(1000); // ms
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'end'>('idle');
    const [userGuess, setUserGuess] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [playlistPage, setPlaylistPage] = useState(0);
    const PLAYLISTS_PER_PAGE = 10;

    useEffect(() => {
        const checkToken = async () => {
            const tokenExpiry = localStorage.getItem('tokenExpiry');
            const refreshToken = localStorage.getItem('refreshToken');
            const clientId = `${process.env.REACT_APP_SPOTIFY_CLIENT_ID}`;

            if (tokenExpiry && refreshToken && Date.now() > parseInt(tokenExpiry)) {
                console.log("Token expired, refreshing...");
                try {
                    const data = await refreshAccessToken(clientId, refreshToken);
                    if (data.access_token) {
                        const { access_token, expires_in, refresh_token: newRefreshToken } = data;
                        localStorage.setItem('accessToken', access_token);
                        sessionStorage.setItem('accessToken', access_token);
                        localStorage.setItem('tokenExpiry', (Date.now() + expires_in * 1000).toString());
                        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
                        setAccessToken(access_token);
                    }
                } catch (e) {
                    console.error("Failed to refresh token", e);
                    // Logout if refresh fails
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/';
                }
            }
        };

        checkToken();

        const fetchPlaylists = async () => {
            if (accessToken) {
                setIsLoadingPlaylists(true);
                try {
                    let allPlaylists: any[] = [];
                    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

                    while (nextUrl) {
                        const response = await fetch(nextUrl, {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`
                            }
                        });

                        if (response.status === 401) {
                            console.error("401 Unauthorized during playlist fetch");
                            break;
                        }

                        if (!response.ok) {
                            console.error('Failed to fetch playlists:', response.statusText);
                            break;
                        }

                        const data = await response.json();
                        allPlaylists = [...allPlaylists, ...data.items];
                        nextUrl = data.next;
                    }

                    setPlaylists(allPlaylists);
                } catch (error) {
                    console.error('Error fetching playlists:', error);
                } finally {
                    setIsLoadingPlaylists(false);
                }
            } else {
                setIsLoadingPlaylists(false);
            }
        };

        fetchPlaylists();
    }, [accessToken]);

    const startGame = (tracks: any[]) => {
        // Filter out recent tracks to prevent repeats
        let candidates = tracks.filter(t => !recentTracks.includes(t.track.id));

        if (candidates.length === 0 && tracks.length > 0) {
            // If all tracks have been played, reset history
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
            setSnippetDuration(2000); // Start with 2 seconds
            setFeedbackMessage('');
            setUserGuess('');

            // Add to recent tracks
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

    const handlePlaylistClick = async (playlistId: string) => {
        if (isLoading) return;
        console.log("Clicked playlist:", playlistId);

        if (playlistId === 'LIKED_SONGS') {
            setSelectedPlaylistName('Liked Songs');
        } else {
            const playlist = playlists.find((p: any) => p.id === playlistId);
            if (playlist) {
                setSelectedPlaylistName(playlist.name);
            }
        }

        if (accessToken) {
            setIsLoading(true);
            setFeedbackMessage("Loading tracks... Game will start soon.");
            try {
                let initialUrl = '';
                if (playlistId === 'LIKED_SONGS') {
                    initialUrl = 'https://api.spotify.com/v1/me/tracks?market=from_token&limit=50';
                } else {
                    initialUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=from_token&limit=100`;
                }

                // Initial fetch to get first page and total count
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
                        setIsLoading(false);
                        return;
                    }

                    setCurrentTracks(validInitialTracks);
                    startGame(validInitialTracks); // Start with first batch of tracks
                    setIsLoading(false);

                    // Background fetch for the rest of the tracks
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
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error fetching playlist tracks:', error);
                setFeedbackMessage(`Error: ${error}`);
                setIsLoading(false);
            }
        } else {
            console.error("No access token found in sessionStorage");
            alert("No access token found. Please try logging in again.");
        }
    };

    const handlePlayAgain = () => {
        startGame(currentTracks);
    };

    const handleSelectNewPlaylist = () => {
        setGameState('idle');
        setTargetSong(null);
        setCurrentTracks([]);
        setFeedbackMessage('');
        setSelectedPlaylistName('');
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
                setFeedbackMessage("No preview available for this track. Try 'Play Again' to skip.");
                return;
            }

            setFeedbackMessage('');
            playPreview(previewUrl, snippetDuration);

        } catch (e) {
            console.error("Playback error", e);
            setFeedbackMessage("Error playing snippet. Please try again.");
        }
    };

    const handleGuessSubmit = () => {
        if (!targetSong) return;

        // Fuzzy matching
        const normalizeString = (str: string) => {
            return str.toLowerCase().replace(/[^a-z0-9]/g, '');
        };

        const checkGuess = normalizeString(userGuess);
        const checkTitle = normalizeString(targetSong.name);

        if (checkTitle.includes(checkGuess) && checkGuess.length > 2) {
            setGameState('end');
            setFeedbackMessage(`Correct! You won! Guessed the song in ${snippetDuration / 1000} seconds.`);
        } else {
            if (snippetDuration >= 30000) {
                setGameState('end');
                setFeedbackMessage(`Game Over! You didn't get it. The song was: ${targetSong.name}`);
            } else {
                setFeedbackMessage('Incorrect. Increasing snippet length!');
                setSnippetDuration(prev => Math.min(prev + 2000, 30000)); // Increase by 2s, max 30s
            }
        }
    };

    const handleGiveUp = () => {
        setGameState('end');
        setFeedbackMessage(`The song was: ${targetSong.name}`);
    };

    return (
        <div>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Typography color='black' marginBottom='0.5rem'>
                    Home
                </Typography>

                <button
                    onClick={() => {
                        sessionStorage.removeItem('accessToken');
                        window.location.href = '/';
                    }}
                    style={{ marginBottom: '1rem', padding: '5px 10px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Logout / Reset Token
                </button>

                {playerError && (
                    <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', border: '1px solid #ef9a9a' }}>
                        <strong>Error:</strong> {playerError}
                        <br />
                        <small>Please try logging out and logging in again.</small>
                    </div>
                )}

                {gameState === 'idle' && (
                    <>
                        <Typography variant="h4">Select a Playlist to Start Game</Typography>
                        {isLoadingPlaylists ? (
                            <Typography color="textSecondary">Loading playlists...</Typography>
                        ) : (
                            <>
                                <ul>
                                    {playlistPage === 0 && (
                                        <li
                                            onClick={() => handlePlaylistClick('LIKED_SONGS')}
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
                                            onClick={() => handlePlaylistClick(playlist.id)}
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
                        {feedbackMessage && <Typography color="error">{feedbackMessage}</Typography>}
                    </>
                )}

                {gameState === 'playing' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {selectedPlaylistName && (
                            <Typography variant="h6" color="textSecondary">
                                Playing: {selectedPlaylistName}
                            </Typography>
                        )}
                        <Typography variant="h5">Guess the Song!</Typography>
                        <Typography>Snippet Length: {snippetDuration / 1000} seconds</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button onClick={playSnippet} style={{ padding: '10px 20px', fontSize: '1.2rem' }}>Play Snippet</button>
                            {isPlaying && <Typography variant="body1" color="primary" sx={{ animation: 'pulse 1s infinite' }}>🎵 Playing...</Typography>}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <input
                                type="text"
                                value={userGuess}
                                onChange={(e) => setUserGuess(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleGuessSubmit();
                                    }
                                }}
                                placeholder="Enter song title..."
                                style={{ padding: '5px' }}
                            />
                            <button onClick={handleGuessSubmit} style={{ padding: '5px 10px' }}>Guess</button>
                        </Box>

                        {feedbackMessage && <Typography color="error">{feedbackMessage}</Typography>}

                        <button onClick={handleGiveUp} style={{ marginTop: '20px' }}>Give Up</button>
                    </Box>
                )}

                {gameState === 'end' && targetSong && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h4" color="success.main">{feedbackMessage}</Typography>
                        <Typography variant="h6">Song: {targetSong.name}</Typography>
                        <Typography>Artist: {targetSong.artists.map((a: any) => a.name).join(', ')}</Typography>
                        {targetSong.album.images?.[0] && (
                            <img src={targetSong.album.images[0].url} alt="Album Art" style={{ width: 200, height: 200 }} />
                        )}

                        <Box sx={{ display: 'flex', gap: 2, marginTop: '20px' }}>
                            <button
                                onClick={handlePlayAgain}
                                style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                            >
                                Play Again (Same Playlist)
                            </button>
                            <button
                                onClick={handleSelectNewPlaylist}
                                style={{ padding: '10px 20px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                            >
                                Select New Playlist
                            </button>
                        </Box>
                    </Box>
                )}
            </Box>
        </div >
    );
};

export default Home;
