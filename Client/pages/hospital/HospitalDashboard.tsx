import { API_URL } from '../../config/api';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import ProfileCompletionPopup from '../../components/ProfileCompletionPopup';

const StatCard: React.FC<{ title: string; value: string | number; loading?: boolean; }> = ({ title, value, loading }) => (
    <Card className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-brand-primary dark:text-brand-accent">
            {loading ? '—' : value}
        </p>
    </Card>
);

interface RecentPatient {
    id: string;
    patientId: string;
    name: string;
    email?: string;
    phone?: string;
    gender?: string;
    createdAt: string;
}

interface HospitalProfile {
    regNumber?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
    license?: string;
    adminPhone?: string;
}

const HospitalDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loadingMetrics, setLoadingMetrics] = useState(true);
    const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
    const [showProfileCompletionPopup, setShowProfileCompletionPopup] = useState(false);
    const [missingProfileItems, setMissingProfileItems] = useState<string[]>([]);
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
        if (profilePromptShownRef.current) return;

        const missing = getMissingHospitalProfileItems(hospitalProfile);
        if (missing.length === 0) return;

        profilePromptShownRef.current = true;
        setMissingProfileItems(missing);
        setShowProfileCompletionPopup(true);
        notify('Complete your hospital profile to improve onboarding and approvals.');
    }, [hospitalProfile]);

    const handleProfileCompleteNow = () => {
        setShowProfileCompletionPopup(false);
        navigate('/hospital/settings');
    };

    const handleProfileLater = () => {
        setShowProfileCompletionPopup(false);
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
            <Card className="dashboard-hero bg-[linear-gradient(130deg,#dce7f6_0%,#e7eef8_52%,#dceaf7_100%)] dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-800">
                <h2 className="text-2xl font-bold text-[var(--app-text)]">Welcome, {user?.name || 'Hospital'}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-[var(--app-muted)] mt-2">
                    <span>Verification Status: <span className="text-status-green font-semibold">Approved</span></span>
                    <span>Last Activity: {formatLastActivity()}</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Active Patients" value={metrics.patientsTotal} loading={loadingMetrics} />
                <StatCard title="Medical Records" value={metrics.recordsTotal} loading={loadingMetrics} />
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
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-base">{item.name || 'Unknown Patient'}</span>
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
                    <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2.5 bg-emerald-600 dark:bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-800 transition-all shadow-sm hover:shadow-md">+ Add Record</button>
                    <button onClick={() => navigate('/hospital/reports')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Generate Report</button>
                    <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Account Settings</button>
                </div>
            </Card>

            <ProfileCompletionPopup
                isOpen={showProfileCompletionPopup}
                roleLabel="Hospital"
                missingItems={missingProfileItems}
                onCompleteNow={handleProfileCompleteNow}
                onLater={handleProfileLater}
            />
        </div>
    );
};

export default HospitalDashboard;