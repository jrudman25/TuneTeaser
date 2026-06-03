import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import NavBar from '../components/NavBar';
import PlaylistMenu from '../components/PlaylistMenu';
import { auth } from '../backend/FirebaseConfig';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { usePlaylists } from '../hooks/usePlaylists';
import {
    MultiplayerPlayer,
    MultiplayerRoom,
    createMultiplayerRoom,
    joinMultiplayerRoom,
    kickMultiplayerPlayer,
    startMultiplayerGame,
    subscribeToMultiplayerPlayers,
    subscribeToMultiplayerRoom,
    updateMultiplayerRoomSettings
} from '../utils/multiplayer';

const getFirebaseMessage = (error: unknown, fallback: string) => {
    if (error instanceof FirebaseError) return error.message;
    if (error instanceof Error) return error.message;
    return fallback;
};

const getDefaultDisplayName = () => {
    return localStorage.getItem('multiplayerDisplayName') || '';
};

const Multiplayer = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialRoomId = (searchParams.get('room') || '').toUpperCase();
    const isGuest = searchParams.get('mode') === 'guest';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const effectiveGuest = isGuest || (!!user?.isAnonymous && !accessToken);
    const { manualPlaylists, isLoadingManualPlaylists, manualPlaylistError } = useManualPlaylists(user, effectiveGuest);
    const isManualMode = !effectiveGuest && !!user && !user.isAnonymous;
    const { playlists, isLoadingPlaylists, playlistError } = usePlaylists(accessToken, effectiveGuest, manualPlaylists, isManualMode);
    const [displayName, setDisplayName] = useState(getDefaultDisplayName);
    const [roomCode, setRoomCode] = useState(initialRoomId);
    const [activeRoomId, setActiveRoomId] = useState(initialRoomId);
    const [room, setRoom] = useState<MultiplayerRoom | null>(null);
    const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
    const [selectedPlaylistName, setSelectedPlaylistName] = useState('');
    const [pointGoal, setPointGoal] = useState(100);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [hasJoinedActiveRoom, setHasJoinedActiveRoom] = useState(false);

    const currentPlayer = useMemo(() => {
        return players.find(player => player.uid === user?.uid) || null;
    }, [players, user?.uid]);

    const isHost = !!room && room.hostUid === user?.uid;
    const shareUrl = activeRoomId ? `${window.location.origin}/multiplayer?room=${activeRoomId}` : '';
    const modeQuery = effectiveGuest ? '&mode=guest' : '';

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
        setSelectedPlaylistId(room.playlistId || '');
        setSelectedPlaylistName(room.playlistName || '');
        setPointGoal(room.pointGoal || 100);
    }, [room]);

    useEffect(() => {
        if (!hasJoinedActiveRoom || !activeRoomId || !user || isLoadingUser || currentPlayer || players.length === 0) return;
        setError('You are no longer in this room. Ask the host for a new invite if you were kicked.');
    }, [activeRoomId, currentPlayer, hasJoinedActiveRoom, isLoadingUser, players.length, user]);

    const ensureReady = async () => {
        const trimmedName = displayName.trim();
        if (!trimmedName) {
            setError('Enter a display name first.');
            return null;
        }

        localStorage.setItem('multiplayerDisplayName', trimmedName);

        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }

        return trimmedName;
    };

    const handleCreateRoom = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');
        setIsBusy(true);

        try {
            const trimmedName = await ensureReady();
            if (!trimmedName) return;
            const result = await createMultiplayerRoom(trimmedName);
            setActiveRoomId(result.roomId);
            setRoomCode(result.roomId);
            setHasJoinedActiveRoom(true);
            navigate(`/multiplayer?room=${result.roomId}${modeQuery}`, { replace: true });
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
            const trimmedName = await ensureReady();
            if (!trimmedName) return;
            const result = await joinMultiplayerRoom(roomCode, trimmedName);
            setActiveRoomId(result.roomId);
            setHasJoinedActiveRoom(true);
            navigate(`/multiplayer?room=${result.roomId}${modeQuery}`, { replace: true });
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
            await updateMultiplayerRoomSettings(activeRoomId, playlistId, playlistName, pointGoal);
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
            await updateMultiplayerRoomSettings(activeRoomId, selectedPlaylistId, selectedPlaylistName, pointGoal);
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
            setSuccess('Game started. Round gameplay is the next implementation step.');
        } catch (err) {
            setError(getFirebaseMessage(err, 'Could not start game.'));
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

    return (
        <>
            <NavBar />
            <main className="page home-page multiplayer-page">
                <section className="record-bin multiplayer-panel">
                    <span className="eyebrow">Party mode</span>
                    <h1 className="section-title">Multiplayer lobby</h1>
                    <p className="body-copy">Create a local party room, share the code, and let players join from their phones. The host device controls the music.</p>

                    {error && <div className="error-banner"><strong>Error:</strong> {error}</div>}
                    {success && <div className="success-banner">{success}</div>}
                    {manualPlaylistError && <div className="error-banner"><strong>Error:</strong> {manualPlaylistError}</div>}
                    {playlistError && <div className="error-banner"><strong>Error:</strong> {playlistError}</div>}

                    <div className="multiplayer-grid">
                        <form className="multiplayer-card" onSubmit={handleCreateRoom}>
                            <span className="playlist-label">Host</span>
                            <h2>Create a room</h2>
                            <label className="form-label" htmlFor="display-name">Display name</label>
                            <input
                                id="display-name"
                                className="text-input"
                                value={displayName}
                                maxLength={32}
                                onChange={event => setDisplayName(event.target.value)}
                                placeholder="DJ Jazzy Jess"
                            />
                            <button className="button button-secondary" type="submit" disabled={isBusy || isLoadingUser}>
                                Create room
                            </button>
                        </form>

                        <form className="multiplayer-card" onSubmit={handleJoinRoom}>
                            <span className="playlist-label">Join</span>
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
                            <button className="button button-tertiary" type="submit" disabled={isBusy || isLoadingUser}>
                                Join game
                            </button>
                        </form>
                    </div>

                    {activeRoomId && room && (
                        <section className="multiplayer-lobby">
                            <div className="multiplayer-lobby-header">
                                <div>
                                    <span className="eyebrow">Room {activeRoomId}</span>
                                    <h2 className="section-title">{room.status === 'playing' ? 'Game in progress' : 'Lobby'}</h2>
                                    <p className="body-copy">{room.playerCount} / {room.maxPlayers} players joined</p>
                                </div>
                                <div className="multiplayer-share-box">
                                    <strong>Share link</strong>
                                    <input className="text-input" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} />
                                    <button className="button button-quiet" type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
                                        Copy link
                                    </button>
                                </div>
                            </div>

                            <div className="multiplayer-grid">
                                <div className="multiplayer-card">
                                    <span className="playlist-label">Players</span>
                                    <ul className="multiplayer-player-list">
                                        {players.map(player => (
                                            <li key={player.uid}>
                                                <div>
                                                    <strong>{player.displayName}</strong>
                                                    <span>{player.isHost ? 'Host' : `${player.score} pts`}</span>
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
                                    <span className="playlist-label">Settings</span>
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
                                    <p className="body-copy">Playlist: <strong>{selectedPlaylistName || 'Not selected yet'}</strong></p>
                                    {isHost ? (
                                        <div className="action-row">
                                            <button className="button button-secondary" type="button" disabled={isBusy || !selectedPlaylistId} onClick={handleSaveSettings}>
                                                Save settings
                                            </button>
                                            <button className="button button-tertiary" type="button" disabled={isBusy || !selectedPlaylistId} onClick={handleStartGame}>
                                                Start game
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="body-copy">Waiting for the host to pick a playlist and start.</p>
                                    )}
                                </div>
                            </div>

                            {isHost && (
                                <PlaylistMenu
                                    playlists={playlists}
                                    isLoading={isLoadingPlaylists || isLoadingManualPlaylists}
                                    onSelectPlaylist={handleSelectPlaylist}
                                    isGuest={effectiveGuest || isManualMode}
                                />
                            )}

                            {room.status === 'playing' && (
                                <div className="success-banner">
                                    Lobby state is live. The next step is adding synchronized rounds, guesses, scoring, and game-end handling.
                                </div>
                            )}
                        </section>
                    )}

                    {!activeRoomId && (
                        <p className="body-copy">Public lobbies are intentionally skipped for the MVP. Private codes are safer and cheaper while the feature is new.</p>
                    )}

                    <div className="action-row">
                        <Link className="button button-quiet" to={effectiveGuest ? '/home?mode=guest' : '/home'}>Back home</Link>
                    </div>
                </section>
            </main>
        </>
    );
};

export default Multiplayer;
