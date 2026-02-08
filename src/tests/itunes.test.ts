/**
 * itunes.test.ts
 * Tests the itunes utility.
 * @version 2026.02.07
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getItunesPreview } from '../utils/itunes';

describe('getItunesPreview', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
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
});
