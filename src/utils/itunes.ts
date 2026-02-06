/**
 * itunes.ts
 * Used to fetch preview URLs.
 * @version 2026.02.05
 */

interface ItunesResult {
    resultCount: number;
    results: Array<{
        previewUrl: string;
        trackName: string;
        artistName: string;
        kind: string;
    }>;
}

/**
 * Searches iTunes for a track and returns its preview URL.
 * @param trackName Name of the song
 * @param artistName Name of the artist
 * @returns The preview URL or null if not found
 */
export const getItunesPreview = async (trackName: string, artistName: string): Promise<string | null> => {
    try {
        // Construct the search query
        const term = encodeURIComponent(`${trackName} ${artistName}`);
        const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=10`; // increased limit

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`iTunes API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: ItunesResult = await response.json();

        if (data.resultCount > 0) {
            const cleanTrackName = trackName.toLowerCase();
            const bannedTerms = ['remix', 'mix', 'live', 'instrumental', 'club', 'edit'];

            const bestMatch = data.results.find(res => {
                const resName = res.trackName.toLowerCase();
                const resArtist = res.artistName.toLowerCase();

                if (!resArtist.includes(artistName.toLowerCase()) && !artistName.toLowerCase().includes(resArtist)) {
                    return false;
                }

                const hasBannedTerm = bannedTerms.some(term =>
                    resName.includes(term) && !cleanTrackName.includes(term)
                );

                if (hasBannedTerm) return false;

                return true;
            });

            if (bestMatch && bestMatch.previewUrl) {
                console.log("Found preview via iTunes:", bestMatch.trackName);
                return bestMatch.previewUrl;
            } else if (data.results[0].previewUrl) {
                console.log("Strict matching failed, falling back to first result:", data.results[0].trackName);
                return data.results[0].previewUrl;
            }
        }

        console.warn("No iTunes results found for:", trackName, artistName);
        return null;

    } catch (error) {
        console.error("Error fetching from iTunes:", error);
        return null;
    }
};
