import { API_URL } from '../../config/api';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../../utils/theme';
import { Role } from '../../types';
import {
  OnboardingShell, StepDef, TextField, TextAreaField, ChoiceField, TagField, PasswordStrength, ThemeChoice,
  useGoogleSignup, isEmail, Spinner,
} from '../../components/onboarding/Onboarding';

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

const initialForm: PatientForm = {
  firstName: '', lastName: '', email: '', dob: '', gender: '', phone: '', address: '',
  emergencyContactName: '', emergencyContactPhone: '', allergies: '', conditions: '', medications: '',
  familyHistory: '', smoking: '', password: '', confirmPassword: '',
};

type StepKey = 'account' | 'about' | 'contact' | 'health' | 'secure';
type Errors = Partial<Record<keyof PatientForm | 'terms', string>>;

const MANUAL_STEPS: Array<StepDef & { key: StepKey }> = [
  { key: 'account', label: 'Your account', hint: 'Name, email, phone' },
  { key: 'about', label: 'About you', hint: 'Optional' },
  { key: 'contact', label: 'Contact & emergency', hint: 'Optional' },
  { key: 'health', label: 'Health snapshot', hint: 'Optional' },
  { key: 'secure', label: 'Password & consent' },
];
const GOOGLE_STEPS: Array<StepDef & { key: StepKey }> = [
  { key: 'account', label: 'Your account', hint: 'From Google' },
  { key: 'secure', label: 'Consent' },
];
const VERIFY_STEP: StepDef = { label: 'Verify email', hint: '6-digit code' };

function createGeneratedPassword() {
  return `g1_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

const PatientRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<PatientForm>(initialForm);
  const [isGoogle, setIsGoogle] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [submitting, setSubmitting] = useState(false);

  const steps = isGoogle ? GOOGLE_STEPS : MANUAL_STEPS;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const optional = ['about', 'contact', 'health'].includes(step.key);

  const update = (key: keyof PatientForm) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const google = useGoogleSignup(profile => {
    setIsGoogle(true);
    setStepIndex(0);
    setErrors({});
    setForm(prev => ({
      ...prev,
      email: profile.email || prev.email,
      firstName: profile.given_name || prev.firstName,
      lastName: profile.family_name || prev.lastName,
    }));
    notify('Google connected. Two short steps left.');
  }, !isGoogle);

  const validate = (key: StepKey): Errors => {
    const e: Errors = {};
    if (key === 'account') {
      if (!form.firstName.trim()) e.firstName = 'Enter your first name.';
      if (!form.lastName.trim()) e.lastName = 'Enter your last name.';
      if (!form.email.trim()) e.email = 'Enter your email address.';
      else if (!isEmail(form.email)) e.email = 'That doesn’t look like an email address.';
      if (!isGoogle && !form.phone.trim()) e.phone = 'A phone number is required.';
    }
    if (key === 'secure') {
      if (!isGoogle) {
        if (!form.password) e.password = 'Choose a password.';
        if (!form.confirmPassword) e.confirmPassword = 'Type the password again.';
        else if (form.password !== form.confirmPassword) e.confirmPassword = 'The passwords don’t match.';
      }
      if (!termsAccepted) e.terms = 'Please accept the terms to continue.';
    }
    return e;
  };

  const next = async () => {
    const e = validate(step.key);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!isLast) {
      setStepIndex(i => i + 1);
      return;
    }
    await submit();
  };

  const submit = async () => {
    setStoredTheme(theme);
    const toArray = (val?: string) => (val ? val.split(',').map(s => s.trim()).filter(Boolean) : []);
    const body = {
      email: form.email,
      password: isGoogle ? createGeneratedPassword() : form.password,
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

    setSubmitting(true);
    try {
      const resp = await fetch(`${API_URL}/auth/signup/patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = data?.error || data?.message || 'Registration failed';
        if (/email/i.test(message)) {
          setStepIndex(0);
          setErrors({ email: message });
        } else {
          notify(message);
        }
        return;
      }
      navigate('/patient/verify-otp', {
        state: { email: data?.email || form.email, role: Role.PATIENT, name: form.firstName, flow: isGoogle ? 'google' : 'manual' },
      });
    } catch (err) {
      console.error('patient signup error', err);
      notify('We couldn’t reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copy: Record<StepKey, { title: string; lead: string }> = {
    account: isGoogle
      ? { title: 'Is this you?', lead: 'We filled this in from your Google account. Fix your name if it isn’t quite right.' }
      : { title: 'Let’s start with the basics.', lead: 'This is how hospitals will recognise you when they ask for access to your records.' },
    about: { title: 'A little about you.', lead: 'Doctors use these to read your records correctly. Skip anything you’d rather add later.' },
    contact: { title: 'Who should we call in an emergency?', lead: 'Only hospitals you approve can see this. You can fill it in later from settings.' },
    health: { title: 'Anything a new doctor should know?', lead: 'Allergies, ongoing conditions and medicines you take. Type one and press Enter.' },
    secure: isGoogle
      ? { title: 'One last thing.', lead: 'You’ll sign in with Google, so there’s no password to remember.' }
      : { title: 'Secure your account.', lead: 'Choose a password, then we’ll email you a code to confirm it’s really you.' },
  };

  const content = (() => {
    switch (step.key) {
      case 'account':
        return (
          <>
            {!isGoogle && (
              <>
                <div className="ob-google" ref={google.ref} />
                {!google.available && <p className="ob-hint" style={{ textAlign: 'center' }}>Google sign-up isn’t configured on this server.</p>}
                <div className="ob-divider">or use your email</div>
              </>
            )}
            <div className="ob-row">
              <TextField id="firstName" label="First name" value={form.firstName} onChange={update('firstName')} error={errors.firstName} autoComplete="given-name" autoFocus={!isGoogle} />
              <TextField id="lastName" label="Last name" value={form.lastName} onChange={update('lastName')} error={errors.lastName} autoComplete="family-name" />
            </div>
            <TextField id="email" label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} readOnly={isGoogle} autoComplete="email" hint={isGoogle ? 'Linked to your Google account.' : 'We’ll send a verification code here.'} />
            {!isGoogle && (
              <TextField id="phone" label="Phone number" type="tel" value={form.phone} onChange={update('phone')} error={errors.phone} placeholder="+91 98765 43210" autoComplete="tel" />
            )}
            {isGoogle && (
              <div className="ob-panel">
                Phone, address and health details are skipped for now. You can add them any time from <b>Settings</b>.{' '}
                <button type="button" className="ob-btn--text" style={{ color: 'var(--app-accent)', fontWeight: 600, padding: 0, background: 'none', border: 0, cursor: 'pointer' }} onClick={() => { setIsGoogle(false); setStepIndex(0); }}>
                  Use the full sign-up instead
                </button>
              </div>
            )}
          </>
        );
      case 'about':
        return (
          <>
            <TextField id="dob" label="Date of birth" type="date" value={form.dob} onChange={update('dob')} optional />
            <ChoiceField id="gender" label="Gender" options={['Male', 'Female', 'Other', 'Prefer Not']} value={form.gender} onChange={update('gender')} optional />
          </>
        );
      case 'contact':
        return (
          <>
            <TextField id="address" label="Home address" value={form.address} onChange={update('address')} optional autoComplete="street-address" />
            <div className="ob-row">
              <TextField id="emergencyContactName" label="Emergency contact" value={form.emergencyContactName} onChange={update('emergencyContactName')} placeholder="Name" optional />
              <TextField id="emergencyContactPhone" label="Their phone" type="tel" value={form.emergencyContactPhone} onChange={update('emergencyContactPhone')} optional />
            </div>
          </>
        );
      case 'health':
        return (
          <>
            <TagField id="allergies" label="Allergies" value={form.allergies} onChange={update('allergies')} placeholder="e.g. Penicillin" optional />
            <TagField id="conditions" label="Ongoing conditions" value={form.conditions} onChange={update('conditions')} placeholder="e.g. Type 2 diabetes" optional />
            <TagField id="medications" label="Medicines you take" value={form.medications} onChange={update('medications')} placeholder="e.g. Metformin 500 mg" optional />
            <TextAreaField id="familyHistory" label="Family medical history" value={form.familyHistory} onChange={update('familyHistory')} placeholder="e.g. Father has high blood pressure" optional />
            <ChoiceField id="smoking" label="Smoking" options={['Never', 'Former', 'Current']} value={form.smoking} onChange={update('smoking')} optional />
          </>
        );
      case 'secure':
        return (
          <>
            {!isGoogle && (
              <>
                <div>
                  <TextField id="password" label="Password" type="password" value={form.password} onChange={update('password')} error={errors.password} autoComplete="new-password" />
                  <div style={{ marginTop: 8 }}><PasswordStrength password={form.password} /></div>
                </div>
                <TextField id="confirmPassword" label="Confirm password" type="password" value={form.confirmPassword} onChange={update('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
              </>
            )}
            <ThemeChoice value={theme} onChange={setTheme} />
            <div>
              <label className="ob-check">
                <input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setErrors(prev => ({ ...prev, terms: undefined })); }} />
                <span>I agree to the G1Card Terms of Service and Privacy Policy, and confirm these details are mine.</span>
              </label>
              {errors.terms && <p className="ob-error" style={{ marginTop: 6, marginLeft: 28 }}>{errors.terms}</p>}
            </div>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <OnboardingShell
      railTitle="Create your G1Card"
      railSub="Your records from every hospital, in one place, shared only with hospitals you approve."
      steps={[...steps, VERIFY_STEP]}
      current={stepIndex}
      kicker={`Step ${stepIndex + 1} of ${steps.length + 1}${optional ? ' · Optional' : ''}`}
      title={copy[step.key].title}
      lead={copy[step.key].lead}
      actions={
        <>
          {stepIndex > 0 ? (
            <button type="button" className="ob-btn ob-btn--text" onClick={() => { setErrors({}); setStepIndex(i => i - 1); }} disabled={submitting}>← Back</button>
          ) : (
            <button type="button" className="ob-btn ob-btn--text" onClick={() => navigate('/get-started')}>← Back</button>
          )}
          <div className="ob-actions-right">
            {optional && (
              <button type="button" className="ob-btn ob-btn--ghost" onClick={() => setStepIndex(i => i + 1)}>Skip for now</button>
            )}
            <button type="button" className="ob-btn" onClick={next} disabled={submitting}>
              {submitting ? <><Spinner /> Creating account</> : isLast ? 'Create account' : 'Continue'}
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={e => { e.preventDefault(); next(); }} style={{ display: 'contents' }}>
        {content}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </OnboardingShell>
  );
};

export default PatientRegistrationPage;
