// =============================================================================
// Request Logger Middleware — Structured JSON request logging with requestId
// Implements: TASK-027, EP §11
// Design: 35-security-and-observability.md §10
// =============================================================================

import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request logger middleware. Assigns a unique requestId to every request
 * and logs request/response details in structured JSON format (DD-35 §10).
 *
 * Logs: method, url, statusCode, durationMs, requestId, tenantId, userId
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  const startTime = Date.now();

  // Attach requestId to response headers for client-side debugging
  res.set('X-Request-Id', requestId);

  // Log request start
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    module: 'http',
    message: `${req.method} ${req.path}`,
    requestId,
    method: req.method,
    path: req.path,
    tenantId: req.user?.tenantId,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };

  console.log(JSON.stringify(logEntry));

  // Log response on finish
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const responseLog = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      module: 'http',
      message: `${req.method} ${req.path} → ${res.statusCode} (${durationMs}ms)`,
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
    };

    console.log(JSON.stringify(responseLog));
  });

  next();
}
