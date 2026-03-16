import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import Loader from '../components/Loader';

const LOGIN_ROLES = [Role.PATIENT, Role.HOSPITAL] as const;

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>(Role.PATIENT);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isGoogleSdkReady, setIsGoogleSdkReady] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const roleRef = useRef<Role>(role);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, loginWithGoogle } = useAuth();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const isAdminLogin = location.pathname === '/admin/login';
    const emailPlaceholder = role === Role.HOSPITAL ? 'admin@hospital.com' : 'patient@email.com';

    useEffect(() => {
        if (isAdminLogin) {
            setRole(Role.SUPER_ADMIN);
            return;
        }
        if (role === Role.SUPER_ADMIN) {
            setRole(Role.PATIENT);
        }
    }, [isAdminLogin, role]);

    useEffect(() => {
        roleRef.current = role;
    }, [role]);

    const navigateByRole = useCallback((currentRole: Role) => {
        switch (currentRole) {
            case Role.SUPER_ADMIN:
                navigate('/admin/dashboard');
                break;
            case Role.HOSPITAL:
                navigate('/hospital/dashboard');
                break;
            case Role.PATIENT:
                navigate('/patient/dashboard');
                break;
            default:
                navigate('/login');
        }
    }, [navigate]);

    const handleGoogleCredential = useCallback(async (response: { credential?: string }) => {
        const token = response?.credential;
        if (!token) {
            notify('Google sign-in failed. Please try again.');
            return;
        }

        setIsLoggingIn(true);
        const activeRole = roleRef.current;

        try {
            const ok = await loginWithGoogle(activeRole, token);
            if (!ok) {
                notify('Google sign-in failed for selected role.');
                setIsLoggingIn(false);
                return;
            }
            navigateByRole(activeRole);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
            notify(errorMessage);
            setIsLoggingIn(false);
        }
    }, [loginWithGoogle, navigateByRole]);

    useEffect(() => {
        if (window.google?.accounts?.id) {
            setIsGoogleSdkReady(true);
            return;
        }

        const scriptId = 'google-identity-services-sdk';
        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existingScript) {
            existingScript.addEventListener('load', () => setIsGoogleSdkReady(true), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setIsGoogleSdkReady(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!googleButtonRef.current) return;

        googleButtonRef.current.innerHTML = '';

        if (!LOGIN_ROLES.includes(role as (typeof LOGIN_ROLES)[number])) return;
        if (!isGoogleSdkReady || !window.google?.accounts?.id) return;
        if (!googleClientId) return;

        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredential,
            auto_select: false,
            cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            width: googleButtonRef.current.offsetWidth || 320,
            text: 'continue_with',
        });
    }, [googleClientId, handleGoogleCredential, isGoogleSdkReady, role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        try {
            const ok = await login(role, email, password);
            if (!ok) {
                notify('Login failed. Check credentials.');
                setIsLoggingIn(false);
                return;
            }
            navigateByRole(role);
        } catch (err) {
            setIsLoggingIn(false);
        }
    };

    if (isLoggingIn) {
        return <Loader text="Logging you in..." fullScreen />;
    }

    return (
        <div className="min-h-screen bg-[var(--app-bg)] relative overflow-hidden px-4 py-10 sm:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_42%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.16),transparent_38%)]" />

            <div className={`relative z-10 mx-auto w-full ${isAdminLogin ? 'max-w-md' : 'max-w-6xl'}`}>
                <div className={`grid gap-8 items-center ${isAdminLogin ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {!isAdminLogin && (
                        <aside className="hidden lg:block">
                            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/96 p-8 shadow-[0_10px_30px_rgba(36,50,71,0.14)] dark:shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-accent)]">Why G1CARD</p>
                                <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--app-text)]">Unified records for patients, hospitals, and administrators</h2>
                                <p className="mt-4 text-sm leading-7 text-[var(--app-muted)]">G1CARD gives each stakeholder a clear, secure workflow: faster access for clinicians, better visibility for patients, and reliable governance for admins.</p>

                                <div className="mt-8 space-y-3">
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Patient Experience</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Health history, notifications, and profile updates in one place.</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Hospital Workflow</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Patient records, templates, reports, and audit logs with role-based controls.</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Platform Trust</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Every sensitive action is monitored to keep access accountable.</p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    )}

                    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/96 backdrop-blur-sm p-6 sm:p-8 shadow-[0_10px_30px_rgba(36,50,71,0.18)] dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)] lg:max-w-md lg:justify-self-end w-full">
                    <div className="mb-7">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-accent)]">G1CARD</p>
                        <h1 className="mt-3 text-3xl font-semibold text-[var(--app-text)]">{isAdminLogin ? 'Admin sign in' : 'Welcome back'}</h1>
                        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{isAdminLogin ? 'Sign in to access super admin controls.' : 'Sign in to continue securely to your healthcare workspace.'}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isAdminLogin && (
                            <div>
                                <span className="text-sm font-medium text-[var(--app-text)]">Sign in as</span>
                                <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--app-surface-soft)] p-1">
                                    {LOGIN_ROLES.map((r) => (
                                        <label
                                            key={r}
                                            className={`login-role-pill flex items-center justify-center h-10 rounded-lg cursor-pointer transition-colors ${role === r ? 'login-role-pill-active !bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] shadow-sm' : 'border border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)]/70'}`}
                                        >
                                            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                                            <span className="text-sm font-medium">{r}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium text-[var(--app-text)]">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/70"
                                placeholder={emailPlaceholder}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-sm font-medium text-[var(--app-text)]">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 pr-10 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/70"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074L3.707 2.293zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                            <path d="M12.454 16.697L9.727 13.97a2.003 2.003 0 01-2.45-2.45L4.546 8.777A4 4 0 0012.454 16.697zM10 17a7 7 0 01-7-7c0-1.953.768-3.738 2.002-5.002L14.998 14.998A6.987 6.987 0 0110 17z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 3C5.454 3 1.563 5.946.2 10c1.363 4.054 5.254 7 9.8 7s8.437-2.946 9.8-7c-1.363-4.054-5.254-7-9.8-7zm0 11a4 4 0 110-8 4 4 0 010 8z" />
                                            <path d="M10 8a2 2 0 100 4 2 2 0 000-4z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <button type="button" onClick={() => navigate('/forgot-password')} className="font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors">
                                Forgot password?
                            </button>
                            {!isAdminLogin && (
                                <button
                                    type="button"
                                    onClick={() => navigate(role === Role.HOSPITAL ? '/hospital/register' : '/patient/register')}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    {role === Role.HOSPITAL ? 'Register hospital' : 'Create account'}
                                </button>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/70"
                        >
                            Login
                        </button>

                        {!isAdminLogin && (
                            <div className="pt-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-[var(--app-border)]"></div>
                                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Or continue with</span>
                                        <div className="h-px flex-1 bg-[var(--app-border)]"></div>
                                </div>
                                {!googleClientId && (
                                    <p className="mt-3 text-xs text-center text-amber-700 dark:text-amber-400">Google login is unavailable. Missing VITE_GOOGLE_CLIENT_ID.</p>
                                )}
                                <div ref={googleButtonRef} className="mt-3 min-h-10 w-full flex justify-center"></div>
                            </div>
                        )}
                    </form>

                    <div className="mt-6 text-center space-y-2">
                        <p className="text-xs text-[var(--app-muted)]">Protected health data access is monitored and audited.</p>
                        <button
                            type="button"
                            onClick={() => navigate(isAdminLogin ? '/login' : '/admin/login')}
                            className="text-xs font-medium text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
                        >
                            {isAdminLogin ? 'Back to user login' : 'Admin login'}
                        </button>
                    </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;