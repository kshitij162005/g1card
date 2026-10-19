import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import AppDialog, { DialogButton } from '../../components/AppDialog';
import { SettingsPage, SettingsSection, InfoGrid, SettingRow, Field, StatusPill } from '../../components/settings/Settings';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';
import { useSSE } from '../../hooks/useSSE';
import GlassNotification from '../../components/GlassNotification';

interface HospitalData {
    _id: string;
    name: string;
    username: string;
    regNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
    license?: string;
    contactEmail?: string;
    phone?: string;
    website?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
    designation?: string;
    active: boolean;
    createdAt: string;
}

interface UpdateRequest {
    _id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    requestedChanges: any;
    originalData: any;
    adminRemarks?: string;
    conversation: Array<{
        sender: 'HOSPITAL' | 'ADMIN';
        message: string;
        timestamp: string;
    }>;
    createdAt: string;
    resubmittedAt?: string;
    reviewedAt?: string;
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    consequences: string[];
    confirmText: string;
    isDeactivate: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, consequences, confirmText, isDeactivate }) => (
    <AppDialog
        open={isOpen}
        onClose={onClose}
        size="sm"
        tone={isDeactivate ? 'danger' : 'accent'}
        eyebrow="Account status"
        title={title}
        subtitle={message}
        footer={<>
            <DialogButton onClick={onClose}>Cancel</DialogButton>
            <DialogButton variant={isDeactivate ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</DialogButton>
        </>}
    >
        <p className="st-form-divider !mt-0">{isDeactivate ? 'What happens' : 'What comes back'}</p>
        <ul className="st-list">
            {consequences.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
    </AppDialog>
);

const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: string; label: string; type?: string; wide?: boolean }> }> = [
    { title: 'Hospital', fields: [
        { key: 'name', label: 'Hospital name', wide: true },
        { key: 'regNumber', label: 'Registration number' },
        { key: 'license', label: 'License number' },
    ] },
    { title: 'Location', fields: [
        { key: 'address', label: 'Address', wide: true },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'pin', label: 'PIN code' },
    ] },
    { title: 'Contact', fields: [
        { key: 'username', label: 'Sign-in email', type: 'email' },
        { key: 'contactEmail', label: 'Contact email', type: 'email' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'website', label: 'Website', type: 'url' },
    ] },
    { title: 'Administrator', fields: [
        { key: 'adminName', label: 'Name' },
        { key: 'designation', label: 'Designation' },
        { key: 'adminEmail', label: 'Email', type: 'email' },
        { key: 'adminPhone', label: 'Phone', type: 'tel' },
    ] },
];
const FIELD_LABELS: Record<string, string> = Object.fromEntries(FIELD_GROUPS.flatMap(g => g.fields.map(f => [f.key, `${g.title === 'Administrator' ? 'Admin ' + f.label.toLowerCase() : f.label}`])));

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
    PENDING: { label: 'Waiting for admin review', tone: 'warn' },
    CHANGES_REQUESTED: { label: 'Admin asked for changes', tone: 'warn' },
    APPROVED: { label: 'Approved', tone: 'ok' },
    REJECTED: { label: 'Rejected', tone: 'bad' },
};

const HospitalSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const [hospital, setHospital] = useState<HospitalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<UpdateRequest | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [submitMessage, setSubmitMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState<{
        show: boolean;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    }>({ show: false, title: '', message: '', type: 'info' });
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        consequences: string[];
        confirmText: string;
        isDeactivate: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        consequences: [],
        confirmText: '',
        isDeactivate: false,
        onConfirm: () => {}
    });

    // Listen for SSE notifications
    useSSE({
        userId: user?.id,
        userType: 'Hospital',
        onEvent: (event) => {
            if (event.type.includes('UPDATE_REQUEST')) {
                fetchPendingRequest();
            }
        }
    });

    useEffect(() => {
        if (user?.id) {
            fetchHospitalData();
            fetchPendingRequest();
        }
    }, [user?.id]);

    const fetchHospitalData = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to fetch hospital data');
            setHospital(data.hospital);
            setFormData(data.hospital);
        } catch (err) {
            console.error('fetch hospital data error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingRequest = async () => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request/pending`);
            const data = await resp.json();
            if (resp.ok) {
                setPendingRequest(data.updateRequest);
            }
        } catch (err) {
            console.error('fetch pending request error:', err);
        }
    };

    const handleSubmitRequest = async () => {
        if (!user?.id) return;
        
        const changes: any = {};
        const editableFields = ['name', 'username', 'regNumber', 'license', 'address', 'city', 'state', 
                               'pin', 'contactEmail', 'phone', 'website', 'adminName', 
                               'adminEmail', 'adminPhone', 'designation'];
        
        for (const field of editableFields) {
            if (formData[field] !== hospital?.[field]) {
                changes[field] = formData[field];
            }
        }
        
        if (Object.keys(changes).length === 0) {
            setNotification({
                show: true,
                title: 'No Changes',
                message: 'No changes detected. Please modify at least one field.',
                type: 'warning'
            });
            return;
        }
        
        setSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes, message: submitMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setNotification({
                show: true,
                title: 'Request Submitted',
                message: 'Your update request has been submitted successfully! Waiting for admin approval.',
                type: 'success'
            });
            setIsEditing(false);
            setSubmitMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            setNotification({
                show: true,
                title: 'Submission Failed',
                message: err.message || 'Failed to submit update request. Please try again.',
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendMessage = async () => {
        if (!user?.id || !pendingRequest || !replyMessage.trim()) return;
        
        setSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request/${pendingRequest._id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setNotification({
                show: true,
                title: 'Message Sent',
                message: 'Your message has been sent to the admin.',
                type: 'success'
            });
            setReplyMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            setNotification({
                show: true,
                title: 'Failed to Send',
                message: err.message || 'Failed to send message. Please try again.',
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <Loader text="Loading hospital settings..." fullScreen />;
    }

    const showDeactivateModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Deactivate Hospital Account',
            message: 'Are you sure you want to deactivate your hospital account?',
            consequences: [
                'You will lose access to most system features immediately',
                'An "Account Inactive" screen will block access to the dashboard',
                'You cannot add new patients',
                'You cannot create or edit medical records',
                'Existing patient and medical data will be preserved but inaccessible',
                'Only this settings page will remain accessible',
                'You will need to reactivate to regain full access'
            ],
            confirmText: 'Deactivate Account',
            isDeactivate: true,
            onConfirm: performToggleActiveStatus
        });
    };

    const showActivateModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Activate Hospital Account',
            message: 'Are you sure you want to activate your hospital account?',
            consequences: [
                'Full access to the system will be restored',
                'You can add and manage patients',
                'You can create and edit medical records',
                'Dashboard and reporting features will be accessible',
                'All form templates will become available'
            ],
            confirmText: 'Activate Account',
            isDeactivate: false,
            onConfirm: performToggleActiveStatus
        });
    };

    const performToggleActiveStatus = async () => {
        if (!hospital || !user?.id) return;
        
        const action = hospital.active ? 'deactivate' : 'activate';
        setUpdating(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !hospital.active }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to update status');
            
            setNotification({
                show: true,
                title: 'Status Updated',
                message: `Hospital account ${action}d successfully!`,
                type: 'success'
            });
            await fetchHospitalData();

            // Notify layout to re-check account status without full page reload.
            window.dispatchEvent(new CustomEvent('hospital:status-updated'));
        } catch (err: any) {
            console.error('toggle active status error:', err);
            setNotification({
                show: true,
                title: 'Update Failed',
                message: err.message || `Unable to ${action} hospital account`,
                type: 'error'
            });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return <Loader text="Loading hospital settings..." fullScreen />;
    }

    if (!hospital) {
        return (
            <div className="p-4 text-center">
                <p className="text-slate-600 dark:text-slate-400">Unable to load hospital data.</p>
            </div>
        );
    }

    const changedKeys = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key)).filter(k => (formData[k] || '') !== ((hospital as any)[k] || ''));
    const closeEditor = () => { setIsEditing(false); setFormData(hospital); };
    const reqStatus = pendingRequest ? (STATUS_LABEL[pendingRequest.status] || { label: pendingRequest.status, tone: 'muted' as const }) : null;

    return (
        <>
            {notification.show && (
                <GlassNotification
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification({ ...notification, show: false })}
                />
            )}

            <ConfirmModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                consequences={modalConfig.consequences}
                confirmText={modalConfig.confirmText}
                isDeactivate={modalConfig.isDeactivate}
            />

            <SettingsPage kicker="Hospital account" title="Settings" subtitle={`${hospital.name} · on G1Card since ${new Date(hospital.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}>
                {pendingRequest && reqStatus && (
                    <SettingsSection
                        title="Requested changes"
                        description="Your current details stay live until an admin approves the change."
                        actions={pendingRequest.status === 'CHANGES_REQUESTED' ? <DialogButton variant="primary" onClick={() => setIsEditing(true)}>Edit and resubmit</DialogButton> : undefined}
                    >
                        <SettingRow title="Status" description={`Sent ${new Date(pendingRequest.resubmittedAt || pendingRequest.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}>
                            <StatusPill tone={reqStatus.tone}>{reqStatus.label}</StatusPill>
                        </SettingRow>
                        {pendingRequest.status === 'CHANGES_REQUESTED' && pendingRequest.adminRemarks && (
                            <p className="st-note st-note--warn"><b>Admin:</b> {pendingRequest.adminRemarks}</p>
                        )}
                        <ul className="st-diff">
                            {pendingRequest.requestedChanges && Object.entries(pendingRequest.requestedChanges).map(([key, value]) => (
                                <li key={key}>
                                    <span className="st-diff-label">{FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span className="st-diff-old">{pendingRequest.originalData?.[key] || 'Empty'}</span>
                                    <span className="st-diff-arrow" aria-hidden>→</span>
                                    <span className="st-diff-new">{String(value) || 'Empty'}</span>
                                </li>
                            ))}
                        </ul>
                        {pendingRequest.conversation?.length > 0 && (
                            <div className="st-thread">
                                {pendingRequest.conversation.map((msg, idx) => (
                                    <div key={idx} className={`st-msg ${msg.sender === 'ADMIN' ? 'is-admin' : 'is-you'}`}>
                                        <small>{msg.sender === 'ADMIN' ? 'G1Card admin' : 'You'} · {new Date(msg.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
                                        <p>{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {pendingRequest.status === 'CHANGES_REQUESTED' && (
                            <div className="st-reply">
                                <textarea className="st-input" rows={2} value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} placeholder="Reply to the admin…" aria-label="Reply to the admin" />
                                <DialogButton onClick={handleSendMessage} disabled={submitting || !replyMessage.trim()}>Send</DialogButton>
                            </div>
                        )}
                    </SettingsSection>
                )}

                <SettingsSection
                    title="Hospital details"
                    description="Changes go to a G1Card admin for approval, so patients always see verified information."
                    actions={!pendingRequest || pendingRequest.status === 'APPROVED' || pendingRequest.status === 'REJECTED'
                        ? <DialogButton onClick={() => setIsEditing(true)}>Request a change</DialogButton>
                        : undefined}
                >
                    {FIELD_GROUPS.map(group => (
                        <div key={group.title} className="st-group">
                            <p className="st-form-divider">{group.title}</p>
                            <InfoGrid items={group.fields.map(f => ({ label: f.label, value: (hospital as any)[f.key], wide: f.wide }))} />
                        </div>
                    ))}
                </SettingsSection>

                <SettingsSection
                    tone={hospital.active ? 'danger' : 'default'}
                    title="Account status"
                    description={hospital.active
                        ? 'Deactivating pauses patient work for your whole team. Your data is kept.'
                        : 'Your account is inactive. Patients and records stay locked until you reactivate.'}
                    actions={
                        <DialogButton variant={hospital.active ? 'danger' : 'primary'} onClick={hospital.active ? showDeactivateModal : showActivateModal} disabled={updating}>
                            {updating ? 'Updating…' : hospital.active ? 'Deactivate account' : 'Reactivate account'}
                        </DialogButton>
                    }
                >
                    <SettingRow title="Current status">
                        <StatusPill tone={hospital.active ? 'ok' : 'bad'}>{hospital.active ? 'Active' : 'Inactive'}</StatusPill>
                    </SettingRow>
                </SettingsSection>
            </SettingsPage>

            <AppDialog
                open={isEditing}
                onClose={closeEditor}
                size="lg"
                eyebrow={pendingRequest?.status === 'CHANGES_REQUESTED' ? 'Resubmit changes' : 'Request a change'}
                title="Edit hospital details"
                subtitle="Edited fields are highlighted. An admin reviews them before they go live."
                footer={<>
                    <span className="st-dialog-count">{changedKeys.length ? `${changedKeys.length} change${changedKeys.length === 1 ? '' : 's'}` : 'No changes yet'}</span>
                    <DialogButton onClick={closeEditor}>Cancel</DialogButton>
                    <DialogButton variant="primary" onClick={handleSubmitRequest} disabled={submitting || changedKeys.length === 0}>{submitting ? 'Sending…' : 'Send for approval'}</DialogButton>
                </>}
            >
                <div className="st-form">
                    {FIELD_GROUPS.map(group => (
                        <React.Fragment key={group.title}>
                            <p className="st-form-divider">{group.title}</p>
                            {group.fields.map(f => {
                                const changed = changedKeys.includes(f.key);
                                return (
                                    <Field key={f.key} label={f.label} htmlFor={`h-${f.key}`} wide={f.wide} hint={changed ? <>Was: {(hospital as any)[f.key] || 'empty'}</> : undefined}>
                                        <input
                                            id={`h-${f.key}`}
                                            type={f.type || 'text'}
                                            className={`st-input ${changed ? 'is-changed' : ''}`}
                                            value={formData[f.key] || ''}
                                            onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                                        />
                                    </Field>
                                );
                            })}
                        </React.Fragment>
                    ))}
                    <Field label="Note for the admin (optional)" htmlFor="h-note" wide>
                        <textarea id="h-note" className="st-input" rows={2} value={submitMessage} onChange={(e) => setSubmitMessage(e.target.value)} placeholder="Why the change, e.g. we moved to a new building" />
                    </Field>
                </div>
            </AppDialog>
        </>
    );
};

export default HospitalSettingsPage;
