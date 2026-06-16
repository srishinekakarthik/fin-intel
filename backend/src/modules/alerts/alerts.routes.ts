import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { monitorSecFilings } from '../../services/sec-edgar';
import { monitorCompanyNews } from '../../services/news-monitor';
import {
  generateInvestmentMemo,
  generateExecutiveSummary,
} from '../../services/investment-memo';
import { analysisAgent } from '../../agents/analysis.agent';
import { requireAuth, isAnalystOrAbove } from '../../middleware/auth';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

function verifyN8nCallback(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-callback-secret'];
  if (env.N8N_CALLBACK_SECRET && secret !== env.N8N_CALLBACK_SECRET) {
    res.status(401).json({ error: 'Invalid callback secret' });
    return;
  }
  next();
}

const router = Router();

// ── n8n MONITORING TRIGGERS ───────────────────────────────

/**
 * POST /api/v1/alerts/monitor/sec
 * n8n calls this daily to check for new SEC filings.
 */
router.post(
  '/monitor/sec',
  verifyN8nCallback,
  [body('orgId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const count = await monitorSecFilings(req.body.orgId);
      logger.info('SEC monitoring complete', { orgId: req.body.orgId, alertsCreated: count });
      res.json({ data: { alertsCreated: count } });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/alerts/monitor/news
 * n8n calls this every 6 hours to check for new financial news.
 */
router.post(
  '/monitor/news',
  verifyN8nCallback,
  [body('orgId').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const count = await monitorCompanyNews(req.body.orgId);
      res.json({ data: { alertsCreated: count } });
    } catch (err) { next(err); }
  }
);

// ── AUTHENTICATED USER ROUTES ─────────────────────────────

router.use(requireAuth);

// GET /api/v1/alerts
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('alert_type').optional().isIn(['sec_filing', 'earnings', 'news', 'price_move', 'custom']),
    query('company_id').optional().isUUID(),
    query('is_read').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query['page']) || 1;
      const limit = Number(req.query['limit']) || 30;
      const offset = (page - 1) * limit;

      let q = supabaseAdmin
        .from('alerts')
        .select(
          'id, alert_type, title, summary, source_url, is_read, metadata, created_at, companies(id, name, ticker)',
          { count: 'exact' }
        )
        .eq('org_id', req.auth.orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (req.query['alert_type']) q = q.eq('alert_type', req.query['alert_type'] as string);
      if (req.query['company_id']) q = q.eq('company_id', req.query['company_id'] as string);
      if (req.query['is_read'] !== undefined) q = q.eq('is_read', req.query['is_read'] === 'true');

      const { data, error, count } = await q;
      if (error) throw new AppError('Failed to fetch alerts', 500);

      res.json({ data, total: count ?? 0, page, limit, hasMore: offset + limit < (count ?? 0) });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/alerts/unread-count
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', req.auth.orgId)
      .eq('is_read', false);

    if (error) throw new AppError('Failed to count alerts', 500);
    res.json({ data: { count: count ?? 0 } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/alerts/:id/read — mark single alert as read
router.patch(
  '/:id/read',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error } = await supabaseAdmin
        .from('alerts')
        .update({ is_read: true })
        .eq('id', req.params['id']!)
        .eq('org_id', req.auth.orgId);

      if (error) throw new AppError('Failed to mark alert as read', 500);
      res.json({ message: 'Alert marked as read' });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/alerts/read-all — mark all alerts as read
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error } = await supabaseAdmin
      .from('alerts')
      .update({ is_read: true })
      .eq('org_id', req.auth.orgId)
      .eq('is_read', false);

    if (error) throw new AppError('Failed to mark alerts as read', 500);
    res.json({ message: 'All alerts marked as read' });
  } catch (err) { next(err); }
});

// DELETE /api/v1/alerts/:id
router.delete(
  '/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await supabaseAdmin
        .from('alerts')
        .delete()
        .eq('id', req.params['id']!)
        .eq('org_id', req.auth.orgId);
      res.json({ message: 'Alert deleted' });
    } catch (err) { next(err); }
  }
);

// ── INTELLIGENCE ENDPOINTS ────────────────────────────────

// POST /api/v1/alerts/intelligence/memo
// Generate investment memo for a company
router.post(
  '/intelligence/memo',
  isAnalystOrAbove,
  [body('company_id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const memo = await generateInvestmentMemo(req.auth.orgId, req.body.company_id);
      res.json({ data: memo });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/alerts/intelligence/executive-summary
router.post(
  '/intelligence/executive-summary',
  isAnalystOrAbove,
  [body('company_id').isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const summary = await generateExecutiveSummary(req.auth.orgId, req.body.company_id);
      res.json({ data: { summary } });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/alerts/intelligence/competitor-analysis
router.post(
  '/intelligence/competitor-analysis',
  isAnalystOrAbove,
  [
    body('companies').isArray({ min: 2, max: 4 }),
    body('companies.*.id').isUUID(),
    body('companies.*.name').trim().notEmpty(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const comparison = await analysisAgent.compareCompanies(
        req.auth.orgId,
        req.body.companies
      );
      res.json({ data: comparison });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/alerts/sec/:ticker — fetch latest SEC filings directly
router.get(
  '/sec/:ticker',
  param('ticker').isAlphanumeric().isLength({ max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lookupCik, getRecentFilings } = await import('../../services/sec-edgar');
      const cik = await lookupCik(req.params['ticker']!.toUpperCase());
      if (!cik) throw new AppError('Company not found on SEC EDGAR', 404);

      const filings = await getRecentFilings(cik, ['10-K', '10-Q', '8-K'], 10);
      res.json({ data: filings });
    } catch (err) { next(err); }
  }
);

export default router;
