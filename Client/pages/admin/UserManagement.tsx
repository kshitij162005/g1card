import { API_URL } from '../../config/api';
import SearchBox from '../../components/SearchBox';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AppDialog, { DialogButton } from '../../components/AppDialog';

interface Patient {
    _id: string;
    username?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    patientId?: string;
    hospitalName?: string;
    createdAt: string;
    suspended?: boolean;
    suspendedAt?: string;
    suspendedReason?: string;
}

type StatusFilter = '' | 'active' | 'suspended';

const initials = (name?: string) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<StatusFilter>('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

    const [target, setTarget] = useState<Patient | null>(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(fetchPatients, searchTerm ? 250 : 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, page, status]);

    async function fetchPatients() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ search: searchTerm, page: String(page), limit: '10', status });
            const resp = await fetch(`${API_URL}/superadmin/patients?${params}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to load patients');
            setPatients(data.patients || []);
            setPagination(data.pagination || { total: 0, pages: 1, limit: 10 });
        } catch (err) {
            console.error('fetch patients error:', err);
            notify('Couldn’t load patients. Try again.');
        } finally {
            setLoading(false);
        }
    }

    const openDialog = (patient: Patient) => {
        setTarget(patient);
        setReason('');
    };

    const confirmSuspension = async () => {
        if (!target || !user?.id) return;
        const suspend = !target.suspended;
        setSaving(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/patients/${target._id}/suspension`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: user.id, suspended: suspend, reason }),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.error || 'Update failed');
            setPatients(prev => prev.map(p => (p._id === target._id ? { ...p, ...data.patient } : p)));
            notify(suspend ? `${target.name || 'Patient'} is suspended.` : `${target.name || 'Patient'} is active again.`);
            setTarget(null);
        } catch (err) {
            notify(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const filters: Array<{ value: StatusFilter; label: string }> = [
        { value: '', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[13px] font-semibold text-[var(--app-accent)]">People</p>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-1">Patients</h2>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">{pagination.total} {status === 'suspended' ? 'suspended' : status === 'active' ? 'active' : 'registered'} patient{pagination.total === 1 ? '' : 's'}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="inline-flex rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-1" role="tablist">
                        {filters.map(f => (
                            <button
                                key={f.label}
                                type="button"
                                role="tab"
                                aria-selected={status === f.value}
                                onClick={() => { setStatus(f.value); setPage(1); }}
                                className={`h-8 rounded-full px-4 text-sm font-medium transition-colors ${status === f.value ? 'bg-[var(--app-primary)] text-[var(--app-primary-text)]' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <SearchBox
                        className="w-full sm:w-80"
                        placeholder="Search name, email, phone or ID"
                        live
                        onSearch={q => { setSearchTerm(q); setPage(1); }}
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow)]">
                {loading && patients.length === 0 ? (
                    <div className="space-y-3 p-5">
                        {[0, 1, 2, 3].map(n => <div key={n} className="h-12 animate-pulse rounded-lg bg-[var(--app-surface-soft)]" />)}
                    </div>
                ) : patients.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <p className="font-serif text-lg font-semibold">No patients found</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">{searchTerm ? 'Try a different search.' : status === 'suspended' ? 'No accounts are suspended.' : 'Patients appear here once they sign up.'}</p>
                    </div>
                ) : (
                    <ul className={`divide-y divide-[var(--app-border)] ${loading ? 'opacity-60' : ''}`}>
                        {patients.map(patient => (
                            <li key={patient._id} className={`flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center ${patient.suspended ? 'bg-[var(--app-danger-soft)]/40' : ''}`}>
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${patient.suspended ? 'bg-[var(--app-danger-soft)] text-[var(--app-danger)]' : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'}`}>
                                        {initials(patient.name)}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">{patient.name || 'Name not provided'}</p>
                                        <p className="truncate text-xs text-[var(--app-muted)]">
                                            {patient.email || patient.username || 'No email'} · <span className="font-mono">{patient.patientId || 'No ID'}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-sm text-[var(--app-muted)] md:w-36">
                                    <p className="text-xs">Joined</p>
                                    <p className="text-[var(--app-text)]">{formatDate(patient.createdAt)}</p>
                                </div>
                                <div className="md:w-48">
                                    {patient.suspended ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-danger-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-danger)]" title={patient.suspendedReason || ''}>
                                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-danger)]" /> Suspended {patient.suspendedAt ? formatDate(patient.suspendedAt) : ''}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-success-text)]">
                                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-success-text)]" /> Active
                                        </span>
                                    )}
                                </div>
                                <div className="md:w-32 md:text-right">
                                    <DialogButton
                                        className={patient.suspended ? '' : '!text-[var(--app-danger)]'}
                                        onClick={() => openDialog(patient)}
                                    >
                                        {patient.suspended ? 'Reactivate' : 'Suspend'}
                                    </DialogButton>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {pagination.pages > 1 && (
                <div className="flex items-center justify-between text-sm text-[var(--app-muted)]">
                    <span>Page {page} of {pagination.pages}</span>
                    <div className="flex gap-2">
                        <DialogButton disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</DialogButton>
                        <DialogButton disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>Next</DialogButton>
                    </div>
                </div>
            )}

            <AppDialog
                open={Boolean(target)}
                onClose={() => !saving && setTarget(null)}
                size="sm"
                tone={target?.suspended ? 'accent' : 'danger'}
                eyebrow={target?.suspended ? 'Reactivate account' : 'Suspend account'}
                title={target?.suspended ? `Reactivate ${target?.name || 'this patient'}?` : `Suspend ${target?.name || 'this patient'}?`}
                footer={
                    <>
                        <DialogButton onClick={() => setTarget(null)} disabled={saving}>Cancel</DialogButton>
                        <DialogButton variant={target?.suspended ? 'primary' : 'danger'} onClick={confirmSuspension} disabled={saving}>
                            {saving ? 'Saving…' : target?.suspended ? 'Reactivate' : 'Suspend account'}
                        </DialogButton>
                    </>
                }
            >
                {target?.suspended ? (
                    <p className="text-sm leading-relaxed text-[var(--app-muted)]">
                        They’ll be able to sign in and use their portal again, hospitals will stop seeing the suspension notice, and Golu will include them in answers.
                    </p>
                ) : (
                    <>
                        <ul className="space-y-2 text-sm leading-relaxed text-[var(--app-muted)]">
                            <li>They’re signed out and can’t use their patient portal.</li>
                            <li>Hospitals see a clear “suspended” notice on their profile.</li>
                            <li>Golu leaves them out of answers unless you ask about them.</li>
                            <li>No records are deleted. You can reactivate at any time.</li>
                        </ul>
                        <label className="mt-5 block text-sm font-medium" htmlFor="suspend-reason">
                            Reason <span className="font-normal text-[var(--app-muted)]">(optional, shared with the patient)</span>
                        </label>
                        <textarea
                            id="suspend-reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="e.g. Duplicate account, under review"
                            className="mt-2 w-full rounded-[10px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--app-accent)] focus:outline-none focus:ring-[3px] focus:ring-[var(--app-accent-soft)]"
                        />
                    </>
                )}
            </AppDialog>
        </div>
    );
};

export default UserManagement;
