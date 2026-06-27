import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFunctionsUrl } from '../utils/multiplayer';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { signInAnonymously, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import NavBar from '../components/NavBar';
import ToastMessage from '../components/ToastMessage';

import { auth } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { usePlaylists } from '../hooks/usePlaylists';
import usePreviewPlayer from '../hooks/usePreviewPlayer';
import {
    MultiplayerRoundData,
    MultiplayerPlayer,
    MultiplayerRoom,
    createMultiplayerRoom,
    getMultiplayerRoundData,
    giveUpMultiplayerRound,
    joinMultiplayerRoom,
    kickMultiplayerPlayer,
    leaveMultiplayerRoom,
    playMultiplayerAgain,
    returnMultiplayerToLobby,
    startMultiplayerGame,
    subscribeToMultiplayerPlayers,
    subscribeToMultiplayerRoom,
    submitMultiplayerGuess,
    updateMultiplayerRoomSettings
} from '../utils/multiplayer';

const getFirebaseMessage = (error: unknown, fallback: string) => {
    if (error instanceof FirebaseError) {
        if (
            import.meta.env.DEV
            && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
            && error.code === 'functions/internal'
        ) {
            return 'The local Functions emulator returned an internal error. Restart npm run emulators and check that functions loaded successfully.';
        }

        return error.message;
    }
    if (error instanceof Error) return error.message;
    return fallback;
};

const getDefaultRoomName = () => {
    return localStorage.getItem('multiplayerRoomName') || '';
};

const Multiplayer = () => {
    const navigate = useNavigate();
    const { roomCode: roomCodeParam } = useParams();
    const [searchParams] = useSearchParams();
    const queryRoomId = (searchParams.get('room') || '').toUpperCase();
    const initialRoomId = (roomCodeParam || queryRoomId).toUpperCase();
    const isGuest = searchParams.get('mode') === 'guest';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const effectiveGuest = isGuest || (!!user?.isAnonymous && !accessToken);
    const { manualPlaylists, isLoadingManualPlaylists, manualPlaylistError } = useManualPlaylists(user, effectiveGuest);
    const isManualMode = !effectiveGuest && !!user && !user.isAnonymous;
    const { playlists, isLoadingPlaylists, playlistError } = usePlaylists(accessToken, effectiveGuest, manualPlaylists, isManualMode);
    const [roomName, setRoomName] = useState(getDefaultRoomName);
    const [roomCode, setRoomCode] = useState(initialRoomId);
    const [activeRoomId, setActiveRoomId] = useState(initialRoomId);
    const [room, setRoom] = useState<MultiplayerRoom | null>(null);
    const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [pointGoal, setPointGoal] = useState(100);
    const [roundTimerSeconds, setRoundTimerSeconds] = useState(90);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [playlistSearch, setPlaylistSearch] = useState('');
    const [roundData, setRoundData] = useState<MultiplayerRoundData | null>(null);
    const [roundDataId, setRoundDataId] = useState('');
    const [userGuess, setUserGuess] = useState('');
    const [isGuessFocused, setIsGuessFocused] = useState(false);
    const [roundFeedback, setRoundFeedback] = useState('');
    const { playPreview, pause, isPlaying, error: playerError, volume, setVolume } = usePreviewPlayer();

    const filteredPlaylists = useMemo(() => {
        if (!playlistSearch.trim()) return playlists;
        const query = playlistSearch.toLowerCase();
        return playlists.filter((p: any) => p.name?.toLowerCase().includes(query));
    }, [playlists, playlistSearch]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [hasJoinedActiveRoom, setHasJoinedActiveRoom] = useState(false);

    const currentPlayer = useMemo(() => {
        return players.find(player => player.uid === user?.uid) || null;
    }, [players, user?.uid]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.joinedAt - b.joinedAt;
        });
    }, [players]);
    const guessSuggestions = useMemo(() => {
        const query = userGuess.trim().toLowerCase();
        if (query.length < 2) return [];

        return (roundData?.choices || [])
            .filter(choice => `${choice.name} ${choice.artistName}`.toLowerCase().includes(query))
            .slice(0, 6);
    }, [roundData?.choices, userGuess]);

    const isHost = !!room && room.hostUid === user?.uid;
    const shareUrl = activeRoomId ? `${window.location.origin}/multiplayer/${activeRoomId}` : '';
    const modeQuery = effectiveGuest ? '?mode=guest' : '';
    const isCurrentPlayerGuessing = currentPlayer?.state === 'guessing';
    const activeRoomIdRef = useRef(activeRoomId);
    const currentPlayerRef = useRef(currentPlayer);
    const roomRef = useRef(room);
    const isLeavingRoomRef = useRef(false);
    const leftRoomIdsRef = useRef<Set<string>>(new Set());
    const hadCurrentPlayerRef = useRef(false);
    const homePath = effectiveGuest ? '/home?mode=guest' : '/home';
    const playlistsPath = effectiveGuest ? '/playlists?mode=guest' : '/playlists';
    const toastMessage = error || manualPlaylistError || playlistError || success;
    const toastType = error || manualPlaylistError || playlistError ? 'error' : 'success';

    useEffect(() => {
        activeRoomIdRef.current = activeRoomId;
        currentPlayerRef.current = currentPlayer;
        roomRef.current = room;
    }, [activeRoomId, currentPlayer, room]);

    useEffect(() => {
        if (queryRoomId && !roomCodeParam) {
            navigate(`/multiplayer/${queryRoomId}${modeQuery}`, { replace: true });
        }
    }, [modeQuery, navigate, queryRoomId, roomCodeParam]);

    useEffect(() => {
        const routedRoomId = (roomCodeParam || '').toUpperCase();
        if (!routedRoomId || routedRoomId === activeRoomId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRoomCode(routedRoomId);
        setActiveRoomId(routedRoomId);
        setHasJoinedActiveRoom(false);
        hadCurrentPlayerRef.current = false;
    }, [activeRoomId, roomCodeParam]);

    useEffect(() => {
        if (!isLoadingUser && !user) {
            signInAnonymously(auth).catch(err => {
                setError(getFirebaseMessage(err, 'Could not start guest multiplayer.'));
            });
        }
    }, [isLoadingUser, user]);

    useEffect(() => {
        if (!activeRoomId || !user) return;

        const unsubscribeRoom = subscribeToMultiplayerRoom(activeRoomId, setRoom, err => {
            setError(getFirebaseMessage(err, 'Could not load room.'));
        });
        const unsubscribePlayers = subscribeToMultiplayerPlayers(activeRoomId, setPlayers, err => {
            setError(getFirebaseMessage(err, 'Could not load players.'));
        });

        return () => {
            unsubscribeRoom();
            unsubscribePlayers();
        };
    }, [activeRoomId, user]);

    useEffect(() => {
        if (!room) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedPlaylistId(room.playlistId || '');
        setSelectedPlaylistName(room.playlistName || '');
        setPointGoal(room.pointGoal || 100);
        setRoundTimerSeconds(room.roundTimerSeconds || 90);
    }, [room]);

    // Countdown timer: computes time remaining from the synced endsAt timestamp
    useEffect(() => {
        const endsAt = room?.currentRound?.endsAt;
        if (!endsAt || room?.status !== 'playing' || room?.currentRound?.state !== 'playing') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTimeRemaining(null);
            return;
        }

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            setTimeRemaining(remaining);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [room?.currentRound?.endsAt, room?.currentRound?.state, room?.status]);

    // Reveal countdown: ticks down from advancesAt when round is advancing between rounds
    const [revealTimeRemaining, setRevealTimeRemaining] = useState<number | null>(null);
    useEffect(() => {
        const advancesAt = room?.currentRound?.advancesAt;
        if (!advancesAt || room?.currentRound?.state !== 'advancing') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRevealTimeRemaining(null);
            return;
        }

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((advancesAt - Date.now()) / 1000));
            setRevealTimeRemaining(remaining);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [room?.currentRound?.advancesAt, room?.currentRound?.state]);

    // Auto-give-up when timer reaches 0
    const autoGiveUpFiredRef = useRef('');
    useEffect(() => {
        const roundId = room?.currentRound?.id;
        if (timeRemaining !== 0 || !roundId || !activeRoomId || !isCurrentPlayerGuessing) return;
        if (autoGiveUpFiredRef.current === roundId) return;

        autoGiveUpFiredRef.current = roundId;
        setRoundFeedback("Time's up!");
        pause();
        giveUpMultiplayerRound(activeRoomId, roundId).catch(err => {
            setError(getFirebaseMessage(err, 'Could not give up.'));
        });
    }, [timeRemaining, room?.currentRound?.id, activeRoomId, isCurrentPlayerGuessing, pause]);

    useEffect(() => {
        const roundId = room?.currentRound?.id || '';
        if (!activeRoomId || !currentPlayer || room?.status !== 'playing' || !roundId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRoundData(null);
            setRoundDataId('');
            setUserGuess('');
            setRoundFeedback('');
            pause();
            return;
        }

        if (roundDataId === roundId && roundData) return;

        let isCancelled = false;
        setRoundData(null);
        setRoundFeedback('Loading round...');
        setUserGuess('');
        pause();

        getMultiplayerRoundData(activeRoomId, roundId)
            .then(data => {
                if (isCancelled) return;
                setRoundData(data);
                setRoundDataId(roundId);
                setRoundFeedback('');
            })
            .catch(err => {
                if (isCancelled) return;
                setError(getFirebaseMessage(err, 'Could not load round.'));
                setRoundFeedback('');
            });

        return () => {
            isCancelled = true;
        };
    }, [activeRoomId, currentPlayer, pause, room?.currentRound?.id, room?.status, roundData, roundDataId]);

    useEffect(() => {
        if (!hasJoinedActiveRoom || !activeRoomId || !user || isLoadingUser || currentPlayer || players.length === 0) return;
        if (!hadCurrentPlayerRef.current) return;
        setHasJoinedActiveRoom(false);
        hadCurrentPlayerRef.current = false;
        setActiveRoomId('');
        setRoom(null);
        setPlayers([]);
        navigate('/multiplayer', { replace: true });
        setSuccess('');
        setError('You were removed from the room.');
    }, [activeRoomId, currentPlayer, hasJoinedActiveRoom, isLoadingUser, navigate, players.length, user]);

    useEffect(() => {
        if (currentPlayer) {
            hadCurrentPlayerRef.current = true;
        }
    }, [currentPlayer]);

    const leaveActiveLobby = useCallback(async () => {
        const roomId = activeRoomIdRef.current;
        const activePlayer = currentPlayerRef.current;

        if (!roomId || !activePlayer || isLeavingRoomRef.current || leftRoomIdsRef.current.has(roomId)) return false;

        isLeavingRoomRef.current = true;

        try {
            await leaveMultiplayerRoom(roomId);
            leftRoomIdsRef.current.add(roomId);
            return true;
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not leave room.'));
            return false;
        } finally {
            isLeavingRoomRef.current = false;
        }
    }, []);

    useEffect(() => {
        return () => {
            void leaveActiveLobby();
        };
    }, [leaveActiveLobby]);

    // Pre-cache the auth token so the page-exit handler can fire synchronously.
    // getIdToken() is async and would not resolve during beforeunload/pagehide.
    const cachedTokenRef = useRef('');
    useEffect(() => {
        if (!activeRoomId || !currentPlayer) {
            cachedTokenRef.current = '';
            return;
        }
        const refreshToken = () => {
            auth.currentUser?.getIdToken().then(token => {
                cachedTokenRef.current = token;
            }).catch(() => { });
        };
        refreshToken();
        // Firebase tokens expire after ~1 hour; refresh every 50 minutes while in lobby
        const interval = setInterval(refreshToken, 50 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeRoomId, currentPlayer]);

    // Best-effort leave on full page exit (tab close, refresh, external navigation).
    // SPA navigation is handled by the cleanup effect above; this covers browser-level exits
    // where the JS context is torn down before the async leave call can complete.
    useEffect(() => {
        const handlePageExit = () => {
            const roomId = activeRoomIdRef.current;
            const activePlayer = currentPlayerRef.current;
            const token = cachedTokenRef.current;

            if (!roomId || !activePlayer || leftRoomIdsRef.current.has(roomId) || !token) return;

            // fetch with keepalive survives page teardown and supports Authorization headers
            // (sendBeacon cannot set custom headers).
            const url = getFunctionsUrl('leaveMultiplayerRoom');
            const body = JSON.stringify({ data: { roomId } });
            fetch(url, {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                keepalive: true
            }).catch(() => { });
        };

        // pagehide fires on tab close and navigation; beforeunload is the fallback
        window.addEventListener('pagehide', handlePageExit);
        window.addEventListener('beforeunload', handlePageExit);

        return () => {
            window.removeEventListener('pagehide', handlePageExit);
            window.removeEventListener('beforeunload', handlePageExit);
        };
    }, []);

    const ensureSignedIn = async () => {
        const currentUser = auth.currentUser || (await signInAnonymously(auth)).user;

        await currentUser.getIdToken();
    };

    const handleCreateRoom = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            const trimmedRoomName = roomName.trim();
            if (!trimmedRoomName) {
                setError('Enter a room name first.');
                return;
            }
            localStorage.setItem('multiplayerRoomName', trimmedRoomName);
            await ensureSignedIn();
            const result = await createMultiplayerRoom(trimmedRoomName);
            leftRoomIdsRef.current.delete(result.roomId);
            setActiveRoomId(result.roomId);
            setRoomCode(result.roomId);
            setHasJoinedActiveRoom(true);
            navigate(`/multiplayer/${result.roomId}${modeQuery}`, { replace: true });
            setSuccess('Room created. Share the code or link with players.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not create room.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleJoinRoom = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await ensureSignedIn();
            const result = await joinMultiplayerRoom(roomCode);
            leftRoomIdsRef.current.delete(result.roomId);
            setActiveRoomId(result.roomId);
            setHasJoinedActiveRoom(true);
            navigate(`/multiplayer/${result.roomId}${modeQuery}`, { replace: true });
            setSuccess('Joined room.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not join room.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleJoinActiveRoom = async () => {
        if (!activeRoomId) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await ensureSignedIn();
            const result = await joinMultiplayerRoom(activeRoomId);
            leftRoomIdsRef.current.delete(result.roomId);
            setRoomCode(result.roomId);
            setHasJoinedActiveRoom(true);
            setSuccess('Joined room.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not join room.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleSelectPlaylist = async (playlistId: string) => {
        const playlistName = playlistId === 'LIKED_SONGS'
            ? 'Liked Songs'
            : playlists.find((playlist: any) => playlist.id === playlistId)?.name || '';

        setSelectedPlaylistId(playlistId);
        setSelectedPlaylistName(playlistName);

        if (!activeRoomId || !playlistName) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await updateMultiplayerRoomSettings(activeRoomId, playlistId, playlistName, pointGoal, roundTimerSeconds);
            setSuccess(`Playlist set to ${playlistName}.`);
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not update room settings.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!activeRoomId || !selectedPlaylistId || !selectedPlaylistName) {
            setError('Pick a playlist before saving settings.');
            return;
        }

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await updateMultiplayerRoomSettings(activeRoomId, selectedPlaylistId, selectedPlaylistName, pointGoal, roundTimerSeconds);
            setSuccess('Room settings saved.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not save settings.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleStartGame = async () => {
        if (!activeRoomId) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await startMultiplayerGame(activeRoomId);
            setSuccess('Game started.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not start game.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handlePlayRoundSnippet = () => {
        const snippetDuration = currentPlayer?.roundSnippetDurationMs || room?.currentRound?.snippetDurationMs || 2000;
        if (!roundData?.previewUrl) {
            setRoundFeedback('Round audio is still loading.');
            return;
        }

        setRoundFeedback('');
        playPreview(roundData.previewUrl, snippetDuration);
    };

    const handleSubmitRoundGuess = async () => {
        const roundId = room?.currentRound?.id;
        const snippetDuration = currentPlayer?.roundSnippetDurationMs || room?.currentRound?.snippetDurationMs || 2000;
        if (!activeRoomId || !roundId || !currentPlayer) return;

        setError('');
        setRoundFeedback('');
        setIsBusy(true);

        try {
            const result = await submitMultiplayerGuess(activeRoomId, roundId, userGuess, snippetDuration);
            if (result.correct) {
                setRoundFeedback(`Correct! +${result.points} pts`);
            } else if (result.done) {
                setRoundFeedback('Round complete. Waiting for the next song.');
            } else {
                setRoundFeedback(`Incorrect. Snippet is now ${result.snippetDurationMs / 1000} seconds.`);
            }
            setUserGuess('');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not submit guess.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleGiveUpRound = async () => {
        const roundId = room?.currentRound?.id;
        if (!activeRoomId || !roundId) return;

        setError('');
        setIsBusy(true);

        try {
            await giveUpMultiplayerRound(activeRoomId, roundId);
            setRoundFeedback('You gave up. Waiting for the next song.');
            pause();
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not give up.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handlePlayAgain = async () => {
        if (!activeRoomId) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await playMultiplayerAgain(activeRoomId);
            setSuccess('Starting a new game.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not start again.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleReturnToLobby = async () => {
        if (!activeRoomId) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await returnMultiplayerToLobby(activeRoomId);
            setSuccess('Returned to lobby.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not return to lobby.'));
        } finally {
            setIsBusy(false);
        }
    };

    const handleKickPlayer = async (targetUid: string) => {
        if (!activeRoomId) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            await kickMultiplayerPlayer(activeRoomId, targetUid);
            setSuccess('Player removed.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not remove player.'));
        } finally {
            setIsBusy(false);
        }
    };

    const resetLocalRoomState = useCallback(() => {
        setHasJoinedActiveRoom(false);
        setActiveRoomId('');
        setRoomCode('');
        setRoom(null);
        setPlayers([]);
    }, []);

    const handleLeaveRoom = async () => {
        if (!activeRoomId || !currentPlayer) return;

        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            const didLeave = await leaveActiveLobby();
            if (!didLeave) return;
            resetLocalRoomState();
            navigate(`/multiplayer${modeQuery}`, { replace: true });
            setSuccess(isHost ? 'Room closed.' : 'You left the room.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleNavigateAway = async (to: string) => {
        await leaveActiveLobby();
        navigate(to);
    };

    const handleLogout = async () => {
        await leaveActiveLobby();
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        try {
            await signOut(auth);
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not sign out.'));
            return;
        }

        navigate('/');
    };

    const navActionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={playlistsPath} onClick={(event) => {
                event.preventDefault();
                void handleNavigateAway(playlistsPath);
            }}>
                Manage Playlists
            </Link>
            {currentPlayer && room?.status === 'lobby' && (
                <button className="button button-danger" type="button" disabled={isBusy} onClick={handleLeaveRoom}>
                    {isHost ? 'Close room' : 'Leave room'}
                </button>
            )}
            {(user || isLoadingUser) && (
                <button className="button button-danger" type="button" disabled={isBusy} onClick={handleLogout}>
                    {effectiveGuest ? 'Exit Guest Mode' : 'Sign Out'}
                </button>
            )}
        </div>
    );

    return (
        <>
            <NavBar actionButtons={navActionButtons} onNavigate={handleNavigateAway} />
            <main className="page home-page multiplayer-page">
                <section className="record-bin multiplayer-panel">
                    <span className="eyebrow">Party mode</span>
                    <h1 className="section-title">{activeRoomId ? 'Game room' : 'Multiplayer lobby'}</h1>
                    <p className="body-copy">
                        {activeRoomId
                            ? 'Share the room link with players and get ready to play.'
                            : 'Create a local party room, share the code, and let players join from their phones. The host device controls the music.'}
                    </p>

                    <ToastMessage
                        message={toastMessage}
                        type={toastType}
                        onClose={() => {
                            setError('');
                            setSuccess('');
                        }}
                    />

                    {!activeRoomId && (
                        <div className="multiplayer-grid">
                            <form className="multiplayer-card" onSubmit={handleCreateRoom}>
                                <span className="eyebrow">Host</span>
                                <h2>Create a room</h2>
                                <label className="form-label" htmlFor="room-name">Room name</label>
                                <input
                                    id="room-name"
                                    className="text-input"
                                    value={roomName}
                                    maxLength={40}
                                    onChange={event => setRoomName(event.target.value)}
                                    placeholder="Jess's Birthday Bash"
                                />
                                <p className="body-copy">Players will appear by their TuneTeaser username.</p>
                                <button className="button button-secondary" type="submit" disabled={isBusy || isLoadingUser}>
                                    Create room
                                </button>
                            </form>

                            <form className="multiplayer-card" onSubmit={handleJoinRoom}>
                                <span className="eyebrow">Join</span>
                                <h2>Enter a code</h2>
                                <label className="form-label" htmlFor="room-code">Room code</label>
                                <input
                                    id="room-code"
                                    className="text-input multiplayer-code-input"
                                    value={roomCode}
                                    maxLength={6}
                                    onChange={event => setRoomCode(event.target.value.toUpperCase())}
                                    placeholder="ABC123"
                                />
                                <button className="button button-secondary" type="submit" disabled={isBusy || isLoadingUser}>
                                    Join game
                                </button>
                            </form>
                        </div>
                    )}

                    {activeRoomId && room && (
                        <section className="multiplayer-lobby">
                            <div className="multiplayer-lobby-header">
                                <div>
                                    <span className="eyebrow">Room code: {activeRoomId}</span>
                                    <h2 className="section-title">{room.roomName || (room.status === 'playing' ? 'Game in progress' : 'Lobby')}</h2>
                                    <p className="body-copy">{room.status === 'playing' ? 'Game in progress' : 'Lobby'}</p>
                                    <p className="body-copy">{room.playerCount} / {room.maxPlayers} players joined</p>
                                    {currentPlayer && room.status === 'lobby' && (
                                        <button className="button button-danger" type="button" disabled={isBusy} onClick={handleLeaveRoom}>
                                            {isHost ? 'Close room' : 'Leave room'}
                                        </button>
                                    )}
                                </div>
                                <div className="multiplayer-share-box">
                                    <strong>Share link</strong>
                                    <input className="text-input" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} />
                                    <button className="button button-quiet" type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                                        Copy link
                                    </button>
                                </div>
                            </div>

                            {!currentPlayer && (
                                <div className="multiplayer-card">
                                    <span className="eyebrow">Invite</span>
                                    <h2>Join this room</h2>
                                    <p className="body-copy">You are viewing this room, but you have not joined it yet.</p>
                                    <button className="button button-secondary" type="button" disabled={isBusy || isLoadingUser} onClick={handleJoinActiveRoom}>
                                        Join room
                                    </button>
                                </div>
                            )}

                            {currentPlayer && room.status === 'lobby' && (
                                <div className="multiplayer-grid">
                                    <div className="multiplayer-card">
                                        <span className="eyebrow">Players</span>
                                        <h2>Who's here</h2>
                                        <p className="body-copy">{players.length} of {room.maxPlayers} spots filled.</p>
                                        <ul className="multiplayer-player-list">
                                            {sortedPlayers.map(player => (
                                                <li key={player.uid}>
                                                    <div>
                                                        <strong>{player.displayName}</strong>
                                                        <span>{player.isHost ? `Host · ${player.score} pts` : `${player.score} pts`}</span>
                                                    </div>
                                                    {isHost && !player.isHost && (
                                                        <button className="button button-danger" type="button" disabled={isBusy} onClick={() => handleKickPlayer(player.uid)}>
                                                            Kick
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="multiplayer-card">
                                        <span className="eyebrow">Settings</span>
                                        <h2>Game options</h2>
                                        <label className="form-label" htmlFor="point-goal">Point goal</label>
                                        <input
                                            id="point-goal"
                                            className="text-input"
                                            type="number"
                                            min="10"
                                            max="1000"
                                            step="5"
                                            value={pointGoal}
                                            disabled={!isHost}
                                            onChange={event => setPointGoal(Number(event.target.value))}
                                        />
                                        <label className="form-label" htmlFor="round-timer">Round timer (seconds)</label>
                                        <input
                                            id="round-timer"
                                            className="text-input"
                                            type="number"
                                            min="15"
                                            max="300"
                                            step="5"
                                            value={roundTimerSeconds}
                                            disabled={!isHost}
                                            onChange={event => setRoundTimerSeconds(Number(event.target.value))}
                                        />
                                        <p className="body-copy">Playlist: <strong>{selectedPlaylistName || 'Not selected yet'}</strong></p>
                                        {isHost ? (
                                            <>
                                                <div className="multiplayer-playlist-picker">
                                                    <label className="form-label" htmlFor="playlist-search">Choose a playlist</label>
                                                    <input
                                                        id="playlist-search"
                                                        className="text-input"
                                                        type="text"
                                                        placeholder="Search playlists..."
                                                        value={playlistSearch}
                                                        onChange={event => setPlaylistSearch(event.target.value)}
                                                    />
                                                    {(isLoadingPlaylists || isLoadingManualPlaylists) ? (
                                                        <div className="multiplayer-playlist-empty">Loading playlists...</div>
                                                    ) : filteredPlaylists.length === 0 ? (
                                                        <div className="multiplayer-playlist-empty">
                                                            {playlistSearch ? `No playlists matching "${playlistSearch}"` : 'No playlists available.'}
                                                        </div>
                                                    ) : (
                                                        <ul className="multiplayer-playlist-list">
                                                            {!(effectiveGuest || isManualMode) && !playlistSearch && (
                                                                <li>
                                                                    <button
                                                                        className={`multiplayer-playlist-item${selectedPlaylistId === 'LIKED_SONGS' ? ' multiplayer-playlist-item-active' : ''}`}
                                                                        type="button"
                                                                        onClick={() => handleSelectPlaylist('LIKED_SONGS')}
                                                                        disabled={isBusy}
                                                                    >
                                                                        <span className="multiplayer-playlist-item-name">Liked Songs</span>
                                                                        <span className="multiplayer-playlist-item-meta">Library</span>
                                                                    </button>
                                                                </li>
                                                            )}
                                                            {filteredPlaylists.map((playlist: any) => (
                                                                <li key={playlist.id}>
                                                                    <button
                                                                        className={`multiplayer-playlist-item${selectedPlaylistId === playlist.id ? ' multiplayer-playlist-item-active' : ''}`}
                                                                        type="button"
                                                                        onClick={() => handleSelectPlaylist(playlist.id)}
                                                                        disabled={isBusy || playlist.status === 'importing'}
                                                                    >
                                                                        <span className="multiplayer-playlist-item-name">{playlist.name}</span>
                                                                        <span className="multiplayer-playlist-item-meta">
                                                                            {playlist.tracks?.total ?? playlist.tracks?.length ?? 0} tracks
                                                                        </span>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <div className="action-row">
                                                    <button className="button button-secondary" type="button" disabled={isBusy || !selectedPlaylistId} onClick={handleSaveSettings}>
                                                        Save settings
                                                    </button>
                                                    <button className="button button-secondary" type="button" disabled={isBusy || !selectedPlaylistId} onClick={handleStartGame}>
                                                        Start game
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="body-copy">Waiting for the host to pick a playlist and start.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentPlayer && room.status === 'playing' && (
                                <div className="multiplayer-grid">
                                    <div className="multiplayer-card multiplayer-game-card">
                                        <span className="eyebrow">Round {room.currentRound?.roundNumber || 1}</span>
                                        <h2>Guess the song</h2>
                                        <p className="body-copy">Playlist: <strong>{room.playlistName}</strong></p>
                                        <span className="snippet-meter">
                                            Snippet length: {(currentPlayer.roundSnippetDurationMs || room.currentRound?.snippetDurationMs || 2000) / 1000} seconds
                                        </span>

                                        {timeRemaining !== null && (
                                            <span className={`round-timer${timeRemaining <= 10 ? ' round-timer-urgent' : ''}`}>
                                                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                                            </span>
                                        )}

                                        <div className="volume-console">
                                            <label className="form-label" htmlFor="multiplayer-volume">Volume</label>
                                            <input
                                                id="multiplayer-volume"
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={Math.round(volume * 100)}
                                                onChange={event => setVolume(Number(event.target.value) / 100)}
                                            />
                                        </div>

                                        {playerError && <div className="error-banner"><strong>Error:</strong> {playerError}</div>}

                                        <div className="play-row">
                                            <button className="button button-large" type="button" disabled={isPlaying || !roundData?.previewUrl} onClick={handlePlayRoundSnippet}>
                                                Play Snippet
                                            </button>
                                            {isPlaying && <span className="playing-badge">Playing...</span>}
                                        </div>

                                        <div className="guess-row">
                                            <div className="guess-input-wrap">
                                                <input
                                                    className="text-input guess-input"
                                                    value={userGuess}
                                                    disabled={isBusy || !isCurrentPlayerGuessing}
                                                    onBlur={() => window.setTimeout(() => setIsGuessFocused(false), 120)}
                                                    onChange={event => setUserGuess(event.target.value)}
                                                    onFocus={() => setIsGuessFocused(true)}
                                                    onKeyDown={event => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            void handleSubmitRoundGuess();
                                                        }
                                                    }}
                                                    placeholder="Enter song title..."
                                                />
                                                {isGuessFocused && guessSuggestions.length > 0 && (
                                                    <ul className="guess-suggestion-list">
                                                        {guessSuggestions.map(choice => {
                                                            const value = `${choice.name} - ${choice.artistName}`;
                                                            return (
                                                                <li key={choice.id}>
                                                                    <button
                                                                        type="button"
                                                                        onMouseDown={event => event.preventDefault()}
                                                                        onClick={() => {
                                                                            setUserGuess(value);
                                                                            setIsGuessFocused(false);
                                                                        }}
                                                                    >
                                                                        {value}
                                                                    </button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                            <button
                                                className="button button-tertiary"
                                                type="button"
                                                disabled={isBusy || !isCurrentPlayerGuessing}
                                                onClick={handleSubmitRoundGuess}
                                            >
                                                Guess
                                            </button>
                                        </div>

                                        {room.currentRound?.state === 'advancing' && room.revealedRound ? (
                                            <div className="round-reveal-banner">
                                                <span className="eyebrow">Answer revealed</span>
                                                <h3 className="reveal-title">{room.revealedRound.title}</h3>
                                                <p className="reveal-artist">by {room.revealedRound.artistName}</p>
                                                {revealTimeRemaining !== null && revealTimeRemaining > 0 && (
                                                    <span className="reveal-countdown">Next round in {revealTimeRemaining}...</span>
                                                )}
                                                {revealTimeRemaining === 0 && (
                                                    <span className="reveal-countdown">Starting next round...</span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {room.revealedRound && (
                                                    <div className="feedback-pill">
                                                        Answer: {room.revealedRound.title} by {room.revealedRound.artistName}
                                                    </div>
                                                )}
                                                {roundFeedback && <div className="feedback-pill">{roundFeedback}</div>}

                                                <div className="give-up-zone">
                                                    <span className="helper-text">Stuck on this round?</span>
                                                    <button
                                                        className="button button-danger"
                                                        type="button"
                                                        disabled={isBusy || !isCurrentPlayerGuessing}
                                                        onClick={handleGiveUpRound}
                                                    >
                                                        Give Up
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="multiplayer-card">
                                        <span className="eyebrow">Scoreboard</span>
                                        <h2>First to {room.pointGoal}</h2>
                                        <ul className="multiplayer-player-list">
                                            {sortedPlayers.map(player => (
                                                <li key={player.uid}>
                                                    <div>
                                                        <strong>{player.displayName}</strong>
                                                        <span>
                                                            {player.score} pts
                                                            {player.currentRoundId === room.currentRound?.id && player.state === 'correct' ? ' · Correct' : ''}
                                                            {player.currentRoundId === room.currentRound?.id && player.state === 'gave-up' ? ' · Gave up' : ''}
                                                            {player.currentRoundId === room.currentRound?.id && player.state === 'timed-out' ? ' · Timed out' : ''}
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {currentPlayer && room.status === 'ended' && (
                                <div className="multiplayer-grid">
                                    <div className="multiplayer-card">
                                        <span className="eyebrow">Game over</span>
                                        <h2>{room.winnerDisplayName || 'A player'} wins!</h2>
                                        {room.revealedRound && (
                                            <p className="body-copy">Final answer: <strong>{room.revealedRound.title}</strong> by {room.revealedRound.artistName}</p>
                                        )}
                                        {isHost ? (
                                            <div className="action-row">
                                                <button className="button button-secondary" type="button" disabled={isBusy} onClick={handlePlayAgain}>
                                                    Play again
                                                </button>
                                                <button className="button button-tertiary" type="button" disabled={isBusy} onClick={handleReturnToLobby}>
                                                    Return to lobby
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="body-copy">Waiting for the host to choose what happens next.</p>
                                        )}
                                    </div>

                                    <div className="multiplayer-card">
                                        <span className="eyebrow">Final scores</span>
                                        <h2>Scoreboard</h2>
                                        <ul className="multiplayer-player-list">
                                            {sortedPlayers.map(player => (
                                                <li key={player.uid}>
                                                    <div>
                                                        <strong>{player.displayName}</strong>
                                                        <span>{player.score} pts</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {!activeRoomId && (
                        <p className="body-copy">Public lobbies are intentionally skipped for the MVP. Private codes are safer and cheaper while the feature is new.</p>
                    )}

                    <div className="action-row">
                        <Link className="button button-quiet" to={homePath} onClick={(event) => {
                            event.preventDefault();
                            void handleNavigateAway(homePath);
                        }}>Back home</Link>
                    </div>
                </section>
            </main>
        </>
    );
};

export default Multiplayer;
