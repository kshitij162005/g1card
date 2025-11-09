import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

const AdminHeader: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinkClasses = ({ isActive }: { isActive: boolean }): string => 
        `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-100 dark:bg-slate-700 text-brand-primary dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-300 hover:text-brand-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`;

    return (
        <header className="bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <nav className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-6">
                    <h1 className="text-xl font-bold text-brand-primary dark:text-white tracking-wider">G1CARD ADMIN</h1>
                    <div className="hidden md:flex items-center space-x-1">
                        <NavLink to="/admin/dashboard" className={navLinkClasses}>Dashboard</NavLink>
                        <NavLink to="/admin/hospitals" className={navLinkClasses}>Hospitals</NavLink>
                        <NavLink to="/admin/users" className={navLinkClasses}>Users</NavLink>
                        <NavLink to="/admin/settings" className={navLinkClasses}>Settings</NavLink>
                        <NavLink to="/admin/logs" className={navLinkClasses}>Audit Logs</NavLink>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-slate-600 dark:text-slate-300 text-sm hidden sm:block">Welcome, {user?.name}</span>
                    <ThemeToggle />
                    <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all transform hover:scale-105 shadow-sm hover:shadow-md">
                        Logout
                    </button>
                </div>
            </nav>
        </header>
    );
};

const AdminLayout: React.FC = () => {
    return (
        <div className="min-h-screen">
            <AdminHeader />
            <main className="container mx-auto p-4 md:p-6">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;