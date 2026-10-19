import React, { useEffect, useRef, useState } from 'react';
import { goHome } from '../../utils/home';
import { useNavigate } from 'react-router-dom';
import { ThemeMode, setStoredTheme } from '../../utils/theme';
import '../../src/onboarding.css';

/* ------------------------------------------------------------------------- */
/* Shell                                                                      */
/* ------------------------------------------------------------------------- */

export interface StepDef {
  label: string;
  hint?: string;
}

interface ShellProps {
  railTitle: string;
  railSub: string;
  steps: StepDef[];
  current: number;
  /** Mark every step as done (e.g. after submission) */
  allDone?: boolean;
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

// The G1Card logo reloads the current page everywhere in the app
export const Wordmark: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button type="button" className="g1-wordmark" onClick={onClick || goHome} title="Go to dashboard" aria-label="G1Card, reload page">
    G1Card
  </button>
);

export const OnboardingShell: React.FC<ShellProps> = ({ railTitle, railSub, steps, current, allDone, kicker, title, lead, children, actions }) => {
  const navigate = useNavigate();
  const progress = allDone ? 100 : Math.round(((current + 1) / steps.length) * 100);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [current]);

  return (
    <div className="ob">
      <aside className="ob-rail">
        <Wordmark />
        <h1 className="ob-rail-title">{railTitle}</h1>
        <p className="ob-rail-sub">{railSub}</p>
        <ol className="ob-steps">
          {steps.map((step, i) => {
            const state = allDone || i < current ? 'is-done' : i === current ? 'is-current' : '';
            return (
              <li key={step.label} className={`ob-step ${state}`} aria-current={i === current ? 'step' : undefined}>
                <span className="ob-step-dot">{state === 'is-done' ? '✓' : i + 1}</span>
                <span className="ob-step-label">
                  {step.label}
                  {step.hint && <small>{step.hint}</small>}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="ob-rail-foot">
          Already have an account? <button type="button" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </aside>

      <main className="ob-main">
        <div className="ob-topbar">
          <Wordmark />
          <span className="ob-topbar-step">{allDone ? 'Done' : `Step ${current + 1} of ${steps.length}`}</span>
        </div>
        <div className="ob-progress" aria-hidden><span style={{ width: `${progress}%` }} /></div>
        <div className="ob-body">
          {kicker && <p className="ob-kicker">{kicker}</p>}
          <h2 className="ob-title">{title}</h2>
          {lead && <p className="ob-lead">{lead}</p>}
          <div className="ob-content" key={current}>{children}</div>
          {actions && <div className="ob-actions">{actions}</div>}
        </div>
      </main>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Fields                                                                     */
/* ------------------------------------------------------------------------- */

interface FieldProps {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ id, label, optional, hint, error, children }) => (
  <div className={`ob-field ${error ? 'has-error' : ''}`}>
    <label className="ob-label" htmlFor={id}>
      {label}
      {optional && <em>Optional</em>}
    </label>
    {children}
    {error ? <p className="ob-error" role="alert">{error}</p> : hint ? <p className="ob-hint">{hint}</p> : null}
  </div>
);

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  readOnly?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({ id, label, value, onChange, type = 'text', placeholder, optional, hint, error, readOnly, autoComplete, autoFocus }) => {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const input = (
    <input
      id={id}
      className="ob-input"
      type={isPassword && reveal ? 'text' : type}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      aria-invalid={Boolean(error)}
      onChange={e => onChange(e.target.value)}
    />
  );
  return (
    <Field id={id} label={label} optional={optional} hint={hint} error={error}>
      {isPassword ? (
        <div className="ob-input-wrap">
          {input}
          <button type="button" className="ob-input-action" onClick={() => setReveal(r => !r)}>{reveal ? 'Hide' : 'Show'}</button>
        </div>
      ) : input}
    </Field>
  );
};

export const TextAreaField: React.FC<Omit<TextFieldProps, 'type'>> = ({ id, label, value, onChange, placeholder, optional, hint, error }) => (
  <Field id={id} label={label} optional={optional} hint={hint} error={error}>
    <textarea id={id} className="ob-textarea" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  </Field>
);

export const ChoiceField: React.FC<{ id: string; label: string; options: string[]; value: string; onChange: (v: string) => void; optional?: boolean; error?: string }> = ({ id, label, options, value, onChange, optional, error }) => (
  <Field id={id} label={label} optional={optional} error={error}>
    <div className="ob-chips" role="radiogroup" aria-labelledby={id}>
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`ob-chip ${value === option ? 'is-selected' : ''}`}
          onClick={() => onChange(value === option && optional ? '' : option)}
        >
          {option}
        </button>
      ))}
    </div>
  </Field>
);

/** Comma-separated value edited as chips: type and press Enter or comma */
export const TagField: React.FC<{ id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; optional?: boolean }> = ({ id, label, value, onChange, placeholder, hint, optional }) => {
  const [draft, setDraft] = useState('');
  const tags = value.split(',').map(t => t.trim()).filter(Boolean);
  const commit = (text: string) => {
    const next = text.trim().replace(/,$/, '');
    if (!next || tags.some(t => t.toLowerCase() === next.toLowerCase())) { setDraft(''); return; }
    onChange([...tags, next].join(', '));
    setDraft('');
  };
  const remove = (index: number) => onChange(tags.filter((_, i) => i !== index).join(', '));
  return (
    <Field id={id} label={label} optional={optional} hint={hint}>
      <div className="ob-tags" onClick={() => document.getElementById(id)?.focus()}>
        {tags.map((tag, i) => (
          <span key={tag} className="ob-tag">
            {tag}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${tag}`}>×</button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={tags.length ? '' : placeholder}
          onChange={e => (e.target.value.endsWith(',') ? commit(e.target.value) : setDraft(e.target.value))}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
            if (e.key === 'Backspace' && !draft && tags.length) remove(tags.length - 1);
          }}
          onBlur={() => draft && commit(draft)}
        />
      </div>
    </Field>
  );
};

export function passwordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
  return Math.max(1, score);
}

export const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const score = passwordScore(password);
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  if (!password) return null;
  return (
    <div>
      <div className={`ob-strength s${score}`} aria-hidden><i /><i /><i /><i /></div>
      <p className="ob-hint" style={{ marginTop: 6 }}>Password strength: {label}. Longer passwords with numbers and symbols are stronger.</p>
    </div>
  );
};

export const ThemeChoice: React.FC<{ value: ThemeMode; onChange: (v: ThemeMode) => void }> = ({ value, onChange }) => (
  <ChoiceField
    id="theme"
    label="Appearance"
    options={['Light', 'Dark']}
    value={value === 'dark' ? 'Dark' : 'Light'}
    onChange={v => {
      const mode: ThemeMode = v === 'Dark' ? 'dark' : 'light';
      setStoredTheme(mode);
      onChange(mode);
    }}
  />
);

export const FilePick: React.FC<{ id: string; label: string; fileName: string; onPick: (name: string) => void }> = ({ id, label, fileName, onPick }) => (
  <Field id={id} label={label} optional>
    <label className="ob-file" htmlFor={id}>
      <span>{fileName || 'PDF or image, up to 10 MB'}</span>
      <b>{fileName ? 'Replace' : 'Choose file'}</b>
      <input id={id} type="file" accept=".pdf,image/*" onChange={e => onPick(e.target.files?.[0]?.name || '')} />
    </label>
  </Field>
);

/* ------------------------------------------------------------------------- */
/* Email code                                                                 */
/* ------------------------------------------------------------------------- */

export const OtpInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; onComplete?: (code: string) => void; disabled?: boolean }> = ({ value, onChange, onComplete, disabled }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);

  const setAt = (index: number, digit: string) => {
    const next = value.map((d, i) => (i === index ? digit : d));
    onChange(next);
    if (digit && index < value.length - 1) refs.current[index + 1]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(''));
  };

  return (
    <div className="ob-otp" onPaste={e => {
      const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, value.length).split('');
      if (!digits.length) return;
      e.preventDefault();
      const next = value.map((_, i) => digits[i] || '');
      onChange(next);
      refs.current[Math.min(digits.length, value.length - 1)]?.focus();
      if (next.every(Boolean)) onComplete?.(next.join(''));
    }}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          onFocus={e => e.target.select()}
          onChange={e => {
            const d = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(i, d);
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < value.length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
};

/** Countdown that re-arms whenever `armKey` changes */
export function useCountdown(seconds: number, armKey: unknown = 0) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = window.setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [seconds, armKey]);
  return left;
}

export const Spinner: React.FC = () => <span className="ob-spinner" aria-hidden />;

/* ------------------------------------------------------------------------- */
/* Google sign-up                                                             */
/* ------------------------------------------------------------------------- */

export interface GoogleProfile {
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

function parseGoogleCredential(credential: string): GoogleProfile | null {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = payload.length % 4;
    return JSON.parse(atob(padding ? payload + '='.repeat(4 - padding) : payload));
  } catch {
    return null;
  }
}

/** Renders the Google "Sign up with" button into the returned ref */
export function useGoogleSignup(onProfile: (profile: GoogleProfile) => void, enabled = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(Boolean(window.google?.accounts?.id));
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const callbackRef = useRef(onProfile);
  callbackRef.current = onProfile;

  useEffect(() => {
    if (window.google?.accounts?.id) { setReady(true); return; }
    const scriptId = 'google-identity-services-sdk';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => setReady(true), { once: true }); return; }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    el.innerHTML = '';
    if (!clientId || !ready || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        const profile = response?.credential ? parseGoogleCredential(response.credential) : null;
        if (!profile?.email) {
          notify('Could not read your Google account. Please try again.');
          return;
        }
        callbackRef.current(profile);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', width: Math.min(el.offsetWidth || 360, 400), text: 'signup_with' });
  }, [clientId, ready, enabled]);

  return { ref, available: Boolean(clientId) };
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
