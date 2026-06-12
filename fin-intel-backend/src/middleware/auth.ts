import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import type { AuthContext, UserRole } from '../types';

// Extend Express Request with our auth context
declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

/**
 * requireAuth — validates the Bearer token from Supabase Auth,
 * looks up the internal user record, and attaches AuthContext to req.auth.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed authorization header' });
    return;
  }

  const accessToken = authHeader.slice(7);

  // Verify token with Supabase
  const { data: { user: supabaseUser }, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !supabaseUser) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Fetch our internal user record (includes org_id + role)
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, org_id, email, role, is_active')
    .eq('auth_id', supabaseUser.id)
    .single();

  if (userError || !user) {
    logger.warn('Auth middleware: user not found for auth_id', {
      auth_id: supabaseUser.id,
    });
    res.status(401).json({ error: 'User account not found' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }

  req.auth = {
    userId: user.id,
    authId: supabaseUser.id,
    orgId: user.org_id,
    role: user.role as UserRole,
    email: user.email,
    accessToken,
  };

  // Update last_seen in background (non-blocking)
  void supabaseAdmin
    .from('users')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => null, (e: unknown) => logger.warn('Failed to update last_seen', { error: e }));

  next();
}

/**
 * requireRole — must be used AFTER requireAuth.
 * Accepts one or more roles; rejects if the user's role is not in the list.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.auth.role,
      });
      return;
    }
    next();
  };
}

// Role hierarchy helpers
export const isOwner = requireRole('owner');
export const isAdminOrAbove = requireRole('owner', 'admin');
export const isAnalystOrAbove = requireRole('owner', 'admin', 'analyst');
