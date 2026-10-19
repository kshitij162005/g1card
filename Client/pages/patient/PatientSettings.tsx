import { API_URL } from '../../config/api';
import AppDialog, { DialogButton } from '../../components/AppDialog';
import SearchBox from '../../components/SearchBox';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingsPage, SettingsSection, InfoGrid, SettingRow, Switch, Field, StatusPill } from '../../components/settings/Settings';
import { useAuth } from '../../contexts/AuthContext';
import { DetailedPatient, Role } from '../../types';

async function parseApiResponse(resp: Response) {
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return resp.json();
    }
    const text = await resp.text();
    return { error: text?.slice(0, 200) || `HTTP ${resp.status}` };
}

const ACCESS_PAGE_SIZE = 5;

interface HospitalPermissionEntry {
    accessId: string;
    hospitalId: string;
    hospitalName: string;
    accessLevel: 'GENERAL' | 'COMPLETE';
    lastAccessed: string | null;
}

interface HospitalAccessCounts {
    total: number;
    complete: number;
    partial: number;
}

interface NotificationPreferences {
    emailWhenHospitalAccessRecords: boolean;
    emailForNewPrescriptions: boolean;
    emailForConsultationReminders: boolean;
}

interface DeletionRequestStatus {
    _id: string;
    requestType: 'DATA_DELETION' | 'ACCOUNT_DELETION';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reason?: string;
    reviewNotes?: string;
    createdAt: string;
    reviewedAt?: string;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    emailWhenHospitalAccessRecords: true,
    emailForNewPrescriptions: true,
    emailForConsultationReminders: true,
};

const OTP_LENGTH = 6;
const OTP_VALIDITY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function formatCountdown(ms: number): string {
    const safeMs = Math.max(0, ms);
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const PatientSettings: React.FC = () => {
    const { user, logout } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', gender: '', address: '', emergencyContactName: '', emergencyContactPhone: '' });
    const [hospitalPermissions, setHospitalPermissions] = useState<HospitalPermissionEntry[]>([]);
    const [permissionSearch, setPermissionSearch] = useState('');
    const [permissionPage, setPermissionPage] = useState(1);
    const [showPermissionsManager, setShowPermissionsManager] = useState(false);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);
    const [permissionsRefreshKey, setPermissionsRefreshKey] = useState(0);
    const [accessCounts, setAccessCounts] = useState<HospitalAccessCounts>({ total: 0, complete: 0, partial: 0 });
    const [countsLoading, setCountsLoading] = useState(false);
    const [countsError, setCountsError] = useState<string | null>(null);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' });
    const [passwordOtpRequested, setPasswordOtpRequested] = useState(false);
    const [passwordActionLoading, setPasswordActionLoading] = useState(false);
    const [passwordOtpDigits, setPasswordOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
    const [otpResendAvailableAt, setOtpResendAvailableAt] = useState<number | null>(null);
    const [otpNow, setOtpNow] = useState(Date.now());
    const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationSaving, setNotificationSaving] = useState(false);
    const [allowHospitalsUpdate, setAllowHospitalsUpdate] = useState<boolean>(true);
    const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null);
    const [submittingDeletion, setSubmittingDeletion] = useState(false);
    const [showDeletionConfirmModal, setShowDeletionConfirmModal] = useState(false);
    const [deletionReasonDraft, setDeletionReasonDraft] = useState('');
    const [deletionConfirmChecked, setDeletionConfirmChecked] = useState(false);
    const [latestDeletionRequest, setLatestDeletionRequest] = useState<DeletionRequestStatus | null>(null);
    const [deletionStatusLoading, setDeletionStatusLoading] = useState(false);
    const lastKnownDeletionStatusRef = useRef<string | null>(null);
    const [revokeModal, setRevokeModal] = useState<{ show: boolean; accessId: string; hospitalName: string } | null>(null);
    const [accessLevelModal, setAccessLevelModal] = useState<{ 
        show: boolean; 
        accessId: string; 
        hospitalName: string; 
        currentLevel: 'GENERAL' | 'COMPLETE';
        newLevel: 'GENERAL' | 'COMPLETE';
    } | null>(null);

    useEffect(() => {
        const fetchPatient = async () => {
            if (!user?.id) return;
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}`);
                const data = await parseApiResponse(resp);
                if (resp.ok && data?.patient) setPatient(data.patient as DetailedPatient);
            } catch (err) {
                console.warn('Could not fetch patient details', err);
            }
        };
        const fetchHospitalAccessCounts = async () => {
            if (!user?.id) return;
            setCountsLoading(true);
            setCountsError(null);
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/hospital-accesses/count`);
                const data = await parseApiResponse(resp);
                if (!resp.ok || !data?.counts) {
                    throw new Error(data?.error || 'Unable to load access counts');
                }
                setAccessCounts({
                    total: data.counts.total || 0,
                    complete: data.counts.complete || 0,
                    partial: data.counts.partial || 0,
                });
            } catch (err) {
                console.warn('Could not fetch hospital access counts', err);
                setCountsError('Unable to load access counts right now.');
            } finally {
                setCountsLoading(false);
            }
        };
        const fetchDeletionStatus = async (showStatusToast = false) => {
            if (!user?.id) return;
            setDeletionStatusLoading(true);
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/deletion-requests`);
                const data = await parseApiResponse(resp);
                if (!resp.ok) throw new Error(data?.error || 'Unable to load deletion request status');
                const latest = (data?.latestRequest || null) as DeletionRequestStatus | null;
                setLatestDeletionRequest(latest);

                const nextStatus = latest?.status || null;
                if (showStatusToast && lastKnownDeletionStatusRef.current && nextStatus && lastKnownDeletionStatusRef.current !== nextStatus) {
                    notify(`Deletion request status updated: ${nextStatus}`);
                }
                lastKnownDeletionStatusRef.current = nextStatus;
            } catch (err) {
                console.warn('Could not fetch deletion request status', err);
            } finally {
                setDeletionStatusLoading(false);
            }
        };
        fetchPatient();
        fetchHospitalAccessCounts();
        reloadNotificationPreferences();
        fetchDeletionStatus(false);

        const interval = window.setInterval(() => {
            fetchDeletionStatus(true);
        }, 30000);

        return () => window.clearInterval(interval);
    }, [user?.id]);

    useEffect(() => {
        if (patient && (patient as any).allowHospitalsUpdate !== undefined) {
            setAllowHospitalsUpdate(Boolean((patient as any).allowHospitalsUpdate));
        }
    }, [patient]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'manage-access') {
            setShowPermissionsManager(true);
        }
    }, [searchParams]);

    useEffect(() => {
        const fetchHospitalPermissions = async () => {
            if (!showPermissionsManager || !user?.id) return;
            setPermissionsLoading(true);
            setPermissionsError(null);
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/hospital-accesses`);
                const data = await parseApiResponse(resp);
                if (!resp.ok || !data?.accesses) {
                    throw new Error(data?.error || 'Unable to load hospital permissions');
                }
                const list: HospitalPermissionEntry[] = data.accesses.map((a: any) => ({
                    accessId: a.id,
                    hospitalId: a.hospitalId,
                    hospitalName: a.hospitalName,
                    accessLevel: a.accessLevel,
                    lastAccessed: a.lastAccessed,
                }));
                setHospitalPermissions(list);
                const complete = list.filter((entry) => entry.accessLevel === 'COMPLETE').length;
                setAccessCounts({ total: list.length, complete, partial: list.length - complete });
            } catch (err) {
                console.warn('Could not fetch hospital permissions', err);
                setPermissionsError('Unable to load hospital permissions. Please try again.');
            } finally {
                setPermissionsLoading(false);
            }
        };
        fetchHospitalPermissions();
    }, [showPermissionsManager, user?.id, permissionsRefreshKey]);

    const openEdit = () => {
        setForm({
            firstName: (patient?.firstName as string) || '',
            lastName: (patient?.lastName as string) || '',
            email: (patient?.email as string) || user?.email || '',
            phone: (patient?.phone as string) || '',
            dob: (patient?.dob as string) || '',
            gender: (patient?.gender as string) || '',
            address: (patient?.address as string) || '',
            emergencyContactName: (patient?.emergencyContactName as string) || '',
            emergencyContactPhone: (patient?.emergencyContactPhone as string) || '',
        });
        setShowEdit(true);
    };

    const updateField = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const updatePasswordField = (k: string, v: string) => setPasswordForm(prev => ({ ...prev, [k]: v }));

    const updateNotificationPreference = (k: keyof NotificationPreferences, value: boolean) => {
        setNotificationPreferences((prev) => ({ ...prev, [k]: value }));
    };

    const reloadNotificationPreferences = async () => {
        if (!user?.id) return;
        setNotificationLoading(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/preferences/notifications`);
            const data = await parseApiResponse(resp);
            if (!resp.ok) throw new Error(data?.error || 'Unable to load notification preferences');
            setNotificationPreferences({
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                ...(data?.preferences || {}),
            });
        } catch (err) {
            console.warn('Could not fetch notification preferences', err);
        } finally {
            setNotificationLoading(false);
        }
    };

    const saveProfile = async () => {
        if (!user?.id) return notify('Not signed in');
        setSaving(true);
        try {
            const body: any = {
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                phone: form.phone,
                dob: form.dob,
                gender: form.gender,
                address: form.address,
                emergencyContactName: form.emergencyContactName,
                emergencyContactPhone: form.emergencyContactPhone,
            };
            const resp = await fetch(`${API_URL}/patients/${user.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) return notify('Save failed: ' + (data?.error || data?.message || 'unknown'));
            setPatient(data.patient as DetailedPatient);
            setShowEdit(false);
        } catch (err) {
            console.error('save profile error', err);
            notify('Error saving profile');
        } finally { setSaving(false); }
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return 'Never';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'N/A';
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleAccessLevelChange = async (accessId: string, hospitalName: string, currentLevel: 'GENERAL' | 'COMPLETE', newLevel: 'GENERAL' | 'COMPLETE') => {
        // Show confirmation modal
        setAccessLevelModal({ show: true, accessId, hospitalName, currentLevel, newLevel });
    };

    const confirmAccessLevelChange = async () => {
        if (!accessLevelModal || !user?.id) return;
        const { accessId, newLevel } = accessLevelModal;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/hospital-accesses/${accessId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessLevel: newLevel }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify('Failed to update access level: ' + (data?.error || data?.message || 'unknown'));
                return;
            }
            // Update local state
            setHospitalPermissions(prev => prev.map(h => 
                h.accessId === accessId ? { ...h, accessLevel: newLevel } : h
            ));
            setAccessCounts(prev => {
                if (accessLevelModal.currentLevel === newLevel) return prev;
                if (newLevel === 'COMPLETE') {
                    return { ...prev, complete: prev.complete + 1, partial: Math.max(0, prev.partial - 1) };
                }
                return { ...prev, complete: Math.max(0, prev.complete - 1), partial: prev.partial + 1 };
            });
            setAccessLevelModal(null);
        } catch (err) {
            console.error('update access level error', err);
            notify('Error updating access level');
        }
    };

    const handleRevokeHospital = (accessId: string, hospitalName: string) => {
        setRevokeModal({ show: true, accessId, hospitalName });
    };

    const filteredPermissions = hospitalPermissions.filter((entry) =>
        entry.hospitalName.toLowerCase().includes(permissionSearch.trim().toLowerCase())
    );

    const permissionPages = Math.max(1, Math.ceil(filteredPermissions.length / ACCESS_PAGE_SIZE));
    const paginatedPermissions = filteredPermissions.slice(
        (permissionPage - 1) * ACCESS_PAGE_SIZE,
        permissionPage * ACCESS_PAGE_SIZE
    );
    const completeAccessCount = accessCounts.complete;
    const partialAccessCount = accessCounts.partial;

    useEffect(() => {
        setPermissionPage(1);
    }, [permissionSearch, hospitalPermissions.length]);

    useEffect(() => {
        if (permissionPage > permissionPages) {
            setPermissionPage(permissionPages);
        }
    }, [permissionPage, permissionPages]);

    useEffect(() => {
        if (!changingPassword || (!passwordOtpRequested && !otpExpiresAt && !otpResendAvailableAt)) {
            return;
        }
        setOtpNow(Date.now());
        const interval = window.setInterval(() => setOtpNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [changingPassword, passwordOtpRequested, otpExpiresAt, otpResendAvailableAt]);

    const closePermissionsManager = () => {
        setShowPermissionsManager(false);
        if (searchParams.get('tab') === 'manage-access') {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            setSearchParams(next, { replace: true });
        }
    };

    const resetPasswordFlow = () => {
        setChangingPassword(false);
        setPasswordOtpRequested(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' });
        setPasswordOtpDigits(Array(OTP_LENGTH).fill(''));
        setOtpExpiresAt(null);
        setOtpResendAvailableAt(null);
        setOtpNow(Date.now());
    };

    const otpExpiresInMs = otpExpiresAt ? Math.max(0, otpExpiresAt - otpNow) : 0;
    const otpResendInMs = otpResendAvailableAt ? Math.max(0, otpResendAvailableAt - otpNow) : 0;
    const otpCode = passwordOtpDigits.join('');

    const handleOtpDigitChange = (index: number, inputValue: string) => {
        const digit = inputValue.replace(/\D/g, '').slice(-1);
        setPasswordOtpDigits((prev) => {
            const next = [...prev];
            next[index] = digit;
            return next;
        });

        if (digit && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && !passwordOtpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
            return;
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
            return;
        }
        if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;

        event.preventDefault();
        const next = Array(OTP_LENGTH).fill('');
        pasted.split('').forEach((digit, index) => {
            next[index] = digit;
        });
        setPasswordOtpDigits(next);

        const focusIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
        if (focusIndex >= 0) {
            requestAnimationFrame(() => otpInputRefs.current[focusIndex]?.focus());
        }
    };

    const confirmRevokeAccess = async () => {
        if (!revokeModal || !user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/hospital-accesses/${revokeModal.accessId}/revoke`, {
                method: 'POST',
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify('Failed to revoke access: ' + (data?.error || data?.message || 'unknown'));
                return;
            }
            // Remove from local state
            setHospitalPermissions(prev => prev.filter(h => h.accessId !== revokeModal.accessId));
            setAccessCounts(prev => {
                const revoked = hospitalPermissions.find(h => h.accessId === revokeModal.accessId);
                if (!revoked) {
                    return { ...prev, total: Math.max(0, prev.total - 1) };
                }
                return {
                    total: Math.max(0, prev.total - 1),
                    complete: revoked.accessLevel === 'COMPLETE' ? Math.max(0, prev.complete - 1) : prev.complete,
                    partial: revoked.accessLevel === 'GENERAL' ? Math.max(0, prev.partial - 1) : prev.partial,
                };
            });
            setRevokeModal(null);
        } catch (err) {
            console.error('revoke access error', err);
            notify('Error revoking access');
        }
    };

    const requestPasswordOtp = async () => {
        if (!user?.email) {
            notify('Unable to identify user email for password change');
            return;
        }

        setPasswordActionLoading(true);
        try {
            const resp = await fetch(`${API_URL}/auth/change-password/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: Role.PATIENT,
                    email: user.email,
                    currentPassword: passwordForm.currentPassword,
                }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to send OTP');
                return;
            }

            const issuedAt = Date.now();
            setPasswordOtpRequested(true);
            setPasswordOtpDigits(Array(OTP_LENGTH).fill(''));
            setOtpExpiresAt(issuedAt + OTP_VALIDITY_MS);
            setOtpResendAvailableAt(issuedAt + OTP_RESEND_COOLDOWN_MS);
            setOtpNow(issuedAt);
            notify('OTP sent to your registered email. It is valid for 10 minutes.');
        } catch (err) {
            console.error('request password otp error', err);
            notify('Error while requesting OTP');
        } finally {
            setPasswordActionLoading(false);
        }
    };

    const submitPasswordChange = async () => {
        if (!user?.email) {
            notify('Unable to identify user email for password change');
            return;
        }
        if (!passwordOtpRequested) {
            notify('Request OTP first');
            return;
        }
        if (!passwordForm.newPassword) {
            notify('Please enter a new password');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            notify('New passwords do not match');
            return;
        }
        if (!otpCode || otpCode.length !== OTP_LENGTH) {
            notify('Please enter the 6-digit OTP');
            return;
        }
        if (otpExpiresInMs === 0) {
            notify('OTP has expired. Please request a new OTP.');
            return;
        }

        setPasswordActionLoading(true);
        try {
            const resp = await fetch(`${API_URL}/auth/change-password/confirm-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: Role.PATIENT,
                    email: user.email,
                    otp: otpCode,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to change password');
                return;
            }
            notify('Password updated successfully');
            resetPasswordFlow();
        } catch (err) {
            console.error('change password error', err);
            notify('Error while changing password');
        } finally {
            setPasswordActionLoading(false);
        }
    };

    const saveNotificationPreferences = async () => {
        if (!user?.id) return;
        setNotificationSaving(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/preferences/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationPreferences),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to save notification preferences');
                return;
            }
            setNotificationPreferences({
                ...DEFAULT_NOTIFICATION_PREFERENCES,
                ...(data?.preferences || notificationPreferences),
            });
            // Also save privacy preference: allowHospitalsUpdate
            try {
                const r2 = await fetch(`${API_URL}/patients/${user.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allowHospitalsUpdate }),
                });
                // ignore response details; backend may or may not persist this exact field
                if (!r2.ok) console.warn('Could not persist allowHospitalsUpdate');
            } catch (e) {
                console.warn('save privacy preference error', e);
            }
            notify('Notification preferences saved');
        } catch (err) {
            console.error('save notification preferences error', err);
            notify('Error saving notification preferences');
        } finally {
            setNotificationSaving(false);
        }
    };

    const downloadDataExport = async (format: 'csv' | 'pdf') => {
        if (!user?.id) return;
        setExportingFormat(format);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/data-export?format=${format}`);
            if (!resp.ok) {
                const data = await parseApiResponse(resp);
                notify(data?.error || data?.message || 'Unable to download data export');
                return;
            }

            const blob = await resp.blob();
            const ext = format === 'pdf' ? 'pdf' : 'csv';
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `g1card-data-export.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            notify(`Data export downloaded as ${ext.toUpperCase()}`);
        } catch (err) {
            console.error('download data export error', err);
            notify('Error while downloading data export');
        } finally {
            setExportingFormat(null);
        }
    };

    const openDeletionConfirmModal = () => {
        if (latestDeletionRequest?.status === 'PENDING') {
            notify('You already have a pending deletion request under review');
            return;
        }
        setDeletionReasonDraft('');
        setDeletionConfirmChecked(false);
        setShowDeletionConfirmModal(true);
    };

    const closeDeletionConfirmModal = () => {
        if (submittingDeletion) return;
        setShowDeletionConfirmModal(false);
        setDeletionReasonDraft('');
        setDeletionConfirmChecked(false);
    };

    const submitDeletionRequest = async () => {
        if (!user?.id) return;
        if (!deletionConfirmChecked) {
            notify('Please confirm that you understand this action is irreversible');
            return;
        }

        setSubmittingDeletion(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/deletion-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestType: 'ACCOUNT_DELETION', reason: deletionReasonDraft.trim() }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to submit deletion request');
                return;
            }

            closeDeletionConfirmModal();
            if (data?.accountDeleted) {
                notify('Your account and all linked data were deleted successfully.');
                logout();
                return;
            }

            setLatestDeletionRequest((data?.request || null) as DeletionRequestStatus | null);
            notify('Deletion request submitted to admin for approval');
        } catch (err) {
            console.error('submit deletion request error', err);
            notify('Error while submitting deletion request');
        } finally {
            setSubmittingDeletion(false);
        }
    };

    const fullName = patient?.name || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || user?.name || '';
    const p = (patient || {}) as any;
    const deletionTone = latestDeletionRequest?.status === 'APPROVED' ? 'ok' : latestDeletionRequest?.status === 'REJECTED' ? 'bad' : 'warn';
    const openPasswordFlow = () => {
        setChangingPassword(true);
        setPasswordOtpRequested(false);
        setPasswordOtpDigits(Array(OTP_LENGTH).fill(''));
        setOtpExpiresAt(null);
        setOtpResendAvailableAt(null);
        setOtpNow(Date.now());
    };

    return (
        <>
        <SettingsPage kicker="Your account" title="Settings" subtitle="Your profile, who can see your records, sign-in security and the emails we send you.">
            <SettingsSection
                title="Profile"
                description="Hospitals you approve see these details. Keep your phone and emergency contact current."
                actions={<>
                    <DialogButton onClick={openEdit}>Edit profile</DialogButton>
                </>}
            >
                <InfoGrid items={[
                    { label: 'Full name', value: fullName },
                    { label: 'Email', value: (patient?.email || user?.email) ? <>{patient?.email || user?.email} {patient?.email && <StatusPill tone="ok">Verified</StatusPill>}</> : '' },
                    { label: 'Phone', value: p.phone },
                    { label: 'Date of birth', value: patient?.dob ? new Date(patient.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '' },
                    { label: 'Gender', value: p.gender },
                    { label: 'Address', value: p.address },
                    { label: 'Emergency contact', value: p.emergencyContactName },
                    { label: 'Emergency contact phone', value: p.emergencyContactPhone },
                ]} />
            </SettingsSection>

            <SettingsSection
                title="Hospital access"
                description="Hospitals only see your records after you approve them. Change their level or take access away at any time."
                actions={<DialogButton variant="primary" onClick={() => setShowPermissionsManager(true)}>Manage hospital access</DialogButton>}
            >
                <div className="st-stats">
                    <div className="app-tone--blue"><span>{countsLoading ? '–' : accessCounts.total}</span><small>Connected hospitals</small></div>
                    <div className="app-tone--green"><span>{countsLoading ? '–' : completeAccessCount}</span><small>Complete history</small></div>
                    <div className="app-tone--amber"><span>{countsLoading ? '–' : partialAccessCount}</span><small>Partial access</small></div>
                </div>
                {countsError && <p className="st-note st-note--warn">{countsError}</p>}
            </SettingsSection>

            <SettingsSection title="Sign-in & security" description="Changing your password needs a one-time code sent to your email.">
                <SettingRow title="Password" description="Use at least 8 characters with upper and lower case letters and a number.">
                    <DialogButton onClick={openPasswordFlow}>Change password</DialogButton>
                </SettingRow>
                <SettingRow title="Two-factor authentication" badge="Coming soon" description="A second check at sign-in.">
                    <Switch label="Two-factor authentication" checked={false} disabled />
                </SettingRow>
            </SettingsSection>

            <SettingsSection title="Privacy" description="Control what approved hospitals can do with your records.">
                <SettingRow title="Allow hospitals to update my records" description="Approved hospitals can add prescriptions, reports and visit notes.">
                    <Switch
                        label="Allow hospitals to update my records"
                        checked={allowHospitalsUpdate}
                        onChange={(checked) => {
                            // Only confirm when turning OFF
                            if (!checked) {
                                const ok = window.confirm('Stop hospitals from adding or updating your records? They will still be able to view what you have approved.');
                                if (!ok) return;
                            }
                            setAllowHospitalsUpdate(checked);
                        }}
                    />
                </SettingRow>
                <SettingRow title="Share medical history in an emergency" badge="Coming soon" description="Let emergency staff see allergies and conditions without waiting for approval.">
                    <Switch label="Share medical history in an emergency" checked={false} disabled />
                </SettingRow>
            </SettingsSection>

            <SettingsSection
                title="Email notifications"
                description="Choose which updates we email you. You’ll always see everything in Notifications."
                actions={<>
                    <DialogButton onClick={reloadNotificationPreferences} disabled={notificationSaving || notificationLoading}>Undo changes</DialogButton>
                    <DialogButton variant="primary" onClick={saveNotificationPreferences} disabled={notificationSaving || notificationLoading}>{notificationSaving ? 'Saving…' : 'Save preferences'}</DialogButton>
                </>}
            >
                <SettingRow title="When a hospital opens my records">
                    <Switch label="Email when hospitals access records" checked={notificationPreferences.emailWhenHospitalAccessRecords} disabled={notificationLoading || notificationSaving} onChange={(checked) => updateNotificationPreference('emailWhenHospitalAccessRecords', checked)} />
                </SettingRow>
                <SettingRow title="New prescriptions">
                    <Switch label="Email for new prescriptions" checked={notificationPreferences.emailForNewPrescriptions} disabled={notificationLoading || notificationSaving} onChange={(checked) => updateNotificationPreference('emailForNewPrescriptions', checked)} />
                </SettingRow>
                <SettingRow title="Consultation reminders">
                    <Switch label="Email for consultation reminders" checked={notificationPreferences.emailForConsultationReminders} disabled={notificationLoading || notificationSaving} onChange={(checked) => updateNotificationPreference('emailForConsultationReminders', checked)} />
                </SettingRow>
            </SettingsSection>

            <SettingsSection
                tone="danger"
                title="Delete account"
                description="An admin reviews every request. Once approved, your records and access links are permanently removed."
                actions={
                    <DialogButton
                        variant="danger"
                        onClick={openDeletionConfirmModal}
                        disabled={submittingDeletion || latestDeletionRequest?.status === 'PENDING'}
                    >
                        {submittingDeletion ? 'Submitting…' : latestDeletionRequest?.status === 'PENDING' ? 'Request pending review' : 'Request account deletion'}
                    </DialogButton>
                }
            >
                <SettingRow
                    title="Latest request"
                    description={deletionStatusLoading
                        ? 'Loading…'
                        : latestDeletionRequest
                            ? <>
                                {latestDeletionRequest.requestType === 'ACCOUNT_DELETION' ? 'Account deletion' : 'Data deletion'} · requested {new Date(latestDeletionRequest.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {latestDeletionRequest.reviewedAt && <> · reviewed {new Date(latestDeletionRequest.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                                {latestDeletionRequest.reviewNotes && <><br />Admin note: {latestDeletionRequest.reviewNotes}</>}
                            </>
                            : 'You haven’t asked to delete your account.'}
                >
                    {latestDeletionRequest ? <StatusPill tone={deletionTone}>{latestDeletionRequest.status.charAt(0) + latestDeletionRequest.status.slice(1).toLowerCase()}</StatusPill> : <StatusPill tone="muted">None</StatusPill>}
                </SettingRow>
            </SettingsSection>
        </SettingsPage>

        <AppDialog
            open={showEdit}
            onClose={() => setShowEdit(false)}
            size="md"
            eyebrow="Profile"
            title="Edit your details"
            subtitle="Hospitals you approve see these, so keep them accurate."
            footer={<>
                <DialogButton onClick={() => setShowEdit(false)}>Cancel</DialogButton>
                <DialogButton variant="primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DialogButton>
            </>}
        >
            <div className="st-form">
                <Field label="First name" htmlFor="edit-firstName"><input id="edit-firstName" className="st-input" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} autoComplete="given-name" /></Field>
                <Field label="Last name" htmlFor="edit-lastName"><input id="edit-lastName" className="st-input" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} autoComplete="family-name" /></Field>
                <Field label="Email" htmlFor="edit-email"><input id="edit-email" type="email" className="st-input" value={form.email} onChange={(e) => updateField('email', e.target.value)} autoComplete="email" /></Field>
                <Field label="Phone" htmlFor="edit-phone"><input id="edit-phone" type="tel" className="st-input" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} autoComplete="tel" placeholder="10-digit mobile number" /></Field>
                <Field label="Date of birth" htmlFor="edit-dob"><input id="edit-dob" type="date" className="st-input" value={form.dob} onChange={(e) => updateField('dob', e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
                <Field label="Gender" htmlFor="edit-gender">
                    <select id="edit-gender" className="st-input" value={form.gender} onChange={(e) => updateField('gender', e.target.value)}>
                        <option value="">Select</option>
                        {['Female', 'Male', 'Non-binary', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                        {form.gender && !['Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(form.gender) && <option value={form.gender}>{form.gender}</option>}
                    </select>
                </Field>
                <Field label="Address" htmlFor="edit-address" wide><input id="edit-address" className="st-input" value={form.address} onChange={(e) => updateField('address', e.target.value)} autoComplete="street-address" placeholder="House, street, city" /></Field>
                <p className="st-form-divider">Emergency contact</p>
                <Field label="Name" htmlFor="edit-emergencyName"><input id="edit-emergencyName" className="st-input" value={form.emergencyContactName} onChange={(e) => updateField('emergencyContactName', e.target.value)} placeholder="e.g. Yash Kotecha (Father)" /></Field>
                <Field label="Phone" htmlFor="edit-emergencyPhone"><input id="edit-emergencyPhone" type="tel" className="st-input" value={form.emergencyContactPhone} onChange={(e) => updateField('emergencyContactPhone', e.target.value)} /></Field>
            </div>
        </AppDialog>

        <AppDialog
            open={changingPassword}
            onClose={resetPasswordFlow}
            size="sm"
            eyebrow="Security"
            title="Change password"
            subtitle={passwordOtpRequested ? 'Enter the 6-digit code we emailed you, then save.' : 'We’ll email you a one-time code to confirm it’s you.'}
            footer={<>
                <DialogButton onClick={resetPasswordFlow}>Cancel</DialogButton>
                <DialogButton onClick={requestPasswordOtp} disabled={passwordActionLoading || (passwordOtpRequested && otpResendInMs > 0)}>
                    {passwordActionLoading && !passwordOtpRequested ? 'Sending…'
                        : passwordActionLoading && passwordOtpRequested ? 'Resending…'
                            : !passwordOtpRequested ? 'Send code'
                                : otpResendInMs > 0 ? `Resend in ${formatCountdown(otpResendInMs)}` : 'Resend code'}
                </DialogButton>
                {passwordOtpRequested && (
                    <DialogButton variant="primary" onClick={submitPasswordChange} disabled={passwordActionLoading}>
                        {passwordActionLoading ? 'Updating…' : 'Update password'}
                    </DialogButton>
                )}
            </>}
        >
            <div className="st-form st-form--single">
                <Field label="Current password" htmlFor="currentPassword" hint="Leave blank if you’ve only ever signed in with Google.">
                    <input id="currentPassword" type="password" className="st-input" value={passwordForm.currentPassword} onChange={(e) => updatePasswordField('currentPassword', e.target.value)} autoComplete="current-password" />
                </Field>
                <Field label="New password" htmlFor="newPassword" hint="We recommend 8+ characters with upper and lower case letters and a number.">
                    <input id="newPassword" type="password" className="st-input" value={passwordForm.newPassword} onChange={(e) => updatePasswordField('newPassword', e.target.value)} autoComplete="new-password" />
                </Field>
                <Field label="Confirm new password" htmlFor="confirmPassword">
                    <input id="confirmPassword" type="password" className="st-input" value={passwordForm.confirmPassword} onChange={(e) => updatePasswordField('confirmPassword', e.target.value)} autoComplete="new-password" />
                    {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && <small className="st-error">Passwords don’t match yet.</small>}
                </Field>
                {passwordOtpRequested && (
                    <div className="st-otp">
                        <label htmlFor="passwordOtp">Code from your email</label>
                        <div className="st-otp-boxes">
                            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                                <input
                                    key={index}
                                    id={index === 0 ? 'passwordOtp' : undefined}
                                    ref={(element) => { otpInputRefs.current[index] = element; }}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    aria-label={`Digit ${index + 1}`}
                                    value={passwordOtpDigits[index]}
                                    onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                                    onKeyDown={(e) => handleOtpDigitKeyDown(index, e)}
                                    onPaste={handleOtpPaste}
                                />
                            ))}
                        </div>
                        <small>Expires in <b>{formatCountdown(otpExpiresInMs)}</b>{otpExpiresAt ? ` (at ${new Date(otpExpiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })})` : ''}</small>
                    </div>
                )}
            </div>
        </AppDialog>

        <AppDialog
            open={showDeletionConfirmModal}
            onClose={closeDeletionConfirmModal}
            size="sm"
            tone="danger"
            eyebrow="Delete account"
            title="Ask to delete your account?"
            subtitle="An admin reviews the request. Once approved it can’t be undone."
            footer={<>
                <DialogButton onClick={closeDeletionConfirmModal} disabled={submittingDeletion}>Keep my account</DialogButton>
                <DialogButton variant="danger" onClick={submitDeletionRequest} disabled={submittingDeletion || !deletionConfirmChecked}>{submittingDeletion ? 'Sending…' : 'Request deletion'}</DialogButton>
            </>}
        >
            <div className="st-form st-form--single">
                <p className="st-note st-note--bad">Your records, hospital access links and sign-in history will be permanently removed.</p>
                <Field label="Reason (optional)" htmlFor="deleteReason">
                    <textarea id="deleteReason" rows={3} className="st-input" value={deletionReasonDraft} onChange={(e) => setDeletionReasonDraft(e.target.value)} placeholder="Anything that would help us improve" />
                </Field>
                <label className={`app-check-row ${deletionConfirmChecked ? 'is-checked' : ''}`}>
                    <input type="checkbox" checked={deletionConfirmChecked} onChange={(e) => setDeletionConfirmChecked(e.target.checked)} />
                    <span>I understand this is permanent once approved.</span>
                </label>
            </div>
        </AppDialog>

        <AppDialog
            open={showPermissionsManager}
            onClose={closePermissionsManager}
            size="xl"
            eyebrow="Manage access"
            title="Who can see your records"
            subtitle="Change how much each hospital can see, or take access away. Changes apply straight away."
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SearchBox
                    className="w-full sm:w-80"
                    placeholder="Search hospitals"
                    live
                    initialValue={permissionSearch}
                    onSearch={q => setPermissionSearch(q)}
                />
                <p className="text-sm text-[var(--app-muted)]">
                    {hospitalPermissions.length} hospital{hospitalPermissions.length === 1 ? '' : 's'} connected
                </p>
            </div>

            <div className="mt-5">
                {permissionsLoading ? (
                    <div className="space-y-3" aria-label="Loading">
                        {[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-[var(--app-surface-soft)]" />)}
                    </div>
                ) : permissionsError ? (
                    <div className="rounded-xl border border-[var(--app-border)] p-5">
                        <p className="text-sm text-[var(--app-danger)]">{permissionsError}</p>
                        <DialogButton className="mt-3" onClick={() => setPermissionsRefreshKey((key) => key + 1)}>Try again</DialogButton>
                    </div>
                ) : hospitalPermissions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-border-strong)] px-6 py-10 text-center">
                        <p className="font-serif text-lg font-semibold">No hospital can see your records</p>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">When a hospital asks for access you’ll get a notification to approve or deny it.</p>
                    </div>
                ) : filteredPermissions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--app-muted)]">No hospitals match “{permissionSearch}”.</p>
                ) : (
                    <>
                        <ul className="divide-y divide-[var(--app-border)] overflow-hidden rounded-xl border border-[var(--app-border)]">
                            {paginatedPermissions.map((h) => {
                                const nextLevel: 'GENERAL' | 'COMPLETE' = h.accessLevel === 'COMPLETE' ? 'GENERAL' : 'COMPLETE';
                                const complete = h.accessLevel === 'COMPLETE';
                                return (
                                    <li key={h.accessId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">
                                                {h.hospitalName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">{h.hospitalName}</p>
                                                <p className="text-xs text-[var(--app-muted)]">Last opened your records {formatDate(h.lastAccessed)}</p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${complete ? 'bg-[var(--app-success-soft)] text-[var(--app-success-text)]' : 'bg-[var(--app-warning-soft)] text-[var(--app-warning)]'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${complete ? 'bg-[var(--app-success-text)]' : 'bg-[var(--app-warning)]'}`} />
                                            {complete ? 'Complete history' : 'Partial access'}
                                        </span>
                                        <div className="flex gap-2 sm:ml-4">
                                            <DialogButton onClick={() => handleAccessLevelChange(h.accessId, h.hospitalName, h.accessLevel, nextLevel)}>
                                                Switch to {nextLevel === 'COMPLETE' ? 'complete' : 'partial'}
                                            </DialogButton>
                                            <DialogButton className="!text-[var(--app-danger)]" onClick={() => handleRevokeHospital(h.accessId, h.hospitalName)}>
                                                Revoke
                                            </DialogButton>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        {permissionPages > 1 && (
                            <div className="mt-4 flex items-center justify-between text-sm text-[var(--app-muted)]">
                                <span>
                                    {(permissionPage - 1) * ACCESS_PAGE_SIZE + 1}–{Math.min(permissionPage * ACCESS_PAGE_SIZE, filteredPermissions.length)} of {filteredPermissions.length}
                                </span>
                                <div className="flex gap-2">
                                    <DialogButton disabled={permissionPage === 1} onClick={() => setPermissionPage((p) => Math.max(1, p - 1))}>Previous</DialogButton>
                                    <DialogButton disabled={permissionPage === permissionPages} onClick={() => setPermissionPage((p) => Math.min(permissionPages, p + 1))}>Next</DialogButton>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppDialog>

        <AppDialog
            open={Boolean(revokeModal?.show)}
            onClose={() => setRevokeModal(null)}
            size="sm"
            tone="danger"
            eyebrow="Revoke access"
            title={`Stop ${revokeModal?.hospitalName || 'this hospital'} seeing your records?`}
            footer={
                <>
                    <DialogButton onClick={() => setRevokeModal(null)}>Keep access</DialogButton>
                    <DialogButton variant="danger" onClick={confirmRevokeAccess}>Revoke access</DialogButton>
                </>
            }
        >
            <ul className="space-y-2 text-sm leading-relaxed text-[var(--app-muted)]">
                <li>They lose access to your records immediately.</li>
                <li>They can’t add to or update your health information.</li>
                <li>They’ll have to ask again, and you decide whether to approve.</li>
            </ul>
            <p className="mt-4 rounded-xl bg-[var(--app-surface-soft)] px-4 py-3 text-sm text-[var(--app-muted)]">
                Anything they viewed before stays in your audit history.
            </p>
        </AppDialog>

        <AppDialog
            open={Boolean(accessLevelModal?.show)}
            onClose={() => setAccessLevelModal(null)}
            size="sm"
            eyebrow="Change access level"
            title={accessLevelModal?.hospitalName || 'Hospital'}
            footer={
                <>
                    <DialogButton onClick={() => setAccessLevelModal(null)}>Cancel</DialogButton>
                    <DialogButton variant="primary" onClick={confirmAccessLevelChange}>Confirm change</DialogButton>
                </>
            }
        >
            {accessLevelModal && (
                <>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="rounded-xl border border-[var(--app-border)] p-3">
                            <p className="text-xs text-[var(--app-muted)]">Now</p>
                            <p className="mt-0.5 font-semibold">{accessLevelModal.currentLevel === 'COMPLETE' ? 'Complete history' : 'Partial access'}</p>
                        </div>
                        <span className="text-[var(--app-muted)]" aria-hidden>→</span>
                        <div className="rounded-xl border border-[var(--app-accent)] bg-[var(--app-accent-soft)] p-3">
                            <p className="text-xs text-[var(--app-accent)]">After</p>
                            <p className="mt-0.5 font-semibold">{accessLevelModal.newLevel === 'COMPLETE' ? 'Complete history' : 'Partial access'}</p>
                        </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-[var(--app-muted)]">
                        {accessLevelModal.newLevel === 'COMPLETE'
                            ? 'They’ll be able to see your full history from every hospital, including lab results and treatment notes.'
                            : 'They’ll only see basic medical information and the records they created themselves.'}
                    </p>
                </>
            )}
        </AppDialog>
        </>
    );
};

export default PatientSettings;