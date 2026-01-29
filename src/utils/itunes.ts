/**
 * itunes.ts
 * Used to fetch preview URLs.
 * @version 2026.01.28
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
        const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`;

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`iTunes API error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data: ItunesResult = await response.json();

        if (data.resultCount > 0 && data.results[0].previewUrl) {
            console.log("Found preview via iTunes:", data.results[0].trackName);
            return data.results[0].previewUrl;
        } else {
            console.warn("No iTunes results found for:", trackName, artistName);
            return null;
        }

    } catch (error) {
        console.error("Error fetching from iTunes:", error);
        return null;
    }
};
