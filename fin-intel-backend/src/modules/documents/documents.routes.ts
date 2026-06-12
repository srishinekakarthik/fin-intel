import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { body, param, validationResult } from 'express-validator';
import { documentService } from './documents.service';
import { requireAuth, isAnalystOrAbove, isAdminOrAbove } from '../../middleware/auth';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { DocType } from '../../types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
  },
});

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

/**
 * Middleware: verify the X-Callback-Secret header on n8n → backend callbacks.
 * This ensures only our n8n workflow can call these endpoints.
 */
function verifyN8nCallback(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-callback-secret'];
  if (!env.N8N_CALLBACK_SECRET) {
    // Not configured — allow in development, warn in production
    if (env.NODE_ENV === 'production') {
      logger.warn('N8N_CALLBACK_SECRET not set — callback endpoint is unprotected');
    }
    next();
    return;
  }
  if (secret !== env.N8N_CALLBACK_SECRET) {
    res.status(401).json({ error: 'Invalid callback secret' });
    return;
  }
  next();
}

const DOC_TYPES: DocType[] = [
  'annual_report', 'quarterly_report', 'financial_statement',
  'investor_presentation', 'earnings_transcript', 'sec_filing', 'other',
];

const router = Router();

// ── n8n CALLBACK ROUTES (no user auth — secured by callback secret) ──────────

/**
 * POST /api/v1/documents/:id/ingestion-complete
 *
 * n8n calls this when the ingestion pipeline finishes successfully.
 * Body: { orgId, totalPages, totalChunks, durationMs }
 */
router.post(
  '/:id/ingestion-complete',
  verifyN8nCallback,
  [
    param('id').isUUID(),
    body('orgId').isUUID(),
    body('totalPages').isInt({ min: 0 }),
    body('totalChunks').isInt({ min: 0 }),
    body('durationMs').isInt({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      await documentService.handleIngestionComplete(
        req.params['id']!,
        req.body.orgId,
        {
          totalPages: req.body.totalPages,
          totalChunks: req.body.totalChunks,
          durationMs: req.body.durationMs,
        }
      );
      res.json({ message: 'Document marked as ready' });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/documents/:id/ingestion-failed
 *
 * n8n calls this when the ingestion pipeline fails.
 * Body: { orgId, errorMessage }
 */
router.post(
  '/:id/ingestion-failed',
  verifyN8nCallback,
  [param('id').isUUID(), body('orgId').isUUID(), body('errorMessage').isString()],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      await documentService.handleIngestionFailed(
        req.params['id']!,
        req.body.orgId,
        req.body.errorMessage
      );
      res.json({ message: 'Document marked as failed' });
    } catch (err) { next(err); }
  }
);

// ── AUTHENTICATED USER ROUTES ─────────────────────────────────────────────────

router.use(requireAuth);

// POST /api/v1/documents/upload
router.post(
  '/upload',
  isAnalystOrAbove,
  upload.single('file'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('doc_type').isIn(DOC_TYPES).withMessage('Invalid document type'),
    body('company_id').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    try {
      const doc = await documentService.upload(req.auth, {
        file: req.file,
        title: req.body.title,
        docType: req.body.doc_type as DocType,
        companyId: req.body.company_id,
      });
      res.status(201).json({ data: doc, message: 'Document uploaded. n8n ingestion pipeline triggered.' });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/documents
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await documentService.list(req.auth, {
        page: Number(req.query['page']) || 1,
        limit: Number(req.query['limit']) || 20,
        search: req.query['search'] as string | undefined,
        companyId: req.query['company_id'] as string | undefined,
        docType: req.query['doc_type'] as DocType | undefined,
        status: req.query['status'] as string | undefined,
      });
      res.json(result);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/documents/:id
router.get(
  '/:id',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentService.getById(req.auth, req.params['id']!);
      res.json({ data: doc });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/documents/:id/status  (lightweight polling)
router.get(
  '/:id/status',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await documentService.getStatus(req.auth, req.params['id']!);
      res.json({ data: status });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/documents/:id/download
router.get(
  '/:id/download',
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = await documentService.getDownloadUrl(req.auth, req.params['id']!);
      res.json({ data: { url } });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/documents/:id/reprocess
router.post(
  '/:id/reprocess',
  isAnalystOrAbove,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentService.reprocess(req.auth, req.params['id']!);
      res.json({ message: 'Reprocessing triggered via n8n' });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/documents/:id
router.delete(
  '/:id',
  isAdminOrAbove,
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentService.delete(req.auth, req.params['id']!);
      res.json({ message: 'Document deleted' });
    } catch (err) { next(err); }
  }
);

export default router;
