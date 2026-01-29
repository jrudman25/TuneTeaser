/**
 * Home.tsx
 * The main page of the site.
 * @version 2026.01.28
 */
import React, { useEffect, useState } from 'react';
import { Typography, Box } from "@mui/material";
import usePreviewPlayer from '../hooks/usePreviewPlayer';
import { getItunesPreview } from '../utils/itunes';


const Home = () => {
    const accessToken = sessionStorage.getItem('accessToken');
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

    useEffect(() => {
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
        if (isLoading) return; // Prevent multiple clicks
        console.log("Clicked playlist:", playlistId);

        if (accessToken) {
            setIsLoading(true);
            setFeedbackMessage("Loading tracks... This may take a moment for large playlists.");
            try {
                let allTracks: any[] = [];
                let nextUrl: string | null = '';

                if (playlistId === 'LIKED_SONGS') {
                    nextUrl = 'https://api.spotify.com/v1/me/tracks?market=from_token&limit=50';
                } else {
                    nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=from_token&limit=100`;
                }

                // Initial fetch to get first page and total count
                const response = await fetch(nextUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    allTracks = [...data.items];
                    const total = data.total;
                    console.log(`Initial fetch: ${allTracks.length} of ${total} tracks`);

                    // Calculate remaining requests
                    const limit = playlistId === 'LIKED_SONGS' ? 50 : 100;
                    const requests = [];
                    for (let offset = limit; offset < total; offset += limit) {
                        requests.push(async () => {
                            let url = '';
                            if (playlistId === 'LIKED_SONGS') {
                                url = `https://api.spotify.com/v1/me/tracks?market=from_token&limit=${limit}&offset=${offset}`;
                            } else {
                                url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=from_token&limit=${limit}&offset=${offset}`;
                            }

                            const res = await fetch(url, {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            });
                            return res.json();
                        });
                    }

                    // Execute in batches to avoid rate limits
                    const BATCH_SIZE = 5;
                    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
                        const batch = requests.slice(i, i + BATCH_SIZE).map(req => req());
                        const results = await Promise.all(batch);
                        results.forEach((res: any) => {
                            if (res && res.items) {
                                allTracks.push(...res.items);
                            }
                        });
                        console.log(`Fetched batch ${i / BATCH_SIZE + 1}, total tracks so far: ${allTracks.length}`);
                    }

                    // Filter for valid tracks (we'll fetch preview URLs on demand)
                    const validTracks = allTracks.filter((item: any) =>
                        item.track &&
                        item.track.id &&
                        !item.is_local
                    );

                    console.log(`Found ${validTracks.length} valid tracks out of ${allTracks.length} total items.`);

                    if (validTracks.length === 0) {
                        setFeedbackMessage('No playable tracks found in this playlist.');
                        setIsLoading(false);
                        return;
                    }

                    setCurrentTracks(validTracks);
                    startGame(validTracks);
                } else {
                    console.error('Failed to fetch playlist tracks:', response.statusText);
                    setFeedbackMessage(`Error fetching tracks: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                console.error('Error fetching playlist tracks:', error);
                setFeedbackMessage(`Error: ${error}`);
            } finally {
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
    };

    const playSnippet = async () => {
        if (!targetSong) {
            setFeedbackMessage("No song selected.");
            return;
        }

        setFeedbackMessage("Loading preview...");

        try {
            console.log("No Spotify preview_url, trying iTunes...");
            const artistName = targetSong.artists[0]?.name || "";
            const trackName = targetSong.name;
            let previewUrl = await getItunesPreview(trackName, artistName);

            if (!previewUrl) {
                setFeedbackMessage("No preview available for this track (checked Spotify & iTunes). Try 'Play Again' to skip.");
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
                            <ul>
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
                                    ❤️ Liked Songs
                                </li>
                                {playlists.map((playlist: any) => (
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
                        )}
                        {feedbackMessage && <Typography color="error">{feedbackMessage}</Typography>}
                    </>
                )}

                {gameState === 'playing' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
        </div>
    );
};

export default Home;
