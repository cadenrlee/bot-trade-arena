'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [devToken, setDevToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.request<any>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
      if (res.token) setDevToken(res.token);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card hover={false} className="w-full max-w-md p-8">
        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">&#9993;</div>
            <h1 className="text-xl font-bold font-[var(--font-display)] mb-2">Check your email</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              If an account with that email exists, we sent a password reset link.
            </p>
            {devToken && (
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] mb-4">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Dev mode — reset link:</p>
                <Link
                  href={`/auth/reset-password?token=${devToken}`}
                  className="text-sm text-[var(--accent-indigo)] hover:underline break-all"
                >
                  Click here to reset password
                </Link>
              </div>
            )}
            <Link href="/auth/login" className="text-sm text-[var(--accent-indigo)] hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold font-[var(--font-display)] mb-1">Reset Password</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />
              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-[var(--text-tertiary)]">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-[var(--accent-indigo)] hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
