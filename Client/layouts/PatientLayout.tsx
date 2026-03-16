import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import { useSSE } from '../hooks/useSSE';
import AccessRequestModal from '../components/AccessRequestModal';
import GlassNotification from '../components/GlassNotification';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../utils/theme';

interface PatientHeaderProps {
    pendingCount?: number;
    onOpenRequests?: () => void;
    onOpenNav?: () => void;
}

const patientNavItems = [
    { to: '/patient/dashboard', label: 'Dashboard' },
    { to: '/patient/health-history', label: 'Health History' },
    { to: '/patient/settings?tab=manage-access', label: 'Manage Access' }
];

const PatientHeader: React.FC<PatientHeaderProps> = ({ pendingCount = 0, onOpenRequests, onOpenNav }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
    const isNotificationsPage = location.pathname.includes('/patient/notifications');
    const isSettingsPage = location.pathname.includes('/patient/settings');

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
                    <h1 className="text-xl font-bold text-brand-primary dark:text-white tracking-wider">G1CARD</h1>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                    <span className="text-[var(--app-muted)] text-sm hidden sm:block">Welcome, {user?.name}</span>
                    {onOpenRequests && (
                        <button
                            type="button"
                            onClick={onOpenRequests}
                            className={`relative inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-xl border transition-all ${
                                isNotificationsPage
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                            }`}
                            aria-label="Hospital access requests"
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
                            {pendingCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                            {isNotificationsPage && <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-200 ring-2 ring-blue-600" />}
                        </button>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className={`relative inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-xl border transition-all ${
                                isSettingsPage
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                            }`}
                            aria-label="Settings"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {isSettingsPage && <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-200 ring-2 ring-blue-600" />}
                        </button>
                        {showSettingsMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-[var(--app-surface)]/95 backdrop-blur-sm rounded-lg shadow-lg border border-[var(--app-border)] overflow-hidden z-50">
                                <button
                                    onClick={() => {
                                        navigate('/patient/settings');
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
                                        <div className="text-xs text-[var(--app-muted)]">Manage account</div>
                                    </div>
                                </button>
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
                            <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setShowSettingsMenu(false)} />
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
};

const PatientLayout: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [currentRequest, setCurrentRequest] = useState<{
        requestId: string;
        hospitalName: string;
    } | null>(null);
    const [notification, setNotification] = useState<{
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    } | null>(null);

    // SSE connection for real-time notifications
    const { connected, lastEvent } = useSSE({
        userId: user?.id || '',
        userType: 'Patient',
        enabled: !!user?.id,
        onEvent: (eventData) => {
            console.log('SSE Event received:', eventData);
            
            // Handle different event types
            if (eventData.type === 'NEW_ACCESS_REQUEST' || eventData.type === 'ACCESS_UPGRADE_REQUEST') {
                console.log('NEW ACCESS REQUEST detected - showing modal for:', eventData.hospitalName);
                // Show modal for new access requests
                setCurrentRequest({
                    requestId: eventData.accessId || eventData.requestId,
                    hospitalName: eventData.hospitalName || 'Hospital'
                });
                // Show notification toast as well
                setNotification({
                    title: eventData.title || 'New Access Request',
                    message: eventData.message || `${eventData.hospitalName} wants to access your records`,
                    type: 'info'
                });
                // Increment pending count
                setPendingCount(prev => prev + 1);
            } else if (eventData.type === 'ACCESS_REVOKED') {
                // Show notification for revoked access
                setNotification({
                    title: eventData.title || 'Access Revoked',
                    message: eventData.message || 'Hospital access has been revoked',
                    type: 'info'
                });
                // Decrement pending count
                setPendingCount(prev => Math.max(0, prev - 1));
            } else if (eventData.type === 'MEDICAL_RECORD_CREATED') {
                // Hospital added a new medical record
                setNotification({
                    title: eventData.title || 'New Medical Record',
                    message: eventData.message || `${eventData.hospitalName} added a new record`,
                    type: 'success'
                });
            } else if (eventData.type === 'RECORDS_ACCESSED') {
                // Hospital viewed patient records
                setNotification({
                    title: eventData.title || 'Records Accessed',
                    message: eventData.message || `${eventData.hospitalName} viewed your records`,
                    type: 'info'
                });
            }
        }
    });

    // Log SSE connection status
    useEffect(() => {
        console.log('SSE Connection Status:', connected ? 'CONNECTED' : 'DISCONNECTED');
    }, [connected]);

    // Fetch initial notification count
    useEffect(() => {
        if (!user?.id) return;
        const fetchCount = async () => {
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/notifications/count`);
                const data = await resp.json();
                if (resp.ok && data.counts) {
                    setPendingCount(data.counts.total);
                }
            } catch {
                // ignore
            }
        };
        fetchCount();
    }, [user?.id]);

    const handleApproveAccess = async (accessLevel: 'general' | 'complete', requestId: string) => {
        try {
            const response = await fetch(
                `${API_URL}/patients/${user?.id}/access-requests/${requestId}/decision`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        decision: 'APPROVE',
                        accessLevel: accessLevel.toUpperCase()
                    })
                }
            );

            if (response.ok) {
                setNotification({
                    title: 'Access Granted',
                    message: `${currentRequest?.hospitalName} has been granted ${accessLevel} access to your records.`,
                    type: 'success'
                });
                setPendingCount(prev => Math.max(0, prev - 1));
            } else {
                const errorData = await response.json();
                setNotification({
                    title: 'Error',
                    message: errorData.error || 'Failed to approve access request',
                    type: 'error'
                });
            }
        } catch (error) {
            setNotification({
                title: 'Error',
                message: 'Failed to approve access request',
                type: 'error'
            });
        }
    };

    const handleDenyAccess = async (requestId: string) => {
        try {
            const response = await fetch(
                `${API_URL}/patients/${user?.id}/access-requests/${requestId}/decision`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decision: 'DENY' })
                }
            );

            if (response.ok) {
                setNotification({
                    title: 'Access Denied',
                    message: `Access request from ${currentRequest?.hospitalName} has been denied.`,
                    type: 'info'
                });
                setPendingCount(prev => Math.max(0, prev - 1));
            } else {
                const errorData = await response.json();
                setNotification({
                    title: 'Error',
                    message: errorData.error || 'Failed to deny access request',
                    type: 'error'
                });
            }
        } catch (error) {
            setNotification({
                title: 'Error',
                message: 'Failed to deny access request',
                type: 'error'
            });
        }
    };

    const handleOpenRequestsFromHeader = () => {
        // Navigate to notifications page to see all pending and previous notifications
        navigate('/patient/notifications');
    };

    const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
        `block w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 bg-transparent'}`;

    const isNotificationsPage = location.pathname.includes('/patient/notifications');

    const renderNavItems = () => (
        <>
            {patientNavItems.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={navLinkClasses}
                    onClick={() => setShowMobileNav(false)}
                >
                    {item.label}
                </NavLink>
            ))}
            {isNotificationsPage && (
                <NavLink
                    to="/patient/notifications"
                    className={() => 'block w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors bg-blue-600 text-white shadow-sm'}
                    onClick={() => setShowMobileNav(false)}
                >
                    Notifications
                </NavLink>
            )}
        </>
    );

    return (
        <div className="patient-shell min-h-screen bg-[var(--app-bg)]">
            <div className="flex min-h-screen">
                <aside className="hidden lg:flex sticky top-0 h-screen overflow-y-auto w-60 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex-col">
                    <div className="mb-5 px-2">
                        <h1 className="sidebar-brand-title text-2xl font-bold tracking-wide">G1CARD USER</h1>
                        <p className="sidebar-brand-subtitle text-xs mt-1">Patient Portal</p>
                    </div>
                    <nav className="flex-1 space-y-2">{renderNavItems()}</nav>
                </aside>

                <div className="flex-1 min-w-0">
                    <PatientHeader
                        pendingCount={pendingCount}
                        onOpenRequests={handleOpenRequestsFromHeader}
                        onOpenNav={() => setShowMobileNav(true)}
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
                            <h1 className="sidebar-brand-title text-xl font-bold tracking-wide">G1CARD USER</h1>
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
                        <nav className="space-y-2">{renderNavItems()}</nav>
                    </aside>
                </div>
            )}

            {/* Access Request Modal */}
            <AccessRequestModal
                isOpen={!!currentRequest}
                onClose={() => setCurrentRequest(null)}
                hospitalName={currentRequest?.hospitalName || ''}
                requestId={currentRequest?.requestId || ''}
                onApprove={handleApproveAccess}
                onDeny={handleDenyAccess}
            />

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

export default PatientLayout;