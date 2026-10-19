import express from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { mongoose } from './db.js';
import { getAiReadiness } from './utils/aiClient.js';

const router = express.Router();

// --- Helpers: SHA-256 based hashing with salt (uses PBKDF2 with sha256 for stronger derivation) ---
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashWithSalt(password, salt) {
  // PBKDF2 with SHA-256, 100k iterations, 64 byte key
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
  return derived.toString('hex');
}

let googleOauthClient;

function getGoogleOauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on server');
  }
  if (!googleOauthClient) {
    googleOauthClient = new OAuth2Client(clientId);
  }
  return { client: googleOauthClient, clientId };
}

async function verifyGoogleIdToken(idToken) {
  const { client, clientId } = getGoogleOauthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  return ticket.getPayload();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// One email belongs to one kind of account. Returns 'Patient' | 'Hospital' | 'Super Admin' | null.
async function findEmailOwner(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const exact = { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' };
  const [Patient, Hospital, Superadmin] = await Promise.all([
    import('./models/Patient.js').then(m => m.default),
    import('./models/Hospital.js').then(m => m.default),
    import('./models/Superadmin.js').then(m => m.default),
  ]);
  if (await Superadmin.exists({ username: exact })) return 'Super Admin';
  if (await Hospital.exists({ $or: [{ username: exact }, { contactEmail: exact }, { adminEmail: exact }] })) return 'Hospital';
  if (await Patient.exists({ $or: [{ username: exact }, { email: exact }], accountDeleted: { $ne: true } })) return 'Patient';
  return null;
}

function emailInUseMessage(owner, wanted) {
  const as = owner === 'Hospital' ? 'a hospital' : owner === 'Super Admin' ? 'a G1Card administrator' : 'a patient';
  const want = wanted === 'Hospital' ? 'hospital' : 'patient';
  const portal = owner === 'Hospital' ? 'the hospital portal' : owner === 'Super Admin' ? 'the admin portal' : 'the patient portal';
  return `This email is already registered to ${as} account, so it can't also be used for a ${want} account. Sign in through ${portal} instead, or use a different email.`;
}

function calculateAgeFromDob(dob) {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

function generateOtpCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

function toRolePurpose(role) {
  if (role === 'Patient' || role === 'PATIENT') return 'SIGNUP_PATIENT';
  if (role === 'Hospital' || role === 'HOSPITAL') return 'SIGNUP_HOSPITAL';
  return null;
}

// Health endpoint — includes DB status
router.get('/health', (req, res) => {
  const dbState = mongoose?.connection?.readyState ?? 0; // 0 = disconnected, 1 = connected
  res.json({ status: 'ok', uptime: process.uptime(), dbState });
});

// Root of API
router.get('/', (req, res) => {
  res.json({ message: 'g1card API root', version: '0.1.0' });
});

// Echo endpoint
router.post('/echo', (req, res) => {
  res.json({ received: req.body });
});

// AI readiness endpoint (future role-specific AI features)
router.get('/ai/readiness', async (req, res) => {
  return res.json({ ok: true, readiness: await getAiReadiness() });
});

// Auth: signup for patient
router.post('/auth/signup/patient', async (req, res) => {
  try {
    const Patient = (await import('./models/Patient.js')).default;
    const EmailOtp = (await import('./models/EmailOtp.js')).default;
    const { sendOtpEmail } = await import('./utils/emailService.js');
    const { email, password, firstName, lastName, dob, gender, phone, address, emergencyContactName, emergencyContactPhone, allergies, conditions, surgeries, medications, familyHistory, smoking } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const normalizedEmail = normalizeEmail(email);
    const exists = await Patient.findOne({ username: normalizedEmail });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    const owner = await findEmailOwner(normalizedEmail);
    if (owner && owner !== 'Patient') {
      return res.status(409).json({ error: emailInUseMessage(owner, 'Patient'), code: 'EMAIL_IN_USE_OTHER_ROLE' });
    }

    const salt = generateSalt();
    const passwordHash = hashWithSalt(password, salt);

    await EmailOtp.deleteMany({ email: normalizedEmail, purpose: 'SIGNUP_PATIENT', usedAt: null });

    const otp = generateOtpCode(6);
    const otpSalt = generateSalt();
    const otpHash = hashWithSalt(otp, otpSalt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpDoc = await EmailOtp.create({
      email: normalizedEmail,
      purpose: 'SIGNUP_PATIENT',
      otpHash,
      salt: otpSalt,
      expiresAt,
      payload: {
        username: normalizedEmail,
        password: passwordHash,
        userSalt: salt,
        email: normalizedEmail,
        patientId: `P${Date.now()}`,
        age: calculateAgeFromDob(dob),
        firstName,
        lastName,
        dob,
        gender,
        phone,
        address,
        emergencyContactName,
        emergencyContactPhone,
        allergies,
        conditions,
        surgeries,
        medications,
        familyHistory,
        smoking,
      },
    });

    const delivery = await sendOtpEmail({ to: normalizedEmail, otp, purposeLabel: 'patient registration' });
    if (!delivery?.ok) {
      await EmailOtp.deleteOne({ _id: otpDoc._id });
      return res.status(503).json({
        error: `OTP could not be delivered: ${delivery?.reason || 'Email service is not configured'}`,
      });
    }

    return res.json({ ok: true, email: normalizedEmail, message: 'OTP sent to your email. Verify to complete registration.' });
  } catch (err) {
    console.error('signup patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: signup for hospital
router.post('/auth/signup/hospital', async (req, res) => {
  try {
    const Hospital = (await import('./models/Hospital.js')).default;
    const EmailOtp = (await import('./models/EmailOtp.js')).default;
    const { sendOtpEmail } = await import('./utils/emailService.js');
    const { hospitalName, regNumber, address, city, state, pin, license, email, phone, website, adminName, adminEmail, adminPhone, designation, password } = req.body;
    if (!email || !password || !hospitalName) return res.status(400).json({ error: 'hospitalName, email and password are required' });

    const normalizedHospitalEmail = normalizeEmail(email);
    const normalizedAdminEmail = normalizeEmail(adminEmail);
    if (normalizedAdminEmail && normalizedHospitalEmail === normalizedAdminEmail) {
      return res.status(400).json({ error: 'Hospital contact email and admin email must be different' });
    }

    const exists = await Hospital.findOne({ username: normalizedHospitalEmail });
    if (exists) return res.status(409).json({ error: 'A hospital with this email already exists. Sign in instead.' });
    for (const candidate of [normalizedHospitalEmail, normalizedAdminEmail].filter(Boolean)) {
      const owner = await findEmailOwner(candidate);
      if (owner && owner !== 'Hospital') {
        const which = candidate === normalizedHospitalEmail ? 'Hospital email' : 'Admin email';
        return res.status(409).json({ error: `${which}: ${emailInUseMessage(owner, 'Hospital')}`, code: 'EMAIL_IN_USE_OTHER_ROLE' });
      }
    }

    const salt = generateSalt();
    const passwordHash = hashWithSalt(password, salt);

    await EmailOtp.deleteMany({ email: normalizedHospitalEmail, purpose: 'SIGNUP_HOSPITAL', usedAt: null });

    const otp = generateOtpCode(6);
    const otpSalt = generateSalt();
    const otpHash = hashWithSalt(otp, otpSalt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpDoc = await EmailOtp.create({
      email: normalizedHospitalEmail,
      purpose: 'SIGNUP_HOSPITAL',
      otpHash,
      salt: otpSalt,
      expiresAt,
      payload: {
        name: hospitalName,
        username: normalizedHospitalEmail,
        password: passwordHash,
        userSalt: salt,
        regNumber,
        address,
        city,
        state,
        pin,
        license,
        contactEmail: normalizedHospitalEmail,
        phone,
        website,
        adminName,
        adminEmail: normalizedAdminEmail,
        adminPhone,
        designation,
        status: 'pending',
        active: false,
        emailVerified: true,
      },
    });

    const delivery = await sendOtpEmail({ to: normalizedHospitalEmail, otp, purposeLabel: 'hospital registration' });
    if (!delivery?.ok) {
      await EmailOtp.deleteOne({ _id: otpDoc._id });
      return res.status(503).json({
        error: `OTP could not be delivered: ${delivery?.reason || 'Email service is not configured'}`,
      });
    }

    return res.json({ ok: true, email: normalizedHospitalEmail, message: 'OTP sent to hospital email. Verify to complete registration.' });
  } catch (err) {
    console.error('signup hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: verify signup OTP and finalize account creation
router.post('/auth/otp/verify-signup', async (req, res) => {
  try {
    const Patient = (await import('./models/Patient.js')).default;
    const Hospital = (await import('./models/Hospital.js')).default;
    const EmailOtp = (await import('./models/EmailOtp.js')).default;

    const { role, email, otp } = req.body || {};
    const purpose = toRolePurpose(role);
    const normalizedEmail = normalizeEmail(email);

    if (!purpose || !normalizedEmail || !otp) {
      return res.status(400).json({ error: 'role, email and otp are required' });
    }

    const otpDoc = await EmailOtp.findOne({
      email: normalizedEmail,
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new OTP.' });
    }

    const computed = hashWithSalt(String(otp), otpDoc.salt);
    if (computed !== otpDoc.otpHash) {
      otpDoc.attempts = (otpDoc.attempts || 0) + 1;
      await otpDoc.save();
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    if (purpose === 'SIGNUP_PATIENT') {
      const exists = await Patient.findOne({ username: normalizedEmail });
      if (exists) {
        otpDoc.usedAt = new Date();
        await otpDoc.save();
        return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      }
      const owner = await findEmailOwner(normalizedEmail);
      if (owner && owner !== 'Patient') {
        otpDoc.usedAt = new Date();
        await otpDoc.save();
        return res.status(409).json({ error: emailInUseMessage(owner, 'Patient'), code: 'EMAIL_IN_USE_OTHER_ROLE' });
      }

      const payload = otpDoc.payload || {};
      const doc = new Patient({
        username: payload.username || normalizedEmail,
        password: payload.password,
        salt: payload.userSalt,
        patientId: payload.patientId || `P${Date.now()}`,
        email: payload.email || normalizedEmail,
        emailVerified: true,
        firstName: payload.firstName,
        lastName: payload.lastName,
        dob: payload.dob,
        age: payload.age,
        gender: payload.gender,
        phone: payload.phone,
        address: payload.address,
        emergencyContactName: payload.emergencyContactName,
        emergencyContactPhone: payload.emergencyContactPhone,
        allergies: payload.allergies,
        conditions: payload.conditions,
        surgeries: payload.surgeries,
        medications: payload.medications,
        familyHistory: payload.familyHistory,
        smoking: payload.smoking,
      });
      await doc.save();
      otpDoc.usedAt = new Date();
      await otpDoc.save();
      return res.json({ ok: true, id: doc._id, message: 'Patient registration completed.' });
    }

    const exists = await Hospital.findOne({ username: normalizedEmail });
    if (exists) {
      otpDoc.usedAt = new Date();
      await otpDoc.save();
      return res.status(409).json({ error: 'Hospital already exists' });
    }

    const payload = otpDoc.payload || {};
    const doc = new Hospital({
      ...payload,
      username: payload.username || normalizedEmail,
      contactEmail: payload.contactEmail || normalizedEmail,
      emailVerified: true,
    });
    await doc.save();

    const { sendHospitalLifecycleEmail } = await import('./utils/emailService.js');
    await sendHospitalLifecycleEmail({
      to: doc.contactEmail || normalizedEmail,
      hospitalName: doc.name,
      status: 'pending',
    });

    otpDoc.usedAt = new Date();
    await otpDoc.save();
    return res.json({ ok: true, id: doc._id, message: 'Hospital registration completed.' });
  } catch (err) {
    console.error('verify signup otp error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: resend signup OTP
router.post('/auth/otp/resend-signup', async (req, res) => {
  try {
    const EmailOtp = (await import('./models/EmailOtp.js')).default;
    const { sendOtpEmail } = await import('./utils/emailService.js');
    const { role, email } = req.body || {};
    const purpose = toRolePurpose(role);
    const normalizedEmail = normalizeEmail(email);
    if (!purpose || !normalizedEmail) {
      return res.status(400).json({ error: 'role and email are required' });
    }

    const lastOtp = await EmailOtp.findOne({ email: normalizedEmail, purpose }).sort({ createdAt: -1 });
    if (!lastOtp || !lastOtp.payload) {
      return res.status(404).json({ error: 'No pending signup found for this email' });
    }

    const otp = generateOtpCode(6);
    const otpSalt = generateSalt();
    const otpHash = hashWithSalt(otp, otpSalt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpDoc = await EmailOtp.create({
      email: normalizedEmail,
      purpose,
      otpHash,
      salt: otpSalt,
      expiresAt,
      payload: lastOtp.payload,
    });

    const delivery = await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purposeLabel: purpose === 'SIGNUP_PATIENT' ? 'patient registration' : 'hospital registration',
    });
    if (!delivery?.ok) {
      await EmailOtp.deleteOne({ _id: otpDoc._id });
      return res.status(503).json({
        error: `OTP could not be delivered: ${delivery?.reason || 'Email service is not configured'}`,
      });
    }

    return res.json({ ok: true, message: 'OTP resent successfully' });
  } catch (err) {
    console.error('resend signup otp error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: Google sign-in/sign-up
router.post('/auth/google', async (req, res) => {
  try {
    const { role, idToken } = req.body || {};
    if (!role || !idToken) {
      return res.status(400).json({ error: 'role and idToken are required' });
    }

    if (role === 'Super Admin' || role === 'Super_Admin' || role === 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'Google login is not supported for Super Admin' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Server Google auth is not configured. Set GOOGLE_CLIENT_ID on backend.' });
    }

    const payload = await verifyGoogleIdToken(idToken);
    const email = normalizeEmail(payload?.email);
    const emailVerified = Boolean(payload?.email_verified);

    if (!email || !emailVerified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const displayName = payload?.name || [payload?.given_name, payload?.family_name].filter(Boolean).join(' ').trim();
    const escapedEmail = escapeRegex(email);

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;

      // A hospital's or admin's Google account must never turn into a patient account
      const owner = await findEmailOwner(email);
      if (owner && owner !== 'Patient') {
        return res.status(409).json({ error: emailInUseMessage(owner, 'Patient'), code: 'EMAIL_IN_USE_OTHER_ROLE' });
      }

      let user = await Patient.findOne({ username: { $regex: `^${escapedEmail}$`, $options: 'i' } });
      if (!user) {
        user = await Patient.findOne({ email: { $regex: `^${escapedEmail}$`, $options: 'i' } });
      }

      if (!user) {
        const patientId = `P${Date.now()}`;
        user = new Patient({
          username: email,
          email,
          emailVerified: true,
          firstName: payload?.given_name,
          lastName: payload?.family_name,
          name: displayName || email,
          patientId,
          lastAccess: new Date(),
        });
      } else {
        user.email = user.email || email;
        user.emailVerified = true;
        user.firstName = user.firstName || payload?.given_name;
        user.lastName = user.lastName || payload?.family_name;
        user.name = user.name || displayName || user.email || user.username;
        user.lastAccess = new Date();
      }

      if (user.accountDeleted) {
        return res.status(403).json({ error: 'Account has been deactivated by admin approval of deletion request' });
      }
      if (user.suspended) {
        return res.status(403).json({ error: 'This G1Card account has been suspended by an administrator. Contact support if you think this is a mistake.', code: 'ACCOUNT_SUSPENDED' });
      }

      await user.save();

      return res.json({
        ok: true,
        user: {
          id: user._id,
          email: user.email || user.username,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email,
          role: 'Patient',
          lastAccess: user.lastAccess,
        },
      });
    }

    if (role === 'Hospital' || role === 'HOSPITAL') {
      const Hospital = (await import('./models/Hospital.js')).default;
      const query = {
        $or: [
          { username: { $regex: `^${escapedEmail}$`, $options: 'i' } },
          { contactEmail: { $regex: `^${escapedEmail}$`, $options: 'i' } },
          { adminEmail: { $regex: `^${escapedEmail}$`, $options: 'i' } },
        ],
      };
      const user = await Hospital.findOne(query);

      if (!user) {
        return res.status(404).json({ error: 'Hospital not found. Please register first.' });
      }

      if (user.status && user.status !== 'approved') {
        return res.status(403).json({ error: 'Hospital registration is not approved yet', status: user.status });
      }

      user.lastAccess = new Date();
      user.emailVerified = true;
      await user.save();

      return res.json({
        ok: true,
        user: {
          id: user._id,
          email: user.contactEmail || user.username,
          name: user.name,
          role: 'Hospital',
          lastAccess: user.lastAccess,
        },
      });
    }

    return res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('google auth error:', err);
    const message = err?.message || String(err);
    if (/GOOGLE_CLIENT_ID/i.test(message) || /not configured/i.test(message)) {
      return res.status(503).json({ error: 'Server Google auth is not configured. Set GOOGLE_CLIENT_ID on backend.' });
    }
    return res.status(500).json({ error: message });
  }
});

// Auth: confirm a stored session still maps to a valid account for its role.
// The client calls this on load so sessions that should never have existed
// (e.g. a hospital email used to sign into the patient portal) are signed out.
router.post('/auth/session', async (req, res) => {
  try {
    const { role, id, isSimulation } = req.body || {};
    if (!role || !id) return res.status(400).json({ error: 'role and id are required' });
    if (!mongoose.isValidObjectId(id)) return res.status(401).json({ valid: false, error: 'Session is no longer valid' });

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const user = await Patient.findById(id).select('email username accountDeleted suspended').lean();
      if (!user || user.accountDeleted) return res.status(401).json({ valid: false, error: 'This account no longer exists.' });
      if (user.suspended) return res.status(403).json({ valid: false, code: 'ACCOUNT_SUSPENDED', error: 'This G1Card account has been suspended by an administrator.' });
      if (!isSimulation) {
        const owner = await findEmailOwner(user.email || user.username);
        if (owner && owner !== 'Patient') {
          return res.status(409).json({ valid: false, code: 'EMAIL_IN_USE_OTHER_ROLE', error: emailInUseMessage(owner, 'Patient') });
        }
      }
      return res.json({ valid: true });
    }

    if (role === 'Hospital' || role === 'HOSPITAL') {
      const Hospital = (await import('./models/Hospital.js')).default;
      const user = await Hospital.findById(id).select('status').lean();
      if (!user) return res.status(401).json({ valid: false, error: 'This hospital account no longer exists.' });
      if (!isSimulation && user.status && user.status !== 'approved') {
        return res.status(403).json({ valid: false, status: user.status, error: 'Hospital registration is not approved yet' });
      }
      return res.json({ valid: true });
    }

    if (role === 'Super Admin' || role === 'Super_Admin' || role === 'SUPER_ADMIN') {
      const Superadmin = (await import('./models/Superadmin.js')).default;
      const exists = await Superadmin.exists({ _id: id });
      if (!exists) return res.status(401).json({ valid: false, error: 'Session is no longer valid' });
      return res.json({ valid: true });
    }

    return res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('session check error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: simulation login for demos using existing sample data in DB
router.post('/auth/simulation-login', async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'role is required' });

    if (role === 'Super Admin' || role === 'Super_Admin' || role === 'SUPER_ADMIN') {
      const Superadmin = (await import('./models/Superadmin.js')).default;
      const user = await Superadmin.findOne({}).sort({ _id: 1 });
      if (!user) return res.status(404).json({ error: 'No Super Admin sample user found' });
      return res.json({
        ok: true,
        simulation: true,
        user: {
          id: user._id,
          email: user.username,
          name: 'Super Admin',
          role: 'Super Admin',
        },
      });
    }

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const user = await Patient.findOne({ suspended: { $ne: true } }).sort({ _id: 1 });
      if (!user) return res.status(404).json({ error: 'No Patient sample user found' });

      try {
        user.lastAccess = new Date();
        await user.save();
      } catch (e) {
        console.warn('Could not update lastAccess for simulation patient', e && e.message ? e.message : e);
      }

      return res.json({
        ok: true,
        simulation: true,
        user: {
          id: user._id,
          email: user.email || user.username,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: 'Patient',
          lastAccess: user.lastAccess,
        },
      });
    }

    if (role === 'Hospital' || role === 'HOSPITAL') {
      const Hospital = (await import('./models/Hospital.js')).default;
      const user = await Hospital.findOne({ status: 'approved' }).sort({ _id: 1 }) || await Hospital.findOne({}).sort({ _id: 1 });
      if (!user) return res.status(404).json({ error: 'No Hospital sample user found' });

      try {
        user.lastAccess = new Date();
        await user.save();
      } catch (e) {
        console.warn('Could not update lastAccess for simulation hospital', e && e.message ? e.message : e);
      }

      return res.json({
        ok: true,
        simulation: true,
        user: {
          id: user._id,
          email: user.contactEmail || user.username,
          name: user.name,
          role: 'Hospital',
          lastAccess: user.lastAccess,
        },
      });
    }

    return res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('simulation login error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: login for any role
router.post('/auth/login', async (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!role || !email || !password) return res.status(400).json({ error: 'role, email and password required' });

    // Superadmin: authenticate from DB (no UI creation allowed). Username is treated as email.
    if (role === 'Super Admin' || role === 'Super_Admin' || role === 'SUPER_ADMIN') {
      const Superadmin = (await import('./models/Superadmin.js')).default;
      const user = await Superadmin.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'Superadmin not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        return res.json({ ok: true, user: { id: user._id, email: user.username, name: 'Super Admin', role: 'Super Admin' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const user = await Patient.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'User not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        // An email that belongs to a hospital or admin can never be used for a patient session
        const owner = await findEmailOwner(user.email || user.username);
        if (owner && owner !== 'Patient') {
          return res.status(409).json({ error: emailInUseMessage(owner, 'Patient'), code: 'EMAIL_IN_USE_OTHER_ROLE' });
        }
        if (user.suspended) {
          return res.status(403).json({ error: 'This G1Card account has been suspended by an administrator. Contact support if you think this is a mistake.', code: 'ACCOUNT_SUSPENDED' });
        }
        // update lastAccess timestamp
        try {
          user.lastAccess = new Date();
          await user.save();
        } catch (e) {
          console.warn('Could not update lastAccess for user', e && e.message ? e.message : e);
        }
        return res.json({ ok: true, user: { id: user._id, email: user.email || user.username, name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(), role: 'Patient', lastAccess: user.lastAccess } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (role === 'Hospital' || role === 'HOSPITAL') {
      const Hospital = (await import('./models/Hospital.js')).default;
      const user = await Hospital.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'Hospital not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        // if hospital has a status and is not approved, deny full login
        if (user.status && user.status !== 'approved') {
          return res.status(403).json({ error: 'Hospital registration is not approved yet', status: user.status });
        }
        // update lastAccess timestamp
        try {
          user.lastAccess = new Date();
          await user.save();
        } catch (e) {
          console.warn('Could not update lastAccess for hospital', e && e.message ? e.message : e);
        }
        return res.json({ ok: true, user: { id: user._id, email: user.contactEmail || user.username, name: user.name, role: 'Hospital', lastAccess: user.lastAccess } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: request OTP for password change
router.post('/auth/change-password/request-otp', async (req, res) => {
  try {
    const { role, email, currentPassword } = req.body || {};
    if (!role || !email) {
      return res.status(400).json({ error: 'role and email are required' });
    }

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const EmailOtp = (await import('./models/EmailOtp.js')).default;
      const { sendOtpEmail } = await import('./utils/emailService.js');
      const normalizedEmail = normalizeEmail(email);
      const user = await Patient.findOne({ username: normalizedEmail });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.accountDeleted) return res.status(403).json({ error: 'Account has been deactivated by admin approval of deletion request' });

      const hasExistingPassword = Boolean(user.password && user.salt);
      const providedCurrentPassword = String(currentPassword || '');
      if (hasExistingPassword) {
        if (!providedCurrentPassword) {
          return res.status(400).json({ error: 'Current password is required for this account' });
        }
        const computed = hashWithSalt(providedCurrentPassword, user.salt || '');
        if (computed !== user.password) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
      }

      await EmailOtp.deleteMany({ email: normalizedEmail, purpose: 'CHANGE_PASSWORD_PATIENT', usedAt: null });
      const otp = generateOtpCode(6);
      const otpSalt = generateSalt();
      const otpHash = hashWithSalt(otp, otpSalt);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const otpDoc = await EmailOtp.create({
        email: normalizedEmail,
        purpose: 'CHANGE_PASSWORD_PATIENT',
        otpHash,
        salt: otpSalt,
        expiresAt,
        payload: { patientId: user._id.toString() },
      });

      const delivery = await sendOtpEmail({
        to: normalizedEmail,
        otp,
        purposeLabel: hasExistingPassword ? 'password change' : 'password setup',
      });
      if (!delivery?.ok) {
        await EmailOtp.deleteOne({ _id: otpDoc._id });
        return res.status(503).json({
          error: `OTP could not be delivered: ${delivery?.reason || 'Email service is not configured'}`,
        });
      }
      return res.json({
        ok: true,
        message: hasExistingPassword
          ? 'OTP sent to your email for password change verification.'
          : 'OTP sent to your email to set your password.',
      });
    }

    return res.status(400).json({ error: 'Password change OTP is currently supported only for Patient role' });
  } catch (err) {
    console.error('request password otp error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: confirm OTP and apply new password
router.post('/auth/change-password/confirm-otp', async (req, res) => {
  try {
    const { role, email, otp, newPassword } = req.body || {};
    if (!role || !email || !otp || !newPassword) {
      return res.status(400).json({ error: 'role, email, otp and newPassword are required' });
    }

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const EmailOtp = (await import('./models/EmailOtp.js')).default;
      const normalizedEmail = normalizeEmail(email);

      const otpDoc = await EmailOtp.findOne({
        email: normalizedEmail,
        purpose: 'CHANGE_PASSWORD_PATIENT',
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!otpDoc) {
        return res.status(400).json({ error: 'OTP expired or not found. Please request a new OTP.' });
      }

      const computed = hashWithSalt(String(otp), otpDoc.salt);
      if (computed !== otpDoc.otpHash) {
        otpDoc.attempts = (otpDoc.attempts || 0) + 1;
        await otpDoc.save();
        return res.status(401).json({ error: 'Invalid OTP' });
      }

      const user = await Patient.findOne({ username: normalizedEmail });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const salt = generateSalt();
      const passwordHash = hashWithSalt(newPassword, salt);
      user.salt = salt;
      user.password = passwordHash;
      await user.save();

      otpDoc.usedAt = new Date();
      await otpDoc.save();

      return res.json({ ok: true, message: 'Password updated successfully' });
    }

    return res.status(400).json({ error: 'Password change is currently supported only for Patient role' });
  } catch (err) {
    console.error('confirm password otp error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Backward-compatibility route: old change-password now proxies OTP flow with explicit error
router.post('/auth/change-password', async (req, res) => {
  return res.status(400).json({ error: 'This endpoint is deprecated. Use /auth/change-password/request-otp then /auth/change-password/confirm-otp.' });
});

// Dev-only seed endpoint retained (kept for compatibility)
router.post('/seed', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Forbidden in production' });
    if (req.query.confirm !== 'true') return res.status(400).json({ error: 'Missing confirm=true query param' });

    const bcrypt = await import('bcryptjs');
    const Patient = (await import('./models/Patient.js')).default;
    const Hospital = (await import('./models/Hospital.js')).default;
    const Superadmin = (await import('./models/Superadmin.js')).default;

    const pwSalt = await bcrypt.genSalt(10);
    const patientPw = await bcrypt.hash('patientpass', pwSalt);
    const hospitalPw = await bcrypt.hash('hospitalpass', pwSalt);
    const adminPw = await bcrypt.hash('superpass', pwSalt);

    await Patient.updateOne({ username: 'patient1' }, { $setOnInsert: { username: 'patient1', password: patientPw, name: 'Test Patient' } }, { upsert: true });
    await Hospital.updateOne({ username: 'hospital1' }, { $setOnInsert: { name: 'Test Hospital', username: 'hospital1', password: hospitalPw, address: '123 Main St' } }, { upsert: true });
    await Superadmin.updateOne({ username: 'admin' }, { $setOnInsert: { username: 'admin', password: adminPw, role: 'superadmin' } }, { upsert: true });

    return res.json({ ok: true, message: 'Seeded sample Patient, Hospital and Superadmin' });
  } catch (err) {
    console.error('Seed endpoint error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Mount modular routers for resource-specific endpoints
// (keeps this file as the central auth/utility router while delegating resource ops)
import patientRouter from './routes/patient.js';
import hospitalRouter from './routes/hospital.js';
import superadminRouter from './routes/superadmin.js';
import auditLogsRouter from './routes/auditLogs.js';
import sseRouter from './routes/sse.js';

router.use('/patients', patientRouter);
router.use('/hospitals', hospitalRouter);
router.use('/superadmin', superadminRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/sse', sseRouter);

export default router;
