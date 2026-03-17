import { API_URL } from '../../config/api';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';
import { DetailedPatient } from '../../types';
import Loader from '../../components/Loader';
import ProfileCompletionPopup from '../../components/ProfileCompletionPopup';

const ONBOARDING_SNOOZE_MS = 24 * 60 * 60 * 1000;

const PATIENT_ONBOARDING_FIELDS = [
    { key: 'phone', label: 'Phone Number', type: 'tel' as const, placeholder: 'Add your active phone number' },
    { key: 'dob', label: 'Date of Birth', type: 'date' as const, placeholder: '' },
    { key: 'gender', label: 'Gender', type: 'text' as const, placeholder: 'e.g. Female, Male, Non-binary' },
    { key: 'address', label: 'Address', type: 'text' as const, placeholder: 'Street, city, state' },
    { key: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text' as const, placeholder: 'Who should we contact in emergencies?' },
    { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', type: 'tel' as const, placeholder: 'Emergency contact number' },
];

type PatientOnboardingKey = typeof PATIENT_ONBOARDING_FIELDS[number]['key'];

const HealthSummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-sm text-slate-400 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
);

const QuickInfoItem: React.FC<{ icon: 'allergy' | 'condition' | 'medication' | 'consultation'; label: string; value: string; color: string }> = ({ icon, label, value, color }) => {
    const iconMap = {
        allergy: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 4l9 16H3l9-16z" />
            </svg>
        ),
        condition: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
        ),
        medication: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
            </svg>
        ),
        consultation: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
        ),
    } as const;

    return (
    <div className="flex items-center py-2">
        <span className={`text-xl ${color}`}>{iconMap[icon]}</span>
        <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">{label}:</span>
        <span className="ml-auto text-sm text-slate-900 dark:text-slate-100 font-semibold">{value}</span>
    </div>
    );
};

interface HospitalAccessEntry {
    hospitalId: string;
    hospitalName: string;
    lastAccessed: string;
}

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: any;
    isRead: boolean;
    readAt?: string;
    actionUrl?: string;
    relatedAccess?: string;
    sender?: { _id: string; name: string };
    createdAt: string;
    updatedAt: string;
}

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<DetailedPatient | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ bloodGroup: '', age: '', height: '', weight: '', bmi: '' });
    const [saving, setSaving] = useState(false);
    const [hospitalAccess, setHospitalAccess] = useState<HospitalAccessEntry[]>([]);
    const [pendingNotifications, setPendingNotifications] = useState<Notification[]>([]);
    const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
    const [processingRequest, setProcessingRequest] = useState(false);
    const [showProfileCompletionPopup, setShowProfileCompletionPopup] = useState(false);
    const [skippedOnboardingFields, setSkippedOnboardingFields] = useState<string[]>([]);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileForm, setProfileForm] = useState<Record<PatientOnboardingKey, string>>({
        phone: '',
        dob: '',
        gender: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
    });
    const profilePromptShownRef = useRef(false);

    const getMissingPatientProfileItems = (p: DetailedPatient | null) => {
        if (!p) return [];
        const anyPatient = p as DetailedPatient & {
            phone?: string;
            emergencyContactName?: string;
            emergencyContactPhone?: string;
        };
        const missing: string[] = [];
        const phone = anyPatient.phone || p.contact;
        if (!phone) missing.push('Phone Number');
        if (!p.dob) missing.push('Date of Birth');
        if (!p.gender) missing.push('Gender');
        if (!p.address) missing.push('Address');
        if (!anyPatient.emergencyContactName) missing.push('Emergency Contact Name');
        if (!anyPatient.emergencyContactPhone) missing.push('Emergency Contact Phone');
        return missing;
    };

    const getPatientFieldValue = (p: DetailedPatient, key: PatientOnboardingKey): string => {
        const anyPatient = p as DetailedPatient & {
            phone?: string;
            emergencyContactName?: string;
            emergencyContactPhone?: string;
        };
        if (key === 'phone') return anyPatient.phone || p.contact || '';
        if (key === 'emergencyContactName') return anyPatient.emergencyContactName || '';
        if (key === 'emergencyContactPhone') return anyPatient.emergencyContactPhone || '';
        return String((p as any)[key] || '');
    };

    const openModal = () => {
        setForm({
            bloodGroup: patient?.bloodGroup || '',
            age: patient?.age ? String(patient.age) : '',
            height: patient?.height || '',
            weight: patient?.weight ? String(patient.weight) : '',
            bmi: patient?.bmi ? String(patient.bmi) : '',
        });
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const updateField = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const saveHealthSummary = async () => {
        if (!user?.id) return notify('User not identified');
        setSaving(true);
        try {
            const body: any = {};
            if (form.bloodGroup) body.bloodGroup = form.bloodGroup;
            if (form.age) body.age = Number(form.age);
            if (form.height) body.height = form.height;
            if (form.weight) body.weight = Number(form.weight);
            if (form.bmi) body.bmi = Number(form.bmi);

            const resp = await fetch(`${API_URL}/patients/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) return notify('Save failed: ' + (data?.error || data?.message || 'unknown'));
            setPatient(data.patient as DetailedPatient);
            setShowModal(false);
        } catch (err) {
            console.error('save health summary error', err);
            notify('Error saving health details');
        } finally {
            setSaving(false);
        }
    };

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
        const fetchRecords = async () => {
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

                const list: HospitalAccessEntry[] = Array.from(map.entries()).map(([hospitalId, v]) => ({
                    hospitalId,
                    hospitalName: v.name,
                    lastAccessed: v.lastAccessed,
                }));

                list.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
                setHospitalAccess(list);
            } catch (err) {
                console.warn('Could not fetch hospital access history', err);
            }
        };
        const fetchNotifications = async () => {
            if (!user?.id) return;
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/notifications`);
                const data = await resp.json();
                if (resp.ok && data.notifications) {
                    const pending = data.notifications.filter(
                        (n: Notification) => n.type === 'ACCESS_UPGRADE_REQUEST' && !n.isRead
                    );
                    setPendingNotifications(pending);
                    if (pending.length > 0) {
                        setShowAccessRequestModal(true);
                    }
                }
            } catch (err) {
                console.warn('Could not fetch notifications', err);
            }
        };
        fetchPatient();
        fetchRecords();
        fetchNotifications();
        
        // Set loading to false after all initial fetches complete
        Promise.all([
            fetchPatient(),
            fetchRecords(),
            fetchNotifications()
        ]).finally(() => {
            setInitialLoading(false);
        });
    }, [user?.id]);

    useEffect(() => {
        if (!patient) return;
        const formValues: Record<PatientOnboardingKey, string> = {
            phone: getPatientFieldValue(patient, 'phone'),
            dob: getPatientFieldValue(patient, 'dob'),
            gender: getPatientFieldValue(patient, 'gender'),
            address: getPatientFieldValue(patient, 'address'),
            emergencyContactName: getPatientFieldValue(patient, 'emergencyContactName'),
            emergencyContactPhone: getPatientFieldValue(patient, 'emergencyContactPhone'),
        };
        setProfileForm(formValues);

        if (profilePromptShownRef.current) return;

        const snoozeKey = `g1card:patient-onboarding:snooze:${user?.id || 'anon'}`;
        const snoozeUntil = Number(window.localStorage.getItem(snoozeKey) || '0');
        if (Date.now() < snoozeUntil) return;

        const missing = getMissingPatientProfileItems(patient);
        if (missing.length === 0) return;

        profilePromptShownRef.current = true;
        setSkippedOnboardingFields([]);
        setShowProfileCompletionPopup(true);
        notify('Complete your patient profile for a better onboarding experience.');
    }, [patient, user?.id]);

    const relativeTime = (iso?: string) => {
        if (!iso) return 'N/A';
        const d = new Date(iso).getTime();
        const diff = Date.now() - d;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min${mins>1?'s':''} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs>1?'s':''} ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day${days>1?'s':''} ago`;
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

    const handleAccessRequestDecision = async (notification: Notification, approve: boolean) => {
        if (!user?.id) return;
        setProcessingRequest(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications/${notification.id}/upgrade-decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: approve ? 'APPROVE' : 'DENY' }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Failed to process request');
                return;
            }
            notify(data.message);
            // Remove this notification from pending list
            setPendingNotifications(prev => prev.filter(n => n.id !== notification.id));
            // If no more pending, close modal
            if (pendingNotifications.length <= 1) {
                setShowAccessRequestModal(false);
            }
        } catch (err) {
            console.error('upgrade decision error', err);
            notify('Error processing request');
        } finally {
            setProcessingRequest(false);
        }
    };

    const handleDoLater = () => {
        setShowAccessRequestModal(false);
    };

    const handleProfileLater = () => {
        const snoozeKey = `g1card:patient-onboarding:snooze:${user?.id || 'anon'}`;
        window.localStorage.setItem(snoozeKey, String(Date.now() + ONBOARDING_SNOOZE_MS));
        setShowProfileCompletionPopup(false);
    };

    const handleOnboardingFieldChange = (key: string, value: string) => {
        setProfileForm((prev) => ({ ...prev, [key]: value } as Record<PatientOnboardingKey, string>));
    };

    const handleSkipOnboardingField = (key: string) => {
        setSkippedOnboardingFields((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };

    const handleUnskipOnboardingField = (key: string) => {
        setSkippedOnboardingFields((prev) => prev.filter((item) => item !== key));
    };

    const handleSubmitOnboarding = async () => {
        if (!user?.id) return;

        const body: Record<string, string> = {};
        PATIENT_ONBOARDING_FIELDS.forEach((field) => {
            if (skippedOnboardingFields.includes(field.key)) return;
            const value = (profileForm[field.key] || '').trim();
            if (!value) return;
            body[field.key] = value;
        });

        if (Object.keys(body).length === 0) {
            notify('No onboarding answers to save yet. You can continue later from Settings.');
            setShowProfileCompletionPopup(false);
            return;
        }

        setProfileSaving(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to save onboarding answers');
                return;
            }
            setPatient(data.patient as DetailedPatient);
            setShowProfileCompletionPopup(false);
            notify('Onboarding answers saved successfully.');
        } catch (err) {
            console.error('save patient onboarding error', err);
            notify('Error saving onboarding answers');
        } finally {
            setProfileSaving(false);
        }
    };

    if (initialLoading) {
        return <Loader text="Loading your dashboard..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div className="dashboard-hero rounded-2xl border border-[var(--app-border)] p-5 bg-[var(--app-surface-soft)] dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-800">
                <h2 className="text-2xl font-bold text-[var(--app-text)]">Welcome Back, {user?.name}!</h2>
                <p className="text-sm text-[var(--app-muted)]">Last Access: {relativeTime(user?.lastLogin || patient?.lastUpdated)}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Your Health Summary">
                        <div className="flex justify-around items-center">
                            <HealthSummaryItem label="Blood Group" value={patient?.bloodGroup || 'Not provided'} />
                            <HealthSummaryItem label="Age" value={patient ? `${patient.age || '—'} years` : '—'} />
                            <HealthSummaryItem label="Height" value={patient?.height || '—'} />
                            <HealthSummaryItem label="Weight" value={patient?.weight || '—'} />
                            <HealthSummaryItem label="BMI" value={patient?.bmi || '—'} />
                        </div>
                        <div className="mt-4 text-center">
                            {!patient?.allergies?.length && !patient?.conditions?.length ? (
                                <>
                                    <p className="text-sm text-gray-500">No health details found.</p>
                                    <button onClick={openModal} className="mt-2 px-3 py-1 text-sm bg-brand-primary text-white rounded">Add Details</button>
                                </>
                            ) : (
                                <button onClick={openModal} className="mt-2 px-3 py-1 text-sm border border-brand-primary text-brand-primary rounded">Edit Details</button>
                            )}
                        </div>
                    </Card>
                    <Card title="Quick Actions">
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => navigate('/patient/health-history')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-md hover:bg-brand-secondary">View Full Medical History</button>
                            <button onClick={() => notify('Preparing your records for download...')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Download Records</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Manage Permissions</button>
                            <button onClick={() => navigate('/patient/settings')} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300">Edit Profile</button>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Quick Health Info">
                        <QuickInfoItem icon="allergy" label="Allergies" value={patient?.allergies?.length ? (Array.isArray(patient.allergies) ? (patient.allergies as any).join(', ') : String(patient.allergies)) : 'None'} color="text-red-500" />
                        <QuickInfoItem icon="condition" label="Chronic Conditions" value={patient?.conditions?.length ? (patient.conditions as any).join(', ') : 'None'} color="text-red-600" />
                        <QuickInfoItem icon="medication" label="Active Medications" value={patient?.medications?.length ? `${patient.medications.length} medicines` : 'None'} color="text-yellow-500" />
                        <QuickInfoItem icon="consultation" label="Recent Consultations" value={patient && (patient.consultationHistory as any)?.length ? `${(patient.consultationHistory as any).length} (Last: ${(patient.consultationHistory as any)[0]?.date || 'N/A'})` : 'None'} color="text-blue-500" />
                    </Card>
                    <Card title="Hospital Access History">
                        {hospitalAccess.length === 0 ? (
                            <p className="text-sm text-slate-500">No access history available yet.</p>
                        ) : (
                            <>
                                <ul className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    {hospitalAccess.slice(0, 5).map(entry => (
                                        <li key={entry.hospitalId} className="py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                                </svg>
                                                <span className="font-medium text-slate-900 dark:text-slate-100">{entry.hospitalName}</span>
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{relativeTime(entry.lastAccessed)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                        <button
                            onClick={() => navigate('/patient/health-history')}
                            className="text-sm text-brand-accent hover:underline mt-4 w-full text-right"
                        >
                            View Full Medical Records
                        </button>
                    </Card>
                </div>
            </div>
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md ring-1 ring-slate-200 dark:ring-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Health Summary</h3>
                        <p className="text-sm text-slate-500 mb-4">Add or edit your basic health details.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-slate-700">Blood Group</label>
                                <input value={form.bloodGroup} onChange={(e)=>updateField('bloodGroup', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="B+ / O-" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-slate-700">Age</label>
                                    <input type="number" value={form.age} onChange={(e)=>updateField('age', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-700">Height</label>
                                    <input value={form.height} onChange={(e)=>updateField('height', e.target.value)} placeholder={"e.g. 5'10\""} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-slate-700">Weight (kg)</label>
                                    <input type="number" value={form.weight} onChange={(e)=>updateField('weight', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-700">BMI</label>
                                    <input type="number" step="0.1" value={form.bmi} onChange={(e)=>updateField('bmi', e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={closeModal} className="px-4 py-2 border rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">Cancel</button>
                            <button onClick={saveHealthSummary} disabled={saving} className="px-4 py-2 bg-brand-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ProfileCompletionPopup
                isOpen={showProfileCompletionPopup}
                roleLabel="Patient"
                title="Complete your patient onboarding"
                subtitle="Answer each question now or tap Do later on any field. You can finish everything from Settings."
                fields={PATIENT_ONBOARDING_FIELDS.map((field) => ({
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    placeholder: field.placeholder,
                    value: profileForm[field.key],
                }))}
                skippedFields={skippedOnboardingFields}
                onFieldChange={handleOnboardingFieldChange}
                onSkipField={handleSkipOnboardingField}
                onUnskipField={handleUnskipOnboardingField}
                onSubmit={handleSubmitOnboarding}
                onLater={handleProfileLater}
                onOpenDetails={() => {
                    setShowProfileCompletionPopup(false);
                    navigate('/patient/settings');
                }}
                saving={profileSaving}
            />

            {showAccessRequestModal && pendingNotifications.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-lg ring-1 ring-slate-200 dark:ring-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Access Request</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">A hospital has requested to upgrade their access level</p>
                            </div>
                            <button 
                                onClick={handleDoLater} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {pendingNotifications.map((notification) => (
                                <div 
                                    key={notification.id}
                                    className="p-4 border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                                >
                                    <div className="flex items-start gap-3">
                                        <svg className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                                                    {notification.metadata?.hospitalName || 'Hospital'}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-700 dark:text-orange-200">
                                                    UPGRADE REQUEST
                                                </span>
                                            </div>
                                            <p className="text-sm text-orange-700 dark:text-orange-400 mb-3">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-orange-600 dark:text-orange-500 mb-3">
                                                Requested: {new Date(notification.createdAt).toLocaleString('en-IN', { 
                                                    timeZone: 'Asia/Kolkata', 
                                                    day: '2-digit', 
                                                    month: 'short', 
                                                    year: 'numeric', 
                                                    hour: '2-digit', 
                                                    minute: '2-digit', 
                                                    hour12: true 
                                                })}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAccessRequestDecision(notification, false)}
                                                    disabled={processingRequest}
                                                    className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Deny
                                                </button>
                                                <button
                                                    onClick={() => handleAccessRequestDecision(notification, true)}
                                                    disabled={processingRequest}
                                                    className="px-4 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingRequest ? 'Processing...' : 'Grant Complete Access'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-center">
                            <button 
                                onClick={handleDoLater}
                                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                I'll do this later
                            </button>
                        </div>
                        <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
                            You can also manage these requests from the Notifications page
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;