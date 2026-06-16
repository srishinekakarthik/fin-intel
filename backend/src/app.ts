import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFound } from './middleware/error';

import authRoutes from './modules/auth/auth.routes';
import companiesRoutes from './modules/companies/companies.routes';
import usersRoutes from './modules/users/users.routes';
import documentsRoutes from './modules/documents/documents.routes';
import chatRoutes from './modules/chat/chat.routes';
import reportsRoutes from './modules/reports/reports.routes';
import marketDataRoutes from './modules/market-data/market-data.routes';
// Phase 6:
import alertsRoutes from './modules/alerts/alerts.routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
});

const API = '/api/v1';
app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/companies`, companiesRoutes);
app.use(`${API}/users`, usersRoutes);
app.use(`${API}/documents`, documentsRoutes);
app.use(`${API}/chat`, chatRoutes);
app.use(`${API}/reports`, reportsRoutes);
app.use(`${API}/market`, marketDataRoutes);
app.use(`${API}/alerts`, alertsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(env.PORT);
app.listen(PORT, () => {
  logger.info(`🚀 fin-intel-backend running on port ${PORT} [${env.NODE_ENV}]`);
});

export default app;
