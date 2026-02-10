/**
 * itunes.test.ts
 * Tests the itunes utility.
 * @version 2026.02.09
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItunesPreview } from '../utils/itunes';

describe('getItunesPreview', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('should NOT match "Me" when searching for "Me & You Together Song"', async () => {
        const mockResponse = {
            resultCount: 1,
            results: [
                {
                    trackName: 'Me',
                    artistName: 'The 1975',
                    previewUrl: 'http://wrong-url.com',
                    kind: 'song'
                }
            ]
        };
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await getItunesPreview('Me & You Together Song', 'The 1975');
        expect(result).toBeNull();
    });

    it('returns the correct preview URL when exact match is found', async () => {
        const mockData = {
            resultCount: 1,
            results: [
                {
                    previewUrl: 'http://preview.url/1',
                    trackName: 'Bohemian Rhapsody',
                    artistName: 'Queen',
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await getItunesPreview('Bohemian Rhapsody', 'Queen');
        expect(result).toBe('http://preview.url/1');
    });

    it('rejects a result with same artist but different track name (Album match scenario)', async () => {
        // Scenario: Searching for "American Idiot" (Song)
        // iTunes returns "Holiday" (from American Idiot Album) as first result because it's popular
        const mockData = {
            resultCount: 2,
            results: [
                {
                    previewUrl: 'http://preview.url/holiday',
                    trackName: 'Holiday',
                    artistName: 'Green Day',
                },
                {
                    previewUrl: 'http://preview.url/american-idiot',
                    trackName: 'American Idiot',
                    artistName: 'Green Day',
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await getItunesPreview('American Idiot', 'Green Day');

        // Should skip "Holiday" (no string match) and find "American Idiot"
        expect(result).toBe('http://preview.url/american-idiot');
    });

    it('matches tracks with punctuation differences (e.g. Rio vs Rio [Remaster])', async () => {
        // Scenario: Spotify has "Rio - 2009 Remaster", iTunes has "Rio [2009 Remaster]"
        const mockData = {
            resultCount: 1,
            results: [
                {
                    previewUrl: 'http://preview.url/rio',
                    trackName: 'Rio [2009 Remaster]',
                    artistName: 'Duran Duran',
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await getItunesPreview('Rio - 2009 Remaster', 'Duran Duran');
        expect(result).toBe('http://preview.url/rio');
    });

    it('returns null if no results meet similarity threshold', async () => {
        const mockData = {
            resultCount: 1,
            results: [
                {
                    previewUrl: 'http://preview.url/wrong',
                    trackName: 'Completely Different Song',
                    artistName: 'My Artist',
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        const result = await getItunesPreview('My Target Song', 'My Artist');
        expect(result).toBeNull();
    });

    it('cleans "Remaster" from search query and finds match', async () => {
        const trackName = "Shakedown Street - 2013 Remaster";
        const artistName = "The Grateful Dead";

        const mockResponse = {
            resultCount: 5,
            results: [
                {
                    trackName: "Shakedown Street",
                    artistName: "Grateful Dead",
                    previewUrl: "http://preview.url/shakedown",
                    kind: "song"
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await getItunesPreview(trackName, artistName);

        // Assert result
        expect(result).toBe("http://preview.url/shakedown");

        // Ideally we'd test the fetch URL called contained cleaned term, 
        // but since we mocked `global.fetch` in `beforeEach`, we can inspect it here if we spy on it.
        // `global.fetch` is already a spy in this test file setup (vi.fn()).
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('term=Shakedown%20Street%20The%20Grateful%20Dead')
        );
    });

    it('finds "American Idiot" even if buried in results', async () => {
        const trackName = "American Idiot";
        const artistName = "Green Day";

        const mockResults = [];
        for (let i = 0; i < 20; i++) {
            mockResults.push({
                trackName: `American Idiot (Live variant ${i})`,
                artistName: "Green Day",
                previewUrl: "http://wrong.url",
                kind: "song"
            });
        }
        mockResults.push({
            trackName: "American Idiot",
            artistName: "Green Day",
            previewUrl: "http://right.url/idiot",
            kind: "song"
        });

        const mockResponse = {
            resultCount: 22,
            results: mockResults
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await getItunesPreview(trackName, artistName);
        expect(result).toBe("http://right.url/idiot");

        // Assert limit increased
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('limit=50')
        );
    });

    it('returns null if strict match fails (even if artist matches)', async () => {
        const trackName = "American Idiot";
        const artistName = "Green Day";

        const mockResponse = {
            resultCount: 1,
            results: [
                {
                    trackName: "American Idiot (Live at Irving Plaza)",
                    artistName: "Green Day",
                    previewUrl: "http://preview.url/live",
                    kind: "song"
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await getItunesPreview(trackName, artistName);

        // Should reject "Live" version because strict matching is enforced
        expect(result).toBeNull();
    });

    it('does not fallback to incorrect artist even if title matches', async () => {
        const trackName = "American Idiot";
        const artistName = "Green Day";

        const mockResponse = {
            resultCount: 1,
            results: [
                {
                    trackName: "American Idiot",
                    artistName: "5 Seconds of Summer",
                    previewUrl: "http://preview.url/cover",
                    kind: "song"
                }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await getItunesPreview(trackName, artistName);
        expect(result).toBeNull();
    });
});
