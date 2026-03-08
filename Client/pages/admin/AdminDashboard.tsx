import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';

const StatCard: React.FC<{ title: string; value: string | number; loading?: boolean }> = ({ title, value, loading }) => (
    <Card className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-brand-primary dark:text-brand-accent">{loading ? '...' : value}</p>
    </Card>
);

const SystemHealthItem: React.FC<{ name: string; status: 'Healthy' | 'Used' | 'Pending'; value?: string }> = ({ name, status, value }) => {
    const isHealthy = status === 'Healthy';
    const isPending = status === 'Pending';
    const dotColor = isHealthy ? 'bg-status-green' : isPending ? 'bg-status-yellow' : 'bg-status-red';
    
    return (
        <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
                <span className={`mr-3 h-3 w-3 rounded-full ${dotColor}`}></span>
                <span className="text-slate-700 dark:text-slate-300">{name}</span>
            </div>
            <span className={`font-medium ${isHealthy ? 'text-status-green' : 'text-slate-700 dark:text-slate-300'}`}>{value || status}</span>
        </div>
    );
};


const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalHospitals: 0, activeHospitals: 0, activePatients: 0, recentHospitals: [] as any[] });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/dashboard/stats`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to fetch stats');
            setStats(data.stats || { totalHospitals: 0, activeHospitals: 0, activePatients: 0, recentHospitals: [] });
        } catch (err) {
            console.error('fetch dashboard stats error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Loader text="Loading admin dashboard..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome, {user?.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Super Admin Dashboard</p>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <button onClick={() => navigate('/admin/hospitals/add')} className="px-4 py-2.5 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary shadow-sm hover:shadow-md transition-all">+ Add Hospital</button>
                    <button onClick={() => navigate('/admin/hospitals')} className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">View All Hospitals</button>
                    <button onClick={() => navigate('/admin/logs')} className="px-4 py-2.5 bg-violet-600 dark:bg-violet-700 text-white text-sm rounded-lg hover:bg-violet-700 dark:hover:bg-violet-600 transition-all flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Audit Logs
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Hospitals" value={stats.totalHospitals} loading={loading} />
                <StatCard title="Active Hospitals" value={stats.activeHospitals} loading={loading} />
                <StatCard title="Active Patients" value={stats.activePatients.toLocaleString()} loading={loading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Recent Hospital Registrations">
                    {loading ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
                    ) : stats.recentHospitals.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No hospitals registered yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {stats.recentHospitals.map((hospital: any) => (
                                <li key={hospital._id} className="py-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => navigate(`/admin/hospitals/${hospital._id}`)}>
                                   <div className="flex-1">
                                       <span className="text-slate-800 dark:text-slate-300 font-medium">{hospital.name}</span>
                                       <p className="text-xs text-slate-500 dark:text-slate-400">{hospital.city}, {hospital.state}</p>
                                   </div>
                                   <span className={`px-2 py-1 text-xs rounded-full font-semibold ${hospital.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                       {hospital.active ? 'Active' : 'Inactive'}
                                   </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="System Health">
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        <SystemHealthItem name="API Response Time" status="Healthy" value="120ms" />
                        <SystemHealthItem name="Database" status="Healthy" />
                        <SystemHealthItem name="Email Service" status="Healthy" />
                        <SystemHealthItem name="Storage" status="Used" value="45% Used" />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;