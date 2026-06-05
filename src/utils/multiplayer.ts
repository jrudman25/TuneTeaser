import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../backend/FirebaseConfig';

export type MultiplayerRoomStatus = 'lobby' | 'playing' | 'ended';

export interface MultiplayerRoom {
    id: string;
    roomName: string;
    hostUid: string;
    status: MultiplayerRoomStatus;
    visibility: 'private' | 'public';
    maxPlayers: number;
    pointGoal: number;
    playerCount: number;
    playlistId: string | null;
    playlistName: string | null;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    startedAt?: number;
}

export interface MultiplayerPlayer {
    uid: string;
    displayName: string;
    isHost: boolean;
    score: number;
    state: 'lobby' | 'guessing' | 'correct' | 'incorrect' | 'gave-up' | 'timed-out';
    joinedAt: number;
    updatedAt: number;
}

interface RoomResponse {
    roomId: string;
}

const callRoomFunction = async <TInput>(name: string, input: TInput) => {
    const callable = httpsCallable<TInput, RoomResponse>(functions, name);
    const result = await callable(input);
    return result.data;
};

export const createMultiplayerRoom = (roomName: string) => {
    return callRoomFunction('createMultiplayerRoom', { roomName });
};

export const joinMultiplayerRoom = (roomId: string) => {
    return callRoomFunction('joinMultiplayerRoom', { roomId });
};

export const updateMultiplayerRoomSettings = (
    roomId: string,
    playlistId: string,
    playlistName: string,
    pointGoal: number
) => {
    return callRoomFunction('updateMultiplayerRoomSettings', {
        roomId,
        playlistId,
        playlistName,
        pointGoal
    });
};

export const startMultiplayerGame = (roomId: string) => {
    return callRoomFunction('startMultiplayerGame', { roomId });
};

export const kickMultiplayerPlayer = (roomId: string, targetUid: string) => {
    return callRoomFunction('kickMultiplayerPlayer', { roomId, targetUid });
};

export const subscribeToMultiplayerRoom = (
    roomId: string,
    onRoom: (room: MultiplayerRoom | null) => void,
    onError: (error: Error) => void
) => {
    return onSnapshot(doc(db, 'multiplayerRooms', roomId), snapshot => {
        onRoom(snapshot.exists() ? snapshot.data() as MultiplayerRoom : null);
    }, onError);
};

export const subscribeToMultiplayerPlayers = (
    roomId: string,
    onPlayers: (players: MultiplayerPlayer[]) => void,
    onError: (error: Error) => void
) => {
    const playersQuery = query(
        collection(db, 'multiplayerRooms', roomId, 'players'),
        orderBy('joinedAt', 'asc')
    );

    return onSnapshot(playersQuery, snapshot => {
        onPlayers(snapshot.docs.map(playerDoc => playerDoc.data() as MultiplayerPlayer));
    }, onError);
};
