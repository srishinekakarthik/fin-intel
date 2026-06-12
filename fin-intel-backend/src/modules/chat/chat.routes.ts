import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { chatService } from './chat.service';
import { analysisAgent } from '../../agents/analysis.agent';
import { researchAgent } from '../../agents/research.agent';
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

// ── Sessions ─────────────────────────────────────────────

// POST /api/v1/chat/sessions — create a new session
// Scope: global (no body), company (company_id), or document (document_ids[])
router.post(
  '/sessions',
  [
    body('title').optional().trim().isString(),
    body('company_id').optional().isUUID(),
    body('document_ids').optional().isArray(),
    body('document_ids.*').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const session = await chatService.createSession(req.auth, {
        title: req.body.title,
        companyId: req.body.company_id,
        documentIds: req.body.document_ids,
      });
      res.status(201).json({ data: session });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/chat/sessions
router.get(
  '/sessions',
  [query('company_id').optional().isUUID()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await chatService.listSessions(
        req.auth,
        req.query['company_id'] as string | undefined
      );
      res.json({ data: sessions });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/chat/sessions/:id
router.get(
  '/sessions/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await chatService.getSession(req.auth, req.params['id']!);
      res.json({ data: session });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/chat/sessions/:id/rename
router.patch(
  '/sessions/:id/rename',
  [param('id').isUUID(), body('title').trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      await chatService.renameSession(req.auth, req.params['id']!, req.body.title);
      res.json({ message: 'Session renamed' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/chat/sessions/:id — archive
router.delete(
  '/sessions/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await chatService.archiveSession(req.auth, req.params['id']!);
      res.json({ message: 'Session archived' });
    } catch (err) { next(err); }
  }
);

// ── Messages ─────────────────────────────────────────────

// GET /api/v1/chat/sessions/:id/messages
router.get(
  '/sessions/:id/messages',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const messages = await chatService.getMessages(req.auth, req.params['id']!);
      res.json({ data: messages });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/chat/sessions/:id/messages — send a message, get AI response
router.post(
  '/sessions/:id/messages',
  [
    param('id').isUUID(),
    body('content').trim().notEmpty().withMessage('Message content is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const message = await chatService.sendMessage(req.auth, {
        sessionId: req.params['id']!,
        content: req.body.content,
      });
      res.json({ data: message });
    } catch (err) { next(err); }
  }
);

// ── Agent endpoints ───────────────────────────────────────

// POST /api/v1/chat/analyze/health-score
// Generate/refresh AI health score for a company
router.post(
  '/analyze/health-score',
  isAnalystOrAbove,
  [body('company_id').isUUID(), body('company_name').trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const score = await analysisAgent.generateHealthScore(
        req.auth.orgId,
        req.body.company_id,
        req.body.company_name
      );
      res.json({ data: score });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/chat/analyze/risks
router.post(
  '/analyze/risks',
  isAnalystOrAbove,
  [body('company_id').isUUID(), body('company_name').trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const analysis = await analysisAgent.analyzeRisks(
        req.auth.orgId,
        req.body.company_id,
        req.body.company_name
      );
      res.json({ data: analysis });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/chat/analyze/compare
// Compare two or more companies
router.post(
  '/analyze/compare',
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

// GET /api/v1/chat/research/:company_id
// Research brief for a company (used to enrich context)
router.get(
  '/research/:company_id',
  param('company_id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brief = await researchAgent.researchCompany(
        req.auth.orgId,
        req.params['company_id']!
      );
      res.json({ data: brief });
    } catch (err) { next(err); }
  }
);

export default router;
