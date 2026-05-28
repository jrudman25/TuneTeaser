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
    getDoc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    limit,
    where,
    getCountFromServer,
    serverTimestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../backend/FirebaseConfig';

export interface LeaderboardEntry {
    uid: string;
    displayName: string;
    totalPoints: number;
    gamesWon: number;
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
     * Reads the existing doc (if any), increments totals, and writes back.
     */
    const submitScore = useCallback(async (points: number) => {
        if (!user || user.isAnonymous) return;

        const userDocRef = doc(db, LEADERBOARD_COLLECTION, user.uid);

        try {
            const existing = await getDoc(userDocRef);
            const currentData = existing.exists() ? existing.data() : { totalPoints: 0, gamesWon: 0 };

            const displayName = user.displayName
                || user.email?.split('@')[0]
                || 'Anonymous';

            await setDoc(userDocRef, {
                displayName,
                totalPoints: (currentData.totalPoints || 0) + points,
                gamesWon: (currentData.gamesWon || 0) + 1,
                lastUpdated: serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to submit score:', error);
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
