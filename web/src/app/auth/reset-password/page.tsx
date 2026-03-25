'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

function ResetForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!token) { setError('Missing reset token'); return; }

    setLoading(true);
    setError('');
    try {
      await api.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">&#9989;</div>
        <h1 className="text-xl font-bold font-[var(--font-display)] mb-2">Password Reset!</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Your password has been changed. You can now sign in.
        </p>
        <Link href="/auth/login">
          <Button className="w-full">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold font-[var(--font-display)] mb-1">Set New Password</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Enter your new password below.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="New Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Confirm Password" type="password" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error} />
        <Button type="submit" loading={loading} className="w-full">Reset Password</Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card hover={false} className="w-full max-w-md p-8">
        <Suspense fallback={<div className="text-center text-[var(--text-tertiary)]">Loading...</div>}>
          <ResetForm />
        </Suspense>
      </Card>
    </div>
  );
}
