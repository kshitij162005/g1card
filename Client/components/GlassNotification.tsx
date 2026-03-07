import React, { useEffect, useState } from 'react';

interface GlassNotificationProps {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    onClose?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
    autoClose?: number; // milliseconds
}

const GlassNotification: React.FC<GlassNotificationProps> = ({
    title,
    message,
    type = 'info',
    onClose,
    action,
    autoClose = 5000
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // Animate in
        setTimeout(() => setIsAnimating(true), 10);

        // Auto-close timer
        if (autoClose > 0) {
            const timer = setTimeout(() => {
                handleClose();
            }, autoClose);
            return () => clearTimeout(timer);
        }
    }, [autoClose]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsVisible(false);
            onClose?.();
        }, 300);
    };

    if (!isVisible) return null;

    const iconColors = {
        info: 'text-blue-400',
        success: 'text-green-400',
        warning: 'text-yellow-400',
        error: 'text-red-400'
    };

    const icons = {
        info: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        success: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        warning: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        error: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    return (
        <div
            className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ${
                isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
        >
            {/* Glass morphism card */}
            <div className="backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
                
                <div className="relative p-4">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 ${iconColors[type]}`}>
                            {icons[type]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white text-sm mb-1">
                                {title}
                            </h4>
                            <p className="text-slate-300 text-xs leading-relaxed">
                                {message}
                            </p>

                            {/* Action button */}
                            {action && (
                                <button
                                    onClick={() => {
                                        action.onClick();
                                        handleClose();
                                    }}
                                    className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors border border-blue-500/30"
                                >
                                    {action.label}
                                </button>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlassNotification;
