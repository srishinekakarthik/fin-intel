-- ============================================================
-- 006_remove_rls_completely.sql
-- Remove Row Level Security — authorization is enforced in the backend
-- ============================================================

-- Drop all RLS policies (names from 002 and 004 migrations)
drop policy if exists "org_select" on organizations;
drop policy if exists "org_update" on organizations;
drop policy if exists "users_select" on users;
drop policy if exists "users_insert" on users;
drop policy if exists "users_update" on users;
drop policy if exists "users_delete" on users;
drop policy if exists "companies_select" on companies;
drop policy if exists "companies_insert" on companies;
drop policy if exists "companies_update" on companies;
drop policy if exists "companies_delete" on companies;
drop policy if exists "documents_select" on documents;
drop policy if exists "documents_insert" on documents;
drop policy if exists "documents_update" on documents;
drop policy if exists "documents_delete" on documents;
drop policy if exists "document_chunks_select" on document_chunks;
drop policy if exists "document_chunks_insert" on document_chunks;
drop policy if exists "chunks_select" on document_chunks;
drop policy if exists "chat_sessions_select" on chat_sessions;
drop policy if exists "chat_sessions_insert" on chat_sessions;
drop policy if exists "chat_sessions_update" on chat_sessions;
drop policy if exists "chat_sessions_delete" on chat_sessions;
drop policy if exists "chat_messages_select" on chat_messages;
drop policy if exists "chat_messages_insert" on chat_messages;
drop policy if exists "company_snapshots_select" on company_snapshots;
drop policy if exists "company_snapshots_insert" on company_snapshots;
drop policy if exists "snapshots_select" on company_snapshots;
drop policy if exists "reports_select" on reports;
drop policy if exists "reports_insert" on reports;
drop policy if exists "reports_update" on reports;
drop policy if exists "alerts_select" on alerts;
drop policy if exists "alerts_insert" on alerts;
drop policy if exists "alerts_update" on alerts;
drop policy if exists "audit_logs_select" on audit_logs;
drop policy if exists "audit_logs_insert" on audit_logs;
drop policy if exists "audit_select" on audit_logs;

-- Disable RLS on all application tables
alter table organizations     disable row level security;
alter table users             disable row level security;
alter table companies         disable row level security;
alter table documents         disable row level security;
alter table document_chunks   disable row level security;
alter table chat_sessions     disable row level security;
alter table chat_messages     disable row level security;
alter table company_snapshots disable row level security;
alter table reports           disable row level security;
alter table alerts            disable row level security;
alter table audit_logs        disable row level security;

-- Drop RLS helper functions
drop function if exists is_service_role();
drop function if exists auth_org_id();
drop function if exists auth_user_role();
