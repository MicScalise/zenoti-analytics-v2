// =============================================================================
// Identity Routes — POST /auth/login, /auth/logout, /auth/refresh, /auth/mfa/verify
// Implements: DD-32 §4 (authentication endpoints)
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticateUser, verifyMfa, generateSessionToken, generateRefreshToken } from './services/auth-service.js';
import { validateLogin, validateRefresh, validateMfaVerify } from './validators.js';

export const identityRouter: Router = Router();

/**
 * POST /auth/login — authenticate user by email/password
 * DD-32 §4.1. No auth required (public endpoint).
 */
identityRouter.post('/auth/login', async (req: Request, res: Response) => {
  const errors = validateLogin(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors },
    });
  }

  const { email, password, clientType } = req.body;
  // Tenant ID extracted from email domain or explicit header
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'x-tenant-id header required' },
    });
  }

  const result = await authenticateUser(email, tenantId, password);

  // Check if authentication failed
  if ('locked' in result && !('userId' in result)) {
    if (result.locked) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_LOCKED', message: 'Account locked due to too many failed attempts' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
  }

  const authResult = result as { userId: string; tenantId: string; role: string; mfaRequired: boolean };

  // If MFA required, return 423 with userId for MFA flow
  if (authResult.mfaRequired) {
    return res.status(423).json({
      success: false,
      error: { code: 'MFA_REQUIRED', message: 'MFA verification required' },
      data: { userId: authResult.userId },
    });
  }

  // Generate session token
  const sessionId = generateSessionToken(authResult.userId, authResult.tenantId);
  const refreshToken = generateRefreshToken();

  // Set session cookie for web clients
  if (clientType === 'web') {
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 900000, // 15 minutes
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      userId: authResult.userId,
      tenantId: authResult.tenantId,
      role: authResult.role,
      mfaRequired: false,
      sessionId: clientType === 'mobile' ? sessionId : undefined,
      refreshToken,
    },
  });
});

/**
 * POST /auth/logout — invalidate session
 * DD-32 §4.2. Idempotent.
 */
identityRouter.post('/auth/logout', async (_req: Request, res: Response) => {
  // Clear session cookie regardless
  res.clearCookie('sessionId', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  return res.status(204).send();
});

/**
 * POST /auth/refresh — exchange refresh token for new access token
 * DD-32 §4.3. No auth required (uses refresh token in body).
 */
identityRouter.post('/auth/refresh', async (req: Request, res: Response) => {
  const errors = validateRefresh(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors },
    });
  }

  // In production: verify refresh token against Redis/store
  // For now: return error if token format is invalid
  const { refreshToken } = req.body;
  if (refreshToken.length < 32) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid refresh token' },
    });
  }

  // Placeholder: generate new tokens
  const newAccessToken = generateSessionToken('user', 'tenant');
  const newRefreshToken = generateRefreshToken();

  return res.status(200).json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    },
  });
});

/**
 * POST /auth/mfa/verify — verify MFA code
 * DD-32 §4.4. No auth required (userId in body).
 */
identityRouter.post('/auth/mfa/verify', async (req: Request, res: Response) => {
  const errors = validateMfaVerify(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors },
    });
  }

  const { userId, mfaCode } = req.body;
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'x-tenant-id header required' },
    });
  }

  const valid = await verifyMfa(userId, tenantId, mfaCode);
  if (!valid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid MFA code' },
    });
  }

  return res.status(200).json({
    success: true,
    data: { mfaSatisfied: true },
  });
});
