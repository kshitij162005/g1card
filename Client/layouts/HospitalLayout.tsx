import { API_URL } from '../config/api';
import { goHome } from '../utils/home';
import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/Card';
import { useSSE } from '../hooks/useSSE';
import GlassNotification from '../components/GlassNotification';
import Loader from '../components/Loader';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../utils/theme';

type HospitalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

const hospitalNavItems = [
    { to: '/hospital/dashboard', label: 'Dashboard' },
    { to: '/hospital/patients', label: 'Patients' },
    { to: '/hospital/forms', label: 'Forms' },
    { to: '/hospital/reports', label: 'Reports' },
    { to: '/hospital/logs', label: 'Audit Logs' },
    { to: '/hospital/notifications', label: 'Notifications' }
];

const HospitalHeader: React.FC<{
    isActive: boolean;
    notificationCount?: number;
    onOpenNotifications?: () => void;
    onOpenNav?: () => void;
    onToggleDesktopNav?: () => void;
    isDesktopNavCollapsed?: boolean;
}> = ({ isActive, notificationCount = 0, onOpenNotifications, onOpenNav, onToggleDesktopNav, isDesktopNavCollapsed = false }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
    const isNotificationsPage = location.pathname.includes('/hospital/notifications');
    const isSettingsPage = location.pathname.includes('/hospital/settings');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleThemeMode = () => {
        setThemeMode((prev) => {
            const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
            setStoredTheme(next);
            return next;
        });
    };

    return (
        <header className="bg-[var(--app-surface)]/95 backdrop-blur-md sticky top-0 z-50 border-b border-[var(--app-border)] shadow-sm">
            <nav className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-6">
                    {isActive && (
                        <button
                            type="button"
                            className="lg:hidden p-2 rounded-lg hover:bg-[var(--app-surface-soft)]"
                            onClick={onOpenNav}
                            aria-label="Open navigation"
                        >
                            <svg className="w-5 h-5 text-[var(--app-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    )}
                    {isActive && onToggleDesktopNav && (
                        <button
                            type="button"
                            className="hidden lg:inline-flex p-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)] transition-colors"
                            onClick={onToggleDesktopNav}
                            aria-label={isDesktopNavCollapsed ? 'Show left panel' : 'Hide left panel'}
                            title={isDesktopNavCollapsed ? 'Show left panel' : 'Hide left panel'}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isDesktopNavCollapsed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                )}
                            </svg>
                        </button>
                    )}
                    <button type="button" className="g1-wordmark lg:hidden" onClick={goHome} title="Go to dashboard">G1Card</button>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                    <span className="text-[var(--app-muted)] text-sm hidden sm:block">Welcome, {user?.name}</span>
                    {user?.isSimulation && (
                        <span className="inline-flex items-center gap-1.5 h-10 px-3 shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-xs font-semibold text-[var(--app-text)]">
                            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                            <span className="hidden md:inline">Simulation</span>
                        </span>
                    )}
                    {isActive && onOpenNotifications && (
                        <button
                            type="button"
                            onClick={onOpenNotifications}
                            className={`relative inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-xl border transition-all ${
                                isNotificationsPage
                                    ? 'bg-[var(--role-soft)] border-[color-mix(in_srgb,var(--role)_45%,transparent)] text-[var(--role-ink)]'
                                    : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                            }`}
                            aria-label="Notifications"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
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
                    <div className="relative">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className={`relative inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-xl border transition-all ${
                                isSettingsPage
                                    ? 'bg-[var(--role-soft)] border-[color-mix(in_srgb,var(--role)_45%,transparent)] text-[var(--role-ink)]'
                                    : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                            }`}
                            aria-label="Settings"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        {showSettingsMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-[var(--app-surface)]/95 backdrop-blur-sm rounded-lg shadow-lg border border-[var(--app-border)] overflow-hidden z-50">
                                {isActive && (
                                    <button
                                        onClick={() => {
                                            navigate('/hospital/settings');
                                            setShowSettingsMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-[var(--app-surface-soft)] transition-colors flex items-center gap-3"
                                    >
                                        <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div>
                                            <div className="text-sm font-medium text-[var(--app-text)]">Settings</div>
                                            <div className="text-xs text-[var(--app-muted)]">Account preferences</div>
                                        </div>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        toggleThemeMode();
                                        setShowSettingsMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-[var(--app-surface-soft)] transition-colors flex items-center gap-3"
                                >
                                    <svg className="h-5 w-5 text-[var(--app-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
                                    </svg>
                                    <div>
                                        <div className="text-sm font-medium text-[var(--app-text)]">Appearance</div>
                                        <div className="text-xs text-[var(--app-muted)]">Switch to {themeMode === 'dark' ? 'Light' : 'Dark'} mode</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSettingsMenu(false);
                                        handleLogout();
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-[var(--app-surface-soft)] transition-colors flex items-center gap-3"
                                >
                                    <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                                    </svg>
                                    <div>
                                        <div className="text-sm font-medium text-red-600 dark:text-red-400">Logout</div>
                                        <div className="text-xs text-[var(--app-muted)]">Sign out of your account</div>
                                    </div>
                                </button>
                            </div>
                        )}
                        {showSettingsMenu && (
                            <div
                                className="fixed inset-0 z-40 cursor-pointer"
                                onClick={() => setShowSettingsMenu(false)}
                            />
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
};

const HospitalLayout: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [isDesktopNavCollapsed, setIsDesktopNavCollapsed] = useState<boolean>(() => localStorage.getItem('g1card:hospital:navCollapsed') === '1');
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
        window.addEventListener('g1card:notifications-updated', fetchCount);
        return () => window.removeEventListener('g1card:notifications-updated', fetchCount);
    }, [user?.id, hospitalStatus]);

    useEffect(() => {
        if (user?.id) fetchHospitalStatus();
    }, [user?.id]);

    useEffect(() => {
        const handleStatusRefresh = () => {
            fetchHospitalStatus();
        };

        window.addEventListener('hospital:status-updated', handleStatusRefresh);
        return () => window.removeEventListener('hospital:status-updated', handleStatusRefresh);
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

    const toggleDesktopNav = () => {
        setIsDesktopNavCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('g1card:hospital:navCollapsed', next ? '1' : '0');
            return next;
        });
    };

    const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
            `app-nav-link ${isActive ? 'is-active' : ''}`;

    const isNotificationsPage = location.pathname.includes('/hospital/notifications');

    const renderNavItems = () => (
        <>
            {hospitalNavItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={navLinkClasses}
                    onClick={() => setShowMobileNav(false)}
                >
                    {item.label}
                </NavLink>
            ))}
        </>
    );

    if (loading) {
        return <Loader text="Verifying hospital status..." fullScreen />;
    }

    // Pending approval state
    if (hospitalStatus === 'pending') {
        return (
            <div className="hospital-shell min-h-screen bg-[var(--app-bg)]">
                <HospitalHeader isActive={false} />
                <main className="mx-auto w-full p-4 md:p-6 max-w-2xl mt-12">
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
                                    Your registration is under review
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
                                    <li>Hospital registration details</li>
                                    <li>License and certification documents</li>
                                    <li>Administrator credentials</li>
                                    <li>Contact information</li>
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
            <div className="hospital-shell min-h-screen bg-[var(--app-bg)]">
                <HospitalHeader isActive={false} />
                <main className="mx-auto w-full p-4 md:p-6 max-w-2xl mt-12">
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
                                    Your registration request was not approved
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
            <div className="hospital-shell min-h-screen bg-[var(--app-bg)]">
                <HospitalHeader isActive={false} />
                <main className="mx-auto w-full p-4 md:p-6 max-w-2xl mt-12">
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
        <div className="hospital-shell min-h-screen bg-[var(--app-bg)]">
            <div className="flex min-h-screen">
                <aside className={`hidden lg:flex sticky top-0 h-screen overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-bg)] flex-col transition-[width,padding,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDesktopNavCollapsed ? 'w-0 px-0 py-0 overflow-hidden border-r-0 shadow-none' : 'w-60 p-4 shadow-sm'}`}>
                    <div className={`mb-5 px-2 transition-all duration-300 ${isDesktopNavCollapsed ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'}`}>
                        <span className="app-logo"><button type="button" className="g1-wordmark" onClick={goHome} title="Go to dashboard">G1Card</button><span className="app-logo-role">Hospital</span></span>
                    </div>
                    <nav className={`flex-1 space-y-0.5 transition-all duration-300 ${isDesktopNavCollapsed ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'}`}>{renderNavItems()}</nav>
                </aside>

                <div className="flex-1 min-w-0">
                    <HospitalHeader
                        isActive={true}
                        notificationCount={notificationCount}
                        onOpenNotifications={handleOpenNotifications}
                        onOpenNav={() => setShowMobileNav(true)}
                        onToggleDesktopNav={toggleDesktopNav}
                        isDesktopNavCollapsed={isDesktopNavCollapsed}
                    />
                    <main className="max-w-[1400px] mx-auto w-full p-4 md:p-6">
                        <Outlet />
                    </main>
                </div>
            </div>

            {showMobileNav && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-slate-900/50 cursor-pointer" onClick={() => setShowMobileNav(false)} />
                    <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5">
                        <div className="flex items-center justify-between mb-6">
                            <span className="app-logo"><button type="button" className="g1-wordmark" onClick={goHome} title="Go to dashboard">G1Card</button><span className="app-logo-role">Hospital</span></span>
                            <button
                                type="button"
                                onClick={() => setShowMobileNav(false)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="Close navigation"
                            >
                                <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <nav className="space-y-0.5">{renderNavItems()}</nav>
                    </aside>
                </div>
            )}

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