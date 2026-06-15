import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../backend/FirebaseConfig';

/**
 * Returns the direct HTTP URL for a Firebase Cloud Function callable.
 * Used by sendBeacon during page teardown where the SDK's httpsCallable
 * (which relies on fetch) gets aborted by the browser.
 */
export const getFunctionsUrl = (functionName: string): string => {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tuneteaser';
    const isEmulator =
        import.meta.env.DEV &&
        import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

    if (isEmulator) {
        return `http://127.0.0.1:5001/${projectId}/us-central1/${functionName}`;
    }

    return `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`;
};


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
    endedAt?: number;
    winnerUid?: string;
    winnerDisplayName?: string;
    currentRound?: MultiplayerRound;
    revealedRound?: MultiplayerRevealedRound;
}

export interface MultiplayerPlayer {
    uid: string;
    displayName: string;
    isHost: boolean;
    score: number;
    state: 'lobby' | 'guessing' | 'correct' | 'incorrect' | 'gave-up' | 'timed-out';
    joinedAt: number;
    updatedAt: number;
    currentRoundId?: string | null;
    roundSnippetDurationMs?: number | null;
    roundCompletedAt?: number | null;
    lastEarnedPoints?: number | null;
}

export interface MultiplayerRound {
    id: string;
    trackId: string;
    artistName: string;
    albumName: string;
    artworkUrl: string | null;
    startedAt: number;
    snippetDurationMs: number;
    state: 'playing' | 'advancing' | 'completed';
    roundNumber: number;
    completedAt?: number;
}

export interface MultiplayerRevealedRound {
    id: string;
    trackId: string;
    title: string;
    artistName: string;
    albumName: string;
    artworkUrl: string | null;
}

export interface MultiplayerRoundChoice {
    id: string;
    name: string;
    artistName: string;
}

export interface MultiplayerRoundData {
    roundId: string;
    previewUrl: string;
    choices: MultiplayerRoundChoice[];
    artworkUrl: string | null;
    artistName: string;
    albumName: string;
}

export interface SubmitMultiplayerGuessResponse {
    correct: boolean;
    points: number;
    snippetDurationMs: number;
    done: boolean;
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

export const leaveMultiplayerRoom = (roomId: string) => {
    return callRoomFunction('leaveMultiplayerRoom', { roomId });
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

export const getMultiplayerRoundData = async (roomId: string, roundId: string) => {
    const callable = httpsCallable<{ roomId: string; roundId: string }, MultiplayerRoundData>(
        functions,
        'getMultiplayerRoundData'
    );
    const result = await callable({ roomId, roundId });
    return result.data;
};

export const submitMultiplayerGuess = async (
    roomId: string,
    roundId: string,
    guess: string,
    snippetDurationMs: number
) => {
    const callable = httpsCallable<
        { roomId: string; roundId: string; guess: string; snippetDurationMs: number },
        SubmitMultiplayerGuessResponse
    >(functions, 'submitMultiplayerGuess');
    const result = await callable({ roomId, roundId, guess, snippetDurationMs });
    return result.data;
};

export const giveUpMultiplayerRound = (roomId: string, roundId: string) => {
    return callRoomFunction('giveUpMultiplayerRound', { roomId, roundId });
};

export const playMultiplayerAgain = (roomId: string) => {
    return callRoomFunction('playMultiplayerAgain', { roomId });
};

export const returnMultiplayerToLobby = (roomId: string) => {
    return callRoomFunction('returnMultiplayerToLobby', { roomId });
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
