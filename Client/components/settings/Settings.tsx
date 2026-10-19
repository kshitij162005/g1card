import React from 'react';

// Building blocks shared by the patient, hospital and admin settings pages, so all three read the same:
// a page header, then sections with a short explanation on the left and the controls on the right.

export const SettingsPage: React.FC<{ kicker: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ kicker, title, subtitle, actions, children }) => (
    <div className="st">
        <header className="st-head">
            <div>
                <p className="st-kicker">{kicker}</p>
                <h1 className="app-title st-title">{title}</h1>
                {subtitle && <p className="st-sub">{subtitle}</p>}
            </div>
            {actions && <div className="st-head-actions">{actions}</div>}
        </header>
        {children}
    </div>
);

export const SettingsSection: React.FC<{
    title: string;
    description?: React.ReactNode;
    tone?: 'default' | 'danger';
    actions?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, description, tone = 'default', actions, children }) => (
    <section className={`st-section ${tone === 'danger' ? 'st-section--danger' : ''}`}>
        <div className="st-section-intro">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
        </div>
        <div className="st-card">
            {children}
            {actions && <div className="st-card-actions">{actions}</div>}
        </div>
    </section>
);

export interface InfoItem { label: string; value?: React.ReactNode; wide?: boolean }

/** Read-only label/value pairs; empty values show a quiet dash */
export const InfoGrid: React.FC<{ items: InfoItem[] }> = ({ items }) => (
    <dl className="st-info">
        {items.map(item => (
            <div key={item.label} className={item.wide ? 'is-wide' : ''}>
                <dt>{item.label}</dt>
                <dd>{item.value === undefined || item.value === null || item.value === '' ? <span className="st-empty">Not added</span> : item.value}</dd>
            </div>
        ))}
    </dl>
);

export const Switch: React.FC<{ checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; label: string }> = ({ checked, onChange, disabled, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`st-switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange?.(!checked)}
    >
        <span />
    </button>
);

/** One setting: what it does on the left, its control on the right */
export const SettingRow: React.FC<{ title: string; description?: React.ReactNode; badge?: string; children: React.ReactNode }> = ({ title, description, badge, children }) => (
    <div className="st-row">
        <div className="st-row-text">
            <p>{title}{badge && <span className="st-badge">{badge}</span>}</p>
            {description && <small>{description}</small>}
        </div>
        <div className="st-row-control">{children}</div>
    </div>
);

export const Field: React.FC<{ label: string; htmlFor: string; hint?: React.ReactNode; wide?: boolean; children: React.ReactNode }> = ({ label, htmlFor, hint, wide, children }) => (
    <div className={`st-field ${wide ? 'is-wide' : ''}`}>
        <label htmlFor={htmlFor}>{label}</label>
        {children}
        {hint && <small>{hint}</small>}
    </div>
);

export const StatusPill: React.FC<{ tone: 'ok' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => (
    <span className={`st-pill st-pill--${tone}`}>{children}</span>
);
