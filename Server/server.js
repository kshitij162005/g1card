import express from 'express';
import routes from './routes.js';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';

// Load environment variables from server/.env using a proper file path
const envPath = fileURLToPath(new URL('./.env', import.meta.url));
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
  console.warn('dotenv error:', dotenvResult.error && dotenvResult.error.message);
}
if (dotenvResult.parsed) {
  console.log('dotenv parsed keys:', Object.keys(dotenvResult.parsed));
}
console.log('Loaded .env path:', envPath);
console.log('MONGODB_URI present (process.env):', Boolean(process.env.MONGODB_URI));
if (process.env.MONGODB_URI) {
  console.log('MONGODB_URI (masked):', process.env.MONGODB_URI.replace(/:(?:[^@]+)@/, ':***@'));
}

const app = express();
const PORT = process.env.PORT || 8082;
const HOST = process.env.HOST || 'localhost';

app.use(express.json());
// Allow CORS from frontend dev server (adjust in production)
app.use(cors({ origin: '*' }));

// Mount API routes under /api
app.use('/api', routes);

// Simple root route
app.get('/', (req, res) => {
  res.send(`g1card backend running. Try GET /api/health`);
});

// Start server after DB connection
async function start() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB(process.env.MONGODB_URI);
    } else {
      console.warn('MONGODB_URI not provided. Skipping DB connection.');
    }

    // Ensure a Superadmin user exists in DB with the requested credentials.
    // This will create the superadmin automatically on server start if missing.
    try {
      const crypto = await import('crypto');
      const Superadmin = (await import('./models/Superadmin.js')).default;
      // Read superadmin credentials from environment variables
      const fixedEmail = process.env.SUPERADMIN_EMAIL;
      const fixedPassword = process.env.SUPERADMIN_PASSWORD;

      if (!fixedEmail || !fixedPassword) {
        console.warn('SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set in environment — skipping superadmin upsert');
      } else {
        const existing = await Superadmin.findOne({ username: fixedEmail });
        if (!existing) {
          const salt = crypto.randomBytes(16).toString('hex');
          const derived = crypto.pbkdf2Sync(fixedPassword, salt, 100000, 64, 'sha256').toString('hex');
          await Superadmin.updateOne({ username: fixedEmail }, { $setOnInsert: { username: fixedEmail, password: derived, salt, role: 'superadmin' } }, { upsert: true });
          console.log('Superadmin created in DB (email):', fixedEmail);
        } else {
          console.log('Superadmin already present in DB:', fixedEmail);
        }
      }
    } catch (err) {
      console.warn('Could not ensure superadmin in DB:', err && err.message ? err.message : err);
    }

    app.listen(PORT, () => {
      console.log(`Server listening on http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message || err);
    process.exit(1);
  }
}

start();
