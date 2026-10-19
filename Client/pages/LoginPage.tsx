import React, { useCallback, useEffect, useRef, useState } from 'react';
import { goHome } from '../utils/home';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import Loader from '../components/Loader';

const STANDARD_LOGIN_ROLES = [Role.PATIENT, Role.HOSPITAL] as const;

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>(Role.PATIENT);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isGoogleSdkReady, setIsGoogleSdkReady] = useState(false);
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const roleRef = useRef<Role>(role);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, loginWithGoogle, loginSimulation } = useAuth();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const isAdminLogin = location.pathname === '/admin/login';
    const availableRoles = STANDARD_LOGIN_ROLES;
    const emailPlaceholder = role === Role.HOSPITAL
        ? 'admin@hospital.com'
        : role === Role.SUPER_ADMIN
            ? 'superadmin@g1card.com'
            : 'patient@email.com';

    useEffect(() => {
        if (isAdminLogin) {
            setRole(Role.SUPER_ADMIN);
            return;
        }
        if (!isSimulationMode && role === Role.SUPER_ADMIN) {
            setRole(Role.PATIENT);
        }
    }, [isAdminLogin, role, isSimulationMode]);

    useEffect(() => {
        roleRef.current = role;
    }, [role]);

    // Explain why a stored session was signed out (see AuthContext session check)
    useEffect(() => {
        const reason = sessionStorage.getItem('g1card_signout_reason');
        if (reason) {
            sessionStorage.removeItem('g1card_signout_reason');
            notify(reason);
        }
    }, []);

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

        if (isSimulationMode) return;
        if (!STANDARD_LOGIN_ROLES.includes(role as (typeof STANDARD_LOGIN_ROLES)[number])) return;
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
    }, [googleClientId, handleGoogleCredential, isGoogleSdkReady, isSimulationMode, role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);
        try {
            const ok = isSimulationMode
                ? await loginSimulation(role)
                : await login(role, email, password);
            if (!ok) {
                notify(isSimulationMode ? 'Simulation login failed for selected role.' : 'Login failed. Check credentials.');
                setIsLoggingIn(false);
                return;
            }
            navigateByRole(role);
        } catch (err) {
            notify(err instanceof Error && err.message ? err.message : 'Login failed. Please try again.');
            setIsLoggingIn(false);
        }
    };

    if (isLoggingIn) {
        return <Loader text="Logging you in..." fullScreen />;
    }

    return (
        <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[var(--app-bg)] relative px-4 flex">

            <div className={`relative z-10 m-auto w-full py-4 ${isAdminLogin ? 'max-w-md' : 'max-w-5xl'}`}>
                <div className={`grid gap-8 lg:gap-12 items-center ${isAdminLogin ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {!isAdminLogin && (
                        <aside className="hidden lg:block">
                            <div className="px-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-accent)]">Why G1CARD</p>
                                <h2 className="mt-3 font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-[var(--app-text)]">One medical history, shared only with the hospitals you approve</h2>
                                <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">Faster access for clinicians, full visibility for patients, and an audit trail on every record that is opened.</p>

                                <div className="mt-6 space-y-2.5">
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Patient Experience</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Health history, notifications, and profile updates in one place.</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Hospital Workflow</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Patient records, your own record forms, and audit logs.</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">Platform Trust</p>
                                        <p className="mt-1 text-sm text-[var(--app-text)]">Every sensitive action is monitored to keep access accountable.</p>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    )}

                    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 sm:p-7 shadow-[var(--app-shadow)] lg:max-w-[420px] lg:justify-self-end w-full">
                    <div className="mb-5">
                        <button type="button" onClick={goHome} className="g1-wordmark" title="Go to dashboard">G1Card</button>
                        <h1 className="mt-4 font-serif text-[26px] font-semibold tracking-[-0.01em] text-[var(--app-text)]">{isAdminLogin ? 'Admin sign in' : 'Welcome back'}</h1>
                        <p className="mt-1 text-sm text-[var(--app-muted)]">{isAdminLogin ? 'Sign in to access super admin controls.' : 'Sign in to your healthcare workspace.'}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]/55 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--app-text)]">Simulation mode</p>
                                    <p className="text-xs leading-5 text-[var(--app-muted)] truncate">
                                        {isAdminLogin
                                            ? 'Preview the admin dashboard without signing in.'
                                            : 'Explore with sample data, no sign-in.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSimulationMode((prev) => !prev)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border p-0.5 overflow-hidden transition-colors duration-300 ease-out ${isSimulationMode ? 'bg-[var(--app-primary)] border-[var(--app-primary)]' : 'bg-[var(--app-surface)] border-[var(--app-border-strong)]'}`}
                                    aria-pressed={isSimulationMode}
                                    aria-label="Toggle simulation mode"
                                >
                                    <span
                                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                        style={{ left: isSimulationMode ? 'calc(100% - 18px)' : '2px' }}
                                    />
                                </button>
                            </div>
                            <p
                                className={`text-xs font-medium text-[var(--app-accent)] transition-all duration-200 overflow-hidden ${isSimulationMode ? 'mt-1.5 max-h-10 opacity-100' : 'mt-0 max-h-0 opacity-0'}`}
                                aria-hidden={!isSimulationMode}
                            >
                                Simulation users are loaded directly from seeded sample records.
                            </p>
                        </div>

                        {!isAdminLogin && (
                            <div>
                                <span className="text-sm font-medium text-[var(--app-text)]">Sign in as</span>
                                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-[var(--app-surface-soft)] p-1">
                                    {availableRoles.map((r) => (
                                        <label
                                            key={r}
                                            className={`login-role-pill flex items-center justify-center h-9 rounded-lg cursor-pointer transition-colors ${role === r ? 'login-role-pill-active !bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] shadow-sm' : 'border border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)]/70'}`}
                                        >
                                            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                                            <span className="text-sm font-medium">{r}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label htmlFor="email" className="text-sm font-medium text-[var(--app-text)]">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                    disabled={isSimulationMode}
                                className="block h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/70"
                                    placeholder={isSimulationMode ? 'Not required in simulation mode' : emailPlaceholder}
                                    required={!isSimulationMode}
                            />
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="password" className="text-sm font-medium text-[var(--app-text)]">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSimulationMode}
                                    className="block h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 pr-10 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/70"
                                    placeholder={isSimulationMode ? 'Not required in simulation mode' : ''}
                                    required={!isSimulationMode}
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
                                    className={`font-semibold text-[var(--app-accent)] transition-colors ${isSimulationMode ? 'opacity-0 pointer-events-none' : 'hover:opacity-80'}`}
                                    tabIndex={isSimulationMode ? -1 : 0}
                                    aria-hidden={isSimulationMode}
                                >
                                    {role === Role.HOSPITAL ? 'Register hospital' : 'Create account'}
                                </button>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="h-10 w-full rounded-lg bg-[var(--app-primary)] text-sm font-semibold text-[var(--app-primary-text)] transition-colors hover:bg-[var(--app-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent-soft)]"
                        >
                            {isSimulationMode ? 'Enter Simulation' : 'Login'}
                        </button>

                        {!isAdminLogin && (
                            <div className="min-h-[68px]">
                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-[var(--app-border)]"></div>
                                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Or</span>
                                    <div className="h-px flex-1 bg-[var(--app-border)]"></div>
                                </div>
                                {!googleClientId && !isSimulationMode && (
                                    <p className="mt-2 text-xs text-center text-amber-700 dark:text-amber-400">Google login is unavailable. Missing VITE_GOOGLE_CLIENT_ID.</p>
                                )}
                                {isSimulationMode ? (
                                    <div className="mt-2 min-h-10 w-full rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)]/45 px-3 py-2 text-center text-xs text-[var(--app-muted)] flex items-center justify-center">
                                        Google sign-in is unavailable in simulation mode.
                                    </div>
                                ) : (
                                    <div ref={googleButtonRef} className="mt-2 min-h-10 w-full flex justify-center"></div>
                                )}
                            </div>
                        )}
                    </form>

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--app-muted)]">
                        <span>Every access is audited.</span>
                        <button
                            type="button"
                            onClick={() => navigate(isAdminLogin ? '/login' : '/admin/login')}
                            className="font-medium hover:text-[var(--app-text)] transition-colors"
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