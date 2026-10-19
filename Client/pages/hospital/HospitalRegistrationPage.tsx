import { API_URL } from '../../config/api';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeMode, getStoredTheme, setStoredTheme } from '../../utils/theme';
import {
  OnboardingShell, StepDef, TextField, ChoiceField, FilePick, PasswordStrength, ThemeChoice,
  useGoogleSignup, isEmail, Spinner,
} from '../../components/onboarding/Onboarding';
import VerifyEmail from '../../components/onboarding/VerifyEmail';

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

const initialForm: HospitalForm = {
  hospitalName: '', regNumber: '', address: '', city: '', state: '', pin: '', license: '',
  email: '', phone: '', website: '', adminName: '', adminEmail: '', adminPhone: '',
  designation: 'CEO', password: '', confirmPassword: '',
};

type StepKey = 'hospital' | 'location' | 'admin' | 'documents' | 'security' | 'verify';
type Errors = Partial<Record<keyof HospitalForm | 'terms', string>>;

const STEPS: Array<StepDef & { key: StepKey }> = [
  { key: 'hospital', label: 'Your hospital', hint: 'Name, registration, licence' },
  { key: 'location', label: 'Location & contact' },
  { key: 'admin', label: 'Administrator' },
  { key: 'documents', label: 'Documents', hint: 'Optional' },
  { key: 'security', label: 'Security & declaration' },
  { key: 'verify', label: 'Verify email', hint: '6-digit code' },
];

const DESIGNATIONS = ['CEO', 'COO', 'Medical Director', 'Administrator'];

function createGeneratedPassword() {
  return `g1h_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

async function readJson(resp: Response) {
  const type = resp.headers.get('content-type') || '';
  if (type.includes('application/json')) return resp.json();
  const text = await resp.text();
  return { error: text?.slice(0, 200) || `HTTP ${resp.status}` };
}

const HospitalRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<HospitalForm>(initialForm);
  const [isGoogle, setIsGoogle] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [licenseDocName, setLicenseDocName] = useState('');
  const [registrationDocName, setRegistrationDocName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [done, setDone] = useState(false);

  const step = STEPS[stepIndex];
  const update = (key: keyof HospitalForm) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const google = useGoogleSignup(profile => {
    setIsGoogle(true);
    setErrors({});
    setForm(prev => ({
      ...prev,
      email: profile.email || prev.email,
      adminName: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || prev.adminName,
    }));
    notify('Google connected. Your hospital email is filled in.');
  }, !isGoogle && stepIndex === 0);

  const required = (key: keyof HospitalForm, message: string, e: Errors) => {
    if (!String(form[key] || '').trim()) e[key] = message;
  };

  const validate = (key: StepKey): Errors => {
    const e: Errors = {};
    if (key === 'hospital') {
      required('hospitalName', 'Enter the hospital’s name.', e);
      // Google sign-ups may add these during verification (same as before)
      if (!isGoogle) {
        required('regNumber', 'Enter the registration number.', e);
        required('license', 'Enter the healthcare licence number.', e);
      }
    }
    if (key === 'location') {
      required('email', 'Enter the hospital’s email.', e);
      if (form.email && !isEmail(form.email)) e.email = 'That doesn’t look like an email address.';
      required('phone', 'Enter the hospital’s phone number.', e);
      required('address', 'Enter the street address.', e);
      required('city', 'Enter the city.', e);
      required('state', 'Enter the state.', e);
      required('pin', 'Enter the PIN code.', e);
    }
    if (key === 'admin') {
      required('adminName', 'Enter the administrator’s name.', e);
      required('adminEmail', 'Enter the administrator’s email.', e);
      if (form.adminEmail && !isEmail(form.adminEmail)) e.adminEmail = 'That doesn’t look like an email address.';
      else if (form.adminEmail && form.adminEmail.trim().toLowerCase() === form.email.trim().toLowerCase()) {
        e.adminEmail = 'Use a different email from the hospital’s own email.';
      }
      required('adminPhone', 'Enter the administrator’s phone number.', e);
      required('designation', 'Choose a designation.', e);
    }
    if (key === 'security') {
      if (!isGoogle) {
        required('password', 'Choose a password.', e);
        if (!form.confirmPassword) e.confirmPassword = 'Type the password again.';
        else if (form.password !== form.confirmPassword) e.confirmPassword = 'The passwords don’t match.';
      }
      if (!termsAccepted) e.terms = 'Please confirm the declaration to continue.';
    }
    return e;
  };

  const submit = async () => {
    setStoredTheme(theme);
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_URL}/auth/signup/hospital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          password: isGoogle ? createGeneratedPassword() : form.password,
        }),
      });
      const data = await readJson(resp);
      if (!resp.ok) {
        const message = data?.error || data?.message || 'Registration failed';
        if (/admin/i.test(message) && /email/i.test(message)) { setStepIndex(2); setErrors({ adminEmail: message }); }
        else if (/email/i.test(message)) { setStepIndex(1); setErrors({ email: message }); }
        else notify(message);
        return false;
      }
      setRegisteredEmail(String(data?.email || form.email || '').toLowerCase());
      return true;
    } catch (err) {
      console.error('hospital signup error', err);
      notify('We couldn’t reach the server. Check your connection and try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const next = async () => {
    const e = validate(step.key);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step.key === 'security') {
      const ok = await submit();
      if (ok) setStepIndex(i => i + 1);
      return;
    }
    setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  };

  const copy: Record<StepKey, { title: string; lead: React.ReactNode }> = {
    hospital: { title: 'Tell us about your hospital.', lead: 'We check these details before your hospital can see any patient records.' },
    location: { title: 'Where can patients and our team reach you?', lead: 'The hospital email is your sign-in and where we send the verification code.' },
    admin: { title: 'Who looks after your G1Card account?', lead: 'This person manages access, staff and records for your hospital.' },
    documents: { title: 'Speed up verification.', lead: 'Optional. Have your licence or registration certificate handy? Add it here, or share it during review.' },
    security: isGoogle
      ? { title: 'Confirm and submit.', lead: 'You’ll sign in with Google, so there’s no password to set.' }
      : { title: 'Secure your account.', lead: 'Choose a password and confirm the details are accurate. We’ll then email a code to the hospital address.' },
    verify: { title: 'Check the hospital inbox.', lead: <>We sent a 6-digit code to <b style={{ color: 'var(--app-text)' }}>{registeredEmail || form.email}</b>. Enter it below, or paste it straight from the email.</> },
  };

  if (done) {
    return (
      <OnboardingShell
        railTitle="Register your hospital"
        railSub="Verified hospitals see a patient’s full history once the patient says yes."
        steps={STEPS}
        current={STEPS.length - 1}
        allDone
        kicker="Submitted for review"
        title={`Thanks, ${form.hospitalName || 'your hospital'} is registered.`}
        lead="A G1Card admin now verifies your details. Here’s what happens next."
        actions={
          <>
            <button type="button" className="ob-btn ob-btn--text" onClick={() => navigate('/')}>Back to home</button>
            <div className="ob-actions-right"><button type="button" className="ob-btn" onClick={() => navigate('/login')}>Go to sign in</button></div>
          </>
        }
      >
        <ol className="ob-next">
          <li><span>1</span><div><b>We review your registration</b>An admin checks your registration number, licence and contact details.</div></li>
          <li><span>2</span><div><b>You get an email</b>We write to {registeredEmail || form.email} as soon as your hospital is approved.</div></li>
          <li><span>3</span><div><b>Sign in and add patients</b>Request access to a patient’s records and start recording visits in your own forms.</div></li>
        </ol>
      </OnboardingShell>
    );
  }

  const isOptionalStep = step.key === 'documents';

  const content = (() => {
    switch (step.key) {
      case 'hospital':
        return (
          <>
            {!isGoogle ? (
              <>
                <div className="ob-google" ref={google.ref} />
                {!google.available && <p className="ob-hint" style={{ textAlign: 'center' }}>Google sign-up isn’t configured on this server.</p>}
                <div className="ob-divider">or register with email</div>
              </>
            ) : (
              <div className="ob-panel ob-panel--ok">Connected with Google as <b>{form.email}</b>. Registration and licence numbers can be added during review.</div>
            )}
            <TextField id="hospitalName" label="Hospital name" value={form.hospitalName} onChange={update('hospitalName')} error={errors.hospitalName} placeholder="e.g. Riverside Multispeciality Hospital" autoFocus={isGoogle} />
            <div className="ob-row">
              <TextField id="regNumber" label="Registration number" value={form.regNumber} onChange={update('regNumber')} error={errors.regNumber} placeholder="REG-2026-001" optional={isGoogle} />
              <TextField id="license" label="Healthcare licence number" value={form.license} onChange={update('license')} error={errors.license} placeholder="LIC-77881" optional={isGoogle} />
            </div>
          </>
        );
      case 'location':
        return (
          <>
            <div className="ob-row">
              <TextField id="email" label="Hospital email" type="email" value={form.email} onChange={update('email')} error={errors.email} readOnly={isGoogle} placeholder="contact@hospital.com" autoComplete="email" />
              <TextField id="phone" label="Hospital phone" type="tel" value={form.phone} onChange={update('phone')} error={errors.phone} placeholder="+91 98765 43210" />
            </div>
            <TextField id="address" label="Street address" value={form.address} onChange={update('address')} error={errors.address} placeholder="Building, street, area" autoComplete="street-address" />
            <div className="ob-row">
              <TextField id="city" label="City" value={form.city} onChange={update('city')} error={errors.city} autoComplete="address-level2" />
              <TextField id="state" label="State" value={form.state} onChange={update('state')} error={errors.state} autoComplete="address-level1" />
            </div>
            <div className="ob-row">
              <TextField id="pin" label="PIN code" value={form.pin} onChange={update('pin')} error={errors.pin} autoComplete="postal-code" />
              <TextField id="website" label="Website" type="url" value={form.website} onChange={update('website')} placeholder="https://" optional hint="Helps our team verify you faster." />
            </div>
          </>
        );
      case 'admin':
        return (
          <>
            <TextField id="adminName" label="Full name" value={form.adminName} onChange={update('adminName')} error={errors.adminName} placeholder="e.g. Dr. Ananya Rao" autoComplete="name" />
            <div className="ob-row">
              <TextField id="adminEmail" label="Their email" type="email" value={form.adminEmail} onChange={update('adminEmail')} error={errors.adminEmail} hint="Must be different from the hospital email." />
              <TextField id="adminPhone" label="Their phone" type="tel" value={form.adminPhone} onChange={update('adminPhone')} error={errors.adminPhone} />
            </div>
            <ChoiceField id="designation" label="Designation" options={DESIGNATIONS} value={form.designation} onChange={update('designation')} error={errors.designation} />
          </>
        );
      case 'documents':
        return (
          <>
            <FilePick id="licenseDoc" label="Healthcare licence" fileName={licenseDocName} onPick={setLicenseDocName} />
            <FilePick id="registrationDoc" label="Registration certificate" fileName={registrationDocName} onPick={setRegistrationDocName} />
            <p className="ob-hint">Files are only used to verify your hospital and are never shown to patients.</p>
          </>
        );
      case 'security':
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
            <div className="ob-panel">
              <b>{form.hospitalName || 'Your hospital'}</b> · {[form.city, form.state].filter(Boolean).join(', ') || 'Location not set'}<br />
              Administrator: {form.adminName || '—'} ({form.designation})
            </div>
            <ThemeChoice value={theme} onChange={setTheme} />
            <div>
              <label className="ob-check">
                <input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setErrors(prev => ({ ...prev, terms: undefined })); }} />
                <span>I agree to the G1Card terms and certify that the details above are accurate and that I’m authorised to register this hospital.</span>
              </label>
              {errors.terms && <p className="ob-error" style={{ marginTop: 6, marginLeft: 28 }}>{errors.terms}</p>}
            </div>
          </>
        );
      case 'verify':
        return <VerifyEmail role="Hospital" email={registeredEmail || form.email.toLowerCase()} onVerified={() => setDone(true)} />;
      default:
        return null;
    }
  })();

  return (
    <OnboardingShell
      railTitle="Register your hospital"
      railSub="Verified hospitals see a patient’s full history once the patient says yes. Takes about five minutes."
      steps={STEPS}
      current={stepIndex}
      kicker={`Step ${stepIndex + 1} of ${STEPS.length}${isOptionalStep ? ' · Optional' : ''}`}
      title={copy[step.key].title}
      lead={copy[step.key].lead}
      actions={step.key === 'verify' ? undefined : (
        <>
          <button
            type="button"
            className="ob-btn ob-btn--text"
            onClick={() => { setErrors({}); stepIndex > 0 ? setStepIndex(i => i - 1) : navigate('/get-started'); }}
            disabled={submitting}
          >
            ← Back
          </button>
          <div className="ob-actions-right">
            {isOptionalStep && !licenseDocName && !registrationDocName && (
              <button type="button" className="ob-btn ob-btn--ghost" onClick={() => setStepIndex(i => i + 1)}>Skip for now</button>
            )}
            <button type="button" className="ob-btn" onClick={next} disabled={submitting}>
              {submitting ? <><Spinner /> Submitting</> : step.key === 'security' ? 'Submit & verify email' : 'Continue'}
            </button>
          </div>
        </>
      )}
    >
      {step.key === 'verify' ? content : (
        <form onSubmit={e => { e.preventDefault(); next(); }} style={{ display: 'contents' }}>
          {content}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
    </OnboardingShell>
  );
};

export default HospitalRegistrationPage;
