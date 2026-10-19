// Lists patient accounts whose email also belongs to a hospital or super admin.
// These could be created before the one-email-one-role guard existed
// (e.g. a hospital's Google account used on the patient sign-in screen).
//
//   node scripts/findCrossRoleAccounts.js           -> dry run, prints matches
//   node scripts/findCrossRoleAccounts.js --delete  -> removes matches that have no medical records
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const { connectDB, mongoose } = await import('../db.js');
const Patient = (await import('../models/Patient.js')).default;
const Hospital = (await import('../models/Hospital.js')).default;
const Superadmin = (await import('../models/Superadmin.js')).default;
const Record = (await import('../models/Record.js')).default;
const HospitalAccess = (await import('../models/HospitalAccess.js')).default;

const shouldDelete = process.argv.includes('--delete');

await connectDB(process.env.MONGODB_URI);

const lower = (v) => String(v || '').trim().toLowerCase();
const hospitals = await Hospital.find({}).select('name username contactEmail adminEmail').lean();
const admins = await Superadmin.find({}).select('username').lean();

const owners = new Map();
for (const h of hospitals) {
  for (const e of [h.username, h.contactEmail, h.adminEmail].map(lower).filter(Boolean)) owners.set(e, `Hospital "${h.name}"`);
}
for (const a of admins) owners.set(lower(a.username), 'Super Admin');

const patients = await Patient.find({ accountDeleted: { $ne: true } }).select('patientId username email firstName lastName password').lean();
const conflicts = patients.filter((p) => owners.has(lower(p.email)) || owners.has(lower(p.username)));

if (!conflicts.length) {
  console.log('No cross-role patient accounts found.');
} else {
  for (const p of conflicts) {
    const email = lower(p.email || p.username);
    const records = await Record.countDocuments({ patient: p._id });
    const label = `${p.patientId} <${email}> — also ${owners.get(email) || owners.get(lower(p.username))}, ${records} record(s), ${p.password ? 'password' : 'Google-only'}`;
    if (shouldDelete && records === 0) {
      await HospitalAccess.deleteMany({ patient: p._id });
      await Patient.deleteOne({ _id: p._id });
      console.log(`deleted  ${label}`);
    } else {
      console.log(`${shouldDelete ? 'kept     ' : 'found    '}${label}`);
    }
  }
  if (!shouldDelete) console.log('\nDry run. Re-run with --delete to remove the ones that have no medical records.');
}

await mongoose.disconnect();
