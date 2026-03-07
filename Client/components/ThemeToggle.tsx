import React, { useEffect } from 'react';

/**
 * ThemeToggle component - Dark Mode Only
 * For MVP release, only dark mode is supported.
 * This component ensures dark mode is always active.
 */
const ThemeToggle: React.FC = () => {
    useEffect(() => {
        // Force dark mode on mount
        const root = window.document.documentElement;
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }, []);

    // Return null to hide the toggle button completely
    return null;
};

export default ThemeToggle;