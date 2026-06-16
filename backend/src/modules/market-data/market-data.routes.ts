import { Router, Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import {
  getStockQuote,
  getCompanyNews,
  getBasicFinancials,
  refreshCompanySnapshot,
} from '../../services/market-data';
import { requireAuth, isAnalystOrAbove } from '../../middleware/auth';

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

const router = Router();
router.use(requireAuth);

// GET /api/v1/market/quote/:ticker
router.get(
  '/quote/:ticker',
  param('ticker').isAlphanumeric().isLength({ max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const quote = await getStockQuote(req.params['ticker']!.toUpperCase());
      if (!quote) throw new AppError('Quote not available', 404);
      res.json({ data: quote });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/market/financials/:ticker
router.get(
  '/financials/:ticker',
  param('ticker').isAlphanumeric().isLength({ max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const financials = await getBasicFinancials(req.params['ticker']!.toUpperCase());
      if (!financials) throw new AppError('Financials not available', 404);
      res.json({ data: financials });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/market/news/:ticker
router.get(
  '/news/:ticker',
  param('ticker').isAlphanumeric().isLength({ max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().split('T')[0]!;

      const news = await getCompanyNews(
        req.params['ticker']!.toUpperCase(),
        fmt(weekAgo),
        fmt(today)
      );
      res.json({ data: news });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/market/refresh/:company_id
// Fetch fresh market data for a company and persist a new snapshot
router.post(
  '/refresh/:company_id',
  isAnalystOrAbove,
  param('company_id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const { data: company, error } = await supabaseAdmin
        .from('companies')
        .select('id, ticker')
        .eq('id', req.params['company_id']!)
        .eq('org_id', req.auth.orgId)
        .single();

      if (error || !company) throw new AppError('Company not found', 404);
      if (!company.ticker) throw new AppError('Company has no ticker symbol', 400);

      await refreshCompanySnapshot(company.id, company.ticker as string);
      res.json({ message: 'Market data refreshed' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/market/snapshots/:company_id — historical snapshots
router.get(
  '/snapshots/:company_id',
  param('company_id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      // Verify org ownership
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('id', req.params['company_id']!)
        .eq('org_id', req.auth.orgId)
        .single();

      if (!company) throw new AppError('Company not found', 404);

      const { data, error } = await supabaseAdmin
        .from('company_snapshots')
        .select('id, stock_price, market_cap, health_score, pe_ratio, financials, snapshot_at')
        .eq('company_id', req.params['company_id']!)
        .order('snapshot_at', { ascending: false })
        .limit(30);

      if (error) throw new AppError('Failed to fetch snapshots', 500);
      res.json({ data });
    } catch (err) { next(err); }
  }
);

export default router;
