import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden transition-shadow hover:shadow-xl ${className}`}>
            {title && (
                <div className="p-4 md:px-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                </div>
            )}
            <div className="p-4 md:p-6">
                {children}
            </div>
        </div>
    );
};

export default Card;