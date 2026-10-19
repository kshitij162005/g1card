import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    /** Optional control shown at the right of the title row (e.g. an Edit button) */
    action?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, action }) => {
    return (
        <div className={`bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] shadow-[var(--app-shadow)] overflow-hidden ${className}`}>
            {title && (
                <div className="flex items-center gap-3 px-5 pt-5 pb-3 md:px-6">
                    <h3 className="app-card-title text-[15px] font-semibold tracking-[-0.005em] text-[var(--app-text)]">{title}</h3>
                    {action}
                </div>
            )}
            <div className={title ? 'px-5 pb-5 md:px-6 md:pb-6' : 'p-5 md:p-6'}>
                {children}
            </div>
        </div>
    );
};

export default Card;
