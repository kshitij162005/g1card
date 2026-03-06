import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { API_URL } from '../config/api';

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

interface AccessRequest {
    id: string;
    hospitalId: string;
    hospitalName: string;
    status: string;
    createdAt: string;
}

const PatientLayout: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<AccessRequest | null>(null);
    const [choice, setChoice] = useState<'GENERAL' | 'COMPLETE'>('GENERAL');
    const [loadingDecision, setLoadingDecision] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem('g1card_dismissed_access_requests');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const pendingCount = requests.length;

    const saveDismissed = (next: string[]) => {
        setDismissedIds(next);
        try {
            localStorage.setItem('g1card_dismissed_access_requests', JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    // Poll for pending access requests
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        const fetchPending = async () => {
            try {
                const resp = await fetch(`${API_URL}/patients/${user.id}/access-requests?status=PENDING`);
                const data = await resp.json();
                if (!resp.ok) {
                    return;
                }
                const list: AccessRequest[] = data.requests || [];
                if (!cancelled) {
                    setRequests(list);
                    const next = list.find(r => !dismissedIds.includes(r.id));
                    setActiveRequest(next || null);
                }
            } catch {
                // ignore for now
            }
        };

        fetchPending();
        const interval = setInterval(fetchPending, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user?.id, dismissedIds]);

    const handleDecision = async (approve: boolean) => {
        if (!user?.id || !activeRequest) return;
        setLoadingDecision(true);
        try {
            const body: any = { decision: approve ? 'APPROVE' : 'DENY' };
            if (approve) {
                body.accessLevel = choice;
            }
            const resp = await fetch(`${API_URL}/patients/${user.id}/access-requests/${activeRequest.id}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                alert(data?.error || data?.message || 'Failed to update access request');
                return;
            }
            setActiveRequest(null);
        } catch (err) {
            console.error('decision error', err);
            alert('Error updating access request');
        } finally {
            setLoadingDecision(false);
        }
    };

    const handleClosePopup = () => {
        if (activeRequest) {
            const next = Array.from(new Set([...dismissedIds, activeRequest.id]));
            saveDismissed(next);
        }
        setActiveRequest(null);
    };

    const handleOpenRequestsFromHeader = () => {
        if (requests.length > 1) {
            navigate('/patient/notifications');
        } else if (requests.length === 1) {
            setActiveRequest(requests[0]);
        }
    };

    return (
        <div className="min-h-screen">
            <PatientHeader pendingCount={pendingCount} onOpenRequests={handleOpenRequestsFromHeader} />
            <main className="container mx-auto p-4 md:p-6">
                <Outlet />
            </main>
            {activeRequest && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 dark:bg-black/60">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 relative">
                        <button
                            type="button"
                            onClick={handleClosePopup}
                            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            Hospital Access Request
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                            <strong>{activeRequest.hospitalName || 'A hospital'}</strong> is requesting access to your medical records.
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            Requested at: {new Date(activeRequest.createdAt).toLocaleString()}
                        </p>
                        <div className="space-y-3 mb-4">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Select what they can see:</p>
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="radio"
                                    name="accessLevel"
                                    value="GENERAL"
                                    checked={choice === 'GENERAL'}
                                    onChange={() => setChoice('GENERAL')}
                                />
                                <span>
                                    <strong>General Information Only</strong> (basic profile & your records from this hospital)
                                </span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                <input
                                    type="radio"
                                    name="accessLevel"
                                    value="COMPLETE"
                                    checked={choice === 'COMPLETE'}
                                    onChange={() => setChoice('COMPLETE')}
                                />
                                <span>
                                    <strong>Complete Information</strong> (all your records from every hospital)
                                </span>
                            </label>
                        </div>
                        <div className="flex justify-between items-center gap-3 mt-2">
                            <button
                                type="button"
                                onClick={handleClosePopup}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                            >
                                Decide later
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleDecision(false)}
                                    disabled={loadingDecision}
                                    className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    Deny
                                </button>
                                <button
                                    onClick={() => handleDecision(true)}
                                    disabled={loadingDecision}
                                    className="px-4 py-2 text-sm rounded-lg bg-brand-primary text-white hover:bg-brand-secondary"
                                >
                                    {loadingDecision ? 'Saving...' : 'Approve'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientLayout;