import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
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


const PermissionControl: React.FC<{ hospital: string; access: string; lastAccessed: string; onRevoke?: () => void; }> = ({ hospital, access, lastAccessed, onRevoke }) => (
    <div className="p-4 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">{hospital}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Last Accessed: {lastAccessed}</p>
        </div>
        <div className="flex items-center gap-4">
             <select defaultValue={access} className="text-sm border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent">
                 <option>Full Access</option>
                 <option>Limited</option>
                 <option>Read-only</option>
             </select>
             <button onClick={onRevoke} className="text-sm text-red-600 hover:underline font-semibold">Revoke Access</button>
        </div>
    </div>
);

const ActiveSession: React.FC<{ browser: string; location: string; lastActive: string; }> = ({ browser, location, lastActive }) => (
    <div className="p-3 border dark:border-slate-700 rounded-lg flex items-center justify-between">
        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>{browser}</strong> - {location}</p>
        <div className="flex items-center gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Last active: {lastActive}</p>
            <button className="text-sm text-red-600 hover:underline">Sign Out</button>
        </div>
    </div>
);

interface HospitalPermissionEntry {
    hospitalId: string;
    hospitalName: string;
    lastAccessed: string;
}

const PatientSettings: React.FC = () => {
    const { user } = useAuth();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '', address: '', emergencyContactName: '', emergencyContactPhone: '' });
    const [hospitalPermissions, setHospitalPermissions] = useState<HospitalPermissionEntry[]>([]);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

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
        const fetchHospitalPermissions = async () => {
            if (!user?.id) return;
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/records`);
                const data = await resp.json();
                if (!resp.ok || !data?.records) return;
                const map = new Map<string, { name: string; lastAccessed: string }>();
                (data.records as any[]).forEach((rec: any) => {
                    const hospital = rec.hospital || {};
                    const hospitalId = hospital._id || hospital.id;
                    const hospitalName = hospital.name || 'Unknown Hospital';
                    if (!hospitalId) return;
                    const createdAt: string = rec.createdAt || rec.updatedAt || rec.date || new Date().toISOString();
                    const existing = map.get(hospitalId);
                    if (!existing || new Date(createdAt) > new Date(existing.lastAccessed)) {
                        map.set(hospitalId, { name: hospitalName, lastAccessed: createdAt });
                    }
                });
                const list: HospitalPermissionEntry[] = Array.from(map.entries()).map(([hospitalId, v]) => ({
                    hospitalId,
                    hospitalName: v.name,
                    lastAccessed: v.lastAccessed,
                }));
                list.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
                setHospitalPermissions(list);
            } catch (err) {
                console.warn('Could not fetch hospital permissions', err);
            }
        };
        fetchPatient();
        fetchHospitalPermissions();
    }, [user?.id]);

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
        if (!user?.id) return alert('Not signed in');
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
            if (!resp.ok) return alert('Save failed: ' + (data?.error || data?.message || 'unknown'));
            setPatient(data.patient as DetailedPatient);
            setShowEdit(false);
        } catch (err) {
            console.error('save profile error', err);
            alert('Error saving profile');
        } finally { setSaving(false); }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleRevokeHospital = (hospitalId: string) => {
        if (!window.confirm('Are you sure you want to revoke this hospital\'s access?')) return;
        setHospitalPermissions(prev => prev.filter(h => h.hospitalId !== hospitalId));
        // Note: actual enforcement of revocation will be implemented later on the backend.
    };

    const submitPasswordChange = async () => {
        if (!user?.email) {
            alert('Unable to identify user email for password change');
            return;
        }
        if (!passwordForm.currentPassword || !passwordForm.newPassword) {
            alert('Please fill all password fields');
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('New passwords do not match');
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
                alert(data?.error || data?.message || 'Unable to change password');
                return;
            }
            alert('Password updated successfully');
            setChangingPassword(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error('change password error', err);
            alert('Error while changing password');
        }
    };

    return (
        <>
        <Card title="Account Settings & Privacy">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <Section title="Profile Information">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Name:</strong> {patient?.name || `${patient?.firstName || ''} ${patient?.lastName || ''}` || user?.name || '—'}</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Email:</strong> {patient?.email || user?.email || '—'} {patient?.email && <span className="text-green-600">(Verified ✓)</span>}</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>Phone:</strong> {patient?.phone || '—'}</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200"><strong>DOB:</strong> {patient?.dob || '—'}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={openEdit} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Edit Profile</button>
                        <button className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Change Email</button>
                    </div>
                </Section>
                
                <Section title="Hospital Permissions">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Manage which hospitals can access your data.</p>
                    {hospitalPermissions.length === 0 ? (
                        <p className="text-sm text-slate-500">No hospitals have accessed your records yet.</p>
                    ) : (
                        hospitalPermissions.map(h => (
                            <PermissionControl
                                key={h.hospitalId}
                                hospital={h.hospitalName}
                                access="Full Access"
                                lastAccessed={formatDate(h.lastAccessed)}
                                onRevoke={() => handleRevokeHospital(h.hospitalId)}
                            />
                        ))
                    )}
                    <button className="text-sm px-4 py-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">+ Add New Hospital</button>
                </Section>

                <Section title="Security Settings">
                    <div>
                        <p className="text-sm"><strong>Password:</strong> •••••••• <span className="text-xs text-slate-500 ml-4">Last Changed: 15 days ago</span></p>
                        <button
                            onClick={() => setChangingPassword(true)}
                            className="mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Change Password
                        </button>
                    </div>
                   <ToggleSwitch label="Two-Factor Authentication" disabled comingSoon />
                </Section>
                
                <Section title="Active Sessions">
                    <ActiveSession browser="Web Browser (Chrome)" location="Mumbai, IN" lastActive="2 hours ago" />
                    <ActiveSession browser="Mobile (iPhone)" location="Mumbai, IN" lastActive="1 day ago" />
                    <button className="w-full mt-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 border text-red-700 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">Sign Out All Sessions</button>
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
                             <button className="mt-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Download Data Export (PDF/JSON)</button>
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
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 dark:bg-black/60">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg ring-1 ring-slate-200 dark:ring-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Profile</h3>
                    <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="edit-firstName" className="block text-sm text-slate-700 dark:text-slate-300">First name</label>
                                <input id="edit-firstName" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.firstName} onChange={(e)=>updateField('firstName', e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="edit-lastName" className="block text-sm text-slate-700 dark:text-slate-300">Last name</label>
                                <input id="edit-lastName" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.lastName} onChange={(e)=>updateField('lastName', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="edit-email" className="block text-sm text-slate-700 dark:text-slate-300">Email</label>
                                <input id="edit-email" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.email} onChange={(e)=>updateField('email', e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="edit-phone" className="block text-sm text-slate-700 dark:text-slate-300">Phone</label>
                                <input id="edit-phone" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.phone} onChange={(e)=>updateField('phone', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="edit-address" className="block text-sm text-slate-700 dark:text-slate-300">Address</label>
                            <input id="edit-address" className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.address} onChange={(e)=>updateField('address', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="edit-dob" className="block text-sm text-slate-700 dark:text-slate-300">DOB</label>
                                <input id="edit-dob" type="date" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.dob} onChange={(e)=>updateField('dob', e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="edit-emergencyName" className="block text-sm text-slate-700 dark:text-slate-300">Emergency Contact</label>
                                <input id="edit-emergencyName" className="mt-1 p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.emergencyContactName} onChange={(e)=>updateField('emergencyContactName', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="edit-emergencyPhone" className="block text-sm text-slate-700 dark:text-slate-300">Emergency Phone</label>
                            <input id="edit-emergencyPhone" className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={form.emergencyContactPhone} onChange={(e)=>updateField('emergencyContactPhone', e.target.value)} />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button onClick={()=>setShowEdit(false)} className="px-4 py-2 border rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">Cancel</button>
                        <button onClick={saveProfile} disabled={saving} className="px-4 py-2 bg-brand-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            </div>
        )}
        {changingPassword && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 dark:bg-black/60">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-800">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
                    <div className="mt-4 space-y-3">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm text-slate-700 dark:text-slate-300">Current password</label>
                            <input
                                id="currentPassword"
                                type="password"
                                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                value={passwordForm.currentPassword}
                                onChange={(e) => updatePasswordField('currentPassword', e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm text-slate-700 dark:text-slate-300">New password</label>
                            <input
                                id="newPassword"
                                type="password"
                                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                value={passwordForm.newPassword}
                                onChange={(e) => updatePasswordField('newPassword', e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm text-slate-700 dark:text-slate-300">Confirm new password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => updatePasswordField('confirmPassword', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setChangingPassword(false);
                                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            }}
                            className="px-4 py-2 border rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitPasswordChange}
                            className="px-4 py-2 bg-brand-primary text-white rounded"
                        >
                            Update Password
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default PatientSettings;