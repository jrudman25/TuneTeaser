import { createHash } from 'crypto';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { normalizeAnswer } from './answerMatching';
import { getTrackAlbumName, getTrackArtistName, getTrackName } from './playlistTracks';

const ITUNES_FETCH_TIMEOUT_MS = 5000;
const PREVIEW_CACHE_COLLECTION = 'itunesPreviewCache';
const PREVIEW_CACHE_FOUND_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PREVIEW_CACHE_MISSING_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const PREVIEW_LOOKUP_BATCH_SIZE = 4;

export type ItunesPreviewResult =
    | { status: 'found'; previewUrl: string; artworkUrl: string }
    | { status: 'missing' }
    | { status: 'error' };

const cleanItunesQuery = (value: string) => {
    return value.replace(/ - .*/, '').replace(/[([].*?[)\]]/g, '').trim();
};

// iTunes artwork URLs carry a size segment like "100x100bb.jpg"; swap it for
// the requested square size. URLs without a size segment are returned as-is.
export const resizeItunesArtwork = (url: string, size = 300) => {
    return url.replace(/\d{2,4}x\d{2,4}(?=bb|\.|$)/, `${size}x${size}`);
};

export const getItunesPreview = async (
    trackName: string,
    artistName: string,
    albumName?: string
): Promise<ItunesPreviewResult> => {
    try {
        const searchTerm = cleanItunesQuery(trackName);
        const term = encodeURIComponent(`${searchTerm} ${artistName}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=50`, {
            signal: AbortSignal.timeout(ITUNES_FETCH_TIMEOUT_MS)
        });

        if (!response.ok) {
            console.warn(`[getItunesPreview] iTunes search failed with status ${response.status} for "${trackName}".`);
            return { status: 'error' };
        }

        const data = await response.json() as {
            resultCount?: number;
            results?: Array<{
                previewUrl?: string;
                artworkUrl100?: string;
                trackName?: string;
                artistName?: string;
                collectionName?: string;
            }>;
        };

        if (!data.resultCount || !Array.isArray(data.results)) {
            return { status: 'missing' };
        }

        const bannedTerms = ['remix', 'mix', 'live', 'instrumental', 'club', 'edit'];
        const normalizedTarget = normalizeAnswer(cleanItunesQuery(trackName));
        const normalizedArtist = artistName.toLowerCase();

        const bestMatch = data.results
            .map(result => {
                const resultName = (result.trackName || '').toLowerCase();
                const resultArtist = (result.artistName || '').toLowerCase();
                const resultAlbum = (result.collectionName || '').toLowerCase();
                let score = 0;

                if (!result.previewUrl || !resultArtist.includes(normalizedArtist) && !normalizedArtist.includes(resultArtist)) {
                    return { result, score: -1 };
                }

                const hasBannedTerm = bannedTerms.some(term => resultName.includes(term) && !trackName.toLowerCase().includes(term));
                if (hasBannedTerm) {
                    return { result, score: -1 };
                }

                const normalizedResult = normalizeAnswer(cleanItunesQuery(result.trackName || ''));
                if (normalizedResult === normalizedTarget) {
                    score += 10;
                } else if (normalizedResult.includes(normalizedTarget) || normalizedTarget.includes(normalizedResult)) {
                    const maxLength = Math.max(normalizedResult.length, normalizedTarget.length);
                    const lengthDiff = Math.abs(normalizedResult.length - normalizedTarget.length);
                    if (maxLength > 0 && (1 - lengthDiff / maxLength) > 0.7) {
                        score += 5;
                    } else {
                        return { result, score: -1 };
                    }
                } else {
                    return { result, score: -1 };
                }

                if (albumName) {
                    const normalizedAlbumTarget = normalizeAnswer(cleanItunesQuery(albumName));
                    const normalizedAlbumResult = normalizeAnswer(cleanItunesQuery(resultAlbum));
                    if (normalizedAlbumResult === normalizedAlbumTarget) {
                        score += 5;
                    } else if (normalizedAlbumResult.includes(normalizedAlbumTarget) || normalizedAlbumTarget.includes(normalizedAlbumResult)) {
                        score += 2;
                    }
                }

                return { result, score };
            })
            .filter(match => match.score > 0)
            .sort((a, b) => b.score - a.score)[0]?.result;

        if (!bestMatch?.previewUrl) {
            return { status: 'missing' };
        }

        return {
            status: 'found',
            previewUrl: bestMatch.previewUrl,
            artworkUrl: bestMatch.artworkUrl100 ? resizeItunesArtwork(bestMatch.artworkUrl100) : ''
        };
    } catch (error) {
        console.warn(`[getItunesPreview] Lookup failed for "${trackName}":`, error);
        return { status: 'error' };
    }
};

const getPreviewCacheDocId = (trackName: string, artistName: string, albumName: string) => {
    const key = [trackName, artistName, albumName]
        .map(value => value.trim().toLowerCase())
        .join('|');
    return createHash('sha256').update(key).digest('hex');
};

const isCacheEntryFresh = (data: any, now: number) => {
    const expiresAt = data?.expiresAt;
    return typeof expiresAt?.toMillis === 'function' && expiresAt.toMillis() > now;
};

const writePreviewCacheEntry = async (
    ref: any,
    result: ItunesPreviewResult,
    now: number
) => {
    if (result.status === 'error') return;

    const ttlMs = result.status === 'found' ? PREVIEW_CACHE_FOUND_TTL_MS : PREVIEW_CACHE_MISSING_TTL_MS;
    const entry: Record<string, any> = {
        status: result.status,
        checkedAtMillis: now,
        expiresAt: Timestamp.fromMillis(now + ttlMs)
    };
    if (result.status === 'found') {
        entry.previewUrl = result.previewUrl;
        entry.artworkUrl = result.artworkUrl;
    }

    try {
        await ref.set(entry, { merge: true });
    } catch (error) {
        console.warn('[pickTrackWithPreview] Failed to write preview cache entry:', error);
    }
};

export const pickTrackWithPreview = async (
    candidates: any[],
    maxAttempts: number
): Promise<{
    track: any;
    previewUrl: string;
    artworkUrl: string;
    stats: { cacheHits: number; lookups: number; elapsedMs: number };
} | null> => {
    const startedAt = Date.now();
    const attempted = candidates.slice(0, maxAttempts);
    if (attempted.length === 0) return null;

    const db = getFirestore();
    const entries = attempted.map(track => {
        const name = getTrackName(track);
        const artistName = getTrackArtistName(track);
        const albumName = getTrackAlbumName(track);
        return {
            track,
            name,
            artistName,
            albumName,
            ref: db.collection(PREVIEW_CACHE_COLLECTION).doc(getPreviewCacheDocId(name, artistName, albumName))
        };
    });

    const stats = { cacheHits: 0, lookups: 0, elapsedMs: 0 };
    const cachedSnaps = await db.getAll(...entries.map(entry => entry.ref));
    const unknown: typeof entries = [];

    const picked: { track?: any; previewUrl?: string; artworkUrl?: string } = {};
    cachedSnaps.forEach((snap: any, index: number) => {
        const data = snap.exists ? snap.data() : null;
        if (isCacheEntryFresh(data, startedAt)) {
            stats.cacheHits += 1;
            if (!picked.track && data.status === 'found' && typeof data.previewUrl === 'string' && data.previewUrl) {
                picked.track = entries[index].track;
                picked.previewUrl = data.previewUrl;
                // Cache entries written before the resize change still hold
                // oversized URLs, so normalize on read too.
                picked.artworkUrl = typeof data.artworkUrl === 'string' ? resizeItunesArtwork(data.artworkUrl) : '';
            }
            return;
        }
        unknown.push(entries[index]);
    });

    const pendingWrites: Promise<void>[] = [];

    if (!picked.track) {
        for (let i = 0; i < unknown.length && !picked.track; i += PREVIEW_LOOKUP_BATCH_SIZE) {
            const batch = unknown.slice(i, i + PREVIEW_LOOKUP_BATCH_SIZE);
            const results = await Promise.all(batch.map(entry => (
                getItunesPreview(entry.name, entry.artistName, entry.albumName)
            )));
            stats.lookups += batch.length;

            results.forEach((result, index) => {
                pendingWrites.push(writePreviewCacheEntry(batch[index].ref, result, Date.now()));
                if (!picked.track && result.status === 'found') {
                    picked.track = batch[index].track;
                    picked.previewUrl = result.previewUrl;
                    picked.artworkUrl = result.artworkUrl;
                }
            });
        }
    }

    await Promise.all(pendingWrites);
    stats.elapsedMs = Date.now() - startedAt;
    console.log(`[pickTrackWithPreview] candidates=${attempted.length} cacheHits=${stats.cacheHits} lookups=${stats.lookups} elapsedMs=${stats.elapsedMs} picked=${picked.track ? 'yes' : 'no'}`);

    if (!picked.track) return null;
    return {
        track: picked.track,
        previewUrl: picked.previewUrl as string,
        artworkUrl: picked.artworkUrl as string,
        stats
    };
};
