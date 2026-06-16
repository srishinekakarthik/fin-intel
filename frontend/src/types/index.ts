export type UserRole = 'owner' | 'admin' | 'analyst' | 'viewer';
export type OrgPlan = 'free' | 'pro' | 'enterprise';
export type DocType =
  | 'annual_report' | 'quarterly_report' | 'financial_statement'
  | 'investor_presentation' | 'earnings_transcript' | 'sec_filing' | 'other';
export type DocStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'competitor' | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
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
  created_at: string;
  company_snapshots?: Array<{
    health_score: number | null;
    stock_price: number | null;
    market_cap: number | null;
    pe_ratio: number | null;
    financials: Record<string, unknown> | null;
    score_detail: Record<string, number> | null;
    snapshot_at: string;
  }>;
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
  created_at: string;
}

export interface Report {
  id: string;
  org_id: string;
  generated_by: string | null;
  company_id: string | null;
  report_type: ReportType;
  title: string;
  content: string | null;
  status: ReportStatus;
  trigger_source: 'manual' | 'scheduled' | 'n8n';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  companies?: { name: string; ticker: string | null } | null;
}

export interface CompanySnapshot {
  id?: string;
  stock_price: number | null;
  market_cap: number | null;
  health_score: number | null;
  score_detail: Record<string, number> | null;
  pe_ratio: number | null;
  financials: Record<string, unknown> | null;
  snapshot_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface Citation {
  doc_id: string;
  doc_title: string;
  page: number;
  excerpt: string;
}

export type AlertType = 'sec_filing' | 'earnings' | 'news' | 'price_move' | 'custom';
