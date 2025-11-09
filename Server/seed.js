import { connectDB } from './db.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment from this directory's .env
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment from this directory's .env
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });
import Patient from './models/Patient.js';
import Hospital from './models/Hospital.js';
import Superadmin from './models/Superadmin.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not set in environment. Copy .env.example to .env and set the URI.');
      process.exit(1);
    }

    await connectDB(uri);

    // sample credentials (for local testing only). These will be hashed before insertion.
    const patientSample = { username: 'patient1', password: 'patientpass', name: 'Test Patient' };
    const hospitalSample = { name: 'Test Hospital', username: 'hospital1', password: 'hospitalpass', address: '123 Main St' };
    const superadminSample = { username: 'admin', password: 'superpass', role: 'superadmin' };

    const pwSalt = await bcrypt.genSalt(10);
    patientSample.password = await bcrypt.hash(patientSample.password, pwSalt);
    hospitalSample.password = await bcrypt.hash(hospitalSample.password, pwSalt);
    superadminSample.password = await bcrypt.hash(superadminSample.password, pwSalt);

    // Upsert (insert if not exists)
    await Patient.updateOne({ username: patientSample.username }, { $setOnInsert: patientSample }, { upsert: true });
    await Hospital.updateOne({ username: hospitalSample.username }, { $setOnInsert: hospitalSample }, { upsert: true });
    await Superadmin.updateOne({ username: superadminSample.username }, { $setOnInsert: superadminSample }, { upsert: true });

    console.log('Seed complete. Check your database for collections: patients, hospitals, superadmins');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

run();
import { connectDB } from './db.js';
import Patient from './models/Patient.js';
import Hospital from './models/Hospital.js';
import Superadmin from './models/Superadmin.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not set in environment. Copy .env.example to .env and set the URI.');
      process.exit(1);
    }

    await connectDB(uri);

    // sample credentials (for local testing only). These will be hashed before insertion.
    const patientSample = { username: 'patient1', password: 'patientpass', name: 'Test Patient' };
    const hospitalSample = { name: 'Test Hospital', username: 'hospital1', password: 'hospitalpass', address: '123 Main St' };
    const superadminSample = { username: 'admin', password: 'superpass', role: 'superadmin' };

    const pwSalt = await bcrypt.genSalt(10);
    patientSample.password = await bcrypt.hash(patientSample.password, pwSalt);
    hospitalSample.password = await bcrypt.hash(hospitalSample.password, pwSalt);
    superadminSample.password = await bcrypt.hash(superadminSample.password, pwSalt);

    // Upsert (insert if not exists)
    await Patient.updateOne({ username: patientSample.username }, { $setOnInsert: patientSample }, { upsert: true });
    await Hospital.updateOne({ username: hospitalSample.username }, { $setOnInsert: hospitalSample }, { upsert: true });
    await Superadmin.updateOne({ username: superadminSample.username }, { $setOnInsert: superadminSample }, { upsert: true });

    console.log('Seed complete. Check your database for collections: patients, hospitals, superadmins');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

run();
