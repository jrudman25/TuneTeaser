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
