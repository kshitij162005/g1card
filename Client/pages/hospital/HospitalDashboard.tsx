import { API_URL } from '../../config/api';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import ProfileCompletionPopup from '../../components/ProfileCompletionPopup';
import StatCard from '../../components/StatCard';
import { timeOfDayGreeting } from '../../utils/greeting';

const ONBOARDING_SNOOZE_MS = 24 * 60 * 60 * 1000;

const HOSPITAL_ONBOARDING_FIELDS = [
    { key: 'regNumber', label: 'Registration Number', type: 'text' as const, placeholder: 'Enter official registration number' },
    { key: 'license', label: 'License Number', type: 'text' as const, placeholder: 'Enter healthcare license number' },
    { key: 'phone', label: 'Hospital Phone', type: 'tel' as const, placeholder: 'Main hospital phone number' },
    { key: 'address', label: 'Address', type: 'text' as const, placeholder: 'Building, street, area' },
    { key: 'city', label: 'City', type: 'text' as const, placeholder: 'City' },
    { key: 'state', label: 'State', type: 'text' as const, placeholder: 'State' },
    { key: 'pin', label: 'PIN Code', type: 'text' as const, placeholder: 'Postal code' },
    { key: 'contactEmail', label: 'Contact Email', type: 'email' as const, placeholder: 'Public support or contact email' },
    { key: 'website', label: 'Website', type: 'url' as const, placeholder: 'https://yourhospital.com' },
    { key: 'adminPhone', label: 'Admin Phone', type: 'tel' as const, placeholder: 'Primary admin phone number' },
];

type HospitalOnboardingKey = typeof HOSPITAL_ONBOARDING_FIELDS[number]['key'];


interface RecentPatient {
    id: string;
    patientId: string;
    name: string;
    email?: string;
    phone?: string;
    gender?: string;
    createdAt: string;
    suspended?: boolean;
}

interface HospitalProfile {
    name?: string;
    regNumber?: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
    license?: string;
    website?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
}

const HospitalDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loadingMetrics, setLoadingMetrics] = useState(true);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [showProfileCompletionPopup, setShowProfileCompletionPopup] = useState(false);
    const [skippedOnboardingFields, setSkippedOnboardingFields] = useState<string[]>([]);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileForm, setProfileForm] = useState<Record<HospitalOnboardingKey, string>>({
        regNumber: '',
        license: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pin: '',
        contactEmail: '',
        website: '',
        adminPhone: '',
    });
    const profilePromptShownRef = useRef(false);
    const [metrics, setMetrics] = useState<{ patientsTotal: number; recordsTotal: number; patientsPending: number; recentPatients: RecentPatient[] }>({
        patientsTotal: 0,
        recordsTotal: 0,
        patientsPending: 0,
        recentPatients: [],
    });

    const getMissingHospitalProfileItems = (profile: HospitalProfile | null) => {
        if (!profile) return [];
        const missing: string[] = [];
        if (!profile.regNumber) missing.push('Registration Number');
        if (!profile.license) missing.push('License Number');
        if (!profile.phone) missing.push('Hospital Phone');
        if (!profile.address) missing.push('Address');
        if (!profile.city) missing.push('City');
        if (!profile.state) missing.push('State');
        if (!profile.pin) missing.push('PIN Code');
        if (!profile.adminPhone) missing.push('Admin Phone');
        return missing;
    };

    const getHospitalFieldValue = (profile: HospitalProfile, key: HospitalOnboardingKey) => String((profile as any)?.[key] || '');

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user) return;
            setLoadingMetrics(true);
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/dashboard-metrics`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to fetch metrics');
                setMetrics({
                    patientsTotal: data.metrics?.patientsTotal ?? 0,
                    recordsTotal: data.metrics?.recordsTotal ?? 0,
                    patientsPending: data.metrics?.patientsPending ?? 0,
                    recentPatients: data.metrics?.recentPatients ?? [],
                });
            } catch (err) {
                console.error('fetch dashboard metrics', err);
            } finally {
                setLoadingMetrics(false);
            }
        };
        const fetchHospitalProfile = async () => {
            if (!user) return;
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}`);
                const data = await resp.json();
                if (resp.ok && data?.hospital) {
                    setHospitalProfile(data.hospital as HospitalProfile);
                }
            } catch (err) {
                console.error('fetch hospital profile', err);
            }
        };
        fetchMetrics();
        fetchHospitalProfile();
    }, [user]);

    useEffect(() => {
        if (!hospitalProfile) return;
        const formValues: Record<HospitalOnboardingKey, string> = {
            regNumber: getHospitalFieldValue(hospitalProfile, 'regNumber'),
            license: getHospitalFieldValue(hospitalProfile, 'license'),
            phone: getHospitalFieldValue(hospitalProfile, 'phone'),
            address: getHospitalFieldValue(hospitalProfile, 'address'),
            city: getHospitalFieldValue(hospitalProfile, 'city'),
            state: getHospitalFieldValue(hospitalProfile, 'state'),
            pin: getHospitalFieldValue(hospitalProfile, 'pin'),
            contactEmail: getHospitalFieldValue(hospitalProfile, 'contactEmail'),
            website: getHospitalFieldValue(hospitalProfile, 'website'),
            adminPhone: getHospitalFieldValue(hospitalProfile, 'adminPhone'),
        };
        setProfileForm(formValues);

        if (profilePromptShownRef.current) return;
        const snoozeKey = `g1card:hospital-onboarding:snooze:${user?.id || 'anon'}`;
        const snoozeUntil = Number(window.localStorage.getItem(snoozeKey) || '0');
        if (Date.now() < snoozeUntil) return;

        const missing = getMissingHospitalProfileItems(hospitalProfile);
        if (missing.length === 0) return;

        profilePromptShownRef.current = true;
        setSkippedOnboardingFields([]);
        setShowProfileCompletionPopup(true);
        notify('Complete your hospital profile to improve onboarding and approvals.');
    }, [hospitalProfile, user?.id]);

    const handleProfileLater = () => {
        const snoozeKey = `g1card:hospital-onboarding:snooze:${user?.id || 'anon'}`;
        window.localStorage.setItem(snoozeKey, String(Date.now() + ONBOARDING_SNOOZE_MS));
        setShowProfileCompletionPopup(false);
    };

    const handleOnboardingFieldChange = (key: string, value: string) => {
        setProfileForm((prev) => ({ ...prev, [key]: value } as Record<HospitalOnboardingKey, string>));
    };

    const handleSkipOnboardingField = (key: string) => {
        setSkippedOnboardingFields((prev) => (prev.includes(key) ? prev : [...prev, key]));
    };

    const handleUnskipOnboardingField = (key: string) => {
        setSkippedOnboardingFields((prev) => prev.filter((item) => item !== key));
    };

    const handleSubmitOnboarding = async () => {
        if (!user?.id || !hospitalProfile) return;

        const changes: Record<string, string> = {};
        HOSPITAL_ONBOARDING_FIELDS.forEach((field) => {
            if (skippedOnboardingFields.includes(field.key)) return;
            const nextValue = (profileForm[field.key] || '').trim();
            if (!nextValue) return;
            if (nextValue === String((hospitalProfile as any)?.[field.key] || '')) return;
            changes[field.key] = nextValue;
        });

        if (Object.keys(changes).length === 0) {
            notify('No onboarding answers to submit yet. You can continue later from Settings.');
            setShowProfileCompletionPopup(false);
            return;
        }

        setProfileSaving(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    changes,
                    message: 'Submitted via hospital onboarding flow',
                }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to submit onboarding answers');
                return;
            }
            setShowProfileCompletionPopup(false);
            notify('Onboarding answers submitted for admin approval.');
        } catch (err) {
            console.error('submit hospital onboarding error', err);
            notify('Error submitting onboarding answers');
        } finally {
            setProfileSaving(false);
        }
    };

    if (loadingMetrics) {
        return <Loader text="Loading dashboard..." fullScreen />;
    }

    // Format last activity time
    const formatLastActivity = () => {
        if (!user?.lastAccess) return 'Just now';
        const lastAccess = new Date(user.lastAccess);
        const now = new Date();
        const diffMs = now.getTime() - lastAccess.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    return (
        <div className="space-y-6">
            <Card className="dashboard-hero">
                <p className="app-hero-kicker">{timeOfDayGreeting()}</p>
                <h2 className="text-2xl font-bold text-[var(--app-text)]">{user?.name || 'Your hospital'}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--app-muted)] mt-2">
                    <span>Verification Status: <span className="text-status-green font-semibold">Approved</span></span>
                    <span>Last Activity: {formatLastActivity()}</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Patients with access" value={metrics.patientsTotal} loading={loadingMetrics} tone="blue" icon="people" />
                <StatCard title="Records created" value={metrics.recordsTotal} loading={loadingMetrics} tone="teal" icon="records" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Recent Patients Added">
                    {loadingMetrics ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
                    ) : metrics.recentPatients.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No patients added recently.</p>
                    ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {metrics.recentPatients.map(item => (
                                <li key={item.id} className="py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer" onClick={() => navigate(`/hospital/patients/${item.id}`)}>
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center text-sm gap-2">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-base inline-flex items-center gap-2">{item.name || 'Unknown Patient'}{item.suspended && <span className="app-suspended-badge" title="This patient's G1Card account is suspended by an admin">Suspended</span>}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Patient ID: {item.patientId}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                 <Card title="Pending Verifications">
                     {loadingMetrics ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
                     ) : metrics.patientsPending === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No pending verifications.</p>
                     ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            <li className="py-3 flex justify-between items-center text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => navigate('/hospital/patients')}>
                               <span className="text-slate-800 dark:text-slate-300">New patients pending verification</span>
                               <span className="font-bold text-brand-primary bg-brand-light dark:bg-brand-secondary dark:text-white rounded-full px-2 py-1">{metrics.patientsPending}</span>
                            </li>
                        </ul>
                     )}
                </Card>
            </div>
            
            <Card title="Quick Actions">
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => navigate('/hospital/patients/add')} className="px-4 py-2.5 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition-all shadow-sm hover:shadow-md">+ Add Patient</button>
                    <button onClick={() => navigate('/hospital/patients')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">View Patients</button>
                    <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">+ Add Record</button>
                    <button onClick={() => navigate('/hospital/reports')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Generate Report</button>
                    <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Account Settings</button>
                </div>
            </Card>

            <ProfileCompletionPopup
                isOpen={showProfileCompletionPopup}
                roleLabel="Hospital"
                title="Complete your hospital onboarding"
                subtitle="Share details now or defer any question. All onboarding fields remain editable in Hospital Settings."
                fields={HOSPITAL_ONBOARDING_FIELDS.map((field) => ({
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
                    navigate('/hospital/settings');
                }}
                saving={profileSaving}
            />
        </div>
    );
};

export default HospitalDashboard;