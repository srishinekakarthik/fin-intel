import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { companyService } from './companies.service';
import { requireAuth, isAnalystOrAbove, isAdminOrAbove } from '../../middleware/auth';

// ── Validation ───────────────────────────────────────────

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

const createValidation = [
  body('name').trim().notEmpty().withMessage('Company name is required'),
  body('ticker').optional().trim().isAlphanumeric().isLength({ max: 10 }),
  body('exchange').optional().trim(),
  body('sector').optional().trim(),
  body('website').optional().isURL(),
];

// ── Controller ────────────────────────────────────────────

async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await companyService.list(req.auth, {
      page: Number(req.query['page']) || 1,
      limit: Number(req.query['limit']) || 20,
      search: req.query['search'] as string | undefined,
      is_tracked: req.query['is_tracked'] === 'true' ? true
        : req.query['is_tracked'] === 'false' ? false
        : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await companyService.getById(req.auth, req.params['id']!);
    res.json({ data: company });
  } catch (err) { next(err); }
}

async function create(req: Request, res: Response, next: NextFunction) {
  if (!validate(req, res)) return;
  try {
    const company = await companyService.create(req.auth, req.body);
    res.status(201).json({ data: company, message: 'Company created' });
  } catch (err) { next(err); }
}

async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await companyService.update(req.auth, req.params['id']!, req.body);
    res.json({ data: company, message: 'Company updated' });
  } catch (err) { next(err); }
}

async function toggleTracked(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await companyService.toggleTracked(req.auth, req.params['id']!);
    res.json({ data: company });
  } catch (err) { next(err); }
}

async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await companyService.delete(req.auth, req.params['id']!);
    res.json({ message: 'Company deleted' });
  } catch (err) { next(err); }
}

// ── Router ────────────────────────────────────────────────

const router = Router();

router.use(requireAuth);

router.get('/', list);
router.get('/:id', param('id').isUUID(), getOne);
router.post('/', isAnalystOrAbove, createValidation, create);
router.patch('/:id', isAnalystOrAbove, update);
router.patch('/:id/track', isAnalystOrAbove, toggleTracked);
router.delete('/:id', isAdminOrAbove, remove);

export default router;
