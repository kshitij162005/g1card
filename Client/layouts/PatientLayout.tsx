import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { API_URL } from '../config/api';
import { useSSE } from '../hooks/useSSE';
import AccessRequestModal from '../components/AccessRequestModal';
import GlassNotification from '../components/GlassNotification';

interface PatientHeaderProps {
    pendingCount?: number;
    onOpenRequests?: () => void;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({ pendingCount = 0, onOpenRequests }) => {
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
                    <h1 className="text-xl font-bold text-brand-primary dark:text-white tracking-wider">G1CARD</h1>
                    <div className="hidden md:flex items-center space-x-1">
                        <NavLink to="/patient/dashboard" className={navLinkClasses}>Dashboard</NavLink>
                        <NavLink to="/patient/health-history" className={navLinkClasses}>Health History</NavLink>
                        <NavLink to="/patient/settings" className={navLinkClasses}>Settings</NavLink>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-slate-600 dark:text-slate-300 text-sm hidden sm:block">Welcome, {user?.name}</span>
                    {onOpenRequests && (
                        <button
                            type="button"
                            onClick={onOpenRequests}
                            className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Hospital access requests"
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
                            {pendingCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    )}
                    <ThemeToggle />
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all transform hover:scale-105 shadow-sm hover:shadow-md"
                    >
                        Logout
                    </button>
                </div>
            </nav>
        </header>
    );
};

const PatientLayout: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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

    return (
        <div className="min-h-screen">
            <PatientHeader pendingCount={pendingCount} onOpenRequests={handleOpenRequestsFromHeader} />
            <main className="container mx-auto p-4 md:p-6">
                <Outlet />
            </main>

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