import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ActivityTimeline from '../../components/ActivityTimeline';

// Everything this hospital's team did: records opened, access requests, records created
const HospitalAuditLogs: React.FC = () => {
    const { user } = useAuth();
    return (
        <div className="space-y-6">
            <div>
                <p className="text-[13px] font-semibold text-[var(--app-accent)]">Audit trail</p>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-1">Activity</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)] max-w-2xl">
                    Every record your team opened, every access request and every record created. Click an entry for the details.
                </p>
            </div>
            {user?.id && (
                <ActivityTimeline
                    scope="hospital"
                    entityId={user.id}
                    viewerId={user.id}
                    allowExport
                    emptyHint="When your team opens or adds records, it’ll show up here."
                />
            )}
        </div>
    );
};

export default HospitalAuditLogs;
