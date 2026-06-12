# fin-intel-frontend

React + TypeScript frontend for the AI-Powered Financial Intelligence Platform.

## Tech stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS (dark theme, custom gray palette)
- **Routing:** React Router v6
- **Data fetching:** TanStack Query (React Query v5)
- **State:** Zustand (auth store with persistence)
- **HTTP:** Axios with auto-refresh interceptor
- **Forms:** react-hook-form + Zod
- **Icons:** Lucide React

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

Set `VITE_API_URL` to your backend URL (default: `http://localhost:3001/api/v1`).

### 3. Run development server

```bash
npm run dev
```

Opens at `http://localhost:5173`.

Make sure `fin-intel-backend` is running at port 3001.

---

## Pages

| Path | Auth | Description |
|------|------|-------------|
| `/login` | Public | Sign in |
| `/register` | Public | Register + create org |
| `/dashboard` | ✓ | Overview: tracked companies, quick actions |
| `/companies` | ✓ | Company list with search + health scores |
| `/companies/:id` | ✓ | Company detail: info, market data, health score |
| `/documents` | ✓ | Phase 3 placeholder |
| `/chat` | ✓ | Phase 4 placeholder |
| `/reports` | ✓ | Phase 5 placeholder |
| `/alerts` | ✓ | Phase 6 placeholder |
| `/team` | ✓ | Admin: team management (Phase 2) |

---

## Auth flow

1. User registers → backend creates Supabase auth user + org + internal user record
2. Backend returns `access_token` + `refresh_token` (Supabase session tokens)
3. Frontend stores both tokens in Zustand (persisted to `localStorage` via `zustand/middleware/persist`)
4. Axios interceptor attaches `Authorization: Bearer <access_token>` to every request
5. On 401 response, interceptor auto-calls `/auth/refresh` and retries the original request
6. On failed refresh, clears store and redirects to `/login`

---

## Project structure

```
src/
├── api/
│   ├── client.ts       # Axios instance + auth/refresh interceptors
│   ├── auth.ts         # Auth API functions
│   └── companies.ts    # Companies API functions
├── components/
│   ├── ui/             # (Phase 3+) Reusable design system components
│   └── shared/
│       ├── Sidebar.tsx         # Navigation sidebar
│       └── ProtectedLayout.tsx # Auth guard + layout wrapper
├── hooks/
│   ├── useAuth.ts      # useLogin, useRegister, useLogout, useAuth
│   └── useCompanies.ts # useCompanies, useCompany, useCreateCompany, etc.
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── companies/
│   │   ├── CompaniesPage.tsx
│   │   ├── CompanyDetailPage.tsx
│   │   └── CreateCompanyModal.tsx
│   └── Placeholders.tsx   # Phase 3-6 coming-soon pages
├── stores/
│   └── authStore.ts    # Zustand auth store with persistence
├── types/
│   └── index.ts        # Shared TypeScript types
├── App.tsx             # React Router configuration
├── main.tsx            # Entry point + QueryClientProvider
└── index.css           # Tailwind directives + global styles
```

---

## Phases

| Phase | Status | Feature |
|-------|--------|---------|
| 2 | ✅ | Auth, company management, dashboard |
| 3 | 🔜 | Document upload, viewer, semantic search |
| 4 | 🔜 | AI chat interface with citations |
| 5 | 🔜 | Reports viewer, analytics dashboard |
| 6 | 🔜 | Alerts, competitor analysis |
