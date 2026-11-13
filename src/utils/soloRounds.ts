import { httpsCallable } from 'firebase/functions';
import { functions } from '../backend/FirebaseConfig';
import { callWithAuthRetry } from './guestSignIn';

export interface SoloRoundAnswer {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string }[];
    };
}

export interface StartSoloRoundResponse {
    roundId: string;
    previewUrl: string;
    snippetDurationMs: number;
    eligibleForPoints: boolean;
    playableTrackCount: number;
}

export interface SubmitSoloGuessResponse {
    result: 'correct' | 'incorrect' | 'out-of-snippet';
    snippetDurationMs: number;
    pointsAwarded: number | null;
    pointsNote?: 'cooldown' | 'daily-cap' | 'ineligible';
    answer?: SoloRoundAnswer;
}

export interface GiveUpSoloRoundResponse {
    answer: SoloRoundAnswer;
}

export const startSoloRound = async (playlistId: string): Promise<StartSoloRoundResponse> => {
    const callable = httpsCallable<{ playlistId: string }, StartSoloRoundResponse>(functions, 'startSoloRound');
    const result = await callWithAuthRetry(() => callable({ playlistId }));
    return result.data;
};

export const submitSoloGuess = async (roundId: string, guess: string): Promise<SubmitSoloGuessResponse> => {
    const callable = httpsCallable<{ roundId: string; guess: string }, SubmitSoloGuessResponse>(functions, 'submitSoloGuess');
    const result = await callWithAuthRetry(() => callable({ roundId, guess }));
    return result.data;
};

export const giveUpSoloRound = async (roundId: string): Promise<GiveUpSoloRoundResponse> => {
    const callable = httpsCallable<{ roundId: string }, GiveUpSoloRoundResponse>(functions, 'giveUpSoloRound');
    const result = await callWithAuthRetry(() => callable({ roundId }));
    return result.data;
};
