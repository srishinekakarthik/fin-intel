import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import type { AuthContext } from '../types';

interface AuditPayload {
  action: string;           // e.g. 'document.upload', 'user.role_changed'
  resourceType: string;     // e.g. 'document', 'user', 'company'
  resourceId?: string;
  diff?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(
  auth: AuthContext,
  payload: AuditPayload
): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    org_id: auth.orgId,
    user_id: auth.userId,
    action: payload.action,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId ?? null,
    diff: payload.diff ?? null,
    ip_address: payload.ipAddress ?? null,
  });

  if (error) {
    // Audit failures are logged but never thrown — don't break the main flow
    logger.error('Failed to write audit log', { error, payload });
  }
}
