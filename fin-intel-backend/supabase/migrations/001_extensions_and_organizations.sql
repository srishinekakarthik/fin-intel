-- ============================================================
-- 001_extensions_and_organizations.sql
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pg_trgm"; -- for text search

-- ============================================================
-- ORGANIZATIONS (root tenant entity)
-- ============================================================
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  plan        text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  settings    jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- USERS
-- ============================================================
create table users (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  auth_id     uuid not null unique, -- Supabase auth.users.id
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'analyst' check (role in ('owner', 'admin', 'analyst', 'viewer')),
  is_active   boolean not null default true,
  last_seen   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(org_id, email)
);

-- ============================================================
-- COMPANIES
-- ============================================================
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  ticker      text,
  exchange    text,
  sector      text,
  industry    text,
  description text,
  website     text,
  is_tracked  boolean not null default true,
  is_public   boolean not null default true,
  metadata    jsonb not null default '{}',
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(org_id, ticker)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  company_id   uuid references companies(id) on delete set null,
  uploaded_by  uuid references users(id) on delete set null,
  title        text not null,
  doc_type     text not null check (doc_type in (
                  'annual_report', 'quarterly_report', 'financial_statement',
                  'investor_presentation', 'earnings_transcript', 'sec_filing', 'other'
                )),
  storage_path text not null,
  file_size    bigint,
  page_count   integer,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error_msg    text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- DOCUMENT CHUNKS (768 dims for Gemini text-embedding-004)
-- ============================================================
create table document_chunks (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references documents(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  chunk_index  integer not null,
  page_number  integer not null default 1,
  content      text not null,
  embedding    vector(768),
  token_count  integer,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- IVFFlat index for approximate nearest-neighbour search
create index document_chunks_embedding_idx
  on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index document_chunks_document_id_idx on document_chunks(document_id);
create index document_chunks_org_id_idx on document_chunks(org_id);

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
create table chat_sessions (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  title       text not null default 'New conversation',
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
create table chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  citations   jsonb not null default '[]', -- [{doc_id, doc_title, page, excerpt}]
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index chat_messages_session_id_idx on chat_messages(session_id);

-- ============================================================
-- COMPANY SNAPSHOTS (time-series market data)
-- ============================================================
create table company_snapshots (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  stock_price  numeric(12, 4),
  market_cap   bigint,
  pe_ratio     numeric(10, 2),
  revenue_ttm  bigint,
  health_score numeric(5, 2) check (health_score >= 0 and health_score <= 100),
  score_detail jsonb not null default '{}', -- {revenue_growth, profitability, liquidity, debt, risk}
  financials   jsonb not null default '{}',
  snapshot_at  timestamptz not null default now()
);

create index company_snapshots_company_id_idx on company_snapshots(company_id);
create index company_snapshots_snapshot_at_idx on company_snapshots(snapshot_at desc);

-- ============================================================
-- REPORTS
-- ============================================================
create table reports (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organizations(id) on delete cascade,
  generated_by   uuid references users(id) on delete set null,
  company_id     uuid references companies(id) on delete set null,
  report_type    text not null check (report_type in (
                   'weekly', 'monthly', 'quarterly', 'competitor', 'custom'
                 )),
  title          text not null,
  content        text,
  status         text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  trigger_source text not null default 'manual' check (trigger_source in ('manual', 'scheduled', 'n8n')),
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- ALERTS
-- ============================================================
create table alerts (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  company_id  uuid references companies(id) on delete cascade,
  alert_type  text not null check (alert_type in ('sec_filing', 'earnings', 'news', 'price_move', 'custom')),
  title       text not null,
  summary     text,
  source_url  text,
  is_read     boolean not null default false,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index alerts_org_id_idx on alerts(org_id);
create index alerts_is_read_idx on alerts(org_id, is_read);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table audit_logs (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  action        text not null, -- e.g. 'document.upload', 'user.role_changed'
  resource_type text not null,
  resource_id   uuid,
  ip_address    inet,
  diff          jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_org_id_idx on audit_logs(org_id);
create index audit_logs_created_at_idx on audit_logs(created_at desc);

-- ============================================================
-- UPDATED_AT trigger (auto-update timestamps)
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger trg_users_updated_at         before update on users         for each row execute function update_updated_at();
create trigger trg_companies_updated_at     before update on companies     for each row execute function update_updated_at();
create trigger trg_documents_updated_at     before update on documents     for each row execute function update_updated_at();
create trigger trg_chat_sessions_updated_at before update on chat_sessions for each row execute function update_updated_at();
create trigger trg_reports_updated_at       before update on reports       for each row execute function update_updated_at();
