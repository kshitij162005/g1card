import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingShell } from '../../components/onboarding/Onboarding';
import VerifyEmail from '../../components/onboarding/VerifyEmail';

const MANUAL_STEPS = [
  { label: 'Your account', hint: 'Name, email, phone' },
  { label: 'About you', hint: 'Optional' },
  { label: 'Contact & emergency', hint: 'Optional' },
  { label: 'Health snapshot', hint: 'Optional' },
  { label: 'Password & consent' },
  { label: 'Verify email', hint: '6-digit code' },
];
const GOOGLE_STEPS = [
  { label: 'Your account', hint: 'From Google' },
  { label: 'Consent' },
  { label: 'Verify email', hint: '6-digit code' },
];

const PatientOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = String(location.state?.email || '').toLowerCase();
  const name = String(location.state?.name || '');
  const steps = location.state?.flow === 'google' ? GOOGLE_STEPS : MANUAL_STEPS;
  const [done, setDone] = useState(false);

  if (!email) {
    return (
      <OnboardingShell
        railTitle="Create your G1Card"
        railSub="Your records from every hospital, in one place."
        steps={steps}
        current={steps.length - 1}
        title="We lost track of your sign-up."
        lead="This page needs the email you signed up with. Start again and it’ll only take a minute."
        actions={<div className="ob-actions-right"><button type="button" className="ob-btn" onClick={() => navigate('/patient/register')}>Start sign-up</button></div>}
      >
        <span />
      </OnboardingShell>
    );
  }

  if (done) {
    return (
      <OnboardingShell
        railTitle="Create your G1Card"
        railSub="Your records from every hospital, in one place."
        steps={steps}
        current={steps.length - 1}
        allDone
        kicker="All set"
        title={`Welcome to G1Card${name ? `, ${name}` : ''}.`}
        lead="Your account is ready. Here’s what happens from here."
        actions={<div className="ob-actions-right"><button type="button" className="ob-btn" onClick={() => navigate('/login')}>Sign in</button></div>}
      >
        <ol className="ob-next">
          <li><span>1</span><div><b>Sign in</b>{location.state?.flow === 'google' ? 'with the “Continue with Google” button on the sign-in page.' : 'with the email and password you just set up.'}</div></li>
          <li><span>2</span><div><b>Hospitals ask for access</b>You’ll get a notification each time, and nothing is shared until you approve.</div></li>
          <li><span>3</span><div><b>Your records collect in one place</b>Every visit at an approved hospital shows up on your timeline, ready to download.</div></li>
        </ol>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      railTitle="Create your G1Card"
      railSub="Your records from every hospital, in one place, shared only with hospitals you approve."
      steps={steps}
      current={steps.length - 1}
      kicker={`Step ${steps.length} of ${steps.length}`}
      title="Check your inbox."
      lead={<>We sent a 6-digit code to <b style={{ color: 'var(--app-text)' }}>{email}</b>. Enter it below, or paste it straight from the email.</>}
    >
      <VerifyEmail role="Patient" email={email} onVerified={() => setDone(true)} onBack={() => navigate('/patient/register')} />
    </OnboardingShell>
  );
};

export default PatientOtpPage;
