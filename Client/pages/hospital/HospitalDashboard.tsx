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

const HospitalDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const recentPatientAccess = [
        { id: 'P12345', time: '10 min ago' },
        { id: 'P12346', time: '25 min ago' },
        { id: 'P12347', time: '1 hour ago' },
    ];

    const pendingVerifications = [
        { type: 'Staff members awaiting approval', count: 3 },
        { type: 'New patients pending verification', count: 5 },
    ];

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome, Apollo Hospital - Mumbai</h2>
                <div className="flex space-x-6 text-sm text-slate-500 dark:text-slate-400 mt-2">
                    <span>Verification Status: <span className="text-status-green font-semibold">✓ Approved</span></span>
                    <span>Last Activity: 30 minutes ago</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Active Patients" value={450} />
                <StatCard title="Medical Records" value={2340} />
                <StatCard title="Staff Members" value={85} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Recent Patient Access">
                     <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {recentPatientAccess.map(item => (
                            <li key={item.id} className="py-3 flex justify-between items-center text-sm">
                               <span>Patient ID: <span className="font-semibold text-slate-800 dark:text-slate-200">{item.id}</span></span>
                               <span className="text-slate-500 dark:text-slate-400">{item.time}</span>
                            </li>
                        ))}
                    </ul>
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
                    <button onClick={() => navigate('/hospital/staff')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Staff Mgmt</button>
                    <button onClick={() => navigate('/hospital/reports')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Generate Report</button>
                    <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform transform hover:scale-105">Account Settings</button>
                </div>
            </Card>
        </div>
    );
};

export default HospitalDashboard;