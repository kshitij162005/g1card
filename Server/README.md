# g1card - Server

This is a tiny Express backend used for local development.

Quick commands (from repository root):

```bash
# install server deps
cd server && npm install

# start server
npm run dev  # uses nodemon

# or from repo root
cd server && npm start
```

The server listens on port 8082 by default and exposes a small API under `/api`:

- `GET /api/health` — health check
- `GET /api` — API root
- `POST /api/echo` — echoes JSON body

Environment
-----------

The server reads `PORT` and `HOST` from `server/.env` if present. There's an example file at `server/.env.example` you can copy:

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` to change the port or host.

AI Integration (Mistral)
------------------------

The backend is now wired for role-based AI keys via environment variables:

- `MISTRAL_API_KEY_PATIENT` (future patient AI use)
- `MISTRAL_API_KEY_HOSPITAL` (active: patient record AI summary)
- `MISTRAL_API_KEY_ADMIN` (future admin AI use)
- `MISTRAL_MODEL` (default: `mistral-large-latest`)
- `MISTRAL_API_URL` (default: `https://api.mistral.ai/v1/chat/completions`)

Readiness check:

- `GET /api/ai/readiness`

Hospital AI summary endpoint:

- `POST /api/hospitals/:id/patients/:patientId/ai-summary`

Notes:

- Do not commit real API keys.
- Hospital summary respects access level rules (`GENERAL` vs `COMPLETE`).
