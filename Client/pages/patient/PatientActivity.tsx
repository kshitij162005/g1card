import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ActivityTimeline from '../../components/ActivityTimeline';

// Who looked at or changed this patient's records, and when
const PatientActivity: React.FC = () => {
    const { user } = useAuth();
    return (
        <div className="space-y-6">
            <div>
                <p className="text-[13px] font-semibold text-[var(--app-accent)]">Your records</p>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-1">Who saw what</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)] max-w-2xl">
                    Every time a hospital opens your records, asks for access or adds something new, it’s written here. Nothing is hidden from you.
                </p>
            </div>
            {user?.id && (
                <ActivityTimeline
                    scope="patient"
                    entityId={user.id}
                    viewerId={user.id}
                    allowExport
                    emptyHint="When a hospital opens or adds to your records, you’ll see it here."
                />
            )}
        </div>
    );
};

export default PatientActivity;
