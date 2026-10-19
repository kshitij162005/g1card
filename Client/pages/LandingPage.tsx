import React, { useEffect, useRef, useState } from 'react';
import { goHome } from '../utils/home';
import { useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import '../src/landing.css';
import { ThemeMode, applyTheme, setStoredTheme } from '../utils/theme';

// Public landing page. All people, hospitals and ids shown in the product views are fictional.

/* ------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* ------------------------------------------------------------------------- */

const Cite: React.FC<{ n: number; active?: boolean }> = ({ n, active }) => (
  <span className={`lp-cite ${active ? 'is-active' : ''}`}>{n}</span>
);

const Window: React.FC<{ url: string; children: React.ReactNode; className?: string }> = ({ url, children, className = '' }) => (
  <div className={`lp-window ${className}`}>
    <div className="lp-window-bar">
      <span className="lp-window-dots" aria-hidden><i /><i /><i /></span>
      <span className="lp-window-url">{url}</span>
    </div>
    <div className="lp-window-body">{children}</div>
  </div>
);

const Check: React.FC = () => (
  <svg className="lp-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Product screen that lies tilted back in 3D and rises upright, top edge first, as it scrolls into view */
const Media: React.FC<{ children: React.ReactNode; hero?: boolean }> = ({ children, hero }) => (
  <div className="lp-media" data-tilt={hero ? 'hero' : 'section'}>
    <div className="lp-media-reveal">{children}</div>
  </div>
);

/* ------------------------------------------------------------------------- */
/* Product views (recreations of real G1Card screens with sample data)        */
/* ------------------------------------------------------------------------- */

const HospitalRecordView: React.FC = () => (
  <Window url="g1card.vercel.app/hospital/patients/meera-iyer" className="lp-hero-window">
    <div className="lp-app">
      <div className="lp-app-main">
        <div className="lp-patient">
          <span className="lp-avatar">MI</span>
          <div>
            <p className="lp-patient-name">Meera Iyer</p>
            <p className="lp-patient-meta">34 · Female · O+ · P1760432118204</p>
          </div>
        </div>
        <div className="lp-tags">
          <span className="lp-tag lp-tag--bad">Allergy: Penicillin</span>
          <span className="lp-tag lp-tag--ok">Complete access</span>
        </div>
        <div className="lp-tabs"><span>Overview</span><span className="is-active">Records</span></div>
        <ul className="lp-records">
          <li><b>Prescription</b><span>Riverside Hospital · 12 Aug 2026</span></li>
          <li className="is-cited"><b>Blood test</b><span>Northgate Diagnostics · 30 Jul 2026</span></li>
          <li><b>Diabetes follow-up</b><span>Riverside Hospital · 2 Mar 2026</span></li>
          <li><b>Discharge summary</b><span>Sunrise Clinic · 18 Nov 2025</span></li>
        </ul>
      </div>

      <div className="lp-app-side">
        <div className="lp-summary-head">
          <p className="lp-summary-title">AI summary</p>
          <p className="lp-summary-sub">4 records · 12 Aug, 10:42 am</p>
        </div>
        <p className="lp-summary-text">
          34-year-old woman with type 2 diabetes on metformin. Sugar control has slipped since March. <Cite n={2} /> <Cite n={3} />
        </p>
        <div className="lp-alert">
          <p className="lp-label lp-label--bad">Needs attention</p>
          <p>Penicillin allergy, rash in Nov 2025 <Cite n={1} /></p>
        </div>
        <p className="lp-label">Medications</p>
        <ul className="lp-dots">
          <li>Metformin 500 mg twice daily <Cite n={4} /></li>
          <li>Atorvastatin 10 mg at night <Cite n={4} /></li>
        </ul>
        <p className="lp-label">Key findings</p>
        <ul className="lp-dots">
          <li>HbA1c 7.9% on 30 Jul, up from 7.1% <Cite n={2} active /> <Cite n={3} /></li>
        </ul>
        <div className="lp-evidence">
          <p className="lp-label">Evidence</p>
          <ol>
            <li><span>1</span>Discharge summary · Sunrise Clinic</li>
            <li className="is-active"><span>2</span>Blood test · Northgate Diagnostics</li>
            <li><span>3</span>Diabetes follow-up · Riverside Hospital</li>
            <li><span>4</span>Prescription · Riverside Hospital</li>
          </ol>
        </div>
      </div>
    </div>
  </Window>
);

const PatientPhoneView: React.FC = () => (
  <div className="lp-phone" aria-label="Patient app showing an access request">
    <div className="lp-phone-notch" aria-hidden />
    <div className="lp-phone-screen">
      <p className="lp-phone-hello">Hi, Meera</p>
      <div className="lp-request">
        <p className="lp-request-title">Riverside Hospital is asking to see your records</p>
        <p className="lp-request-sub">Complete history · 2 min ago</p>
        <div className="lp-request-actions">
          <span className="lp-btn-mini lp-btn-mini--dark">Approve</span>
          <span className="lp-btn-mini">Deny</span>
        </div>
      </div>
      <p className="lp-phone-section">Your timeline</p>
      <ul className="lp-timeline">
        <li><i /><div><b>Prescription</b><span>Riverside Hospital · 12 Aug</span></div><em>PDF</em></li>
        <li><i /><div><b>Blood test</b><span>Northgate Diagnostics · 30 Jul</span></div><em>PDF</em></li>
        <li><i /><div><b>Diabetes follow-up</b><span>Riverside Hospital · 2 Mar</span></div><em>PDF</em></li>
        <li><i /><div><b>Discharge summary</b><span>Sunrise Clinic · 18 Nov 2025</span></div><em>PDF</em></li>
      </ul>
      <p className="lp-phone-section">Who can see your records</p>
      <ul className="lp-access">
        <li><span>Sunrise Clinic</span><em className="lp-tag lp-tag--ok">Complete</em></li>
        <li><span>Northgate Diagnostics</span><em className="lp-tag">General</em></li>
      </ul>
    </div>
  </div>
);

const FormBuilderView: React.FC = () => (
  <Window url="g1card.vercel.app/hospital/forms/create">
    <div className="lp-builder">
      <div className="lp-palette">
        <p className="lp-label">Add a field</p>
        {['Short text', 'Paragraph', 'Number', 'Date', 'Dropdown', 'Multiple choice', 'File upload', 'Section'].map(f => (
          <span key={f} className="lp-palette-item">{f}</span>
        ))}
      </div>
      <div className="lp-form">
        <p className="lp-form-title">Diabetes follow-up</p>
        <p className="lp-form-sub">Riverside Hospital · Endocrinology</p>
        <label>HbA1c (%)<span className="lp-input">7.9</span></label>
        <label>Fasting glucose (mg/dL)<span className="lp-input">148</span></label>
        <label>Medication changes<span className="lp-input lp-input--tall">Continue metformin 500 mg BD. Review diet plan.</span></label>
        <label>Lab report<span className="lp-input lp-input--file">hba1c-30-jul.pdf</span></label>
        <div className="lp-form-foot"><span className="lp-btn-mini lp-btn-mini--brand">Save record</span></div>
      </div>
    </div>
  </Window>
);

const GoluView: React.FC = () => (
  <Window url="g1card.vercel.app/admin · Golu">
    <div className="lp-chat">
      <div className="lp-chat-user">Which hospital added the most records this month?</div>
      <div className="lp-chat-answer">
        <p><b>Riverside Hospital</b> added the most records this month: 42, ahead of Northgate Diagnostics with 31.</p>
        <div className="lp-chat-evidence">
          <p className="lp-label">Evidence (from the live database)</p>
          <p>Medical records per hospital: 3 result rows</p>
          <p className="lp-mono">Riverside Hospital · records: 42</p>
          <p className="lp-mono">Northgate Diagnostics · records: 31</p>
          <p className="lp-mono">Sunrise Clinic · records: 17</p>
        </div>
        <p className="lp-chat-model">Groq · gpt-oss-120b</p>
      </div>
      <div className="lp-chat-input">Ask anything<span className="lp-chat-send" aria-hidden>↑</span></div>
    </div>
  </Window>
);

const AuditView: React.FC = () => {
  const rows = [
    ['10:42', 'PHI_VIEWED', 'Dr. A. Kulkarni', 'Meera Iyer'],
    ['10:40', 'ACCESS_REQUEST_APPROVED', 'Meera Iyer', 'Riverside Hospital'],
    ['10:38', 'ACCESS_REQUEST_CREATED', 'Riverside Hospital', 'Meera Iyer'],
    ['09:15', 'RECORD_CREATED', 'Northgate Diagnostics', 'Blood test'],
    ['09:02', 'PHI_DOWNLOADED', 'Meera Iyer', 'Prescription'],
  ];
  return (
    <Window url="g1card.vercel.app/admin/logs">
      <table className="lp-audit">
        <thead><tr><th>Time</th><th>Event</th><th>By</th><th>On</th></tr></thead>
        <tbody>
          {rows.map(([t, e, by, on]) => (
            <tr key={t + e}>
              <td className="lp-mono">{t}</td>
              <td><span className={`lp-event ${e.startsWith('PHI') ? 'lp-event--phi' : ''}`}>{e}</span></td>
              <td>{by}</td>
              <td>{on}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Window>
  );
};

/* ------------------------------------------------------------------------- */
/* Workflow                                                                    */
/* ------------------------------------------------------------------------- */

type Lane = 'patient' | 'hospital' | 'g1card';
const STEPS: Array<{ title: string; cells: Partial<Record<Lane, string>> }> = [
  {
    title: 'A hospital joins',
    cells: {
      hospital: 'Registers with its registration number, licence and admin contact.',
      g1card: 'An admin checks the details and approves it. Until then it can’t see any patient.',
    },
  },
  {
    title: 'A patient signs up',
    cells: {
      patient: 'Creates an account with email (verified by a one-time code) or Google, and gets a G1Card ID.',
    },
  },
  {
    title: 'The hospital asks',
    cells: {
      hospital: 'Finds the patient and requests General access (its own records) or Complete access (full history).',
      patient: 'Gets a notification and approves or denies. Access can be revoked later from settings.',
    },
  },
  {
    title: 'The visit is recorded',
    cells: {
      hospital: 'Doctors fill in the hospital’s own forms: prescriptions, lab values, notes, files.',
      patient: 'The record shows up on their timeline the same day and can be downloaded as a PDF.',
    },
  },
  {
    title: 'The next visit is easier',
    cells: {
      hospital: 'Any approved hospital sees the whole history, with an AI summary that points to its sources.',
      g1card: 'Every view, download and change goes into the audit log.',
    },
  },
];
const LANES: Array<{ key: Lane; label: string }> = [
  { key: 'hospital', label: 'Hospital' },
  { key: 'patient', label: 'Patient' },
  { key: 'g1card', label: 'G1Card admin' },
];

const Workflow: React.FC = () => (
  <div className="lp-lanes" role="table" aria-label="How G1Card works, step by step">
    <div className="lp-lanes-head" role="row">
      <span role="columnheader" className="lp-lanes-step-head">Step</span>
      {LANES.map(l => <span role="columnheader" key={l.key}>{l.label}</span>)}
    </div>
    {STEPS.map((step, i) => (
      <div className="lp-lanes-row lp-reveal" role="row" key={step.title}>
        <div className="lp-lanes-step" role="rowheader">
          <span className="lp-lanes-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="lp-lanes-title">{step.title}</span>
        </div>
        {LANES.map(l => (
          <div key={l.key} role="cell" className={`lp-lanes-cell ${step.cells[l.key] ? 'has-text' : ''}`}>
            {step.cells[l.key] && (
              <>
                <span className="lp-lanes-role">{l.label}</span>
                <p>{step.cells[l.key]}</p>
              </>
            )}
          </div>
        ))}
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------------- */
/* Page                                                                        */
/* ------------------------------------------------------------------------- */

const FAQ = [
  {
    q: 'Can a hospital see my records without asking?',
    a: 'No. A hospital has to send a request, and you approve it. With General access it only sees the records it created; with Complete access it sees your full history. You can revoke either from your settings.',
  },
  {
    q: 'What happens when I revoke access?',
    a: 'The hospital loses access straight away. Anything it looked at before stays in the audit log, so there is always a record of who saw what and when.',
  },
  {
    q: 'Does the AI make medical decisions?',
    a: 'No. It summarises what is already in the records and numbers every point so a doctor can open the source. The doctor reads, checks and decides.',
  },
  {
    q: 'Do hospitals have to change how they write records?',
    a: 'Not much. Each hospital builds its own forms in G1Card with the fields it already uses, from lab values to file uploads, and fills those in during the visit.',
  },
  {
    q: 'Which hospitals can join?',
    a: 'Any hospital can register. It only goes live after a G1Card admin has verified its registration details.',
  },
  {
    q: 'Can I delete my data?',
    a: 'Yes. You can ask for your records or your whole account to be deleted from your settings. An admin reviews the request and you get notified of the outcome.',
  },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Dark by default on first visit; afterwards the visitor's choice (shared with the app) wins
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // storage unavailable
    }
    return 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      if (!localStorage.getItem('theme')) localStorage.setItem('theme', theme);
    } catch {
      // storage unavailable: the page still renders in the chosen theme
    }
  }, [theme]);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    setTheme(next);
  };

  // Hash routing owns the URL, so in-page links scroll programmatically instead of using #anchors
  const goTo = (id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, duration: 1.6 });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Gentle reveal on scroll; content stays visible if this never runs
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.classList.add('lp-animate');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.lp-reveal, .lp-media-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Smooth, slightly slower scrolling, and product screens that rise upright in 3D as they scroll in
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const lenis = reduced ? null : new Lenis({
      // A heavier, slower glide: each wheel/trackpad input travels less and settles more gradually
      lerp: 0.075,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.1,
    });
    lenisRef.current = lenis;

    const items = (Array.from(root.querySelectorAll('[data-tilt]')) as HTMLElement[]).map(el => ({
      el,
      inner: el.firstElementChild as HTMLElement,
      hero: el.dataset.tilt === 'hero',
      // Current (smoothed) progress, 0 = lying back, 1 = standing upright
      p: el.dataset.tilt === 'hero' ? 0 : -1,
    }));
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const applyTilt = () => {
      if (reduced) return;
      const vh = window.innerHeight;
      const mobile = window.innerWidth < 768;
      for (const item of items) {
        const { el, inner, hero } = item;
        const rect = el.getBoundingClientRect();
        // Hero: starts lying back on load and stands up over the first ~70% of a screen of scrolling.
        // Sections: lie back while entering from the bottom, fully upright once their top reaches ~20% of the screen.
        const target = hero
          ? clamp(window.scrollY / (vh * 0.7))
          : clamp((vh - rect.top) / (vh * 0.8));
        // Damped follow so the screen eases into place instead of snapping with every scroll tick
        item.p = item.p < 0 ? target : item.p + (target - item.p) * 0.16;
        if (Math.abs(target - item.p) < 0.0005) item.p = target;
        if (rect.bottom < -200 || rect.top > vh + 200) continue;

        const e = easeOut(item.p);
        const maxAngle = hero ? (mobile ? 16 : 28) : (mobile ? 22 : 38);
        const angle = (1 - e) * maxAngle;
        const lift = (1 - e) * (mobile ? 40 : 90);
        const scale = (hero ? 0.94 : 0.9) + (hero ? 0.06 : 0.1) * e;
        inner.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0) rotateX(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        inner.style.setProperty('--lift', e.toFixed(3));
        if (!hero) inner.style.opacity = (0.35 + 0.65 * clamp(e * 1.4)).toFixed(3);
      }
    };

    let frame = 0;
    const loop = (time: number) => {
      lenis?.raf(time);
      applyTilt();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      lenisRef.current = null;
      items.forEach(({ inner }) => { inner.style.transform = ''; inner.style.opacity = ''; });
    };
  }, []);

  useEffect(() => {
    document.title = 'G1Card · One medical history, every hospital';
  }, []);

  const nav = [
    ['how', 'How it works'],
    ['patients', 'Patients'],
    ['hospitals', 'Hospitals'],
    ['ai', 'AI'],
    ['trust', 'Privacy'],
    ['faq', 'FAQ'],
  ];

  return (
    <div className="lp" ref={rootRef}>
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-container lp-nav-inner">
          <button type="button" className="g1-wordmark" onClick={goHome} title="Go to dashboard">
            G1Card
          </button>
          <nav className={`lp-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Sections">
            {nav.map(([id, label]) => (
              <button key={id} type="button" onClick={() => goTo(id)}>{label}</button>
            ))}
            <button type="button" className="lp-nav-signin-mobile" onClick={() => navigate('/login')}>Sign in</button>
          </nav>
          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-theme"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
                </svg>
              )}
            </button>
            <button type="button" className="lp-link" onClick={() => navigate('/login')}>Sign in</button>
            <button type="button" className="lp-btn lp-btn--small" onClick={() => navigate('/get-started')}>Get your G1Card</button>
            <button type="button" className="lp-menu" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-label="Menu">
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-container">
            <p className="lp-eyebrow">Medical records that follow the patient</p>
            <h1 className="lp-h1">
              One medical history.<br />
              <em>Every hospital you visit.</em>
            </h1>
            <div className="lp-hero-row">
              <p className="lp-lead">
                G1Card keeps prescriptions, test results and visit notes from every hospital in one record that belongs to the patient.
                A hospital asks for access, the patient says yes, and the doctor sees the whole history — with every view written to an audit log.
              </p>
              <div className="lp-hero-ctas">
                <button type="button" className="lp-btn" onClick={() => navigate('/patient/register')}>Create a patient account</button>
                <button type="button" className="lp-btn lp-btn--ghost" onClick={() => navigate('/hospital/register')}>Register a hospital</button>
              </div>
            </div>
          </div>

          <div className="lp-container lp-hero-shot">
            <Media hero><HospitalRecordView /></Media>
            <p className="lp-note lp-note--hero">
              <span className="lp-note-line" aria-hidden />
              Every line of the summary is numbered. Click a number and the record it came from opens.
            </p>
          </div>

          <div className="lp-container">
            <ul className="lp-facts">
              <li><b>Consent first.</b> No hospital sees a record until the patient approves.</li>
              <li><b>Logged.</b> Views, downloads and edits go into an audit trail.</li>
              <li><b>Your forms.</b> Hospitals record visits in forms they design.</li>
              <li><b>Sourced AI.</b> Summaries cite the exact record behind each point.</li>
            </ul>
          </div>
        </section>

        {/* Problem */}
        <section className="lp-section lp-problem">
          <div className="lp-container lp-split">
            <p className="lp-kicker">Why this exists</p>
            <div>
              <p className="lp-big">
                A discharge summary in a drawer. A prescription on WhatsApp. Lab reports in three different hospital systems.
              </p>
              <p className="lp-body">
                Most people’s medical history is scattered like this. So every new doctor starts from zero, tests get repeated, and things like a
                penicillin allergy depend on the patient remembering to mention it. G1Card does the unglamorous part: it puts the right records in
                front of the right doctor, with the patient’s permission.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="lp-section" id="how">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-kicker">01 — How it works</p>
              <h2 className="lp-h2">Three people, one record, five steps.</h2>
              <p className="lp-body">Read across to see who does what. Nothing moves between hospitals without the patient in the middle.</p>
            </div>
            <Workflow />
          </div>
        </section>

        {/* Patients */}
        <section className="lp-section lp-section--tint" id="patients">
          <div className="lp-container lp-feature">
            <div className="lp-feature-text">
              <p className="lp-kicker">02 — For patients</p>
              <h2 className="lp-h2">Your history, and your say over who reads it.</h2>
              <ul className="lp-list">
                <li><Check /><span><b>One timeline</b> of records from every hospital you’ve visited, newest first.</span></li>
                <li><Check /><span><b>Approve, deny or revoke</b> each hospital’s access, and choose General or Complete.</span></li>
                <li><Check /><span><b>Download</b> any record as a PDF, or everything from one hospital at once.</span></li>
                <li><Check /><span><b>Email alerts</b> when a hospital opens your records or adds a new prescription. You pick which.</span></li>
                <li><Check /><span><b>Delete on request.</b> Ask for your data or your account to be removed.</span></li>
              </ul>
              <button type="button" className="lp-btn" onClick={() => navigate('/patient/register')}>Create a patient account</button>
            </div>
            <div className="lp-feature-visual">
              <Media><PatientPhoneView /></Media>
            </div>
          </div>
        </section>

        {/* Hospitals */}
        <section className="lp-section" id="hospitals">
          <div className="lp-container lp-feature lp-feature--flip">
            <div className="lp-feature-text">
              <p className="lp-kicker">03 — For hospitals</p>
              <h2 className="lp-h2">Record visits your way. See the rest when you’re allowed to.</h2>
              <ul className="lp-list">
                <li><Check /><span><b>A form builder</b> with text, numbers, dates, dropdowns, choices, file uploads, sections and page breaks.</span></li>
                <li><Check /><span><b>Add patients</b> and request access to their records in a couple of clicks.</span></li>
                <li><Check /><span><b>Full history</b> from other hospitals once the patient grants Complete access.</span></li>
                <li><Check /><span><b>Live notifications</b> when patients approve, deny or revoke.</span></li>
                <li><Check /><span><b>Your own audit log</b> of every record your team opened or changed.</span></li>
              </ul>
              <button type="button" className="lp-btn" onClick={() => navigate('/hospital/register')}>Register a hospital</button>
            </div>
            <div className="lp-feature-visual">
              <Media><FormBuilderView /></Media>
            </div>
          </div>
        </section>

        {/* AI */}
        <section className="lp-section lp-section--ink" id="ai">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-kicker">04 — AI that shows its work</p>
              <h2 className="lp-h2">If it can’t point to the record, it doesn’t say it.</h2>
              <p className="lp-body">
                We don’t trust AI that can’t say where it got something, so neither feature in G1Card is allowed to. Both only read; neither can change a record.
              </p>
            </div>
            <div className="lp-ai-grid">
              <div className="lp-ai-card lp-reveal">
                <p className="lp-ai-label">For doctors</p>
                <h3 className="lp-h3">AI summary of a patient</h3>
                <p className="lp-body">
                  Allergies, medications, conditions, procedures and a dated timeline, pulled from every record the hospital is allowed to see.
                  Each point is numbered, and the number opens the prescription or report it came from. Citations are checked on our server, so the
                  model can’t invent a source.
                </p>
              </div>
              <div className="lp-ai-card lp-reveal">
                <p className="lp-ai-label">For G1Card admins</p>
                <h3 className="lp-h3">Golu, the admin assistant</h3>
                <p className="lp-body">
                  Ask in plain English: “who was our first patient?”, “which hospital is she linked to?”. Golu turns the question into a read-only
                  query, answers from the live data and lists the exact records as evidence. It remembers the conversation, and runs on several AI
                  providers so it keeps working when one is down.
                </p>
              </div>
            </div>
            <div className="lp-ai-shot">
              <Media><GoluView /></Media>
              <ol className="lp-ai-notes">
                <li><span>1</span><p><b>The answer comes first,</b> in plain language, with the numbers that matter.</p></li>
                <li><span>2</span><p><b>Evidence is built from the query results,</b> not written by the model, so every row is real.</p></li>
                <li><span>3</span><p><b>You always see which model answered.</b> Pick one before a chat starts, or leave it on Auto.</p></li>
              </ol>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="lp-section" id="trust">
          <div className="lp-container lp-feature">
            <div className="lp-feature-text">
              <p className="lp-kicker">05 — Privacy and accountability</p>
              <h2 className="lp-h2">Every look at a record leaves a trace.</h2>
              <p className="lp-body">
                Health data deserves more than a password. These are the rules G1Card runs on, not settings someone has to remember to switch on.
              </p>
              <ul className="lp-list">
                <li><Check /><span><b>Verified hospitals only.</b> An admin approves every hospital, and every change to its profile.</span></li>
                <li><Check /><span><b>Consent with levels.</b> General or Complete, granted and revoked by the patient.</span></li>
                <li><Check /><span><b>Verified sign-ups.</b> One-time email codes for new patients and hospitals.</span></li>
                <li><Check /><span><b>A full audit trail.</b> Logins, record views, downloads, edits and consent changes, with who and when.</span></li>
              </ul>
            </div>
            <div className="lp-feature-visual">
              <Media><AuditView /></Media>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-section lp-section--tint" id="faq">
          <div className="lp-container lp-split">
            <div>
              <p className="lp-kicker">06 — Questions</p>
              <h2 className="lp-h2">The things people ask first.</h2>
            </div>
            <div className="lp-faq">
              {FAQ.map(item => (
                <details key={item.q}>
                  <summary>{item.q}<span aria-hidden /></summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-cta">
          <div className="lp-container lp-cta-inner">
            <h2 className="lp-h2">Bring your history with you.</h2>
            <div className="lp-hero-ctas">
              <button type="button" className="lp-btn" onClick={() => navigate('/patient/register')}>Create a patient account</button>
              <button type="button" className="lp-btn lp-btn--ghost" onClick={() => navigate('/hospital/register')}>Register a hospital</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div>
            <span className="g1-wordmark">G1Card</span>
            <p className="lp-footer-note">Unified medical records, shared with consent.</p>
          </div>
          <div className="lp-footer-links">
            <button type="button" onClick={() => navigate('/login')}>Sign in</button>
            <button type="button" onClick={() => navigate('/patient/register')}>Patient sign-up</button>
            <button type="button" onClick={() => navigate('/hospital/register')}>Hospital registration</button>
            <button type="button" onClick={() => navigate('/admin/login')}>Admin</button>
          </div>
          <p className="lp-footer-fine">© {new Date().getFullYear()} G1Card. People and hospitals shown on this page are examples.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
