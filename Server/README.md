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
