// ============================================================
// Core domain types — mirrors the Supabase database schema
// ============================================================

export type UserRole = 'owner' | 'admin' | 'analyst' | 'viewer';
export type OrgPlan = 'free' | 'pro' | 'enterprise';
export type DocType =
  | 'annual_report'
  | 'quarterly_report'
  | 'financial_statement'
  | 'investor_presentation'
  | 'earnings_transcript'
  | 'sec_filing'
  | 'other';
export type DocStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'competitor' | 'custom';
export type AlertType = 'sec_filing' | 'earnings' | 'news' | 'price_move' | 'custom';

// ── Entities ──────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  auth_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  org_id: string;
  name: string;
  ticker: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  is_tracked: boolean;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  org_id: string;
  company_id: string | null;
  uploaded_by: string | null;
  title: string;
  doc_type: DocType;
  storage_path: string;
  file_size: number | null;
  page_count: number | null;
  status: DocStatus;
  error_msg: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  org_id: string;
  chunk_index: number;
  page_number: number;
  content: string;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // embedding omitted from most responses (large)
}

export interface ChatSession {
  id: string;
  org_id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  doc_id: string;
  doc_title: string;
  page: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CompanySnapshot {
  id: string;
  company_id: string;
  stock_price: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  revenue_ttm: number | null;
  health_score: number | null;
  score_detail: Record<string, unknown>;
  financials: Record<string, unknown>;
  snapshot_at: string;
}

export interface Report {
  id: string;
  org_id: string;
  generated_by: string | null;
  company_id: string | null;
  report_type: ReportType;
  title: string;
  content: string | null;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  trigger_source: 'manual' | 'scheduled' | 'n8n';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  org_id: string;
  company_id: string | null;
  alert_type: AlertType;
  title: string;
  summary: string | null;
  source_url: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Auth context attached to every request ─────────────────

export interface AuthContext {
  userId: string;       // users.id (internal)
  authId: string;       // auth.users.id (Supabase)
  orgId: string;
  role: UserRole;
  email: string;
  accessToken: string;  // raw Supabase JWT
}

// ── API response helpers ───────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
