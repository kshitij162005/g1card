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
        ? 'fixed inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm z-50'
        : 'flex items-center justify-center p-8';

    return (
        <div className={containerClasses}>
            <div className="flex flex-col items-center gap-4">
                {/* Simple Rotating Spinner */}
                <div className="relative">
                    {/* Main rotating container */}
                    <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
                        {/* Clean rotating border */}
                        <div className="absolute inset-0 rounded-full border-4 border-slate-700/30" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-cyan-500 animate-spin" />
                        
                        {/* Center circle with medical cross */}
                        <div className="absolute inset-[4px] rounded-full bg-slate-900 flex items-center justify-center">
                            {/* Medical Cross Icon */}
                            <svg 
                                className="w-1/2 h-1/2 text-blue-400" 
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
                    <p className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200 font-semibold text-base sm:text-lg tracking-wide animate-pulse">
                        {text}
                    </p>
                    
                    {/* Animated dots */}
                    <div className="flex gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Loader;
