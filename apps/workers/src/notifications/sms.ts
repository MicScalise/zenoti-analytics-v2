// =============================================================================
// sms.ts — SMS notification worker via Twilio
// Implements: REQ-NOT-01, 35-security-and-observability.md §8
// =============================================================================

import type { Job } from 'bullmq';

/** SMS notification job payload (MFA code delivery only). */
interface SMSJobData {
  to: string;
  message: string;
  tenantId: string;
}

/** SMS notification result for audit logging. */
interface SMSResult {
  messageId: string;
  status: 'sent' | 'skipped' | 'failed';
  timestamp: string;
}

/**
 * Processes an SMS notification job from the BullMQ queue.
 * In production, sends via Twilio API.
 * In development, SMS is disabled (skipped).
 *
 * Error handling:
 * - 429/5xx: retry (transient failure)
 * - 4xx (invalid number): permanent failure, no retry
 *
 * @param job — BullMQ job with SMS payload
 * @returns SMS result for audit logging
 */
export async function processSMSJob(job: Job<SMSJobData>): Promise<SMSResult> {
  const { to, message, tenantId } = job.data;

  // Validate phone number before sending
  if (!isValidPhone(to)) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Dev mode: skip SMS delivery entirely
    console.log(`[DEV SMS] to=${to} msg=${message}`);
    return {
      messageId: `dev-sms-${Date.now()}`,
      status: 'skipped',
      timestamp: new Date().toISOString(),
    };
  }

  // Production: send via Twilio
  return sendViaTwilio(to, message, tenantId);
}

/**
 * Sends an SMS via the Twilio API.
 * Throws on transient errors (429/5xx) for BullMQ retry.
 * Throws on permanent errors (4xx) — caller should not retry.
 *
 * @param to — Recipient phone number (E.164 format)
 * @param message — SMS body text
 * @param _tenantId — Tenant for audit logging
 */
async function sendViaTwilio(
  to: string,
  message: string,
  _tenantId: string,
): Promise<SMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: message,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (response.status >= 500 || response.status === 429) {
    throw new Error(`Twilio transient error: ${response.status}`);
  }

  if (response.status >= 400) {
    throw new Error(`Twilio permanent error: ${response.status}`);
  }

  const data = await response.json() as { sid: string };
  return {
    messageId: data.sid,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
}

/** Basic E.164 phone number validation. */
function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone);
}
