import React from 'react';

interface LoaderProps {
    text?: string;
    size?: 'small' | 'medium' | 'large';
    fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ 
    text = 'Loading...', 
    size = 'medium',
    fullScreen = false 
}) => {
    const sizeClasses = {
        small: 'w-8 h-8',
        medium: 'w-16 h-16',
        large: 'w-24 h-24'
    };

    const containerClasses = fullScreen
        ? 'fixed inset-0 flex items-center justify-center backdrop-blur-md z-[120]'
        : 'flex items-center justify-center p-8';

    return (
        <div className={containerClasses} style={fullScreen ? { backgroundColor: 'color-mix(in srgb, var(--app-bg) 94%, transparent)' } : undefined}>
            <div className={`flex flex-col items-center gap-4 ${fullScreen ? 'rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/92 px-8 py-6 shadow-[0_18px_40px_rgba(22,33,49,0.24)]' : ''}`}>
                {/* Simple Rotating Spinner */}
                <div className="relative">
                    {/* Main rotating container */}
                    <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
                        {/* Clean rotating border */}
                        <div className="absolute inset-0 rounded-full border-4 border-[var(--app-border)]/55" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-cyan-600 animate-spin" />
                        
                        {/* Center circle with medical cross */}
                        <div className="absolute inset-[4px] rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-center">
                            {/* Medical Cross Icon */}
                            <svg 
                                className="w-1/2 h-1/2 text-blue-600" 
                                fill="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <rect x="9" y="4" width="6" height="16" rx="1" />
                                <rect x="4" y="9" width="16" height="6" rx="1" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Loading text */}
                <div className="flex flex-col items-center gap-3">
                    <p className="text-[var(--app-text)] font-semibold text-base sm:text-lg tracking-wide animate-pulse">
                        {text}
                    </p>
                    
                    {/* Animated dots */}
                    <div className="flex gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Loader;
