import React from 'react';
import Card from './Card';

export type StatTone = 'blue' | 'green' | 'amber' | 'violet' | 'teal' | 'rose';
export type StatIcon = 'hospital' | 'check' | 'people' | 'records' | 'clock' | 'shield';

const ICONS: Record<StatIcon, React.ReactNode> = {
    hospital: <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M12 7v6M9 10h6M9 21v-4h6v4" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
    records: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
};

interface StatCardProps {
    title: string;
    value: string | number;
    loading?: boolean;
    tone?: StatTone;
    icon?: StatIcon;
    hint?: string;
}

// Dashboard number with a tinted icon badge
const StatCard: React.FC<StatCardProps> = ({ title, value, loading, tone = 'blue', icon = 'records', hint }) => (
    <Card className={`app-stat-card app-tone--${tone}`}>
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm font-medium text-[var(--app-muted)]">{title}</p>
                <p className="app-stat mt-2">{loading ? '—' : value}</p>
                {hint && <p className="mt-1 text-xs text-[var(--app-muted)]">{hint}</p>}
            </div>
            <span className="app-tone-chip" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
            </span>
        </div>
    </Card>
);

export default StatCard;
