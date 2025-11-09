import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import { useNavigate } from 'react-router-dom';

const StatCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <Card className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-brand-primary dark:text-brand-accent">{value}</p>
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
    const recentHospitals = [
        { name: 'City Hospital - Pune', status: 'Pending' },
        { name: 'Apollo Hospital - Mumbai', status: 'Active' },
        { name: 'Max Healthcare - Delhi', status: 'Active' },
    ];
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome, {user?.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Last Login: {user?.lastLogin}</p>
                </div>
                 <div className="flex space-x-2">
                    <button onClick={() => navigate('/admin/hospitals/add')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition-transform transform hover:scale-105">+ Add Hospital</button>
                    <button onClick={() => navigate('/admin/users')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">View All Users</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Hospitals" value={45} />
                <StatCard title="Active Hospitals" value={42} />
                <StatCard title="Active Patients" value="12,450" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Recent Hospital Registrations">
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {recentHospitals.map(hospital => (
                            <li key={hospital.name} className="py-3 flex justify-between items-center">
                               <span className="text-slate-800 dark:text-slate-300">{hospital.name}</span>
                               <span className={`px-2 py-1 text-xs rounded-full font-semibold ${hospital.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                   {hospital.status}
                               </span>
                            </li>
                        ))}
                    </ul>
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