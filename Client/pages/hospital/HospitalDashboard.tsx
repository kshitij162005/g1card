import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';

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

const HospitalDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [metrics, setMetrics] = useState<{ patientsTotal: number; recordsTotal: number; staffTotal: number; recentPatients: RecentPatient[] }>({
        patientsTotal: 0,
        recordsTotal: 0,
        staffTotal: 0,
        recentPatients: [],
    });

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user) return;
            setLoadingMetrics(true);
            try {
                const resp = await fetch(`http://localhost:8082/api/hospitals/${user.id}/dashboard-metrics`);
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Failed to fetch metrics');
                setMetrics({
                    patientsTotal: data.metrics?.patientsTotal ?? 0,
                    recordsTotal: data.metrics?.recordsTotal ?? 0,
                    staffTotal: data.metrics?.staffTotal ?? 0,
                    recentPatients: data.metrics?.recentPatients ?? [],
                });
            } catch (err) {
                console.error('fetch dashboard metrics', err);
            } finally {
                setLoadingMetrics(false);
            }
        };
        fetchMetrics();
    }, [user]);

    const pendingVerifications = [
        { type: 'Staff members awaiting approval', count: 3 },
        { type: 'New patients pending verification', count: 5 },
    ];

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
            <Card>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome, {user?.name || 'Hospital'}</h2>
                <div className="flex space-x-6 text-sm text-slate-500 dark:text-slate-400 mt-2">
                    <span>Verification Status: <span className="text-status-green font-semibold">✓ Approved</span></span>
                    <span>Last Activity: {formatLastActivity()}</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Active Patients" value={metrics.patientsTotal} loading={loadingMetrics} />
                <StatCard title="Medical Records" value={metrics.recordsTotal} loading={loadingMetrics} />
                <StatCard title="Staff Members" value={metrics.staffTotal} loading={loadingMetrics} />
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
                                            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                 <Card title="Pending Verifications">
                     <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {pendingVerifications.map(item => (
                            <li key={item.type} className="py-3 flex justify-between items-center text-sm">
                               <span className="text-slate-800 dark:text-slate-300">{item.type}</span>
                               <span className="font-bold text-brand-primary bg-brand-light dark:bg-brand-secondary dark:text-white rounded-full px-2 py-1">{item.count}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
            
            <Card title="Quick Actions">
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => navigate('/hospital/patients/add')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition-transform transform hover:scale-105">+ Add Patient</button>
                    <button onClick={() => navigate('/hospital/patients')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">View Patients</button>
                    <button onClick={() => navigate('/hospital/forms')} className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-800 transition-transform transform hover:scale-105">+ Add Record</button>
                    <button onClick={() => navigate('/hospital/staff')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Staff Mgmt</button>
                    <button onClick={() => navigate('/hospital/reports')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Generate Report</button>
                    <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Account Settings</button>
                </div>
            </Card>
        </div>
    );
};

export default HospitalDashboard;