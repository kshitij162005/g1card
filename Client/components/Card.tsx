import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`bg-[var(--app-surface)] rounded-2xl shadow-[0_10px_30px_rgba(36,50,71,0.14)] dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)] border border-[var(--app-border)] overflow-hidden transition-shadow hover:shadow-[0_14px_34px_rgba(36,50,71,0.2)] dark:hover:shadow-[0_14px_34px_rgba(2,6,23,0.52)] ${className}`}>
            {title && (
                <div className="p-4 md:px-6 border-b border-[var(--app-border)]">
                    <h3 className="text-lg font-semibold text-[var(--app-text)]">{title}</h3>
                </div>
            )}
            <div className="p-4 md:p-6">
                {children}
            </div>
        </div>
    );
};

export default Card;