import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { DetailedPatient, Role } from '../../types';

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="py-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
        <div className="space-y-4">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{ label: string; defaultChecked?: boolean; disabled?: boolean; comingSoon?: boolean; }> = ({ label, defaultChecked, disabled, comingSoon }) => (
    <label className={`flex items-center justify-between ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {label} {comingSoon && <span className="text-xs text-brand-accent ml-2">(Coming Soon)</span>}
        </span>
        <div className="relative inline-flex items-center h-6 rounded-full w-11">
            <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} disabled={disabled} />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
        </div>
    </label>
);


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

const PatientSettings: React.FC = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', address: '', emergencyContactName: '', emergencyContactPhone: '' });
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
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
                const data = await resp.json();
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
                const data = await resp.json();
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
        fetchPatient();
        fetchHospitalAccessCounts();
    }, [user?.id]);

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
                const data = await resp.json();
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
            address: (patient?.address as string) || '',
            emergencyContactName: (patient?.emergencyContactName as string) || '',
            emergencyContactPhone: (patient?.emergencyContactPhone as string) || '',
        });
        setShowEdit(true);
    };

    const updateField = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const updatePasswordField = (k: string, v: string) => setPasswordForm(prev => ({ ...prev, [k]: v }));

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
                address: form.address,
                emergencyContactName: form.emergencyContactName,
                emergencyContactPhone: form.emergencyContactPhone,
            };
            const resp = await fetch(`${API_URL}/patients/${user.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            const data = await resp.json();
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
            const data = await resp.json();
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

    const closePermissionsManager = () => {
        setShowPermissionsManager(false);
        if (searchParams.get('tab') === 'manage-access') {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            setSearchParams(next, { replace: true });
        }
    };

    const confirmRevokeAccess = async () => {
        if (!revokeModal || !user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/hospital-accesses/${revokeModal.accessId}/revoke`, {
                method: 'POST',
            });
            const data = await resp.json();
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

    const submitPasswordChange = async () => {
        if (!user?.email) {
            notify('Unable to identify user email for password change');
            return;
        }
        if (!passwordForm.currentPassword || !passwordForm.newPassword) {
            notify('Please fill all password fields');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            notify('New passwords do not match');
            return;
        }
        try {
            const resp = await fetch(`${API_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: Role.PATIENT,
                    email: user.email,
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to change password');
                return;
            }
            notify('Password updated successfully');
            setChangingPassword(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error('change password error', err);
            notify('Error while changing password');
        }
    };

    return (
        <>
        <Card title="Account Settings & Privacy">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <Section title="Profile Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Name:</strong> <span className="font-semibold text-[var(--app-text)]">{patient?.name || `${patient?.firstName || ''} ${patient?.lastName || ''}` || user?.name || '—'}</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Email:</strong> <span className="font-semibold text-[var(--app-text)]">{patient?.email || user?.email || '—'}</span> {patient?.email && <span className="text-green-600">(Verified)</span>}</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Phone:</strong> <span className="font-semibold text-[var(--app-text)]">{patient?.phone || '—'}</span></p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>DOB:</strong> <span className="font-semibold text-[var(--app-text)]">{patient?.dob || '—'}</span></p>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={openEdit} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Edit Profile</button>
                        <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Change Email</button>
                    </div>
                </Section>
                
                <Section title="Hospital Permissions">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Manage which hospitals can access your data and control their access level.</p>
                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Connected</p>
                                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">{countsLoading ? '...' : accessCounts.total}</p>
                            </div>
                            <div className="rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Complete Access</p>
                                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300 mt-1">{completeAccessCount}</p>
                            </div>
                            <div className="rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Partial Access</p>
                                <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300 mt-1">{partialAccessCount}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPermissionsManager(true)}
                                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-secondary transition-colors"
                            >
                                Manage Hospital Access
                            </button>
                        </div>
                        {countsError && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{countsError}</p>
                        )}
                    </div>
                </Section>

                <Section title="Security Settings">
                    <div>
                        <p className="text-sm"><strong>Password:</strong> •••••••• <span className="text-xs text-slate-500 ml-4">Last Changed: 15 days ago</span></p>
                        <button
                            onClick={() => setChangingPassword(true)}
                            className="mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Change Password
                        </button>
                    </div>
                   <ToggleSwitch label="Two-Factor Authentication" disabled comingSoon />
                </Section>
                
                <Section title="Privacy & Data">
                     <div className="space-y-3">
                        <ToggleSwitch label="Allow hospitals to update my records" defaultChecked />
                        <ToggleSwitch label="Share medical history for emergency" defaultChecked />
                        <ToggleSwitch label="Allow anonymous data for research" />
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center pt-4 border-t dark:border-slate-700 mt-6">
                        <div>
                             <h4 className="font-semibold text-slate-800 dark:text-slate-200">Download Your Data</h4>
                             <button className="mt-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Download Data Export (PDF/JSON)</button>
                        </div>
                        <div className="mt-4 md:mt-0">
                             <h4 className="font-semibold text-red-700 dark:text-red-400">Data Deletion Request</h4>
                             <button className="mt-1 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">Request Account Deletion</button>
                        </div>
                    </div>
                </Section>

                <Section title="Notification Preferences">
                    <div className="space-y-3">
                        <ToggleSwitch label="Email when hospitals access records" defaultChecked />
                        <ToggleSwitch label="Email for new prescriptions" defaultChecked />
                        <ToggleSwitch label="Email for consultation reminders" defaultChecked />
                    </div>
                </Section>

                 <div className="pt-8 flex justify-end space-x-4">
                    <button type="button" className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700">
                        Cancel
                    </button>
                     <button type="submit" className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary">
                        Save All Changes
                    </button>
                </div>
            </div>
        </Card>
        {showEdit && (
            <div className="patient-settings-modal fixed inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={() => setShowEdit(false)} />
                <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Edit Profile Information</h2>
                                    <p className="text-sm text-slate-400 mt-1">Update your personal details</p>
                                </div>
                                <button onClick={() => setShowEdit(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1" aria-label="Close">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-5">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="edit-firstName" className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                                        <input id="edit-firstName" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.firstName} onChange={(e)=>updateField('firstName', e.target.value)} />
                                    </div>
                                    <div>
                                        <label htmlFor="edit-lastName" className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                                        <input id="edit-lastName" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.lastName} onChange={(e)=>updateField('lastName', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="edit-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                                        <input id="edit-email" type="email" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.email} onChange={(e)=>updateField('email', e.target.value)} />
                                    </div>
                                    <div>
                                        <label htmlFor="edit-phone" className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                                        <input id="edit-phone" type="tel" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.phone} onChange={(e)=>updateField('phone', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="edit-address" className="block text-sm font-medium text-slate-300 mb-1.5">Address</label>
                                    <input id="edit-address" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.address} onChange={(e)=>updateField('address', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="edit-dob" className="block text-sm font-medium text-slate-300 mb-1.5">Date of Birth</label>
                                        <input id="edit-dob" type="date" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.dob} onChange={(e)=>updateField('dob', e.target.value)} />
                                    </div>
                                    <div>
                                        <label htmlFor="edit-emergencyName" className="block text-sm font-medium text-slate-300 mb-1.5">Emergency Contact Name</label>
                                        <input id="edit-emergencyName" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.emergencyContactName} onChange={(e)=>updateField('emergencyContactName', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="edit-emergencyPhone" className="block text-sm font-medium text-slate-300 mb-1.5">Emergency Contact Phone</label>
                                    <input id="edit-emergencyPhone" type="tel" className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none" value={form.emergencyContactPhone} onChange={(e)=>updateField('emergencyContactPhone', e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 px-6 py-4 bg-slate-900/50">
                            <div className="flex gap-3 justify-end">
                                <button onClick={()=>setShowEdit(false)} className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-transparent border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-colors">Cancel</button>
                                <button onClick={saveProfile} disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]">{saving ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {changingPassword && (
            <div className="patient-settings-modal fixed inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={() => { setChangingPassword(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} />
                <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Change Password</h2>
                                    <p className="text-sm text-slate-400 mt-1">Update your account password</p>
                                </div>
                                <button onClick={() => { setChangingPassword(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="text-slate-500 hover:text-slate-300 transition-colors p-1" aria-label="Close">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-5">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
                                    <input
                                        id="currentPassword"
                                        type="password"
                                        className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => updatePasswordField('currentPassword', e.target.value)}
                                        placeholder="Enter current password"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => updatePasswordField('newPassword', e.target.value)}
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white placeholder-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => updatePasswordField('confirmPassword', e.target.value)}
                                        placeholder="Re-enter new password"
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-md px-4 py-3 mt-5">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Password must be at least 8 characters long and include uppercase, lowercase, and numbers.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 px-6 py-4 bg-slate-900/50">
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => {
                                        setChangingPassword(false);
                                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                    }}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-transparent border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitPasswordChange}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Update Password
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {showPermissionsManager && (
            <div className="patient-settings-modal fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={closePermissionsManager} />
                <div className="relative w-full max-w-5xl animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Hospital Access Manager</h2>
                                    <p className="text-sm text-slate-400 mt-1">Search, review and control hospital permissions.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closePermissionsManager}
                                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <input
                                    type="text"
                                    value={permissionSearch}
                                    onChange={(e) => setPermissionSearch(e.target.value)}
                                    placeholder="Search hospital"
                                    className="w-full md:w-80 px-3 py-2 text-sm border border-slate-700 rounded-lg bg-slate-800 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                                <p className="text-sm text-slate-400">{filteredPermissions.length} result{filteredPermissions.length === 1 ? '' : 's'}</p>
                            </div>
                        </div>
                        <div className="p-6">
                            {permissionsLoading ? (
                                <p className="text-sm text-slate-400">Loading hospital permissions...</p>
                            ) : permissionsError ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-red-300">{permissionsError}</p>
                                    <button
                                        type="button"
                                        onClick={() => setPermissionsRefreshKey((key) => key + 1)}
                                        className="px-4 py-2 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : hospitalPermissions.length === 0 ? (
                                <p className="text-sm text-slate-400">No hospitals currently have access to your records.</p>
                            ) : filteredPermissions.length === 0 ? (
                                <p className="text-sm text-slate-400">No hospitals match your search.</p>
                            ) : (
                                <div className="rounded-xl border border-slate-700 overflow-hidden">
                                    <div className="overflow-x-auto max-h-[22rem] overflow-y-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-800/70 sticky top-0">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Hospital</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Access</th>
                                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">Last Accessed</th>
                                                    <th className="px-4 py-3 text-right font-semibold text-slate-300">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700 bg-slate-900/30">
                                                {paginatedPermissions.map((h) => {
                                                    const nextLevel: 'GENERAL' | 'COMPLETE' = h.accessLevel === 'COMPLETE' ? 'GENERAL' : 'COMPLETE';
                                                    return (
                                                        <tr key={h.accessId}>
                                                            <td className="px-4 py-3 font-medium text-slate-100">{h.hospitalName}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${h.accessLevel === 'COMPLETE' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-amber-900/30 text-amber-300'}`}>
                                                                    {h.accessLevel === 'COMPLETE' ? 'Complete' : 'Partial'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-300">{formatDate(h.lastAccessed)}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleAccessLevelChange(h.accessId, h.hospitalName, h.accessLevel, nextLevel)}
                                                                        className="px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        Switch to {nextLevel === 'COMPLETE' ? 'Complete' : 'Partial'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRevokeHospital(h.accessId, h.hospitalName)}
                                                                        className="px-3 py-1.5 rounded-md border border-red-800 text-red-300 hover:bg-red-900/20 transition-colors"
                                                                    >
                                                                        Revoke
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {permissionPages > 1 && (
                                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/40">
                                            <p className="text-xs text-slate-300">
                                                Showing {(permissionPage - 1) * ACCESS_PAGE_SIZE + 1}-{Math.min(permissionPage * ACCESS_PAGE_SIZE, filteredPermissions.length)} of {filteredPermissions.length}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={permissionPage === 1}
                                                    onClick={() => setPermissionPage((p) => Math.max(1, p - 1))}
                                                    className="px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Prev
                                                </button>
                                                <span className="text-xs text-slate-300">{permissionPage}/{permissionPages}</span>
                                                <button
                                                    type="button"
                                                    disabled={permissionPage === permissionPages}
                                                    onClick={() => setPermissionPage((p) => Math.min(permissionPages, p + 1))}
                                                    className="px-3 py-1.5 rounded-md border border-slate-600 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        {revokeModal?.show && (
            <div className="patient-settings-modal fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={() => setRevokeModal(null)} />
                <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Revoke Hospital Access</h2>
                                    <p className="text-sm text-slate-400 mt-1">{revokeModal.hospitalName}</p>
                                </div>
                                <button onClick={() => setRevokeModal(null)} className="text-slate-500 hover:text-slate-300 transition-colors p-1" aria-label="Close">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-5">
                            <div className="bg-red-900/20 border border-red-800/50 rounded-md px-4 py-3.5 mb-5">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm text-red-300 font-medium mb-2">
                                            You are about to revoke access for <strong>{revokeModal.hospitalName}</strong>
                                        </p>
                                        <p className="text-xs text-red-400/90 mb-2">This action will immediately:</p>
                                        <ul className="text-xs text-red-400/80 space-y-1 ml-1">
                                            <li>• Terminate all access to your medical records</li>
                                            <li>• Prevent updates to your health information</li>
                                            <li>• Require a new authorization to restore access</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-md px-4 py-3">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        This is a permanent action. The hospital can request access again, but you will need to approve it.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 px-6 py-4 bg-slate-900/50">
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setRevokeModal(null)}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-transparent border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmRevokeAccess}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Revoke Access
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {accessLevelModal?.show && (
            <div className="patient-settings-modal fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer" onClick={() => setAccessLevelModal(null)} />
                <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="border-b border-slate-800 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Modify Access Level</h2>
                                    <p className="text-sm text-slate-400 mt-1">{accessLevelModal.hospitalName}</p>
                                </div>
                                <button onClick={() => setAccessLevelModal(null)} className="text-slate-500 hover:text-slate-300 transition-colors p-1" aria-label="Close">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-slate-300 leading-relaxed mb-5">
                                You are about to change the access level for <span className="font-medium text-white">{accessLevelModal.hospitalName}</span>.
                            </p>
                            <div className="bg-slate-800/50 border border-slate-700 rounded-md p-4 mb-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-slate-400">Current Access:</span>
                                    <span className="text-sm font-medium text-white">{accessLevelModal.currentLevel === 'COMPLETE' ? 'Complete Access' : 'Partial Access'}</span>
                                </div>
                                <div className="flex items-center justify-center my-2">
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                                    <span className="text-sm text-slate-400">New Access:</span>
                                    <span className="text-sm font-medium text-blue-400">{accessLevelModal.newLevel === 'COMPLETE' ? 'Complete Access' : 'Partial Access'}</span>
                                </div>
                            </div>
                            <div className="bg-slate-800/30 border border-slate-700/50 rounded-md px-4 py-3">
                                <div className="flex gap-3">
                                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {accessLevelModal.newLevel === 'COMPLETE' 
                                            ? 'Complete access grants the hospital permission to view all your medical records including lab results, imaging, and detailed treatment history.'
                                            : 'Partial access limits the hospital to viewing only basic medical information and hospital-specific records.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-800 px-6 py-4 bg-slate-900/50">
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setAccessLevelModal(null)}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-transparent border border-slate-700 rounded-md hover:bg-slate-800 hover:border-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAccessLevelChange}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Confirm Change
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default PatientSettings;