import React, { useEffect, useState } from 'react';
import { ThemeMode, getStoredTheme, setStoredTheme, toggleStoredTheme } from '../utils/theme';

const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<ThemeMode>('dark');

    useEffect(() => {
        setTheme(getStoredTheme());
    }, []);

    useEffect(() => {
        setStoredTheme(theme);
    }, [theme]);

    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme((prev) => toggleStoredTheme(prev))}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.95 2.05a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM6.364 6.364a1 1 0 010 1.414L5.657 8.485a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 6a4 4 0 100 8 4 4 0 000-8zm-8 4a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm3.05 5.95a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm5.657-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707z" />
                </svg>
            ) : (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8 8 0 1010.586 10.586z" />
                </svg>
            )}
        </button>
    );
};

export default ThemeToggle;