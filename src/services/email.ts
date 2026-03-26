/**
 * Email Service — sends transactional emails via Resend.
 *
 * Free tier: 100 emails/day, no credit card needed.
 * Sign up at https://resend.com and get an API key.
 *
 * If no API key is set, falls back to console logging the email
 * (so dev still works without Resend).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Bot Trade Arena <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[Email] No RESEND_API_KEY set — logging email instead:`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${html.substring(0, 200)}...`);
    return true; // Don't block the flow in dev
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Email] Failed to send to ${to}: ${err}`);
      return false;
    }

    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Email] Error sending to ${to}:`, err);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

  return sendEmail({
    to,
    subject: 'Reset your Bot Trade Arena password',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0A0E1A; color: #F1F5F9; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366F1, #8B5CF6); width: 50px; height: 50px; border-radius: 12px; line-height: 50px; font-weight: bold; color: white; font-size: 18px;">BT</div>
          <h1 style="margin: 15px 0 5px; font-size: 22px; color: #F1F5F9;">Bot Trade Arena</h1>
        </div>
        <h2 style="font-size: 18px; text-align: center; color: #F1F5F9;">Reset Your Password</h2>
        <p style="color: #94A3B8; text-align: center; line-height: 1.6;">
          Someone requested a password reset for your account. Click the button below to set a new password.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #475569; text-align: center; font-size: 13px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 30px 0;" />
        <p style="color: #475569; text-align: center; font-size: 12px;">
          Bot Trade Arena — Compete. Trade. Win.
        </p>
      </div>
    `,
  });
}
