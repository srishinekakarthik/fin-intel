import { Router, Request, Response, NextFunction } from 'express';
import { authController, registerValidation, loginValidation } from './auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Public routes
router.post('/register', registerValidation, (req: Request, res: Response, next: NextFunction) => authController.register(req, res, next));
router.post('/login', loginValidation, (req: Request, res: Response, next: NextFunction) => authController.login(req, res, next));
router.post('/refresh', (req: Request, res: Response, next: NextFunction) => authController.refresh(req, res, next));

// Protected routes
router.post('/logout', requireAuth, (req: Request, res: Response, next: NextFunction) => authController.logout(req, res, next));
router.get('/me', requireAuth, (req: Request, res: Response) => authController.me(req, res));

export default router;
