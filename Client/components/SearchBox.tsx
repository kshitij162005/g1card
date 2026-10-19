import React, { useEffect, useRef, useState } from 'react';

interface SearchBoxProps {
    placeholder?: string;
    /** Called with the trimmed query on Enter, on the Search button, on clear, and (if live) while typing */
    onSearch: (query: string) => void;
    initialValue?: string;
    /** Also search as the user types (debounced) */
    live?: boolean;
    className?: string;
    ariaLabel?: string;
}

// One search field for the whole app: Enter or the button searches, × clears
const SearchBox: React.FC<SearchBoxProps> = ({ placeholder = 'Search', onSearch, initialValue = '', live = false, className = '', ariaLabel }) => {
    const [value, setValue] = useState(initialValue);
    const onSearchRef = useRef(onSearch);
    onSearchRef.current = onSearch;
    const first = useRef(true);

    useEffect(() => {
        if (!live) return;
        if (first.current) { first.current = false; return; }
        const id = window.setTimeout(() => onSearchRef.current(value.trim()), 300);
        return () => window.clearTimeout(id);
    }, [value, live]);

    return (
        <form
            role="search"
            className={`app-search ${className}`}
            onSubmit={e => { e.preventDefault(); onSearch(value.trim()); }}
        >
            <svg className="app-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
                type="search"
                value={value}
                placeholder={placeholder}
                aria-label={ariaLabel || placeholder}
                onChange={e => {
                    setValue(e.target.value);
                    if (!e.target.value && !live) onSearch('');
                }}
            />
            {value && (
                <button type="button" className="app-search-clear" aria-label="Clear search" onClick={() => { setValue(''); onSearch(''); }}>×</button>
            )}
            <button type="submit" className="app-search-go">Search</button>
        </form>
    );
};

export default SearchBox;
