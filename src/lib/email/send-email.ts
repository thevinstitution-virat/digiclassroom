// src/lib/email/send-email.ts
// Transactional email sender for DigiClassroom Pro.
//
// Uses Resend's HTTP API directly (no SDK dependency — keeps the bundle lean
// and avoids an install). Swap the transport here if you move to SMTP/SES later;
// callers only depend on sendEmail().
//
// Config (env):
//   RESEND_API_KEY   — Resend API key. If unset, emails are logged, NOT sent
//                      (dev fallback — auth flows degrade gracefully instead of crashing).
//   EMAIL_FROM       — From address, e.g. "DigiClassroom Pro <noreply@yourdomain.com>"

import { logger } from '@/lib/logger';
import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send a transactional email.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing. Production requires a valid Resend API key to send emails.');
  }

  const EMAIL_FROM = process.env.EMAIL_FROM || 'DigiClassroom Pro <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (error) {
      logger.error('[email] Resend SDK error', { error, to, subject });
      return { ok: false, error: error.message };
    }

    logger.info('[email] sent', { to, subject, id: data?.id });
    return { ok: true, id: data?.id };
  } catch (err) {
    logger.error('[email] send failed', { error: (err as Error).message, to, subject });
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Minimal branded HTML wrapper for transactional emails.
 */
export function emailLayout(opts: { heading: string; body: string; ctaLabel?: string; ctaUrl?: string }): string {
  const { heading, body, ctaLabel, ctaUrl } = opts;
  const button =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">${ctaLabel}</a>`
      : '';
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
    <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#334155">${body}</div>
    ${button}
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">DigiClassroom Pro · If you didn't request this, you can safely ignore this email.</p>
  </div></body></html>`;
}
