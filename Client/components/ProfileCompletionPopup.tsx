import React from 'react';

export interface OnboardingField {
    key: string;
    label: string;
    value: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'tel' | 'url' | 'date';
    helpText?: string;
}

interface ProfileCompletionPopupProps {
    isOpen: boolean;
    roleLabel: 'Patient' | 'Hospital';
    title?: string;
    subtitle?: string;
    fields: OnboardingField[];
    skippedFields: string[];
    onFieldChange: (key: string, value: string) => void;
    onSkipField: (key: string) => void;
    onUnskipField: (key: string) => void;
    onSubmit: () => void;
    onLater: () => void;
    onOpenDetails: () => void;
    saving?: boolean;
}

const ProfileCompletionPopup: React.FC<ProfileCompletionPopupProps> = ({
    isOpen,
    roleLabel,
    title,
    subtitle,
    fields,
    skippedFields,
    onFieldChange,
    onSkipField,
    onUnskipField,
    onSubmit,
    onLater,
    onOpenDetails,
    saving = false,
}) => {
    if (!isOpen) return null;

    const answeredCount = fields.filter((field) => field.value.trim() && !skippedFields.includes(field.key)).length;
    const deferredCount = skippedFields.length;
    const progressCount = answeredCount + deferredCount;
    const progressPercent = fields.length > 0 ? Math.round((progressCount / fields.length) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_20px_50px_rgba(36,50,71,0.24)] dark:shadow-[0_20px_50px_rgba(2,6,23,0.65)] overflow-hidden">
                <div className="relative p-7 border-b border-[var(--app-border)] bg-[linear-gradient(120deg,rgba(34,197,94,0.12),rgba(14,165,233,0.08),rgba(59,130,246,0.12))] dark:bg-[linear-gradient(120deg,rgba(34,197,94,0.18),rgba(14,165,233,0.10),rgba(59,130,246,0.14))]">
                    <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-white/30 dark:bg-white/10 blur-3xl" />
                    <div className="relative">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">{roleLabel} onboarding</p>
                        <h3 className="mt-2 text-2xl font-bold text-[var(--app-text)]">{title || `Finish your ${roleLabel.toLowerCase()} profile`}</h3>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">
                            {subtitle || 'Answer what you can now. You can defer any question and continue using the app.'}
                        </p>
                        <div className="mt-5">
                            <div className="flex items-center justify-between text-xs text-[var(--app-muted)]">
                                <span>{progressCount} of {fields.length} handled</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-[var(--app-surface-soft)] overflow-hidden">
                                <div className="h-full bg-brand-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-h-[58vh] overflow-y-auto p-7 space-y-4">
                    {fields.map((field) => {
                        const isSkipped = skippedFields.includes(field.key);

                        return (
                            <div key={field.key} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]/60 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <label htmlFor={`onboarding-${field.key}`} className="text-sm font-semibold text-[var(--app-text)]">
                                            {field.label}
                                        </label>
                                        {field.helpText && <p className="mt-1 text-xs text-[var(--app-muted)]">{field.helpText}</p>}
                                    </div>
                                    {isSkipped ? (
                                        <button
                                            type="button"
                                            onClick={() => onUnskipField(field.key)}
                                            className="shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                                        >
                                            Answer now
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onSkipField(field.key)}
                                            className="shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                        >
                                            Do later
                                        </button>
                                    )}
                                </div>

                                {isSkipped ? (
                                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Deferred for later. You can update this anytime in details.</p>
                                ) : (
                                    <input
                                        id={`onboarding-${field.key}`}
                                        type={field.type || 'text'}
                                        value={field.value}
                                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                                        placeholder={field.placeholder || 'Add details'}
                                        className="mt-3 block w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] p-5 bg-[var(--app-surface)]">
                    <button
                        type="button"
                        onClick={onLater}
                        className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                    >
                        Do entire onboarding later
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onOpenDetails}
                            className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                        >
                            Open details section
                        </button>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={saving}
                            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-70"
                        >
                            {saving ? 'Saving...' : 'Save onboarding answers'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileCompletionPopup;
