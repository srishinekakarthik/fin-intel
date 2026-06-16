import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { supabaseAdmin } from '../../config/supabase';
import { requireAuth, isAdminOrAbove } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { writeAuditLog } from '../../services/audit';
import type { UserRole } from '../../types';

const router = Router();
router.use(requireAuth);

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// GET /api/users — list all users in the org
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, is_active, last_seen, created_at')
      .eq('org_id', req.auth.orgId)
      .order('created_at');

    if (error) throw new AppError('Failed to fetch users', 500);
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', param('id').isUUID(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, is_active, last_seen, created_at')
      .eq('id', req.params['id']!)
      .eq('org_id', req.auth.orgId)
      .single();

    if (error || !data) throw new AppError('User not found', 404);
    res.json({ data });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/role — change a user's role (owner/admin only)
router.patch(
  '/:id/role',
  isAdminOrAbove,
  [
    param('id').isUUID(),
    body('role').isIn(['owner', 'admin', 'analyst', 'viewer']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const targetId = req.params['id']!;
      const newRole = req.body.role as UserRole;

      // Prevent self-demotion for owner
      if (targetId === req.auth.userId && req.auth.role === 'owner') {
        throw new AppError('Owner cannot change their own role', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ role: newRole })
        .eq('id', targetId)
        .eq('org_id', req.auth.orgId)
        .select()
        .single();

      if (error || !data) throw new AppError('Failed to update role', 500);

      await writeAuditLog(req.auth, {
        action: 'user.role_changed',
        resourceType: 'user',
        resourceId: targetId,
        diff: { role: newRole },
      });

      res.json({ data, message: 'Role updated' });
    } catch (err) { next(err); }
  }
);

// PATCH /api/users/:id/deactivate
router.patch(
  '/:id/deactivate',
  isAdminOrAbove,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetId = req.params['id']!;
      if (targetId === req.auth.userId) {
        throw new AppError('Cannot deactivate yourself', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ is_active: false })
        .eq('id', targetId)
        .eq('org_id', req.auth.orgId)
        .select()
        .single();

      if (error || !data) throw new AppError('Failed to deactivate user', 500);

      await writeAuditLog(req.auth, {
        action: 'user.deactivated',
        resourceType: 'user',
        resourceId: targetId,
      });

      res.json({ message: 'User deactivated' });
    } catch (err) { next(err); }
  }
);

// POST /api/users/invite — invite a new member to the org
router.post(
  '/invite',
  isAdminOrAbove,
  [
    body('email').isEmail().normalizeEmail(),
    body('full_name').trim().notEmpty(),
    body('role').isIn(['admin', 'analyst', 'viewer']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    if (!validate(req, res)) return;
    try {
      const { email, full_name, role } = req.body;

      // Create Supabase auth user with a temp password (they'll reset via email)
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });

      if (authError || !authData.user) {
        throw new AppError(authError?.message ?? 'Failed to create auth user', 400);
      }

      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          org_id: req.auth.orgId,
          auth_id: authData.user.id,
          email,
          full_name,
          role: role as UserRole,
        })
        .select()
        .single();

      if (userError || !user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new AppError('Failed to create user record', 500);
      }

      await writeAuditLog(req.auth, {
        action: 'user.invited',
        resourceType: 'user',
        resourceId: user.id,
        diff: { email, role },
      });

      // TODO: Phase 5 — trigger n8n workflow to send invite email

      res.status(201).json({ data: user, message: 'User invited' });
    } catch (err) { next(err); }
  }
);

export default router;
