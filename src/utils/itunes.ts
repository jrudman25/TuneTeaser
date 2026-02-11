/**
 * itunes.ts
 * Used to fetch preview URLs.
 * @version 2026.02.11
 */
import { normalizeString } from '../utils/stringUtils';

interface ItunesResult {
    resultCount: number;
    results: Array<ItunesTrack>;
}

interface ItunesTrack {
    previewUrl: string;
    artworkUrl100: string;
    trackName: string;
    artistName: string;
    collectionName: string;
    kind: string;
    [key: string]: any;
}

/**
 * Searches iTunes for a track and returns its preview and artwork URLs.
 * @param trackName Name of the song
 * @param artistName Name of the artist
 * @param albumName Optional name of the album for stricter matching
 * @returns Object with previewUrl and artworkUrl, or null if not found
 */
export const getItunesPreview = async (trackName: string, artistName: string, albumName?: string): Promise<{ previewUrl: string; artworkUrl: string } | null> => {
    // Cleaning the query allows for better matches
    const cleanQuery = (str: string) => {
        return str.replace(/ - .*/, '').replace(/[\(\[].*?[\)\]]/g, '').trim();
    };

    try {
        const searchTerm = cleanQuery(trackName);
        const term = encodeURIComponent(`${searchTerm} ${artistName}`);
        const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=50`;

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`iTunes API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: ItunesResult = await response.json();

        if (data.resultCount > 0) {
            const bannedTerms = ['remix', 'mix', 'live', 'instrumental', 'club', 'edit'];

            // Filter and score results
            const matches = data.results.map((res: ItunesTrack) => {
                const resName = res.trackName.toLowerCase();
                const resArtist = res.artistName.toLowerCase();
                const resAlbum = (res.collectionName || '').toLowerCase();
                let score = 0;

                if (!resArtist.includes(artistName.toLowerCase()) && !artistName.toLowerCase().includes(resArtist)) return { res, score: -1 };

                const hasBannedTerm = bannedTerms.some(term =>
                    resName.includes(term) && !trackName.toLowerCase().includes(term)
                );
                if (hasBannedTerm) return { res, score: -1 };

                const cleanTarget = cleanQuery(trackName);
                const cleanRes = cleanQuery(res.trackName);
                const normRes = normalizeString(cleanRes);
                const normTarget = normalizeString(cleanTarget);

                if (normRes === normTarget) {
                    score += 10;
                } else if (normRes.includes(normTarget) || normTarget.includes(normRes)) {
                    const maxLength = Math.max(normRes.length, normTarget.length);
                    const lengthDiff = Math.abs(normRes.length - normTarget.length);
                    if ((1 - (lengthDiff / maxLength)) > 0.7) {
                        score += 5;
                    } else {
                        return { res, score: -1 };
                    }
                } else {
                    return { res, score: -1 };
                }

                if (albumName) {
                    const normAlbumTarget = normalizeString(cleanQuery(albumName));
                    const normAlbumRes = normalizeString(cleanQuery(resAlbum));

                    if (normAlbumRes === normAlbumTarget) {
                        score += 5;
                        console.log(`Album match found: ${res.collectionName}`);
                    } else if (normAlbumRes.includes(normAlbumTarget) || normAlbumTarget.includes(normAlbumRes)) {
                        score += 2;
                    }
                }

                return { res, score };
            });

            const bestMatch = matches
                .filter(m => m.score > 0)
                .sort((a, b) => b.score - a.score)[0]?.res;

            if (bestMatch && bestMatch.previewUrl) {
                console.log("Found preview via iTunes:", bestMatch.trackName, `(Album: ${bestMatch.collectionName})`);
                const highResArtwork = bestMatch.artworkUrl100 ? bestMatch.artworkUrl100.replace('100x100', '600x600') : '';
                return {
                    previewUrl: bestMatch.previewUrl,
                    artworkUrl: highResArtwork
                };
            } else {
                console.warn("No valid match found. Top result was:", data.results[0]?.trackName);
                return null;
            }
        }

        console.warn("No iTunes results found for:", trackName, artistName);
        return null;

    } catch (error) {
        console.error("Error fetching from iTunes:", error);
        return null;
    }
};
