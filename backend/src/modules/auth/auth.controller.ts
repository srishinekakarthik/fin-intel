import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from './auth.service';

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('orgName').trim().isLength({ min: 2 }).withMessage('Organization name must be at least 2 characters'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!validate(req, res)) return;
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ data: result, message: 'Registration successful' });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!validate(req, res)) return;
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json({ data: result, message: 'Login successful' });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }
    try {
      const tokens = await authService.refresh(refresh_token);
      res.json({ data: tokens });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.headers.authorization?.slice(7) ?? '';
      await authService.logout(token);
      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    // req.auth is populated by requireAuth middleware
    res.json({ data: req.auth });
  }
}

export const authController = new AuthController();
