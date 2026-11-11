import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    calculateLeaderboardPoints,
    isCorrectGuess,
    normalizeAnswer,
    normalizeSongTitleForGuess
} from './answerMatching';
import { getItunesPreview } from './itunesPreview';
import { getPlayableTracks } from './playlistTracks';

describe('normalizeAnswer', () => {
    it('normalizes basic strings', () => {
        expect(normalizeAnswer('Hello World')).toBe('helloworld');
    });

    it('handles special characters by stripping them', () => {
        expect(normalizeAnswer('♾')).toBe('');
        expect(normalizeAnswer('!!!')).toBe('');
    });

    it('strips accents from Latin characters', () => {
        expect(normalizeAnswer('Beyoncé')).toBe('beyonce');
    });

    it('keeps non-Latin letters instead of stripping them', () => {
        // NFKD decomposes the dakuten in ピ into ヒ + combining mark, which is stripped.
        expect(normalizeAnswer('ピースサイン - Peace Sign ')).toBe('ヒースサインpeacesign');
        expect(normalizeAnswer('残酷な天使のテーゼ')).toBe('残酷な天使のテーセ');
    });

    it('returns an empty string for non-strings', () => {
        expect(normalizeAnswer(undefined)).toBe('');
        expect(normalizeAnswer(null)).toBe('');
        expect(normalizeAnswer(42)).toBe('');
    });
});

describe('normalizeSongTitleForGuess', () => {
    it('strips trailing dash remaster metadata', () => {
        expect(normalizeSongTitleForGuess('Any Time At All - Remastered 2009')).toBe('anytimeatall');
    });

    it('strips trailing bracketed remaster metadata', () => {
        expect(normalizeSongTitleForGuess('Paranoid Android (Remastered)')).toBe('paranoidandroid');
    });
});

describe('isCorrectGuess', () => {
    it('matches an exact title', () => {
        expect(isCorrectGuess('First Song', 'First Song', 'Artist One')).toBe(true);
    });

    it('matches the "Title - Artist" option exactly', () => {
        expect(isCorrectGuess('First Song - Artist One', 'First Song', 'Artist One')).toBe(true);
    });

    it('accepts a guess without accents for an accented title', () => {
        expect(isCorrectGuess('beyonce', 'Beyoncé', 'Beyoncé')).toBe(true);
    });

    it('rejects blank guesses', () => {
        expect(isCorrectGuess('', 'First Song', 'Artist One')).toBe(false);
        expect(isCorrectGuess('   ', 'First Song', 'Artist One')).toBe(false);
    });

    it('rejects blank and symbol-only guesses on non-Latin titles', () => {
        expect(isCorrectGuess('', '残酷な天使のテーゼ', 'Yoko Takahashi')).toBe(false);
        expect(isCorrectGuess('   ', '残酷な天使のテーゼ', 'Yoko Takahashi')).toBe(false);
        expect(isCorrectGuess('!!!', '残酷な天使のテーゼ', 'Yoko Takahashi')).toBe(false);
    });

    it('accepts a Japanese guess matching the title', () => {
        expect(isCorrectGuess('残酷な天使のテーゼ', '残酷な天使のテーゼ', 'Yoko Takahashi')).toBe(true);
    });

    it('rejects guesses that are too short relative to the title', () => {
        expect(isCorrectGuess('ab', 'A Better Title', 'Artist')).toBe(false);
    });
});

describe('calculateLeaderboardPoints', () => {
    it('awards the maximum bonus at the minimum snippet length', () => {
        expect(calculateLeaderboardPoints(2000)).toBe(25);
    });

    it('decays toward the base at the maximum snippet length', () => {
        expect(calculateLeaderboardPoints(30000)).toBe(10);
        expect(calculateLeaderboardPoints(6000)).toBe(23);
    });
});

describe('getPlayableTracks', () => {
    it('keeps tracks with an id, guessable title, and artist', () => {
        const tracks = [
            { id: 't1', name: 'First Song', artists: [{ name: 'Artist One' }] },
            { id: 't2', name: '残酷な天使のテーゼ', artists: [{ name: 'Yoko Takahashi' }] }
        ];
        expect(getPlayableTracks(tracks)).toHaveLength(2);
    });

    it('excludes symbol-only titles that can never be guessed', () => {
        const tracks = [
            { id: 't1', name: '♾', artists: [{ name: 'Artist One' }] },
            { id: 't2', name: '!!!', artists: [{ name: 'Artist One' }] },
            { id: 't3', name: 'Real Song', artists: [{ name: 'Artist One' }] }
        ];
        expect(getPlayableTracks(tracks).map(track => track.id)).toEqual(['t3']);
    });

    it('excludes tracks without an id or artist', () => {
        const tracks = [
            { name: 'No Id', artists: [{ name: 'Artist One' }] },
            { id: 't2', name: 'No Artist', artists: [] },
            { id: 't3', name: 'Real Song', artists: [{ name: 'Artist One' }] }
        ];
        expect(getPlayableTracks(tracks).map(track => track.id)).toEqual(['t3']);
    });
});

describe('getItunesPreview', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockItunesResponse = (results: any[]) => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ resultCount: results.length, results })
        });
    };

    it('returns found with the preview URL when an exact match exists', async () => {
        mockItunesResponse([
            { previewUrl: 'http://preview.url/1', trackName: 'Bohemian Rhapsody', artistName: 'Queen' }
        ]);

        const result = await getItunesPreview('Bohemian Rhapsody', 'Queen');
        expect(result).toEqual({
            status: 'found',
            previewUrl: 'http://preview.url/1',
            artworkUrl: ''
        });
    });

    it('should NOT match "Me" when searching for "Me & You Together Song"', async () => {
        mockItunesResponse([
            { trackName: 'Me', artistName: 'The 1975', previewUrl: 'http://wrong-url.com', kind: 'song' }
        ]);

        const result = await getItunesPreview('Me & You Together Song', 'The 1975');
        expect(result).toEqual({ status: 'missing' });
    });

    it('skips a same-artist result with a different track name', async () => {
        mockItunesResponse([
            { previewUrl: 'http://preview.url/holiday', trackName: 'Holiday', artistName: 'Green Day' },
            { previewUrl: 'http://preview.url/american-idiot', trackName: 'American Idiot', artistName: 'Green Day' }
        ]);

        const result = await getItunesPreview('American Idiot', 'Green Day');
        expect(result).toMatchObject({ status: 'found', previewUrl: 'http://preview.url/american-idiot' });
    });

    it('matches tracks with punctuation differences (e.g. Rio vs Rio [Remaster])', async () => {
        mockItunesResponse([
            { previewUrl: 'http://preview.url/rio', trackName: 'Rio [2009 Remaster]', artistName: 'Duran Duran' }
        ]);

        const result = await getItunesPreview('Rio - 2009 Remaster', 'Duran Duran');
        expect(result).toMatchObject({ status: 'found', previewUrl: 'http://preview.url/rio' });
    });

    it('returns missing when no result meets the similarity threshold', async () => {
        mockItunesResponse([
            { previewUrl: 'http://preview.url/wrong', trackName: 'Completely Different Song', artistName: 'My Artist' }
        ]);

        const result = await getItunesPreview('My Target Song', 'My Artist');
        expect(result).toEqual({ status: 'missing' });
    });

    it('cleans "Remaster" from the search query', async () => {
        mockItunesResponse([
            { trackName: 'Shakedown Street', artistName: 'Grateful Dead', previewUrl: 'http://preview.url/shakedown', kind: 'song' }
        ]);

        const result = await getItunesPreview('Shakedown Street - 2013 Remaster', 'The Grateful Dead');
        expect(result).toMatchObject({ status: 'found', previewUrl: 'http://preview.url/shakedown' });
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('term=Shakedown%20Street%20The%20Grateful%20Dead'),
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('finds the target even if buried among live variants', async () => {
        const mockResults: any[] = [];
        for (let i = 0; i < 20; i++) {
            mockResults.push({
                trackName: `American Idiot (Live variant ${i})`,
                artistName: 'Green Day',
                previewUrl: 'http://wrong.url',
                kind: 'song'
            });
        }
        mockResults.push({ trackName: 'American Idiot', artistName: 'Green Day', previewUrl: 'http://right.url/idiot', kind: 'song' });
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ resultCount: 22, results: mockResults })
        });

        const result = await getItunesPreview('American Idiot', 'Green Day');
        expect(result).toMatchObject({ status: 'found', previewUrl: 'http://right.url/idiot' });
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=50'), expect.anything());
    });

    it('rejects a live variant when strict matching fails', async () => {
        mockItunesResponse([
            { trackName: 'American Idiot (Live at Irving Plaza)', artistName: 'Green Day', previewUrl: 'http://preview.url/live', kind: 'song' }
        ]);

        const result = await getItunesPreview('American Idiot', 'Green Day');
        expect(result).toEqual({ status: 'missing' });
    });

    it('does not fall back to a different artist even if the title matches', async () => {
        mockItunesResponse([
            { trackName: 'American Idiot', artistName: '5 Seconds of Summer', previewUrl: 'http://preview.url/cover', kind: 'song' }
        ]);

        const result = await getItunesPreview('American Idiot', 'Green Day');
        expect(result).toEqual({ status: 'missing' });
    });

    it('prioritizes tracks that match the provided album name', async () => {
        mockItunesResponse([
            { trackName: 'The 1975', artistName: 'The 1975', collectionName: 'Being Funny In A Foreign Language', previewUrl: 'http://preview.url/wrong-album', kind: 'song' },
            { trackName: 'The 1975', artistName: 'The 1975', collectionName: 'The 1975', previewUrl: 'http://preview.url/correct-album', kind: 'song' }
        ]);

        const result = await getItunesPreview('The 1975', 'The 1975', 'The 1975');
        expect(result).toMatchObject({ status: 'found', previewUrl: 'http://preview.url/correct-album' });
    });

    it('returns error on a non-ok response', async () => {
        (global.fetch as any).mockResolvedValue({ ok: false, status: 500, json: vi.fn() });

        const result = await getItunesPreview('Song', 'Artist');
        expect(result).toEqual({ status: 'error' });
    });

    it('returns error when the request throws', async () => {
        (global.fetch as any).mockRejectedValue(new Error('network down'));

        const result = await getItunesPreview('Song', 'Artist');
        expect(result).toEqual({ status: 'error' });
    });
});
