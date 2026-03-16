import { API_URL } from '../../config/api';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const FormInput: React.FC<{
    label: string;
    id: keyof HospitalForm;
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

const HospitalRegistrationPage: React.FC = () => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<HospitalForm>(initialForm);
    const [authMode, setAuthMode] = useState<AuthMode>('manual');
    const [themePreference, setThemePreference] = useState<ThemeMode>(() => getStoredTheme());
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationComplete, setRegistrationComplete] = useState(false);

    const navigate = useNavigate();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const googleButtonRef = useRef<HTMLDivElement | null>(null);

    const isGoogleFlow = authMode === 'google';
    const stepLabels = isGoogleFlow ? ['Organization', 'Consent'] : ['Hospital', 'Admin', 'Docs', 'Finish'];
    const totalSteps = stepLabels.length;
    const progressPercent = useMemo(() => Math.round((step / totalSteps) * 100), [step, totalSteps]);

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
                setStep(1);
                setForm((prev) => ({
                    ...prev,
                    email: profile.email || prev.email,
                    adminEmail: '',
                    adminName: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || prev.adminName,
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

    const stepOptional = !isGoogleFlow && step === 3;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStoredTheme(themePreference);

        const generatedPassword = isGoogleFlow ? createGeneratedPassword() : '';
        const passwordToUse = isGoogleFlow ? generatedPassword : form.password;

        if (!form.hospitalName || !form.email || !form.adminName || !form.adminEmail) {
            notify('Please complete required organization details.');
            return;
        }

        const normalizedHospitalEmail = String(form.email || '').trim().toLowerCase();
        const normalizedAdminEmail = String(form.adminEmail || '').trim().toLowerCase();
        if (normalizedHospitalEmail === normalizedAdminEmail) {
            notify('Hospital contact email and admin email must be different.');
            return;
        }

        if (!isGoogleFlow) {
            if (!form.regNumber || !form.phone || !form.adminPhone) {
                notify('Please complete required hospital and admin contact details.');
                return;
            }
            if (!form.password || !form.confirmPassword) {
                notify('Please set your password.');
                return;
            }
            if (form.password !== form.confirmPassword) {
                notify('Passwords do not match.');
                return;
            }
        }

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
            password: passwordToUse,
        };

        setIsSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/auth/signup/hospital`, {
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

            setRegistrationComplete(true);
            setIsSubmitting(false);
        } catch (err) {
            console.error('hospital signup error', err);
            notify('Registration error');
            setIsSubmitting(false);
        }
    };

    if (registrationComplete) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4">
                <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-5">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Registration Submitted</h1>
                    <p className="text-slate-600 dark:text-slate-300">Your hospital is now under verification. We will notify you after review.</p>
                    <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm font-medium">
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-80 h-80 bg-brand-accent/20 dark:bg-brand-accent/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-80 h-80 bg-brand-primary/20 dark:bg-brand-primary/20 rounded-full blur-3xl" />

            <div className="max-w-3xl mx-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden relative z-10">
                <div className="p-6 sm:p-8 space-y-6">
                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold text-brand-primary dark:text-white">Hospital Registration</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Choose full onboarding or a fast Google-first path.</p>

                        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/70 dark:bg-slate-900/40">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Continue with Google</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Best for quick onboarding. Non-essential fields stay hidden.</p>
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
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Organization Snapshot</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Only essential details are needed right now.</p>
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white/80 dark:bg-slate-900/60">
                                            <FormInput id="hospitalName" label="Hospital Name" required value={form.hospitalName} onChange={(v) => update('hospitalName', v)} />
                                            <FormInput id="regNumber" label="Registration Number (Optional)" value={form.regNumber} onChange={(v) => update('regNumber', v)} />
                                            <FormInput id="adminName" label="Primary Admin Name" required value={form.adminName} onChange={(v) => update('adminName', v)} />
                                            <FormInput id="email" label="Organization Email" type="email" required value={form.email} onChange={(v) => update('email', v)} readOnly />
                                            <FormInput id="adminEmail" label="Admin Email (must differ from org email)" type="email" required value={form.adminEmail} onChange={(v) => update('adminEmail', v)} />
                                        </div>
                                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                                            Contact numbers, address, and document upload are deferred to post-approval profile completion.
                                        </div>
                                    </section>
                                )}

                                {step === 2 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Consent</h2>
                                        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" required className="mt-1 h-4 w-4" />I agree to terms and certify that the submitted details are accurate.</label>
                                    </section>
                                )}
                            </>
                        ) : (
                            <>
                                {step === 1 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Hospital Details</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="hospitalName" label="Hospital Name" required value={form.hospitalName} onChange={(v) => update('hospitalName', v)} />
                                            <FormInput id="regNumber" label="Registration Number" required value={form.regNumber} onChange={(v) => update('regNumber', v)} />
                                        </div>
                                        <FormInput id="address" label="Address" value={form.address} onChange={(v) => update('address', v)} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormInput id="city" label="City" value={form.city} onChange={(v) => update('city', v)} />
                                            <FormInput id="state" label="State" value={form.state} onChange={(v) => update('state', v)} />
                                            <FormInput id="pin" label="PIN Code" value={form.pin} onChange={(v) => update('pin', v)} />
                                        </div>
                                        <FormInput id="license" label="License Number" value={form.license} onChange={(v) => update('license', v)} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="email" label="Contact Email" type="email" required value={form.email} onChange={(v) => update('email', v)} />
                                            <FormInput id="phone" label="Contact Phone" type="tel" required value={form.phone} onChange={(v) => update('phone', v)} />
                                        </div>
                                        <FormInput id="website" label="Website" value={form.website} onChange={(v) => update('website', v)} />
                                    </section>
                                )}

                                {step === 2 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Admin Details</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="adminName" label="Admin Name" required value={form.adminName} onChange={(v) => update('adminName', v)} />
                                            <FormInput id="adminEmail" label="Admin Email" type="email" required value={form.adminEmail} onChange={(v) => update('adminEmail', v)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="adminPhone" label="Admin Phone" type="tel" required value={form.adminPhone} onChange={(v) => update('adminPhone', v)} />
                                            <div>
                                                <label htmlFor="designation" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Designation</label>
                                                <select
                                                    id="designation"
                                                    value={form.designation}
                                                    onChange={(e) => update('designation', e.target.value)}
                                                    className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                                >
                                                    <option>CEO</option>
                                                    <option>COO</option>
                                                    <option>Medical Director</option>
                                                    <option>Administrator</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {step === 3 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Documents (Optional for now)</h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Upload now or continue and provide later during verification.</p>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hospital License</label>
                                                <input type="file" className="block w-full text-sm text-slate-500 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Registration Certificate</label>
                                                <input type="file" className="block w-full text-sm text-slate-500 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-brand-light dark:file:bg-slate-700 file:text-brand-primary dark:file:text-slate-200" />
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {step === 4 && (
                                    <section className="space-y-4">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security & Terms</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormInput id="password" label="Password" type="password" required value={form.password} onChange={(v) => update('password', v)} />
                                            <FormInput id="confirmPassword" label="Confirm Password" type="password" required value={form.confirmPassword} onChange={(v) => update('confirmPassword', v)} />
                                        </div>
                                        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" required className="mt-1 h-4 w-4" />I agree to terms and certify that the submitted details are accurate.</label>
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
                                        {isSubmitting ? 'Submitting...' : 'Submit Registration'}
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

export default HospitalRegistrationPage;
