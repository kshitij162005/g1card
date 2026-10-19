import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wordmark } from '../components/onboarding/Onboarding';

// "Get your G1Card": choose the patient or hospital sign-up
const GetStartedPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Get started · G1Card';
  }, []);

  return (
    <div className="gs">
      <header className="gs-top">
        <Wordmark />
        <button type="button" className="gs-top-link" onClick={() => navigate('/login')}>
          Already have an account? <b>Sign in</b>
        </button>
      </header>

      <main className="gs-body">
        <h1 className="gs-title">Who is the G1Card for?</h1>
        <p className="gs-lead">Patients and hospitals sign up differently. Pick the one that fits and we’ll take you through it step by step.</p>

        <div className="gs-options">
          <button type="button" className="gs-option" onClick={() => navigate('/patient/register')}>
            <span className="gs-option-kicker">For patients</span>
            <h2>I want my own medical record</h2>
            <p>Keep your history from every hospital in one place and decide who can see it.</p>
            <ul>
              <li>Name, email and phone number</li>
              <li>Health details are optional, add them now or later</li>
              <li>Or sign up with Google in two steps</li>
            </ul>
            <span className="gs-option-foot">
              <span>About 2 minutes</span>
              <strong>Create my G1Card →</strong>
            </span>
          </button>

          <button type="button" className="gs-option" onClick={() => navigate('/hospital/register')}>
            <span className="gs-option-kicker">For hospitals</span>
            <h2>I’m registering a hospital</h2>
            <p>Request patient records with consent and record visits in your own forms.</p>
            <ul>
              <li>Registration number and healthcare licence</li>
              <li>Address and an administrator’s contact details</li>
              <li>Reviewed by a G1Card admin before going live</li>
            </ul>
            <span className="gs-option-foot">
              <span>About 5 minutes</span>
              <strong>Register hospital →</strong>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default GetStartedPage;
