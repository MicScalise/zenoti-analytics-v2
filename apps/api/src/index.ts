// =============================================================================
// API Entry Point — Express app setup and route wiring
// Implements: TASK-028, EP §18
// Design: 24-file-inventory.md §3.1, 35-security-and-observability.md §2
// Defect Registry:
//   DR-007: dotenv loads BEFORE all env-reading imports
//   DR-018: express-async-errors imported FIRST
//   DR-035: Auth routes mounted BEFORE JWT middleware
// =============================================================================

// DR-018: express-async-errors MUST be the first import —
// it patches Express to catch async rejections
import 'express-async-errors';

// DR-007: dotenv MUST load before any module that reads process.env
import 'dotenv/config';

import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Pool } from 'pg';
import ioredis from 'ioredis';
import pino from 'pino';

// Middleware
import { createAuthMiddleware } from './middleware/auth.js';
import { tenantContextMiddleware } from './middleware/tenant-context.js';
import { createDbContextMiddleware } from './middleware/db-context.js';
import { errorHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { requestLogger } from './middleware/request-logger.js';

// Integration routes (TASK-026)
import { createIntegrationRoutes } from './modules/integrations/zenoti/routes.js';

// ---------------------------------------------------------------------------
// Configuration & Clients
// ---------------------------------------------------------------------------

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// ioredis CJS/ESM interop: default export is the Redis constructor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RedisCtor = (ioredis as any).default ?? ioredis;
const redis = new RedisCtor({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  maxRetriesPerRequest: 3,
});

// JWT public key for token verification (base64-encoded in env)
const jwtPublicKey = process.env.JWT_PUBLIC_KEY_B64
  ? Buffer.from(process.env.JWT_PUBLIC_KEY_B64, 'base64').toString('utf-8')
  : '';

// ---------------------------------------------------------------------------
// Express App Setup
// ---------------------------------------------------------------------------

const app: Express = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// 1. Request logger — logs every request with structured JSON
app.use(requestLogger);

// 2. CORS — restrict to allowed origins in production
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));

// 3. JSON body parser
app.use(express.json({ limit: '1mb' }));

// 4. Cookie parser — for session cookies
app.use(cookieParser());

// ---------------------------------------------------------------------------
// DR-035: Auth routes mounted BEFORE JWT middleware
// These routes must be accessible without authentication
// ---------------------------------------------------------------------------

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness check — verifies DB and Redis connections
app.get('/ready', async (_req, res) => {
  const checks: Record<string, string> = {};
  try {
    await db.query('SELECT 1');
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'fail';
  }
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'fail';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ready' : 'degraded',
    checks,
  });
});

// Auth routes — public, no JWT required (DR-035)
const authRouter = express.Router();
app.use('/api/v1/auth', authRouter);

// Login rate limiter (5/min per IP per DD-32 §15)
app.use('/api/v1/auth/login', createRateLimiter(redis, 'login'));

// ---------------------------------------------------------------------------
// Protected routes — auth middleware applied AFTER public routes (DR-035)
// ---------------------------------------------------------------------------

app.use('/api/v1', createAuthMiddleware(redis, jwtPublicKey));
app.use('/api/v1', tenantContextMiddleware);
app.use('/api/v1', createDbContextMiddleware(db));
app.use('/api/v1', createRateLimiter(redis, 'user'));

// Protected API routes
const apiRouter = express.Router();
apiRouter.use('/integrations/zenoti', createIntegrationRoutes(db, logger));
app.use('/api/v1', apiRouter);

// Error handler — MUST be last middleware (DR-018 catches async errors)
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  logger.info(`API server started on port ${PORT}`);
});

export { app, db, redis, logger };
