import React from 'react';

interface ProfileCompletionPopupProps {
    isOpen: boolean;
    roleLabel: 'Patient' | 'Hospital';
    missingItems: string[];
    onCompleteNow: () => void;
    onLater: () => void;
}

const ProfileCompletionPopup: React.FC<ProfileCompletionPopupProps> = ({
    isOpen,
    roleLabel,
    missingItems,
    onCompleteNow,
    onLater,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[0_20px_50px_rgba(36,50,71,0.24)] dark:shadow-[0_20px_50px_rgba(2,6,23,0.65)]">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-amber-900/30 p-2 text-amber-300">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.492-1.647-1.743-2.98l5.58-9.921zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-7a1 1 0 00-1 1v3a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--app-text)]">Complete Your {roleLabel} Profile</h3>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">
                            A few details are missing. Completing your profile improves access, approvals, and notifications.
                        </p>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                    <p className="mb-2 text-sm font-medium text-[var(--app-text)]">Missing details:</p>
                    <div className="flex flex-wrap gap-2">
                        {missingItems.map((item) => (
                            <span key={item} className="rounded-full bg-[var(--app-surface)] px-3 py-1 text-xs font-medium text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
                                {item}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onLater}
                        className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        onClick={onCompleteNow}
                        className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
                    >
                        Complete Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileCompletionPopup;
