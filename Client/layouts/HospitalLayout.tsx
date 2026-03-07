import { API_URL } from '../config/api';
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Card from '../components/Card';
import { useSSE } from '../hooks/useSSE';
import GlassNotification from '../components/GlassNotification';
import Loader from '../components/Loader';

type HospitalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

const HospitalHeader: React.FC<{ isActive: boolean; notificationCount?: number; onOpenNotifications?: () => void }> = ({ isActive, notificationCount = 0, onOpenNotifications }) => {
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
                            <NavLink to="/hospital/reports" className={navLinkClasses}>Reports</NavLink>
                            <NavLink to="/hospital/logs" className={navLinkClasses}>Audit Logs</NavLink>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-slate-600 dark:text-slate-300 text-sm hidden sm:block">Welcome, {user?.name}</span>
                    {isActive && onOpenNotifications && (
                        <button
                            type="button"
                            onClick={onOpenNotifications}
                            className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Notifications"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-slate-600 dark:text-slate-300"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" />
                                <path d="M10 18a3 3 0 01-2.995-2.824L7 15h6a3 3 0 01-2.824 2.995L10 18z" />
                            </svg>
                            {notificationCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full">
                                    {notificationCount}
                                </span>
                            )}
                        </button>
                    )}
                    <ThemeToggle />
                    {isActive && (
                        <button onClick={() => navigate('/hospital/settings')} className="px-4 py-2 bg-slate-600 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-all transform hover:scale-105 shadow-sm hover:shadow-md">
                            Settings
                        </button>
                    )}
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
    const navigate = useNavigate();
    const [hospitalStatus, setHospitalStatus] = useState<HospitalStatus>('approved');
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notification, setNotification] = useState<{
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    } | null>(null);

    // SSE connection for real-time notifications
    const { connected, lastEvent } = useSSE({
        userId: user?.id || '',
        userType: 'Hospital',
        enabled: !!user?.id && hospitalStatus === 'approved',
        onEvent: (eventData) => {
            console.log('SSE Event received:', eventData);
            
            // Map event types to notification types
            let notificationType: 'info' | 'success' | 'warning' | 'error' = 'info';
            
            if (eventData.type === 'ACCESS_GRANTED') {
                notificationType = 'success';
            } else if (eventData.type === 'ACCESS_DENIED' || eventData.type === 'ACCESS_REVOKED') {
                notificationType = 'warning';
            } else if (eventData.type === 'ACCESS_LEVEL_CHANGED') {
                // Check if upgraded or downgraded
                notificationType = eventData.newLevel === 'COMPLETE' ? 'success' : 'warning';
            }
            
            // Show glass notification for all events
            setNotification({
                title: eventData.title || 'Notification',
                message: eventData.message || 'You have a new notification',
                type: notificationType
            });
            
            // Increment notification count
            setNotificationCount(prev => prev + 1);
        }
    });

    // Fetch initial notification count
    useEffect(() => {
        if (!user?.id || hospitalStatus !== 'approved') return;
        const fetchCount = async () => {
            try {
                const resp = await fetch(`${API_URL}/hospitals/${user.id}/notifications/count`);
                const data = await resp.json();
                if (resp.ok && data.counts) {
                    setNotificationCount(data.counts.total);
                }
            } catch {
                // ignore
            }
        };
        fetchCount();
    }, [user?.id, hospitalStatus]);

    useEffect(() => {
        if (user?.id) fetchHospitalStatus();
    }, [user?.id]);

    const fetchHospitalStatus = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            setHospitalStatus(data.hospital?.status || 'approved');
            setRejectionReason(data.hospital?.rejectionReason || '');
        } catch (err) {
            console.error('fetch hospital status error:', err);
            setHospitalStatus('approved'); // fail-open: assume approved if error
        } finally {
            setLoading(false);
        }
    };

    const handleOpenNotifications = () => {
        // Reset notification count when opening notifications page
        setNotificationCount(0);
        navigate('/hospital/notifications');
    };

    if (loading) {
        return <Loader text="Verifying hospital status..." fullScreen />;
    }

    // Pending approval state
    if (hospitalStatus === 'pending') {
        return (
            <div className="min-h-screen">
                <HospitalHeader isActive={false} />
                <main className="container mx-auto p-4 md:p-6 max-w-2xl mt-12">
                    <Card>
                        <div className="text-center py-8 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
                                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Verification Pending</h2>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mx-auto max-w-md">
                                <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                                    🕐 Your registration is under review
                                </p>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Thank you for registering with G1CARD! Your hospital registration request has been submitted successfully and is currently being reviewed by our verification team.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                This process typically takes 1-3 business days. You will be notified once your account has been approved.
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mx-auto max-w-md mt-4">
                                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">What we're verifying:</h3>
                                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 text-left">
                                    <li>✓ Hospital registration details</li>
                                    <li>✓ License and certification documents</li>
                                    <li>✓ Administrator credentials</li>
                                    <li>✓ Contact information</li>
                                </ul>
                            </div>
                            <div className="pt-4">
                                <button onClick={fetchHospitalStatus} className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors">
                                    Check Status
                                </button>
                            </div>
                        </div>
                    </Card>
                </main>
            </div>
        );
    }

    // Rejected state
    if (hospitalStatus === 'rejected') {
        return (
            <div className="min-h-screen">
                <HospitalHeader isActive={false} />
                <main className="container mx-auto p-4 md:p-6 max-w-2xl mt-12">
                    <Card>
                        <div className="text-center py-8 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Registration Rejected</h2>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mx-auto max-w-md">
                                <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                                    ❌ Your registration request was not approved
                                </p>
                            </div>
                            {rejectionReason && (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mx-auto max-w-md">
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Reason:</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{rejectionReason}</p>
                                </div>
                            )}
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                If you believe this is an error or would like to provide additional information, please contact our support team.
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

    // Suspended/Inactive state
    if (hospitalStatus === 'suspended') {
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
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Hospital Account Suspended</h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Your hospital account has been suspended by the system administrator. 
                                All features and services are currently unavailable.
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Please contact the super admin to resolve this issue and restore access to all hospital management features.
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
            <HospitalHeader isActive={true} notificationCount={notificationCount} onOpenNotifications={handleOpenNotifications} />
            <main className="container mx-auto p-4 md:p-6">
                <Outlet />
            </main>

            {/* Glass Notification */}
            {notification && (
                <GlassNotification
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    );
};

export default HospitalLayout;