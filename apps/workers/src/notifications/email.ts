// =============================================================================
// email.ts — Email notification worker via SendGrid
// Implements: REQ-NOT-01, 35-security-and-observability.md §8
// =============================================================================

import type { Job } from 'bullmq';

/** Email notification job payload. */
interface EmailJobData {
  to: string;
  template: 'welcome' | 'payment_failure' | 'mfa_reset';
  templateData: Record<string, string>;
  tenantId: string;
}

/** Email notification result for audit logging. */
interface EmailResult {
  messageId: string;
  status: 'sent' | 'failed';
  timestamp: string;
}

/**
 * Processes an email notification job from the BullMQ queue.
 * In production, sends via SendGrid API.
 * In development, logs to console (or sends to Mailpit).
 *
 * Error handling:
 * - 429/5xx: retry (transient failure)
 * - 4xx (invalid address): permanent failure, no retry
 *
 * @param job — BullMQ job with email payload
 * @returns Email result for audit logging
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<EmailResult> {
  const { to, template, templateData, tenantId } = job.data;

  // Validate recipient address before sending
  if (!isValidEmail(to)) {
    // DR-034: Invalid email → permanent failure, no retry
    throw new Error(`Invalid email address: ${to}`);
  }

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Dev mode: log to console instead of sending
    console.log(`[DEV EMAIL] to=${to} template=${template} data=${JSON.stringify(templateData)}`);
    return {
      messageId: `dev-${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }

  // Production: send via SendGrid
  return sendViaSendGrid(to, template, templateData, tenantId);
}

/**
 * Sends an email via the SendGrid API.
 * Throws on transient errors (429/5xx) for BullMQ retry.
 * Throws on permanent errors (4xx) — caller should not retry.
 *
 * @param to — Recipient email address
 * @param template — Template identifier
 * @param templateData — Template variable substitutions
 * @param tenantId — Tenant for audit logging
 */
async function sendViaSendGrid(
  to: string,
  template: string,
  templateData: Record<string, string>,
  _tenantId: string,
): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { email: 'noreply@zenoti-analytics.com' },
      personalizations: [{ to: [{ email: to }], dynamic_template_data: templateData }],
      template_id: getTemplateId(template),
    }),
  });

  if (response.status >= 500 || response.status === 429) {
    // Transient: BullMQ will retry
    throw new Error(`SendGrid transient error: ${response.status}`);
  }

  if (response.status >= 400) {
    // Permanent: invalid address, bad request — do not retry
    throw new Error(`SendGrid permanent error: ${response.status}`);
  }

  return {
    messageId: response.headers.get('X-Message-Id') ?? `sg-${Date.now()}`,
    status: 'sent',
    timestamp: new Date().toISOString(),
  };
}

/** Maps template name to SendGrid template ID. */
function getTemplateId(template: string): string {
  const ids: Record<string, string> = {
    welcome: process.env.SENDGRID_TEMPLATE_WELCOME ?? '',
    payment_failure: process.env.SENDGRID_TEMPLATE_PAYMENT_FAILURE ?? '',
    mfa_reset: process.env.SENDGRID_TEMPLATE_MFA_RESET ?? '',
  };
  return ids[template] ?? '';
}

/** Basic email address validation. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
