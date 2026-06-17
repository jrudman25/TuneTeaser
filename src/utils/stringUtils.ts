/**
 * stringUtils.ts
 * Shared string manipulation utilities.
 * @version 2026.02.09
 */

/**
 * Normalizes a string by converting to lowercase and removing non-alphanumeric characters.
 * Useful for fuzzy matching.
 * @param str The string to normalize
 * @returns The normalized string
 */
export const normalizeString = (str: string): string => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const songVersionKeywordPattern = /(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)/i;

export const normalizeSongTitleForGuess = (str: string): string => {
    const trimmed = str.trim();
    const withoutBracketedVersion = trimmed.replace(/\s*[[(][^\])]*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)[^\])]*[\])]\s*$/i, '').trim();
    const bracketCleaned = withoutBracketedVersion || trimmed;
    const withoutDashVersion = bracketCleaned.replace(/\s+-\s+.*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio).*$/i, '').trim();
    const cleaned = songVersionKeywordPattern.test(bracketCleaned) ? withoutDashVersion || bracketCleaned : bracketCleaned;
    return normalizeString(cleaned);
};
