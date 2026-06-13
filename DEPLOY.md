# Deploying InfraSure ERP

InfraSure has **two deployables** that live in different places:

```
[ Browser ]  ──VITE_API_URL──►  [ apps/api ]  ──DATABASE_URL──►  [ PostgreSQL ]
  apps/web (Vercel)               Node/Express/Apollo (Render)      (Render-managed)
                                        └── MONGO_URL (optional) ──► MongoDB Atlas
```

- **Vercel** hosts only the **frontend** (`apps/web`, a static SPA).
- The **backend API** (`apps/api`) + **Postgres** must be hosted separately (this guide uses **Render**, which provisions both from `render.yaml`).
- `VITE_API_URL` is **not** a database — it's the URL the website calls to reach the API.

Do **part A first** (you need the API URL before the frontend can talk to anything).

---

## Part A — Backend API + PostgreSQL on Render

The repo ships a Render **Blueprint** (`render.yaml`) that creates a managed Postgres
database and the API service, and wires `DATABASE_URL` + `JWT_SECRET` automatically.

1. Push to GitHub (already done).
2. In **Render** → **New +** → **Blueprint** → pick this repo. Render reads `render.yaml`
   and shows: `infrasure-postgres` (database), `infrasure-api` (web service), and
   `infrasure-ai-engine` (optional).
3. Click **Apply**. Render will:
   - provision Postgres and inject its connection string as `DATABASE_URL`,
   - generate a `JWT_SECRET`,
   - build `apps/api/Dockerfile`, run `prisma db push`, and (because `SEED_ON_START=true`)
     **seed a demo tenant + the 8 role logins** on first boot.
4. (Optional) Audit logs use MongoDB. Create a free **MongoDB Atlas** cluster and set
   `MONGO_URL` on the `infrasure-api` service. Skip it and audit logging just no-ops.
5. When the API is **Live**, copy its URL, e.g. `https://infrasure-api.onrender.com`.
   Check `https://infrasure-api.onrender.com/health` returns `{"status":"ok"}`.

**Demo logins** (password `Passw0rd!`): `companyadmin@demo.test`, `pm@demo.test`,
`engineer@demo.test`, `accountant@demo.test`, `officer@demo.test`, `contractor@demo.test`,
`vendor@demo.test`, `superadmin@demo.test`.

> For your **own** data instead of the demo: set `SEED_ON_START=false` and create a tenant
> via the public `signupTenant` mutation (the login screen's sign-up).

### External portals (optional, go-live)
Each integration (Tally / GSTN / EPFO / RERA / Aadhaar e-Sign / BIM) is a stub until you set
its credentials on the API service — see `apps/api/.env.example`. Until then they return
clearly-labelled stub results.

---

## Part B — Frontend on Vercel

1. In **Vercel** → **Add New** → **Project** → import this repo.
2. **Settings → General**:
   - **Root Directory** — pick **one** (both are configured to work):
     - **empty / `.`** (repo root) → uses the root `vercel.json` (`npm run build --workspace apps/web`, output `apps/web/dist`), **or**
     - **`apps/web`** → uses `apps/web/vercel.json`; Vercel auto-detects Vite and serves `dist`.
     - ⚠️ This field takes a **folder path inside the repo** — *not* a Git URL. If you see
       `The specified Root Directory "https://github.com/…​.git" does not exist`, clear the
       field (leave it empty) and save. The repo URL belongs in **Settings → Git**, not here.
   - **Node.js Version** = **22.x** (the repo pins this via `engines` + `.nvmrc`; Vite 8
     requires Node ≥ 20).
3. **Settings → Environment Variables** → add:
   - **`VITE_API_URL`** = `https://infrasure-api.onrender.com/graphql`
     (your Part-A API URL **with `/graphql`**).
4. **Deploy** (or **Redeploy** if the project already exists). Confirm the build log
   **succeeds** and produces `apps/web/dist`.
5. Open the Vercel URL and log in with a demo account above.

### Troubleshooting `404: NOT_FOUND` (Vercel's own page)
That means the **build produced no output** (not an app bug). Check, in order:
- Build log succeeded? A failed `vite build` (often a Node-version mismatch) ⇒ no output ⇒ 404.
- **Node.js Version = 22.x** and **Root Directory = repo root**.
- Output directory is `apps/web/dist` (set by `vercel.json`).

### App loads but login fails / no data
The frontend can't reach the API. Confirm **`VITE_API_URL`** points at the live API origin
**+ `/graphql`**, then **redeploy** (Vite inlines env vars at build time, so a change needs a
rebuild). CORS is open on the API, so any origin can call it.

---

## Local development

```bash
npm install
# DB: Postgres on :5432 + Mongo on :27017 (or set DATABASE_URL / MONGO_URL)
npm run db:setup --workspace apps/api   # prisma generate + migrate + seed
npm run dev:api                          # API at http://localhost:4000/graphql
npm run dev:web                          # web at http://localhost:5173 (proxies to :4000 by default)
```

## Verifying a real deployment
- API health: `GET /health` → `{"status":"ok"}`.
- Reproduce the live-DB checks locally: `TEST_DATABASE_URL=… scripts/verify-live-db.sh`.
- Reproduce the mobile bundle: `scripts/verify-mobile.sh`.
