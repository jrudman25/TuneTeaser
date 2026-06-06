import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDarkMode } from '../hooks/useDarkMode';

describe('useDarkMode', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
    });

    it('initializes from localStorage and applies the dark class', () => {
        localStorage.setItem('tuneteaser-theme', 'dark');

        const { result } = renderHook(() => useDarkMode());

        expect(result.current.isDarkMode).toBe(true);
        expect(document.body).toHaveClass('dark-theme');
        expect(localStorage.getItem('tuneteaser-theme')).toBe('dark');
    });

    it('toggles between dark and light themes', () => {
        const { result } = renderHook(() => useDarkMode());

        expect(result.current.isDarkMode).toBe(false);
        expect(document.body).not.toHaveClass('dark-theme');

        act(() => result.current.toggleTheme());

        expect(result.current.isDarkMode).toBe(true);
        expect(document.body).toHaveClass('dark-theme');

        act(() => result.current.toggleTheme());

        expect(result.current.isDarkMode).toBe(false);
        expect(document.body).not.toHaveClass('dark-theme');
        expect(localStorage.getItem('tuneteaser-theme')).toBe('light');
    });
});
