# fin-intel-backend

Node.js + Express API for the AI-Powered Financial Intelligence Platform.

## Tech stack

- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express 4
- **Database:** Supabase (PostgreSQL + pgvector + Auth + Storage)
- **AI:** Google Gemini (embeddings + generation)
- **Automation:** n8n Cloud (webhooks)
- **Validation:** Zod + express-validator

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- A [Finnhub](https://finnhub.io) API key (free tier is fine)
- An [n8n Cloud](https://app.n8n.cloud) account

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all values in `.env`. The app will exit at startup if any required variable is missing.

### 3. Set up Supabase

**a. Create a new Supabase project** at https://supabase.com

**b. Run migrations** in order via the Supabase SQL editor:

```
supabase/migrations/001_extensions_and_organizations.sql
supabase/migrations/002_rls_policies.sql
```

Or using the Supabase CLI:

```bash
npx supabase db push
```

**c. Generate TypeScript types** (optional but recommended):

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > src/types/database.ts
```

**d. Enable pgvector** — the migration handles this automatically via `CREATE EXTENSION IF NOT EXISTS vector`.

**e. Storage bucket** — create a bucket named `documents` in your Supabase Storage dashboard. Set it to private.

### 4. Run the development server

```bash
npm run dev
```

The API starts at `http://localhost:3001`.

Health check: `GET http://localhost:3001/health`

---

## API reference

All routes are prefixed with `/api/v1`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register + create organization |
| POST | `/auth/login` | — | Login |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | ✓ | Logout |
| GET | `/auth/me` | ✓ | Current user + org |

**Register body:**
```json
{
  "email": "jane@acme.com",
  "password": "minimum8chars",
  "fullName": "Jane Smith",
  "orgName": "Acme Capital"
}
```

**Login body:**
```json
{ "email": "jane@acme.com", "password": "..." }
```

**Response (register + login):**
```json
{
  "data": {
    "user": { "id": "...", "role": "owner", ... },
    "organization": { "id": "...", "name": "Acme Capital", ... },
    "session": { "access_token": "...", "refresh_token": "..." }
  }
}
```

---

### Companies

All routes require `Authorization: Bearer <access_token>`.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/companies` | all | List companies (supports `?search=`, `?is_tracked=`, `?page=`, `?limit=`) |
| GET | `/companies/:id` | all | Get company by ID |
| POST | `/companies` | analyst+ | Create company |
| PATCH | `/companies/:id` | analyst+ | Update company |
| PATCH | `/companies/:id/track` | analyst+ | Toggle tracked status |
| DELETE | `/companies/:id` | admin+ | Delete company |

**Create company body:**
```json
{
  "name": "NVIDIA Corporation",
  "ticker": "NVDA",
  "exchange": "NASDAQ",
  "sector": "Technology",
  "industry": "Semiconductors",
  "website": "https://nvidia.com",
  "is_public": true
}
```

---

### Users

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/users` | all | List org members |
| GET | `/users/:id` | all | Get member by ID |
| POST | `/users/invite` | admin+ | Invite new member |
| PATCH | `/users/:id/role` | admin+ | Change member role |
| PATCH | `/users/:id/deactivate` | admin+ | Deactivate member |

---

## RBAC role matrix

| Action | viewer | analyst | admin | owner |
|--------|--------|---------|-------|-------|
| Read companies / documents | ✓ | ✓ | ✓ | ✓ |
| Create companies / documents | — | ✓ | ✓ | ✓ |
| Update companies / documents | — | ✓ | ✓ | ✓ |
| Delete companies / documents | — | — | ✓ | ✓ |
| Invite / manage users | — | — | ✓ | ✓ |
| Delete users | — | — | — | ✓ |

---

## Multi-tenancy

Every table includes an `org_id` column. Supabase Row Level Security (RLS) policies enforce that users can only access rows belonging to their organization — at the database level, not just the application layer.

The backend uses **two Supabase clients**:

- `supabaseAnon` — respects RLS, for user-scoped queries
- `supabaseAdmin` (service role) — bypasses RLS, used only for: chunk insertion, audit logging, user creation, n8n webhook handlers

---

## Project structure

```
src/
├── config/
│   ├── env.ts          # Zod-validated environment variables
│   ├── supabase.ts     # Two Supabase clients + user-scoped factory
│   └── logger.ts       # Winston logger
├── middleware/
│   ├── auth.ts         # requireAuth, requireRole, role helpers
│   └── error.ts        # AppError class + global error handler
├── modules/
│   ├── auth/           # register, login, refresh, logout, me
│   ├── companies/      # CRUD + tracking
│   └── users/          # list, invite, role management
├── services/
│   └── audit.ts        # Audit log writer
├── types/
│   ├── index.ts        # Domain types
│   └── database.ts     # Supabase generated types stub
└── app.ts              # Express app + server
```

---

## Phases

| Phase | Status | Module |
|-------|--------|--------|
| 1 | ✅ | Architecture, schema, migrations |
| 2 | ✅ | Auth, companies, users |
| 3 | 🔜 | Document intelligence + RAG pipeline |
| 4 | 🔜 | AI chat assistant (LangChain + Gemini) |
| 5 | 🔜 | Automated reports + n8n workflows |
| 6 | 🔜 | Competitor analysis, SEC monitoring, alerts |
