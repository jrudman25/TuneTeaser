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

export const useManualPlaylists = (user: User | null) => {
    const [manualPlaylists, setManualPlaylists] = useState<ManualPlaylist[]>([]);
    const [isLoadingManualPlaylists, setIsLoadingManualPlaylists] = useState(true);
    const [manualPlaylistError, setManualPlaylistError] = useState('');
    const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

    const getCollectionRef = useCallback(() => {
        if (!user) return null;
        return collection(db, 'users', user.uid, 'playlists');
    }, [user]);

    const fetchManualPlaylists = useCallback(async () => {
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
    }, [getCollectionRef, user]);

    const addManualPlaylist = useCallback(async (name: string, sourceUrl: string, tracks: ManualTrack[]) => {
        const collectionRef = getCollectionRef();
        if (!collectionRef) throw new Error('You must be logged in to add playlists.');

        const trimmedName = name.trim();
        const trimmedSourceUrl = sourceUrl.trim();

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
    }, [fetchManualPlaylists, getCollectionRef]);

    const deleteManualPlaylist = useCallback(async (playlistId: string) => {
        if (!user) throw new Error('You must be logged in to delete playlists.');

        await deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId));
        await fetchManualPlaylists();
    }, [fetchManualPlaylists, user]);

    useEffect(() => {
        fetchManualPlaylists();
    }, [fetchManualPlaylists]);

    const isEffectivelyLoading = isLoadingManualPlaylists || (user ? fetchedForUserId !== user.uid : false);

    return {
        manualPlaylists,
        isLoadingManualPlaylists: isEffectivelyLoading,
        manualPlaylistError,
        fetchManualPlaylists,
        addManualPlaylist,
        deleteManualPlaylist
    };
};
