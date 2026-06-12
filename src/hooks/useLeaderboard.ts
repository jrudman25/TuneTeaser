/**
 * useLeaderboard.ts
 * Firestore integration for the leaderboard system.
 * Reads the top players in real-time and allows submitting scores.
 * @version 2026.05.27
 */
import { useCallback, useEffect, useState } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    limit,
    where,
    getCountFromServer
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../backend/FirebaseConfig';

export interface LeaderboardEntry {
    uid: string;
    displayName: string;
    totalPoints: number;
    gamesWon: number;
}

export interface LeaderboardScoreSubmission {
    playlistId: string;
    songId: string;
    playlistTrackCount: number;
    snippetDurationMs: number;
}

interface SubmitLeaderboardScoreResponse {
    points: number;
}

const LEADERBOARD_COLLECTION = 'leaderboard';

/**
 * Hook that provides real-time top 10 players and current user stats.
 */
export const useLeaderboard = (user: User | null) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
    const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Real-time listener for top 10
    useEffect(() => {
        const q = query(
            collection(db, LEADERBOARD_COLLECTION),
            orderBy('totalPoints', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entries: LeaderboardEntry[] = snapshot.docs.map(docSnap => ({
                uid: docSnap.id,
                ...(docSnap.data() as Omit<LeaderboardEntry, 'uid'>)
            }));
            setTopPlayers(entries);
            setIsLoading(false);
        }, (error) => {
            console.error('Leaderboard snapshot error:', error);
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    // Real-time listener for current user's entry and rank
    useEffect(() => {
        if (!user || user.isAnonymous) return;

        const userDocRef = doc(db, LEADERBOARD_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            if (!docSnap.exists()) {
                setCurrentUserEntry(null);
                setCurrentUserRank(null);
                return;
            }

            const data = docSnap.data() as Omit<LeaderboardEntry, 'uid'>;
            const entry: LeaderboardEntry = { uid: user.uid, ...data };
            setCurrentUserEntry(entry);

            // Calculate rank: count how many users have more points
            try {
                const rankQuery = query(
                    collection(db, LEADERBOARD_COLLECTION),
                    where('totalPoints', '>', data.totalPoints)
                );
                const countSnap = await getCountFromServer(rankQuery);
                setCurrentUserRank(countSnap.data().count + 1);
            } catch (error) {
                console.error('Failed to calculate rank:', error);
                setCurrentUserRank(null);
            }
        });

        return () => {
            unsubscribe();
            setCurrentUserEntry(null);
            setCurrentUserRank(null);
        };
    }, [user]);

    /**
     * Submit points for a correct guess.
     * Delegates validation and leaderboard increments to a callable Cloud Function.
     */
    const submitScore = useCallback(async (submission: LeaderboardScoreSubmission): Promise<number | null> => {
        if (!user || user.isAnonymous) return null;

        try {
            const callable = httpsCallable<LeaderboardScoreSubmission, SubmitLeaderboardScoreResponse>(
                functions,
                'submitLeaderboardScore'
            );
            const result = await callable(submission);
            return result.data.points;
        } catch (error) {
            console.error('Failed to submit score:', error);
            return null;
        }
    }, [user]);

    return {
        topPlayers,
        currentUserEntry,
        currentUserRank,
        isLoading,
        submitScore
    };
};
