// Sentry error tracking setup
// Install: npm install @sentry/node
// Set SENTRY_DSN env var

let Sentry: any = null;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[Sentry] No SENTRY_DSN configured, skipping');
    return;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    console.log('[Sentry] Initialized');
  } catch {
    console.log('[Sentry] @sentry/node not installed, skipping');
  }
}

export function captureException(err: Error) {
  if (Sentry) Sentry.captureException(err);
}

export function captureMessage(msg: string) {
  if (Sentry) Sentry.captureMessage(msg);
}
