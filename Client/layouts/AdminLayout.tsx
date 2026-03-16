import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../utils/theme';

const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/pending', label: 'Pending Requests' },
    { to: '/admin/update-requests', label: 'Update Requests' },
    { to: '/admin/hospitals', label: 'Hospitals' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/settings', label: 'Settings' },
    { to: '/admin/logs', label: 'Audit Logs' }
];

const AdminLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());

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

    const isAdminNotifyContext = location.pathname.includes('/admin/pending') || location.pathname.includes('/admin/update-requests');
    const isAdminSettingsPage = location.pathname.includes('/admin/settings');

    const navLinkClasses = ({ isActive }: { isActive: boolean }): string =>
        `block w-full px-4 py-3 rounded-xl text-sm font-medium leading-snug transition-colors cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 bg-transparent'}`;

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
                <aside className="hidden lg:flex w-60 border-r border-[var(--app-border)] bg-[var(--app-surface)]/95 p-4 flex-col">
                    <div className="mb-5 px-2">
                        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-wide">G1CARD ADMIN</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Control Center</p>
                    </div>
                    <nav className="flex-1 space-y-2">{renderNavItems()}</nav>
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
                                <div>
                                    <p className="text-sm text-[var(--app-muted)]">Welcome</p>
                                    <h2 className="text-base font-semibold text-[var(--app-text)]">{user?.name || 'Super Admin'}</h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/pending')}
                                    className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all ${
                                        isAdminNotifyContext
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                            : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                                    }`}
                                    aria-label="Notifications"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6z" />
                                        <path d="M10 18a3 3 0 01-2.995-2.824L7 15h6a3 3 0 01-2.824 2.995L10 18z" />
                                    </svg>
                                    {isAdminNotifyContext && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-200 ring-2 ring-blue-600" />}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                                        className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all ${
                                            isAdminSettingsPage
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                : 'border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                                        }`}
                                        aria-label="Settings"
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {isAdminSettingsPage && <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-blue-200 ring-2 ring-blue-600" />}
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

                    <main className="admin-shell p-4 md:p-6 max-w-[1400px] mx-auto w-full">
                        <Outlet />
                    </main>
                </div>
            </div>

            {showMobileNav && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40 dark:bg-slate-900/50 cursor-pointer" onClick={() => setShowMobileNav(false)} />
                    <aside className="absolute left-0 top-0 h-full w-72 bg-[var(--app-surface)] border-r border-[var(--app-border)] p-5">
                        <div className="flex items-center justify-between mb-6">
                            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 tracking-wide">G1CARD ADMIN</h1>
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
        </div>
    );
};

export default AdminLayout;