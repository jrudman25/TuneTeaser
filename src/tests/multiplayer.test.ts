import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
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

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
}));

vi.mock('../backend/FirebaseConfig', () => ({
    db: 'mock-db',
    functions: 'mock-functions',
}));

describe('multiplayer utils', () => {
    const mockCallable = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockCallable.mockResolvedValue({ data: { roomId: 'ABC234' } });
        vi.mocked(httpsCallable).mockReturnValue(mockCallable);
        vi.mocked(doc).mockReturnValue('room-ref' as any);
        vi.mocked(collection).mockReturnValue('players-collection' as any);
        vi.mocked(orderBy).mockReturnValue('joinedAt-order' as any);
        vi.mocked(query).mockReturnValue('players-query' as any);
    });

    it('calls create room with the room name', async () => {
        const result = await createMultiplayerRoom('Party Room');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'createMultiplayerRoom');
        expect(mockCallable).toHaveBeenCalledWith({ roomName: 'Party Room' });
        expect(result).toEqual({ roomId: 'ABC234' });
    });

    it('calls join room with the room code', async () => {
        await joinMultiplayerRoom('ABC234');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'joinMultiplayerRoom');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234' });
    });

    it('calls leave room with the room code', async () => {
        await leaveMultiplayerRoom('ABC234');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'leaveMultiplayerRoom');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234' });
    });

    it('calls update settings with playlist and point goal values', async () => {
        await updateMultiplayerRoomSettings('ABC234', 'playlist1', 'Hits', 250, 90);

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'updateMultiplayerRoomSettings');
        expect(mockCallable).toHaveBeenCalledWith({
            roomId: 'ABC234',
            playlistId: 'playlist1',
            playlistName: 'Hits',
            pointGoal: 250,
            roundTimerSeconds: 90
        });
    });

    it('calls start game with the room code', async () => {
        await startMultiplayerGame('ABC234');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'startMultiplayerGame');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234' });
    });

    it('calls kick player with the room code and target player', async () => {
        await kickMultiplayerPlayer('ABC234', 'player1');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'kickMultiplayerPlayer');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234', targetUid: 'player1' });
    });

    it('gets round data with the room and round IDs', async () => {
        mockCallable.mockResolvedValueOnce({ data: { roundId: 'round1', previewUrl: 'url', choices: [], artworkUrl: null, artistName: 'Artist', albumName: 'Album' } });

        const result = await getMultiplayerRoundData('ABC234', 'round1');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'getMultiplayerRoundData');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234', roundId: 'round1' });
        expect(result.roundId).toBe('round1');
    });

    it('submits a multiplayer guess with snippet duration', async () => {
        mockCallable.mockResolvedValueOnce({ data: { correct: true, points: 25, snippetDurationMs: 2000, done: true } });

        const result = await submitMultiplayerGuess('ABC234', 'round1', 'Song - Artist', 2000);

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'submitMultiplayerGuess');
        expect(mockCallable).toHaveBeenCalledWith({
            roomId: 'ABC234',
            roundId: 'round1',
            guess: 'Song - Artist',
            snippetDurationMs: 2000
        });
        expect(result.points).toBe(25);
    });

    it('calls round and end-game controls with room context', async () => {
        await giveUpMultiplayerRound('ABC234', 'round1');
        await playMultiplayerAgain('ABC234');
        await returnMultiplayerToLobby('ABC234');

        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'giveUpMultiplayerRound');
        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'playMultiplayerAgain');
        expect(httpsCallable).toHaveBeenCalledWith('mock-functions', 'returnMultiplayerToLobby');
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234', roundId: 'round1' });
        expect(mockCallable).toHaveBeenCalledWith({ roomId: 'ABC234' });
    });

    it('subscribes to a room document and returns null for missing rooms', () => {
        const onRoom = vi.fn();
        const onError = vi.fn();
        const unsubscribe = vi.fn();
        vi.mocked(onSnapshot).mockImplementationOnce((roomRef: any, onNext: any) => {
            onNext({ exists: () => false });
            return unsubscribe;
        });

        const result = subscribeToMultiplayerRoom('ABC234', onRoom, onError);

        expect(doc).toHaveBeenCalledWith('mock-db', 'multiplayerRooms', 'ABC234');
        expect(onSnapshot).toHaveBeenCalledWith('room-ref', expect.any(Function), onError);
        expect(onRoom).toHaveBeenCalledWith(null);
        expect(result).toBe(unsubscribe);
    });

    it('subscribes to players ordered by join time', () => {
        const onPlayers = vi.fn();
        const onError = vi.fn();
        const unsubscribe = vi.fn();
        const players = [
            { uid: 'host123', displayName: 'Host', isHost: true, score: 0, state: 'lobby', joinedAt: 1, updatedAt: 1 },
            { uid: 'player1', displayName: 'Player', isHost: false, score: 10, state: 'lobby', joinedAt: 2, updatedAt: 2 }
        ];
        vi.mocked(onSnapshot).mockImplementationOnce((playersQuery: any, onNext: any) => {
            onNext({ docs: players.map(player => ({ data: () => player })) });
            return unsubscribe;
        });

        const result = subscribeToMultiplayerPlayers('ABC234', onPlayers, onError);

        expect(collection).toHaveBeenCalledWith('mock-db', 'multiplayerRooms', 'ABC234', 'players');
        expect(orderBy).toHaveBeenCalledWith('joinedAt', 'asc');
        expect(query).toHaveBeenCalledWith('players-collection', 'joinedAt-order');
        expect(onSnapshot).toHaveBeenCalledWith('players-query', expect.any(Function), onError);
        expect(onPlayers).toHaveBeenCalledWith(players);
        expect(result).toBe(unsubscribe);
    });
});
