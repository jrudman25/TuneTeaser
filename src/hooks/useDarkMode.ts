import { useState, useEffect } from 'react';

export const useDarkMode = () => {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        try {
            return localStorage.getItem('tuneteaser-theme') === 'dark';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('tuneteaser-theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('tuneteaser-theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(prev => !prev);
    };

    return { isDarkMode, toggleTheme };
};
