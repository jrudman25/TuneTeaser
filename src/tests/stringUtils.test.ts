/**
 * stringUtils.test.ts
 * Tests the stringUtils utility.
 * @version 2026.02.10
 */
import { describe, it, expect } from 'vitest';
import { normalizeString } from '../utils/stringUtils';

describe('normalizeString', () => {
    it('normalizes basic strings', () => {
        expect(normalizeString('Hello World')).toBe('helloworld');
    });

    it('handles special characters by stripping them', () => {
        expect(normalizeString('♾')).toBe('');
    });

    it('handles non-English characters by stripping them', () => {
        expect(normalizeString('ピースサイン - Peace Sign ')).toBe('peacesign');
    });
});
