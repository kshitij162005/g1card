import React, { useState } from 'react';
import { API_URL } from '../../config/api';
import { OtpInput, Spinner, useCountdown } from './Onboarding';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

async function readJson(resp: Response) {
  const type = resp.headers.get('content-type') || '';
  if (type.includes('application/json')) return resp.json();
  const text = await resp.text();
  return { error: text?.slice(0, 200) || `HTTP ${resp.status}` };
}

interface VerifyEmailProps {
  role: 'Patient' | 'Hospital';
  email: string;
  onVerified: () => void;
  onBack?: () => void;
}

/** 6-digit email code entry with paste support, auto-submit and resend cooldown */
const VerifyEmail: React.FC<VerifyEmailProps> = ({ role, email, onVerified, onBack }) => {
  const [code, setCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendKey, setResendKey] = useState(0);
  const secondsLeft = useCountdown(RESEND_SECONDS, resendKey);

  const verify = async (value = code.join('')) => {
    if (value.length !== OTP_LENGTH) {
      setError('Enter all 6 digits from the email.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/auth/otp/verify-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email, otp: value }),
      });
      const data = await readJson(resp);
      if (!resp.ok) {
        setError(data?.error || data?.message || 'That code didn’t work. Check the email and try again.');
        setCode(new Array(OTP_LENGTH).fill(''));
        return;
      }
      onVerified();
    } catch {
      setError('We couldn’t reach the server. Try again in a moment.');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/auth/otp/resend-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email }),
      });
      const data = await readJson(resp);
      if (!resp.ok) {
        setError(data?.error || data?.message || 'Couldn’t send a new code.');
        return;
      }
      setResendKey(k => k + 1);
      setCode(new Array(OTP_LENGTH).fill(''));
      notify('A new code is on its way.');
    } catch {
      setError('We couldn’t reach the server. Try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <OtpInput value={code} onChange={v => { setCode(v); setError(''); }} onComplete={verify} disabled={verifying} />
      {error && <p className="ob-error" role="alert">{error}</p>}
      <p className="ob-resend">
        Didn’t get it? Check spam, or{' '}
        <button type="button" onClick={resend} disabled={secondsLeft > 0 || resending}>
          {resending ? 'sending…' : secondsLeft > 0 ? `resend in ${secondsLeft}s` : 'send a new code'}
        </button>
      </p>
      <div className="ob-actions">
        {onBack && <button type="button" className="ob-btn ob-btn--text" onClick={onBack} disabled={verifying}>← Back</button>}
        <div className="ob-actions-right">
          <button type="button" className="ob-btn" onClick={() => verify()} disabled={verifying}>
            {verifying ? <><Spinner /> Verifying</> : 'Verify email'}
          </button>
        </div>
      </div>
    </>
  );
};

export default VerifyEmail;
