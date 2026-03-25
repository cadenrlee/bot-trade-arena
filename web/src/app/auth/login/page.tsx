'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(loginField, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check your credentials.');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card hover={false} className="w-full max-w-md p-8">
        <h1
          className="text-2xl font-bold text-center mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Sign In
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email or Username"
            type="text"
            placeholder="you@example.com"
            value={loginField}
            onChange={(e) => setLoginField(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-[var(--accent-red)]">{error}</p>
          )}

          <Button type="submit" size="lg" loading={isLoading} className="w-full mt-2">
            Sign In
          </Button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-[var(--accent-indigo)] hover:underline font-medium">
              Create one
            </Link>
          </p>
          <p>
            <Link href="/auth/forgot-password" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Forgot password?
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
