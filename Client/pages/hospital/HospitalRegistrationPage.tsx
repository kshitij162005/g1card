import { API_URL } from '../../config/api';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../../utils/theme';

type AuthMode = 'manual' | 'google';

interface HospitalForm {
    hospitalName: string;
    regNumber: string;
    address: string;
    city: string;
    state: string;
    pin: string;
    license: string;
    email: string;
    phone: string;
    website: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    designation: string;
    password: string;
    confirmPassword: string;
}

interface GoogleProfile {
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
}

interface OnboardingStep {
    key: keyof HospitalForm | 'terms' | 'licenseDoc' | 'registrationDoc' | 'otp';
    label: string;
    description: string;
    required?: boolean;
    optional?: boolean;
    type?: 'text' | 'email' | 'tel' | 'url' | 'password' | 'select' | 'checkbox' | 'otp' | 'file';
    placeholder?: string;
    options?: string[];
}

const OTP_LENGTH = 6;

const initialForm: HospitalForm = {
    hospitalName: '',
    regNumber: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    license: '',
    email: '',
    phone: '',
    website: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    designation: 'CEO',
    password: '',
    confirmPassword: '',
};

const baseManualSteps: OnboardingStep[] = [
    { key: 'hospitalName', label: 'Hospital Name', description: 'What is your hospital name?', required: true, type: 'text', placeholder: 'Nova Multispeciality Hospital' },
    { key: 'regNumber', label: 'Registration Number', description: 'Official registration number for your hospital.', required: true, type: 'text', placeholder: 'REG-2026-001' },
    { key: 'license', label: 'License Number', description: 'Healthcare license number.', required: true, type: 'text', placeholder: 'LIC-77881' },
    { key: 'email', label: 'Hospital Email', description: 'Primary hospital account email for verification.', required: true, type: 'email', placeholder: 'hospital@example.com' },
    { key: 'phone', label: 'Hospital Phone', description: 'Primary contact number.', required: true, type: 'tel', placeholder: '+91 98XXXXXXXX' },
    { key: 'address', label: 'Address', description: 'Street/building address.', required: true, type: 'text', placeholder: '221B Medical Avenue' },
    { key: 'city', label: 'City', description: 'City of operation.', required: true, type: 'text', placeholder: 'Mumbai' },
    { key: 'state', label: 'State', description: 'State of operation.', required: true, type: 'text', placeholder: 'Maharashtra' },
    { key: 'pin', label: 'PIN Code', description: 'Postal code of your hospital.', required: true, type: 'text', placeholder: '400001' },
    { key: 'website', label: 'Website', description: 'Optional but recommended for trust and verification.', optional: true, type: 'url', placeholder: 'https://yourhospital.com' },
    { key: 'adminName', label: 'Admin Name', description: 'Who is the primary administrator?', required: true, type: 'text', placeholder: 'Dr. Kshitij Kotecha' },
    { key: 'adminEmail', label: 'Admin Email', description: 'Must be different from hospital email.', required: true, type: 'email', placeholder: 'admin@example.com' },
    { key: 'adminPhone', label: 'Admin Phone', description: 'Direct number for the primary admin.', required: true, type: 'tel', placeholder: '+91 97XXXXXXXX' },
    { key: 'designation', label: 'Admin Designation', description: 'Select the admin designation.', required: true, type: 'select', options: ['CEO', 'COO', 'Medical Director', 'Administrator'] },
    { key: 'licenseDoc', label: 'License Document', description: 'Optional for now. You can upload during verification too.', optional: true, type: 'file' },
    { key: 'registrationDoc', label: 'Registration Certificate', description: 'Optional for now. You can upload later.', optional: true, type: 'file' },
    { key: 'password', label: 'Password', description: 'Create your account password.', required: true, type: 'password', placeholder: 'Create strong password' },
    { key: 'confirmPassword', label: 'Confirm Password', description: 'Re-enter password to confirm.', required: true, type: 'password', placeholder: 'Repeat password' },
    { key: 'terms', label: 'Terms & Declaration', description: 'Confirm terms before registration.', required: true, type: 'checkbox' },
    { key: 'otp', label: 'Verify OTP', description: 'Enter the OTP sent to hospital email.', required: true, type: 'otp' },
];

function parseGoogleCredential(credential: string): GoogleProfile | null {
    try {
        const parts = credential.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padding = payload.length % 4;
        const normalized = padding ? payload + '='.repeat(4 - padding) : payload;
        const raw = atob(normalized);
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function createGeneratedPassword() {
    return `g1h_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

async function parseApiResponse(resp: Response) {
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return resp.json();
    }
    const text = await resp.text();
    return { error: text?.slice(0, 200) || `HTTP ${resp.status}` };
}

const HospitalRegistrationPage: React.FC = () => {
    const [form, setForm] = useState<HospitalForm>(initialForm);
    const [authMode, setAuthMode] = useState<AuthMode>('manual');
    const [themePreference, setThemePreference] = useState<ThemeMode>(() => getStoredTheme());
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
    const [otpTimer, setOtpTimer] = useState(25);
    const [otpSubmitting, setOtpSubmitting] = useState(false);
    const [otpResending, setOtpResending] = useState(false);
    const [signupSubmitted, setSignupSubmitted] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const [licenseDocName, setLicenseDocName] = useState('');
    const [registrationDocName, setRegistrationDocName] = useState('');

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const googleButtonRef = useRef<HTMLDivElement | null>(null);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const steps = useMemo(() => {
        if (authMode === 'google') {
            return baseManualSteps.filter((step) => step.key !== 'password' && step.key !== 'confirmPassword').map((step) => {
                if (step.key === 'regNumber') return { ...step, required: false, optional: true, description: 'Optional for quick Google onboarding.' };
                if (step.key === 'license') return { ...step, required: false, optional: true, description: 'Optional for quick Google onboarding.' };
                if (step.key === 'website') return { ...step, optional: true };
                return step;
            });
        }
        return baseManualSteps;
    }, [authMode]);

    const totalPages = steps.length;
    const currentStep = steps[stepIndex];
    const progressPercent = useMemo(() => Math.round(((stepIndex + 1) / totalPages) * 100), [stepIndex, totalPages]);

    const update = (k: keyof HospitalForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

    useEffect(() => {
        if (window.google?.accounts?.id) {
            setIsGoogleReady(true);
            return;
        }

        const scriptId = 'google-identity-services-sdk';
        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existingScript) {
            existingScript.addEventListener('load', () => setIsGoogleReady(true), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setIsGoogleReady(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!googleButtonRef.current) return;
        googleButtonRef.current.innerHTML = '';
        if (!googleClientId || !isGoogleReady || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
                const token = response?.credential;
                if (!token) {
                    notify('Google signup failed. Please try again.');
                    return;
                }
                const profile = parseGoogleCredential(token);
                if (!profile?.email) {
                    notify('Could not read Google account details.');
                    return;
                }

                setAuthMode('google');
                setStepIndex(0);
                setForm((prev) => ({
                    ...prev,
                    email: profile.email || prev.email,
                    adminName: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || prev.adminName,
                }));
                notify('Google connected. Continue with single-step onboarding.');
            },
            auto_select: false,
            cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            width: googleButtonRef.current.offsetWidth || 280,
            text: 'signup_with',
        });
    }, [googleClientId, isGoogleReady]);

    useEffect(() => {
        if (!signupSubmitted || currentStep?.key !== 'otp') return;
        const interval = window.setInterval(() => {
            setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => window.clearInterval(interval);
    }, [signupSubmitted, currentStep?.key]);

    const validateStep = (step: OnboardingStep): boolean => {
        if (step.key === 'terms') {
            if (!termsAccepted) {
                notify('Please accept terms to continue.');
                return false;
            }
            return true;
        }

        if (step.key === 'licenseDoc' || step.key === 'registrationDoc') return true;
        if (step.key === 'otp') return true;

        const value = (form[step.key as keyof HospitalForm] || '').trim();

        if (step.required && !value) {
            notify(`${step.label} is required.`);
            return false;
        }

        if (step.key === 'adminEmail' && value && value.toLowerCase() === form.email.trim().toLowerCase()) {
            notify('Admin email must be different from hospital email.');
            return false;
        }

        if (step.key === 'confirmPassword' && authMode === 'manual') {
            if (form.password !== form.confirmPassword) {
                notify('Passwords do not match.');
                return false;
            }
        }

        return true;
    };

    const submitSignupAndMoveToOtp = async () => {
        const normalizedHospitalEmail = String(form.email || '').trim().toLowerCase();
        const normalizedAdminEmail = String(form.adminEmail || '').trim().toLowerCase();

        if (!form.hospitalName || !form.email || !form.adminName || !form.adminEmail) {
            notify('Please complete required details before OTP verification.');
            return false;
        }

        if (normalizedHospitalEmail === normalizedAdminEmail) {
            notify('Hospital email and admin email must be different.');
            return false;
        }

        if (authMode === 'manual') {
            if (!form.regNumber || !form.phone || !form.adminPhone) {
                notify('Required hospital/admin fields are missing.');
                return false;
            }
            if (!form.password || !form.confirmPassword) {
                notify('Password is required for manual signup.');
                return false;
            }
            if (form.password !== form.confirmPassword) {
                notify('Passwords do not match.');
                return false;
            }
        }

        setStoredTheme(themePreference);
        setIsSubmitting(true);
        try {
            const body = {
                hospitalName: form.hospitalName,
                regNumber: form.regNumber,
                address: form.address,
                city: form.city,
                state: form.state,
                pin: form.pin,
                license: form.license,
                email: form.email,
                phone: form.phone,
                website: form.website,
                adminName: form.adminName,
                adminEmail: form.adminEmail,
                adminPhone: form.adminPhone,
                designation: form.designation,
                password: authMode === 'google' ? createGeneratedPassword() : form.password,
            };

            const resp = await fetch(`${API_URL}/auth/signup/hospital`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Registration failed');
                return false;
            }

            const emailToUse = String(data?.email || form.email || '').toLowerCase();
            setRegisteredEmail(emailToUse);
            setSignupSubmitted(true);
            setOtpTimer(25);
            setOtp(new Array(OTP_LENGTH).fill(''));
            notify('OTP sent to hospital email. Enter it to complete registration.');
            return true;
        } catch (err) {
            console.error('hospital signup error', err);
            notify('Registration error');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const goNext = async () => {
        if (!currentStep) return;

        if (currentStep.key === 'otp') {
            await verifyOtp();
            return;
        }

        if (!validateStep(currentStep)) return;

        const isBeforeOtp = stepIndex === totalPages - 2;
        if (isBeforeOtp) {
            const ok = await submitSignupAndMoveToOtp();
            if (ok) setStepIndex((prev) => Math.min(prev + 1, totalPages - 1));
            return;
        }

        setStepIndex((prev) => Math.min(prev + 1, totalPages - 1));
    };

    const goPrev = () => {
        if (stepIndex === 0 || otpSubmitting || isSubmitting) return;
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const skipCurrentStep = () => {
        if (!currentStep?.optional) return;
        setStepIndex((prev) => Math.min(prev + 1, totalPages - 1));
    };

    const handleOtpChange = (element: HTMLInputElement, index: number) => {
        if (isNaN(Number(element.value))) return;

        const value = element.value.slice(-1);
        setOtp((prev) => [...prev.map((d, idx) => (idx === index ? value : d))]);

        if (value && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const verifyOtp = async () => {
        if (!signupSubmitted) {
            notify('Complete registration before OTP verification.');
            return;
        }

        const otpValue = otp.join('');
        if (otpValue.length !== OTP_LENGTH) {
            notify('Please enter the complete 6-digit OTP.');
            return;
        }

        setOtpSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/auth/otp/verify-signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'Hospital', email: registeredEmail, otp: otpValue }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'OTP verification failed');
                return;
            }

            notify('Hospital registration completed. Await admin approval before login.');
            window.location.hash = '#/login';
        } catch (err) {
            console.error('verify hospital otp error', err);
            notify('Error verifying OTP');
        } finally {
            setOtpSubmitting(false);
        }
    };

    const resendOtp = async () => {
        if (otpTimer > 0 || !registeredEmail) return;
        setOtpResending(true);
        try {
            const resp = await fetch(`${API_URL}/auth/otp/resend-signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'Hospital', email: registeredEmail }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to resend OTP');
                return;
            }
            setOtpTimer(25);
            notify('OTP resent successfully');
        } catch (err) {
            console.error('resend hospital otp error', err);
            notify('Error resending OTP');
        } finally {
            setOtpResending(false);
        }
    };

    const renderCurrentStepInput = () => {
        if (!currentStep) return null;

        if (currentStep.key === 'otp') {
            return (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">We sent a verification code to <span className="font-semibold">{registeredEmail || form.email}</span></p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cooldown: {otpTimer}s</p>
                    <div className="flex justify-center gap-2">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                type="text"
                                name={`otp-${index}`}
                                maxLength={1}
                                className="w-12 h-12 text-center text-xl border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                value={digit}
                                onChange={(e) => handleOtpChange(e.target, index)}
                                onKeyDown={(e) => handleOtpKeyDown(e, index)}
                                onFocus={(e) => e.target.select()}
                                ref={(el) => {
                                    otpInputRefs.current[index] = el;
                                }}
                                aria-label={`OTP digit ${index + 1}`}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={resendOtp}
                        disabled={otpTimer > 0 || otpResending}
                        className="text-sm text-brand-primary hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                        {otpResending ? 'Resending...' : `Resend OTP ${otpTimer > 0 ? `(in ${otpTimer}s)` : ''}`}
                    </button>
                </div>
            );
        }

        if (currentStep.key === 'terms') {
            return (
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4"
                    />
                    I agree to terms and certify that submitted details are accurate.
                </label>
            );
        }

        if (currentStep.key === 'licenseDoc' || currentStep.key === 'registrationDoc') {
            const isLicense = currentStep.key === 'licenseDoc';
            return (
                <div className="space-y-2">
                    <input
                        type="file"
                        onChange={(e) => {
                            const fileName = e.target.files?.[0]?.name || '';
                            if (isLicense) setLicenseDocName(fileName);
                            else setRegistrationDocName(fileName);
                        }}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isLicense ? (licenseDocName || 'No file selected') : (registrationDocName || 'No file selected')}
                    </p>
                </div>
            );
        }

        if (currentStep.type === 'select') {
            return (
                <select
                    value={form[currentStep.key as keyof HospitalForm]}
                    onChange={(e) => update(currentStep.key as keyof HospitalForm, e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                >
                    {(currentStep.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            );
        }

        return (
            <input
                type={currentStep.type || 'text'}
                placeholder={currentStep.placeholder}
                value={form[currentStep.key as keyof HospitalForm]}
                onChange={(e) => update(currentStep.key as keyof HospitalForm, e.target.value)}
                readOnly={authMode === 'google' && currentStep.key === 'email'}
                className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
            />
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-80 h-80 bg-brand-accent/20 dark:bg-brand-accent/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-80 h-80 bg-brand-primary/20 dark:bg-brand-primary/20 rounded-full blur-3xl" />

            <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden relative z-10">
                <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold text-brand-primary dark:text-white">Hospital Registration</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Single-step onboarding: one field per page for better clarity.</p>

                        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/70 dark:bg-slate-900/40">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Continue with Google</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Google pre-fills your onboarding and keeps the same OTP flow.</p>
                            </div>
                            <span className="hidden md:block text-xs text-slate-400">OR</span>
                            <div className="space-y-2">
                                {!googleClientId && <p className="text-xs text-amber-600 dark:text-amber-400">Google is unavailable: missing VITE_GOOGLE_CLIENT_ID.</p>}
                                <div ref={googleButtonRef} className="min-h-10" />
                                {authMode === 'google' && (
                                    <button type="button" onClick={() => { setAuthMode('manual'); setStepIndex(0); }} className="text-xs text-brand-primary hover:underline">
                                        Switch to manual flow
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/80 dark:bg-slate-900/40">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Choose your appearance preference</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This will be remembered until you change it from Settings.</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setThemePreference('light'); setStoredTheme('light'); }}
                                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${themePreference === 'light' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    Light Mode
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setThemePreference('dark'); setStoredTheme('dark'); }}
                                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${themePreference === 'dark' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    Dark Mode
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Page {stepIndex + 1} of {totalPages}</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full bg-brand-accent transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <section className="space-y-3">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{currentStep?.label}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{currentStep?.description}</p>
                            {renderCurrentStepInput()}
                        </section>

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <button
                                type="button"
                                onClick={goPrev}
                                disabled={stepIndex === 0 || otpSubmitting || isSubmitting}
                                className="px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>

                            <div className="ml-auto flex items-center gap-2">
                                {currentStep?.optional && currentStep.key !== 'otp' && (
                                    <button
                                        type="button"
                                        onClick={skipCurrentStep}
                                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Skip for now
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={isSubmitting || otpSubmitting}
                                    className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-secondary disabled:opacity-60"
                                >
                                    {currentStep?.key === 'otp'
                                        ? (otpSubmitting ? 'Verifying...' : 'Verify & Finish')
                                        : (stepIndex === totalPages - 2
                                            ? (isSubmitting ? 'Submitting...' : 'Submit & Send OTP')
                                            : 'Continue')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HospitalRegistrationPage;
