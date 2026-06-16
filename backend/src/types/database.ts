// Supabase generated types stub.
// Replace with: npx supabase gen types typescript --project-id <id> > src/types/database.ts
// This stub is typed loosely so the compiler accepts all .from() calls until real types are generated.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: TableDef;
      users: TableDef;
      companies: TableDef;
      documents: TableDef;
      document_chunks: TableDef;
      chat_sessions: TableDef;
      chat_messages: TableDef;
      company_snapshots: TableDef;
      reports: TableDef;
      alerts: TableDef;
      audit_logs: TableDef;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Generic table definition that accepts any shape — replaced by real generated types
interface TableDef {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
}
