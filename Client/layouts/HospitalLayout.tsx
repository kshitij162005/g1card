import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Card from '../components/Card';

const HospitalHeader: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinkClasses = ({ isActive: active }: { isActive: boolean }): string => 
        `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-100 dark:bg-slate-700 text-brand-primary dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-300 hover:text-brand-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`;

    return (
        <header className="bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <nav className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-6">
                    <h1 className="text-xl font-bold text-brand-primary dark:text-white tracking-wider">G1CARD</h1>
                    {isActive && (
                        <div className="hidden md:flex items-center space-x-1">
                            <NavLink to="/hospital/dashboard" className={navLinkClasses}>Dashboard</NavLink>
                            <NavLink to="/hospital/patients" className={navLinkClasses}>Patients</NavLink>
                            <NavLink to="/hospital/staff" className={navLinkClasses}>Staff</NavLink>
                            <NavLink to="/hospital/reports" className={navLinkClasses}>Reports</NavLink>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-slate-600 dark:text-slate-300 text-sm hidden sm:block">Welcome, {user?.name}</span>
                    <ThemeToggle />
                    <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2 bg-slate-600 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-all transform hover:scale-105 shadow-sm hover:shadow-md">
                        Settings
                    </button>
                    <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all transform hover:scale-105 shadow-sm hover:shadow-md">
                        Logout
                    </button>
                </div>
            </nav>
        </header>
    );
};

const HospitalLayout: React.FC = () => {
    const { user } = useAuth();
    const [hospitalActive, setHospitalActive] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) fetchHospitalStatus();
    }, [user?.id]);

    const fetchHospitalStatus = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`http://localhost:8082/api/superadmin/hospitals/${user.id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            setHospitalActive(data.hospital?.active ?? true);
        } catch (err) {
            console.error('fetch hospital status error:', err);
            setHospitalActive(true); // fail-open: assume active if error
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen">
                <HospitalHeader isActive={true} />
                <main className="container mx-auto p-4 md:p-6">
                    <p className="text-center text-slate-600 dark:text-slate-400">Loading...</p>
                </main>
            </div>
        );
    }

    if (!hospitalActive) {
        return (
            <div className="min-h-screen">
                <HospitalHeader isActive={false} />
                <main className="container mx-auto p-4 md:p-6 max-w-2xl mt-12">
                    <Card>
                        <div className="text-center py-8 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Hospital Account Inactive</h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Your hospital account has been deactivated by the system administrator. 
                                All features and services are currently unavailable.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Please contact the super admin to reactivate your account and restore access to all hospital management features.
                            </p>
                            <div className="pt-4">
                                <button onClick={fetchHospitalStatus} className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors">
                                    Check Status Again
                                </button>
                            </div>
                        </div>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <HospitalHeader isActive={true} />
            <main className="container mx-auto p-4 md:p-6">
                <Outlet />
            </main>
        </div>
    );
};

export default HospitalLayout;