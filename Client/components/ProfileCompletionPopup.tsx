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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-completion-title">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_24px_60px_-20px_rgba(21,32,46,0.35)]">
                <div className="px-7 pt-7 pb-5">
                    <p className="text-[13px] font-semibold text-[var(--app-accent)]">{roleLabel} profile</p>
                    <h3 id="profile-completion-title" className="mt-2 font-serif text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[var(--app-text)]">
                        {title || `Finish your ${roleLabel.toLowerCase()} profile`}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[var(--app-muted)]">
                        {subtitle || 'Answer what you can now. Anything you leave for later stays in your profile settings.'}
                    </p>
                    <div className="mt-5 flex items-center gap-3">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--app-surface-soft)]">
                            <div className="h-full rounded-full bg-[var(--app-accent)] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-[var(--app-muted)]">{progressCount} of {fields.length}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border-t border-[var(--app-border)] px-7">
                    {fields.map((field) => {
                        const isSkipped = skippedFields.includes(field.key);
                        return (
                            <div key={field.key} className="border-b border-[var(--app-border)] py-4 last:border-b-0">
                                <div className="flex items-baseline justify-between gap-3">
                                    <label htmlFor={`onboarding-${field.key}`} className="text-sm font-medium text-[var(--app-text)]">
                                        {field.label}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => (isSkipped ? onUnskipField(field.key) : onSkipField(field.key))}
                                        className="shrink-0 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                    >
                                        {isSkipped ? 'Answer now' : 'Later'}
                                    </button>
                                </div>
                                {field.helpText && <p className="mt-1 text-xs text-[var(--app-muted)]">{field.helpText}</p>}
                                {isSkipped ? (
                                    <p className="mt-2 text-sm text-[var(--app-muted)]">Saved for later. You can add it from your profile any time.</p>
                                ) : (
                                    <input
                                        id={`onboarding-${field.key}`}
                                        type={field.type || 'text'}
                                        value={field.value}
                                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                                        placeholder={field.placeholder || ''}
                                        className="mt-2 block h-11 w-full rounded-[10px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3.5 text-[15px] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)] focus:outline-none focus:ring-[3px] focus:ring-[var(--app-accent-soft)]"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--app-border)] px-7 py-5">
                    <button type="button" onClick={onLater} className="text-sm font-medium text-[var(--app-muted)] hover:text-[var(--app-text)]">
                        Do this later
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onOpenDetails}
                            className="h-10 rounded-full border border-[var(--app-border-strong)] px-4 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                        >
                            Open full profile
                        </button>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={saving}
                            className="h-10 rounded-full bg-[var(--app-primary)] px-5 text-sm font-semibold text-[var(--app-primary-text)] hover:bg-[var(--app-primary-hover)] disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save answers'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileCompletionPopup;
