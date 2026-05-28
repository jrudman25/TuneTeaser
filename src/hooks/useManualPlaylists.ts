import { useCallback, useEffect, useState } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../backend/FirebaseConfig';
import { ManualPlaylist, ManualTrack } from '../utils/manualPlaylists';

export const useManualPlaylists = (user: User | null, isGuest: boolean = false) => {
    const [manualPlaylists, setManualPlaylists] = useState<ManualPlaylist[]>([]);
    const [isLoadingManualPlaylists, setIsLoadingManualPlaylists] = useState(true);
    const [manualPlaylistError, setManualPlaylistError] = useState('');
    const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

    const getCollectionRef = useCallback(() => {
        if (!user || isGuest) return null;
        return collection(db, 'users', user.uid, 'playlists');
    }, [user, isGuest]);

    const fetchManualPlaylists = useCallback(async () => {
        if (isGuest) {
            setIsLoadingManualPlaylists(true);
            setManualPlaylistError('');
            try {
                const stored = localStorage.getItem('guestPlaylists');
                if (stored) {
                    setManualPlaylists(JSON.parse(stored));
                } else {
                    setManualPlaylists([]);
                }
                setFetchedForUserId('guest');
            } catch (error) {
                console.error('Failed to fetch guest manual playlists:', error);
                setManualPlaylistError('Could not load your guest playlists.');
            } finally {
                setIsLoadingManualPlaylists(false);
            }
            return;
        }

        const collectionRef = getCollectionRef();

        if (!collectionRef) {
            setManualPlaylists([]);
            setIsLoadingManualPlaylists(false);
            setFetchedForUserId(null);
            return;
        }

        setIsLoadingManualPlaylists(true);
        setManualPlaylistError('');

        try {
            const snapshot = await getDocs(query(collectionRef, orderBy('createdAt', 'desc')));
            setManualPlaylists(snapshot.docs.map(playlistDoc => ({
                id: playlistDoc.id,
                ...(playlistDoc.data() as Omit<ManualPlaylist, 'id'>)
            })));
            if (user) {
                setFetchedForUserId(user.uid);
            }
        } catch (error) {
            console.error('Failed to fetch manual playlists:', error);
            setManualPlaylistError('Could not load your playlists.');
        } finally {
            setIsLoadingManualPlaylists(false);
        }
    }, [getCollectionRef, user, isGuest]);

    const addManualPlaylist = useCallback(async (name: string, sourceUrl: string, tracks: ManualTrack[]) => {
        const trimmedName = name.trim();
        const trimmedSourceUrl = sourceUrl.trim();

        if (isGuest) {
            let existingPlaylists: ManualPlaylist[] = [];
            try {
                const stored = localStorage.getItem('guestPlaylists');
                if (stored) {
                    existingPlaylists = JSON.parse(stored);
                }
            } catch (e) {
                console.error(e);
            }

            const existingNames = existingPlaylists.map(d => (d.name || '').toLowerCase());
            if (existingNames.includes(trimmedName.toLowerCase())) {
                throw new Error(`A playlist named "${trimmedName}" already exists.`);
            }

            const newPlaylist: ManualPlaylist = {
                id: `guest_manual_${Date.now()}`,
                name: trimmedName,
                sourceUrl: trimmedSourceUrl,
                sourceType: 'spotify-url',
                tracks,
                createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
                updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
            };

            const updatedPlaylists = [newPlaylist, ...existingPlaylists];
            localStorage.setItem('guestPlaylists', JSON.stringify(updatedPlaylists));
            await fetchManualPlaylists();
            return;
        }

        const collectionRef = getCollectionRef();
        if (!collectionRef) throw new Error('You must be logged in to add playlists.');

        // Check for duplicate playlist names
        const snapshot = await getDocs(collectionRef);
        const existingNames = snapshot.docs.map(d => (d.data().name || '').toLowerCase());
        if (existingNames.includes(trimmedName.toLowerCase())) {
            throw new Error(`A playlist named "${trimmedName}" already exists.`);
        }

        await addDoc(collectionRef, {
            name: trimmedName,
            sourceUrl: trimmedSourceUrl,
            sourceType: 'spotify-url',
            tracks,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await fetchManualPlaylists();
    }, [fetchManualPlaylists, getCollectionRef, isGuest]);

    const deleteManualPlaylist = useCallback(async (playlistId: string) => {
        if (isGuest) {
            let existingPlaylists: ManualPlaylist[] = [];
            try {
                const stored = localStorage.getItem('guestPlaylists');
                if (stored) {
                    existingPlaylists = JSON.parse(stored);
                }
            } catch (e) {
                console.error(e);
            }

            const updatedPlaylists = existingPlaylists.filter(p => p.id !== playlistId);
            localStorage.setItem('guestPlaylists', JSON.stringify(updatedPlaylists));
            await fetchManualPlaylists();
            return;
        }

        if (!user) throw new Error('You must be logged in to delete playlists.');

        await deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId));
        await fetchManualPlaylists();
    }, [fetchManualPlaylists, user, isGuest]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchManualPlaylists();
    }, [fetchManualPlaylists]);

    const isEffectivelyLoading = isLoadingManualPlaylists || (isGuest ? fetchedForUserId !== 'guest' : user ? fetchedForUserId !== user.uid : false);

    return {
        manualPlaylists,
        isLoadingManualPlaylists: isEffectivelyLoading,
        manualPlaylistError,
        fetchManualPlaylists,
        addManualPlaylist,
        deleteManualPlaylist
    };
};
