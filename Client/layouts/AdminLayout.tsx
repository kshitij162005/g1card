import React, { useEffect, useState } from 'react';
import { API_URL } from '../config/api';
import { goHome } from '../utils/home';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../utils/theme';
import AdminAiChat from '../components/AdminAiChat';

const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/pending', label: 'Pending Requests' },
    { to: '/admin/deletion-requests', label: 'Deletion Requests' },
    { to: '/admin/update-requests', label: 'Update Requests' },
    { to: '/admin/hospitals', label: 'Hospitals' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/settings', label: 'Settings' },
    { to: '/admin/logs', label: 'Audit Logs' },
    { to: '/admin/notifications', label: 'Notifications' }
];

// Words on buttons that change data; everything else is browsing and stays allowed in simulation
const SIMULATION_BLOCKED_ACTION = /\b(approve|reject|delete|remove|suspend|unsuspend|reinstate|save|add|create|update|submit|confirm|revoke|send|reset|disable|enable|activate|deactivate|restore|deny|grant|upload|import|edit|changes|apply)\b/i;

const AdminLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
    const [showSimulationModal, setShowSimulationModal] = useState(false);
    const [blockedActionLabel, setBlockedActionLabel] = useState('This action');
    const [showAiAssistant, setShowAiAssistant] = useState(false);

    useEffect(() => {
        if (!showAiAssistant) {
            document.body.style.overflow = '';
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowAiAssistant(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showAiAssistant]);

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

    const isAdminNotifyContext = location.pathname.includes('/admin/notifications');
    const [adminUnread, setAdminUnread] = useState(0);

    // Unread badge on the bell, refreshed when the inbox marks things read
    useEffect(() => {
        if (!user?.id) return;
        const fetchCount = async () => {
            try {
                const resp = await fetch(`${API_URL}/superadmin/admins/${user.id}/notifications/count`);
                const data = await resp.json();
                if (resp.ok) setAdminUnread(data.unreadCount || 0);
            } catch { /* ignore */ }
        };
        fetchCount();
        window.addEventListener('g1card:notifications-updated', fetchCount);
        return () => window.removeEventListener('g1card:notifications-updated', fetchCount);
    }, [user?.id]);
    const isAdminSettingsPage = location.pathname.includes('/admin/settings');
    const isAdminSimulation = Boolean(user?.isSimulation);

    const openSimulationGuard = (label?: string) => {
        setBlockedActionLabel(label || 'This action');
        setShowSimulationModal(true);
    };

    const getActionLabel = (el: HTMLElement | null): string => {
        if (!el) return 'This action';
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const dataTitle = el.getAttribute('title');
        if (dataTitle) return dataTitle;
        const text = (el.textContent || '').trim();
        return text ? `"${text.slice(0, 40)}"` : 'This action';
    };

    const handleSimulationMainClickCapture = (e: React.MouseEvent<HTMLElement>) => {
        if (!isAdminSimulation) return;

        const target = e.target as HTMLElement;
        const link = target.closest('a[href]') as HTMLAnchorElement | null;
        if (link) {
            const href = link.getAttribute('href') || '';
            if (href.startsWith('/admin') || href.startsWith('#/admin')) {
                return;
            }
        }

        const actionEl = target.closest('button, input[type="button"], input[type="submit"], [role="button"]') as HTMLElement | null;
        if (!actionEl) return;
        if (actionEl.closest('[data-simulation-allow="true"], form[role="search"]')) return;
        // Browsing stays free in simulation (search, filters, tabs, paging, opening details);
        // only actions that would change data are stopped
        if (actionEl.getAttribute('data-simulation-block') !== 'true' && !SIMULATION_BLOCKED_ACTION.test(getActionLabel(actionEl))) return;

        e.preventDefault();
        e.stopPropagation();
        openSimulationGuard(getActionLabel(actionEl));
    };

    const handleSimulationMainSubmitCapture = (e: React.FormEvent<HTMLElement>) => {
        if (!isAdminSimulation) return;
        if ((e.target as HTMLElement).closest('form[role="search"]')) return;
        e.preventDefault();
        e.stopPropagation();
        openSimulationGuard('Submitting this form');
    };

    const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
        `app-nav-link ${isActive ? 'is-active' : ''}`;

    const renderNavItems = () => (
        <>
            {adminNavItems.map((item) => (
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

    return (
        <div className="admin-shell min-h-screen bg-[var(--app-bg)]">
            <div className="flex min-h-screen">
                <aside className="hidden lg:flex w-60 border-r border-[var(--app-border)] bg-[var(--app-bg)] p-4 flex-col">
                    <div className="mb-5 px-2">
                        <span className="app-logo"><button type="button" className="g1-wordmark" onClick={goHome} title="Go to dashboard">G1Card</button><span className="app-logo-role">Admin</span></span>
                    </div>
                    <nav className="flex-1 space-y-0.5">{renderNavItems()}</nav>
                </aside>

                <div className="flex-1 min-w-0 bg-[var(--app-bg)]">
                    <header className="sticky top-0 z-50 bg-[var(--app-surface)]/95 backdrop-blur-sm border-b border-[var(--app-border)]">
                        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    className="lg:hidden p-2 rounded-lg hover:bg-[var(--app-surface-soft)]"
                                    onClick={() => setShowMobileNav(true)}
                                    aria-label="Open navigation"
                                >
                                    <svg className="w-5 h-5 text-[var(--app-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                                <button type="button" className="g1-wordmark lg:hidden" onClick={goHome} title="Go to dashboard">G1Card</button>
                                <div className="hidden sm:block lg:block">
                                    <p className="text-sm text-[var(--app-muted)]">Welcome</p>
                                    <h2 className="text-base font-semibold text-[var(--app-text)]">{user?.name || 'Super Admin'}</h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {user?.isSimulation && (
                                    <span
                                        data-simulation-allow="true"
                                        className="inline-flex items-center gap-1.5 h-10 px-3 shrink-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-xs font-semibold text-[var(--app-text)]"
                                    >
                                        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                                        <span className="hidden sm:inline">Simulation</span>
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowAiAssistant(true)}
                                    className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]"
                                    aria-label="Open G1Card AI Assistant"
                                >
                                    <svg className="h-4 w-4 text-[var(--app-muted)]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Ask Golu
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/notifications')}
                                    className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all ${
                                        isAdminNotifyContext
                                            ? 'bg-[var(--role-soft)] border-[color-mix(in_srgb,var(--role)_45%,transparent)] text-[var(--role-ink)]'
                                            : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                                    }`}
                                    aria-label="Notifications"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" />
                                        <path d="M10 18a3 3 0 01-2.995-2.824L7 15h6a3 3 0 01-2.824 2.995L10 18z" />
                                    </svg>
                                    {adminUnread > 0 && (
                                        <span className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--app-danger)] px-1 text-[10px] font-semibold leading-[18px] text-white">{adminUnread > 99 ? '99+' : adminUnread}</span>
                                    )}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                                        className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all ${
                                            isAdminSettingsPage
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
                                        <div className="absolute right-0 mt-2 w-56 bg-[var(--app-surface)] rounded-lg shadow-lg border border-[var(--app-border)] overflow-hidden z-50">
                                            <button
                                                onClick={() => {
                                                    setShowSettingsMenu(false);
                                                    navigate('/admin/settings');
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-[var(--app-surface-soft)] transition-colors flex items-center gap-3"
                                            >
                                                    <svg className="h-5 w-5 text-[var(--app-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <div>
                                                    <div className="text-sm font-medium text-[var(--app-text)]">Settings</div>
                                                    <div className="text-xs text-[var(--app-muted)]">Admin preferences</div>
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
                                                    <div className="text-xs text-[var(--app-muted)]">Sign out of admin account</div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                    {showSettingsMenu && (
                                        <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setShowSettingsMenu(false)} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>

                    <main
                        className="admin-shell p-4 md:p-6 max-w-[1400px] mx-auto w-full"
                        onClickCapture={handleSimulationMainClickCapture}
                        onSubmitCapture={handleSimulationMainSubmitCapture}
                    >
                        <Outlet />
                    </main>
                </div>
            </div>

            {showMobileNav && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40 dark:bg-slate-900/50 cursor-pointer" onClick={() => setShowMobileNav(false)} />
                    <aside className="absolute left-0 top-0 h-full w-72 bg-[var(--app-surface)] border-r border-[var(--app-border)] p-5">
                        <div className="flex items-center justify-between mb-6">
                            <span className="app-logo"><button type="button" className="g1-wordmark" onClick={goHome} title="Go to dashboard">G1Card</button><span className="app-logo-role">Admin</span></span>
                            <button
                                type="button"
                                onClick={() => setShowMobileNav(false)}
                                className="p-2 rounded-lg hover:bg-[var(--app-surface-soft)]"
                                aria-label="Close navigation"
                            >
                                <svg className="w-5 h-5 text-[var(--app-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <nav className="space-y-1">{renderNavItems()}</nav>
                    </aside>
                </div>
            )}

            {showSimulationModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]" onClick={() => setShowSimulationModal(false)} />
                    <div className="relative w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
                                <span className="absolute h-8 w-8 rounded-full border border-amber-300/40 animate-pulse" />
                                <span className="text-amber-600 dark:text-amber-300 font-bold">!</span>
                            </div>
                            <div>
                                <p className="text-base font-semibold text-[var(--app-text)]">Read-only simulation</p>
                                <p className="text-xs text-[var(--app-muted)]">Preview flow is active for admin simulation mode.</p>
                            </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-[var(--app-text)]">
                            {blockedActionLabel} is disabled in simulation mode. You can explore screens, tables, and dialogs, but no real updates will be saved.
                        </p>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowSimulationModal(false)}
                                className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
                            >
                                Continue Exploring
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAiAssistant && (
                <div
                    className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/40 golu-backdrop md:p-6"
                    onClick={() => setShowAiAssistant(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="golu-modal-in h-full w-full max-w-[1280px] overflow-hidden shadow-xl md:rounded-xl md:border md:border-[var(--app-border)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <AdminAiChat variant="modal" onClose={() => setShowAiAssistant(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLayout;