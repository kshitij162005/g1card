import { API_URL } from '../../config/api';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../../utils/theme';

type AuthMode = 'manual' | 'google';

interface PatientForm {
    firstName: string;
    lastName: string;
    email: string;
    dob: string;
    gender: string;
    phone: string;
    address: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    allergies: string;
    conditions: string;
    medications: string;
    familyHistory: string;
    smoking: string;
    password: string;
    confirmPassword: string;
}

interface GoogleProfile {
    email?: string;
    given_name?: string;
    family_name?: string;
}

const initialForm: PatientForm = {
    firstName: '',
    lastName: '',
    email: '',
    dob: '',
    gender: '',
    phone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    allergies: '',
    conditions: '',
    medications: '',
    familyHistory: '',
    smoking: '',
    password: '',
    confirmPassword: '',
};

const FormInput: React.FC<{
    label: string;
    id: keyof PatientForm;
    type?: string;
    placeholder?: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
    readOnly?: boolean;
}> = ({ label, id, type = 'text', placeholder, required, value, onChange, readOnly }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <input
            id={id}
            type={type}
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
    </div>
);

const ChipRadioGroup: React.FC<{ legend: string; name: string; options: string[]; value: string; onChange: (v: string) => void }> = ({ legend, name, options, value, onChange }) => (
    <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{legend}</span>
        <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => (
                <label key={option} className={`rounded-full border px-3 py-1.5 text-sm ${value === option ? 'border-brand-accent bg-brand-light dark:bg-slate-700 text-brand-primary dark:text-slate-100' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-brand-accent'}`}>
                    <input type="radio" name={name} value={option} checked={value === option} onChange={(e) => onChange(e.target.value)} className="sr-only" />
                    {option}
                </label>
            ))}
        </div>
    </div>
);

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
    return `g1_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

const PatientRegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<PatientForm>(initialForm);
    const [authMode, setAuthMode] = useState<AuthMode>('manual');
    const [themePreference, setThemePreference] = useState<ThemeMode>(() => getStoredTheme());
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const navigate = useNavigate();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const googleButtonRef = useRef<HTMLDivElement | null>(null);

    const isGoogleFlow = authMode === 'google';
    const stepLabels = isGoogleFlow ? ['Account', 'Consent'] : ['Basics', 'Contact', 'Health', 'Finish'];
    const totalSteps = stepLabels.length;
    const progressPercent = useMemo(() => Math.round((step / totalSteps) * 100), [step, totalSteps]);

    const update = (k: keyof PatientForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

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
                setStep(1);
                setForm((prev) => ({
                    ...prev,
                    email: profile.email || prev.email,
                    firstName: profile.given_name || prev.firstName,
                    lastName: profile.family_name || prev.lastName,
                }));
                notify('Google connected. Finish onboarding in 2 quick steps.');
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
        if (step > totalSteps) {
            setStep(totalSteps);
        }
    }, [step, totalSteps]);

    const nextStep = () => setStep((prev) => Math.min(prev + 1, totalSteps));
    const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

    const stepOptional = !isGoogleFlow && (step === 2 || step === 3);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStoredTheme(themePreference);

        const generatedPassword = isGoogleFlow ? createGeneratedPassword() : '';
        const passwordToUse = isGoogleFlow ? generatedPassword : form.password;

        if (!form.firstName || !form.lastName || !form.email) {
            notify('Please complete your basic details.');
            return;
        }

        if (!isGoogleFlow && !form.phone) {
            notify('Phone number is required for manual signup.');
            return;
        }

        if (!isGoogleFlow) {
            if (!form.password || !form.confirmPassword) {
                notify('Please set your password.');
                return;
            }
            if (form.password !== form.confirmPassword) {
                notify('Passwords do not match.');
                return;
            }
        }

        const toArray = (val?: string) => (val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []);
        const body = {
            email: form.email,
            password: passwordToUse,
            firstName: form.firstName,
            lastName: form.lastName,
            dob: form.dob,
            gender: form.gender,
            phone: form.phone,
            address: form.address,
            emergencyContactName: form.emergencyContactName,
            emergencyContactPhone: form.emergencyContactPhone,
            allergies: toArray(form.allergies),
            conditions: toArray(form.conditions),
            surgeries: [],
            medications: toArray(form.medications),
            familyHistory: form.familyHistory,
            smoking: form.smoking,
        };

        setIsSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/auth/signup/patient`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                notify(`Registration failed: ${data?.error || data?.message || 'unknown error'}`);
                setIsSubmitting(false);
                return;
            }

            notify('Registration successful. Please login to continue.');
            navigate('/login');
        } catch (err) {
            console.error('patient signup error', err);
            notify('Registration error');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-80 h-80 bg-brand-accent/20 dark:bg-brand-accent/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-80 h-80 bg-brand-primary/20 dark:bg-brand-primary/20 rounded-full blur-3xl" />

            <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden relative z-10">
                <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold text-brand-primary dark:text-white">Patient Registration</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Choose your path and complete onboarding in minutes.</p>

                        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/70 dark:bg-slate-900/40">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Continue with Google</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Best for fast signup. Extra profile fields are hidden.</p>
                            </div>
                            <span className="hidden md:block text-xs text-slate-400">OR</span>
                            <div className="space-y-2">
                                {!googleClientId && <p className="text-xs text-amber-600 dark:text-amber-400">Google is unavailable: missing VITE_GOOGLE_CLIENT_ID.</p>}
                                <div ref={googleButtonRef} className="min-h-10" />
                                {isGoogleFlow && (
                                    <button type="button" onClick={() => { setAuthMode('manual'); setStep(1); }} className="text-xs text-brand-primary hover:underline">
                                        Use full manual signup instead
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
                            <span>Step {step} of {totalSteps} {stepOptional ? '(optional section)' : ''}</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full bg-brand-accent transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className={`grid gap-2 ${isGoogleFlow ? 'grid-cols-2' : 'grid-cols-4'}`}>
                            {stepLabels.map((label, idx) => (
                                <div key={label} className={`text-center text-xs rounded-md py-1 ${idx + 1 <= step ? 'bg-brand-light dark:bg-slate-700 text-brand-primary dark:text-slate-100' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {isGoogleFlow ? (
                            <>
                                {step === 1 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Account Snapshot</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">We only need to confirm your profile from Google.</p>
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white/80 dark:bg-slate-900/60">
                                            <FormInput id="firstName" label="First Name" required value={form.firstName} onChange={(v) => update('firstName', v)} />
                                            <FormInput id="lastName" label="Last Name" required value={form.lastName} onChange={(v) => update('lastName', v)} />
                                            <FormInput id="email" label="Email" type="email" required value={form.email} onChange={(v) => update('email', v)} readOnly />
                                        </div>
                                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                                            Manual fields like phone, address, and medical details are skipped for now. You can complete them later in profile settings.
                                        </div>
                                    </section>
                                )}

                                {step === 2 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Consent</h2>
                                        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" required className="mt-1 h-4 w-4" />I agree to G1CARD Terms of Service and Privacy Policy.</label>
                                    </section>
                                )}
                            </>
                        ) : (
                            <>
                                {step === 1 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Basic Details</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="firstName" label="First Name" required value={form.firstName} onChange={(v) => update('firstName', v)} />
                                            <FormInput id="lastName" label="Last Name" required value={form.lastName} onChange={(v) => update('lastName', v)} />
                                        </div>
                                        <FormInput id="email" label="Email" type="email" required value={form.email} onChange={(v) => update('email', v)} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} />
                                            <FormInput id="phone" label="Phone Number" type="tel" required value={form.phone} onChange={(v) => update('phone', v)} />
                                        </div>
                                        <ChipRadioGroup legend="Gender" name="gender" options={['Male', 'Female', 'Other', 'Prefer Not']} value={form.gender} onChange={(v) => update('gender', v)} />
                                    </section>
                                )}

                                {step === 2 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contact & Emergency (Optional)</h2>
                                        <FormInput id="address" label="Address" value={form.address} onChange={(v) => update('address', v)} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="emergencyContactName" label="Emergency Contact Name" value={form.emergencyContactName} onChange={(v) => update('emergencyContactName', v)} />
                                            <FormInput id="emergencyContactPhone" label="Emergency Contact Phone" type="tel" value={form.emergencyContactPhone} onChange={(v) => update('emergencyContactPhone', v)} />
                                        </div>
                                    </section>
                                )}

                                {step === 3 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Health Snapshot (Optional)</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">You can always update this later in settings.</p>
                                        <FormInput id="allergies" label="Allergies" placeholder="Comma separated" value={form.allergies} onChange={(v) => update('allergies', v)} />
                                        <FormInput id="conditions" label="Chronic Conditions" placeholder="Comma separated" value={form.conditions} onChange={(v) => update('conditions', v)} />
                                        <FormInput id="medications" label="Current Medications" placeholder="Comma separated" value={form.medications} onChange={(v) => update('medications', v)} />
                                        <div>
                                            <label htmlFor="familyHistory" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Family Medical History</label>
                                            <textarea
                                                id="familyHistory"
                                                rows={3}
                                                value={form.familyHistory}
                                                onChange={(e) => update('familyHistory', e.target.value)}
                                                className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
                                            />
                                        </div>
                                        <ChipRadioGroup legend="Smoking" name="smoking" options={['Never', 'Former', 'Current']} value={form.smoking} onChange={(v) => update('smoking', v)} />
                                    </section>
                                )}

                                {step === 4 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security & Consent</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="password" label="Password" type="password" required value={form.password} onChange={(v) => update('password', v)} />
                                            <FormInput id="confirmPassword" label="Confirm Password" type="password" required value={form.confirmPassword} onChange={(v) => update('confirmPassword', v)} />
                                        </div>
                                        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" required className="mt-1 h-4 w-4" />I agree to G1CARD Terms of Service and Privacy Policy.</label>
                                    </section>
                                )}
                            </>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <button type="button" onClick={prevStep} disabled={step === 1} className="px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed">
                                Previous
                            </button>

                            <div className="ml-auto flex items-center gap-2">
                                {stepOptional && step < totalSteps && (
                                    <button type="button" onClick={nextStep} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                                        Skip for now
                                    </button>
                                )}

                                {step < totalSteps ? (
                                    <button type="button" onClick={nextStep} className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-secondary">
                                        Continue
                                    </button>
                                ) : (
                                    <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-secondary disabled:opacity-60">
                                        {isSubmitting ? 'Creating account...' : 'Create Account'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PatientRegistrationPage;
