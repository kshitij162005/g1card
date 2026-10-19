import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingShell } from '../../components/onboarding/Onboarding';
import VerifyEmail from '../../components/onboarding/VerifyEmail';

const STEPS = [
  { label: 'Your hospital', hint: 'Name, registration, licence' },
  { label: 'Location & contact' },
  { label: 'Administrator' },
  { label: 'Documents', hint: 'Optional' },
  { label: 'Security & declaration' },
  { label: 'Verify email', hint: '6-digit code' },
];

// Standalone verification page (e.g. when coming back to finish a registration)
const HospitalOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = String(location.state?.email || '').toLowerCase();
  const [done, setDone] = useState(false);
  const shell = { railTitle: 'Register your hospital', railSub: 'Verified hospitals see a patient’s full history once the patient says yes.', steps: STEPS, current: STEPS.length - 1 };

  if (!email) {
    return (
      <OnboardingShell
        {...shell}
        title="We lost track of your registration."
        lead="This page needs the hospital email you registered with. Start the registration again."
        actions={<div className="ob-actions-right"><button type="button" className="ob-btn" onClick={() => navigate('/hospital/register')}>Register a hospital</button></div>}
      >
        <span />
      </OnboardingShell>
    );
  }

  if (done) {
    return (
      <OnboardingShell
        {...shell}
        allDone
        kicker="Submitted for review"
        title="Your hospital is registered."
        lead="A G1Card admin now verifies your details. We’ll email you once you’re approved."
        actions={<div className="ob-actions-right"><button type="button" className="ob-btn" onClick={() => navigate('/login')}>Go to sign in</button></div>}
      >
        <span />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      {...shell}
      kicker={`Step ${STEPS.length} of ${STEPS.length}`}
      title="Check the hospital inbox."
      lead={<>We sent a 6-digit code to <b style={{ color: 'var(--app-text)' }}>{email}</b>.</>}
    >
      <VerifyEmail role="Hospital" email={email} onVerified={() => setDone(true)} onBack={() => navigate('/hospital/register')} />
    </OnboardingShell>
  );
};

export default HospitalOtpPage;
