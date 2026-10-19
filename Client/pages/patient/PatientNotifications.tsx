import React, { useState } from 'react';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSSE } from '../../hooks/useSSE';
import NotificationInbox, { InboxNotification } from '../../components/NotificationInbox';

type Level = 'GENERAL' | 'COMPLETE';

// Approve/deny controls shown inside access-request notifications
const AccessDecision: React.FC<{ n: InboxNotification; patientId: string; onDone: () => void }> = ({ n, patientId, onDone }) => {
    const [level, setLevel] = useState<Level>('GENERAL');
    const [busy, setBusy] = useState(false);
    const upgrade = n.type === 'ACCESS_UPGRADE_REQUEST';

    const decide = async (approve: boolean) => {
        setBusy(true);
        try {
            let resp: Response;
            if (upgrade) {
                resp = await fetch(`${API_URL}/patients/${patientId}/notifications/${n.id}/upgrade-decision`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decision: approve ? 'APPROVE' : 'DENY' }),
                });
            } else {
                const accessId = n.relatedAccess || n.metadata?.accessId;
                if (!accessId) return;
                resp = await fetch(`${API_URL}/patients/${patientId}/access-requests/${accessId}/decision`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(approve ? { decision: 'APPROVE', accessLevel: level } : { decision: 'DENY' }),
                });
            }
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) { notify(data?.error || data?.message || 'Could not update the request'); return; }
            notify(data?.message || (approve ? 'Access approved' : 'Access denied'));
            onDone();
        } catch {
            notify('Could not update the request');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {!upgrade && (
                <div className="hd-seg" role="radiogroup" aria-label="Access level">
                    {(['GENERAL', 'COMPLETE'] as Level[]).map(l => (
                        <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? 'is-on' : ''} onClick={() => setLevel(l)}>
                            {l === 'GENERAL' ? 'Partial access' : 'Complete history'}
                        </button>
                    ))}
                </div>
            )}
            <button type="button" className="nt-btn nt-btn--sm" disabled={busy} onClick={() => decide(false)}>Deny</button>
            <button type="button" className="nt-btn nt-btn--sm nt-btn--primary" disabled={busy} onClick={() => decide(true)}>
                {upgrade ? 'Allow complete history' : 'Approve'}
            </button>
        </>
    );
};

const PatientNotifications: React.FC = () => {
    const { user } = useAuth();

    useSSE({
        userId: user?.id,
        userType: 'Patient',
        enabled: !!user?.id,
        onEvent: () => window.dispatchEvent(new CustomEvent('g1card:notifications-changed')),
    });

    if (!user?.id) return null;

    return (
        <NotificationInbox
            kicker="Your records"
            subtitle="Access requests, approvals and every time a hospital opens or adds to your records."
            baseUrl={`${API_URL}/patients/${user.id}/notifications`}
            renderActions={(n, reload) =>
                (n.type === 'ACCESS_REQUEST' || n.type === 'ACCESS_UPGRADE_REQUEST') && !n.isRead
                    ? <AccessDecision n={n} patientId={user.id} onDone={reload} />
                    : null}
            linkFor={(n) => {
                if (n.type === 'MEDICAL_RECORD_CREATED') return { label: 'View record', to: '/patient/health-history' };
                if (/^ACCESS_/.test(n.type) && n.isRead) return { label: 'Manage access', to: '/patient/settings' };
                if (n.type === 'RECORDS_ACCESSED') return { label: 'See activity', to: '/patient/activity' };
                return null;
            }}
        />
    );
};

export default PatientNotifications;
