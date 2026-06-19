import { useCallback, useEffect, useState } from 'react';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';
import { db, storage } from '../backend/FirebaseConfig';
import { ManualPlaylist, ManualTrack, sanitizeTrack } from '../utils/manualPlaylists';
import { extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';
import { importSpotifyPlaylist, getManualPlaylistTracks } from '../utils/spotifyPlaylistImporter';

export const PLAYLIST_LIMIT = 30;
export const TRACK_LIMIT = 5000;

export const useManualPlaylists = (user: User | null, isGuest: boolean = false) => {
    const [manualPlaylists, setManualPlaylists] = useState<ManualPlaylist[]>([]);
    const [isLoadingManualPlaylists, setIsLoadingManualPlaylists] = useState(true);
    const [manualPlaylistError, setManualPlaylistError] = useState('');
    const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

    const getCollectionRef = useCallback(() => {
        if (!user || isGuest) return null;
        return collection(db, 'users', user.uid, 'playlists');
    }, [user, isGuest]);

    const fetchManualPlaylists = useCallback(async (isSilent = false) => {
        if (isGuest) {
            if (!isSilent) setIsLoadingManualPlaylists(true);
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
                if (!isSilent) setIsLoadingManualPlaylists(false);
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

        if (!isSilent) setIsLoadingManualPlaylists(true);
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
            if (!isSilent) setIsLoadingManualPlaylists(false);
        }
    }, [getCollectionRef, user, isGuest]);

    // Helper to upload tracks JSON to Storage
    const uploadTracksToStorage = useCallback(async (playlistId: string, tracks: ManualTrack[]): Promise<string> => {
        if (!user) {
            throw new Error('You must be signed in to save playlist tracks.');
        }

        const blob = new Blob([JSON.stringify(tracks)], { type: 'application/json' });
        const storageRef = ref(storage, `users/${user.uid}/playlists/${playlistId}.json`);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    }, [user]);

    // Helper to delete tracks JSON from Storage
    const deleteTracksFromStorage = useCallback(async (playlistId: string) => {
        if (!user) return;

        const storageRef = ref(storage, `users/${user.uid}/playlists/${playlistId}.json`);
        try {
            await deleteObject(storageRef);
        } catch (e) {
            console.error("Failed to delete tracks from storage:", e);
        }
    }, [user]);

    const addManualPlaylist = useCallback(async (
        name: string,
        sourceUrl: string,
        tracks: ManualTrack[],
        status: 'ready' | 'importing' = 'ready',
        importedCount?: number,
        totalCount?: number
    ) => {
        const trimmedName = name.trim();
        const trimmedSourceUrl = sourceUrl.trim();

        if (!trimmedName) {
            throw new Error('Playlist name is required.');
        }

        const playlistNameRegex = /^[a-zA-Z0-9_ \x5b\x5d()!?'",&./#-]{1,100}$/;
        if (!playlistNameRegex.test(trimmedName)) {
            throw new Error('Playlist name must be 1-100 characters long and contain only letters, numbers, spaces, or standard music punctuation.');
        }

        const cappedTracks = tracks.slice(0, TRACK_LIMIT);
        const sanitizedTracks = cappedTracks.map(sanitizeTrack);
        const finalTotalCount = Math.min(totalCount !== undefined ? totalCount : tracks.length, TRACK_LIMIT);
        const finalImportedCount = Math.min(importedCount !== undefined ? importedCount : tracks.length, TRACK_LIMIT);
        const finalStatus = (finalImportedCount >= finalTotalCount) ? 'ready' : status;

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

            if (existingPlaylists.length >= PLAYLIST_LIMIT) {
                throw new Error(`You have reached the limit of ${PLAYLIST_LIMIT} playlists. Please delete an existing playlist to add a new one.`);
            }

            const existingNames = existingPlaylists.map(d => (d.name || '').toLowerCase());
            if (existingNames.includes(trimmedName.toLowerCase())) {
                throw new Error(`A playlist named "${trimmedName}" already exists.`);
            }

            const playlistId = `guest_manual_${Date.now()}`;

            // Upload to Storage
            const tracksUrl = await uploadTracksToStorage(playlistId, sanitizedTracks);

            const newPlaylist: ManualPlaylist = {
                id: playlistId,
                name: trimmedName,
                sourceUrl: trimmedSourceUrl,
                sourceType: 'spotify-url',
                tracks: [], // Keep array empty to avoid local storage bloat
                createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
                updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
                status: finalStatus,
                importedCount: finalImportedCount,
                totalCount: finalTotalCount,
                tracksUrl
            };

            const updatedPlaylists = [newPlaylist, ...existingPlaylists];
            localStorage.setItem('guestPlaylists', JSON.stringify(updatedPlaylists));
            await fetchManualPlaylists(true);
            return;
        }

        const collectionRef = getCollectionRef();
        if (!collectionRef || !user) throw new Error('You must be signed in to add playlists.');

        // Check for duplicate playlist names and count limit
        const snapshot = await getDocs(collectionRef);
        if (snapshot.docs.length >= PLAYLIST_LIMIT) {
            throw new Error(`You have reached the limit of ${PLAYLIST_LIMIT} playlists. Please delete an existing playlist to add a new one.`);
        }

        const existingNames = snapshot.docs.map(d => (d.data().name || '').toLowerCase());
        if (existingNames.includes(trimmedName.toLowerCase())) {
            throw new Error(`A playlist named "${trimmedName}" already exists.`);
        }

        // Generate custom document ID first
        const docRef = doc(collection(db, 'users', user.uid, 'playlists'));
        const playlistId = docRef.id;

        // Upload to Storage
        const tracksUrl = await uploadTracksToStorage(playlistId, sanitizedTracks);

        // Write document to Firestore
        await setDoc(docRef, {
            name: trimmedName,
            sourceUrl: trimmedSourceUrl,
            sourceType: 'spotify-url',
            tracks: [], // Keep array empty in Firestore to avoid 1MB document limit
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: finalStatus,
            importedCount: finalImportedCount,
            totalCount: finalTotalCount,
            tracksUrl
        });

        await fetchManualPlaylists(true);
    }, [fetchManualPlaylists, getCollectionRef, isGuest, uploadTracksToStorage, user]);

    const updateManualPlaylist = useCallback(async (
        playlistId: string,
        updates: Partial<Omit<ManualPlaylist, 'id'>>
    ) => {
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

            const updatedPlaylists = existingPlaylists.map(p => {
                if (p.id === playlistId) {
                    return {
                        ...p,
                        ...updates,
                        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
                    };
                }
                return p;
            });

            localStorage.setItem('guestPlaylists', JSON.stringify(updatedPlaylists));
            await fetchManualPlaylists(true);
            return;
        }

        if (!user) throw new Error('You must be signed in to update playlists.');

        const playlistDocRef = doc(db, 'users', user.uid, 'playlists', playlistId);
        await updateDoc(playlistDocRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        await fetchManualPlaylists(true);
    }, [fetchManualPlaylists, user, isGuest]);

    const deleteManualPlaylist = useCallback(async (playlistId: string) => {
        // Delete Storage reference first
        await deleteTracksFromStorage(playlistId);

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
            await fetchManualPlaylists(true);
            return;
        }

        if (!user) throw new Error('You must be signed in to delete playlists.');

        await deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId));
        await fetchManualPlaylists(true);
    }, [fetchManualPlaylists, user, isGuest, deleteTracksFromStorage]);

    // Background importer effect
    useEffect(() => {
        const activeImporting = manualPlaylists.find(p => p.status === 'importing');
        if (!activeImporting) {
            return;
        }

        if (!user) {
            console.log("[TuneTeaser Importer] Active importing playlist found, but user is null. Waiting for auth...");
            return;
        }

        let isSubscribed = true;

        const runBackgroundImport = async () => {
            const playlistId = activeImporting.id;
            const sourceUrl = activeImporting.sourceUrl;
            const spotifyPlaylistId = extractSpotifyPlaylistId(sourceUrl);

            // Load existing tracks from Storage
            let currentTracks: ManualTrack[] = [];
            if (activeImporting.tracksUrl) {
                try {
                    currentTracks = await getManualPlaylistTracks(activeImporting.id);
                } catch (e) {
                    console.error("[TuneTeaser Importer] Failed to load tracks from Storage:", e);
                    currentTracks = activeImporting.tracks || [];
                }
            } else {
                currentTracks = activeImporting.tracks || [];
            }

            const offset = currentTracks.length;
            const limit = 100;

            console.log(`[TuneTeaser Importer] Found playlist "${activeImporting.name}" to continue importing. Current tracks: ${offset}/${activeImporting.totalCount || 0}`);

            if (offset >= TRACK_LIMIT) {
                console.log(`[TuneTeaser Importer] Playlist has reached the track limit of ${TRACK_LIMIT} tracks. Stopping import.`);
                await updateManualPlaylist(playlistId, { status: 'ready' });
                return;
            }

            if (!spotifyPlaylistId) {
                console.warn(`[TuneTeaser Importer] Invalid Spotify playlist URL: ${sourceUrl}. Marking as ready.`);
                await updateManualPlaylist(playlistId, { status: 'ready' });
                return;
            }

            try {
                console.log(`[TuneTeaser Importer] Fetching next batch from Spotify: ID ${spotifyPlaylistId}, offset ${offset}, limit ${limit}`);
                const result = await importSpotifyPlaylist(spotifyPlaylistId, offset, limit);
                if (!isSubscribed) {
                    console.log(`[TuneTeaser Importer] Component unmounted during fetch, discarding result.`);
                    return;
                }

                const newTracks = result.tracks || [];
                const combinedTracks = [...currentTracks, ...newTracks].slice(0, TRACK_LIMIT);
                const total = Math.min(result.total || activeImporting.totalCount || combinedTracks.length, TRACK_LIMIT);

                console.log(`[TuneTeaser Importer] Fetched ${newTracks.length} tracks. Combined: ${combinedTracks.length} / ${total}`);

                // Upload combined list to Storage
                const tracksUrl = await uploadTracksToStorage(playlistId, combinedTracks);

                const isDone = newTracks.length === 0 || combinedTracks.length >= total;

                await updateManualPlaylist(playlistId, {
                    tracks: [], // Keep Firestore doc array empty
                    tracksUrl,
                    importedCount: combinedTracks.length,
                    totalCount: total,
                    status: isDone ? 'ready' : 'importing'
                });
                console.log(`[TuneTeaser Importer] Successfully updated playlist tracks in Storage. isDone: ${isDone}`);
            } catch (err) {
                console.error("[TuneTeaser Importer] Background import failed:", err);
                if (isSubscribed) {
                    await updateManualPlaylist(playlistId, { status: 'ready' });
                }
            }
        };

        const timer = setTimeout(() => {
            runBackgroundImport();
        }, 1500);

        return () => {
            isSubscribed = false;
            clearTimeout(timer);
        };
    }, [manualPlaylists, user, updateManualPlaylist, uploadTracksToStorage]);

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
        updateManualPlaylist,
        deleteManualPlaylist
    };
};
