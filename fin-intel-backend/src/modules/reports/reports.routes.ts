import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { reportAgent } from '../../agents/report.agent';
import { requireAuth, isAnalystOrAbove, isAdminOrAbove } from '../../middleware/auth';
import { env } from '../../config/env';
import type { ReportType } from '../../types';

const REPORT_TYPES: ReportType[] = ['weekly', 'monthly', 'quarterly', 'competitor', 'custom'];

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// ── n8n callback auth ─────────────────────────────────────
function verifyN8nCallback(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-callback-secret'];
  if (env.N8N_CALLBACK_SECRET && secret !== env.N8N_CALLBACK_SECRET) {
    res.status(401).json({ error: 'Invalid callback secret' });
    return;
  }
  next();
}

const router = Router();

// ── n8n SHARED UTILITY ENDPOINTS ──────────────────────────

/**
 * GET /api/v1/reports/active-orgs
 * n8n calls this to get the list of orgs to iterate over for
 * scheduled reports, SEC monitoring, and news monitoring.
 */
router.get(
  '/active-orgs',
  verifyN8nCallback,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('is_active', true);

      if (error) throw new AppError('Failed to fetch organizations', 500);
      res.json({ data: data ?? [] });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/reports/notify
 * n8n calls this to notify org users that a report or alert is ready.
 * Creates an in-app alert (type: 'custom') for visibility.
 * Body: { orgId, reportId?, subject, type? }
 */
router.post(
  '/notify',
  verifyN8nCallback,
  [body('orgId').isUUID(), body('subject').trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const { orgId, reportId, subject } = req.body;

      await supabaseAdmin.from('alerts').insert({
        org_id: orgId,
        company_id: null,
        alert_type: 'custom',
        title: subject,
        summary: reportId ? `A new report is ready to view.` : null,
        source_url: null,
        metadata: { reportId: reportId ?? null },
      });

      res.json({ message: 'Notification created' });
    } catch (err) { next(err); }
  }
);

// ── n8n SCHEDULED REPORT TRIGGER (called by n8n Cloud workflows) ──────────────

/**
 * POST /api/v1/reports/trigger
 * n8n calls this on schedule to trigger report generation for an org.
 * Body: { orgId, reportType, companyId? }
 */
router.post(
  '/trigger',
  verifyN8nCallback,
  [
    body('orgId').isUUID(),
    body('reportType').isIn(REPORT_TYPES),
    body('companyId').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const reportId = await reportAgent.generateReport({
        orgId: req.body.orgId,
        reportType: req.body.reportType as ReportType,
        companyId: req.body.companyId,
        triggerSource: 'n8n',
      });
      res.json({ data: { reportId }, message: 'Report generation started' });
    } catch (err) { next(err); }
  }
);

// ── AUTHENTICATED USER ROUTES ─────────────────────────────

router.use(requireAuth);

// GET /api/v1/reports
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('report_type').optional().isIn(REPORT_TYPES),
    query('company_id').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query['page']) || 1;
      const limit = Number(req.query['limit']) || 20;
      const offset = (page - 1) * limit;

      let q = supabaseAdmin
        .from('reports')
        .select('id, report_type, title, status, trigger_source, company_id, created_at, updated_at, companies(name, ticker)', { count: 'exact' })
        .eq('org_id', req.auth.orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (req.query['report_type']) q = q.eq('report_type', req.query['report_type'] as string);
      if (req.query['company_id']) q = q.eq('company_id', req.query['company_id'] as string);

      const { data, error, count } = await q;
      if (error) throw new AppError('Failed to fetch reports', 500);

      res.json({ data, total: count ?? 0, page, limit, hasMore: offset + limit < (count ?? 0) });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/reports/:id
router.get(
  '/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('reports')
        .select('*, companies(name, ticker)')
        .eq('id', req.params['id']!)
        .eq('org_id', req.auth.orgId)
        .single();

      if (error || !data) throw new AppError('Report not found', 404);
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/reports/generate — manual trigger
router.post(
  '/generate',
  isAnalystOrAbove,
  [
    body('report_type').isIn(REPORT_TYPES),
    body('company_id').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const reportId = await reportAgent.generateReport({
        orgId: req.auth.orgId,
        reportType: req.body.report_type as ReportType,
        companyId: req.body.company_id,
        generatedBy: req.auth.userId,
        triggerSource: 'manual',
      });
      res.status(202).json({ data: { reportId }, message: 'Report generation started' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/reports/:id
router.delete(
  '/:id',
  isAdminOrAbove,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error } = await supabaseAdmin
        .from('reports')
        .delete()
        .eq('id', req.params['id']!)
        .eq('org_id', req.auth.orgId);

      if (error) throw new AppError('Failed to delete report', 500);
      res.json({ message: 'Report deleted' });
    } catch (err) { next(err); }
  }
);

export default router;
