'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await register(email, username, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Try a different username or email.');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card hover={false} className="w-full max-w-md p-8">
        <h1
          className="text-2xl font-bold text-center mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Username"
            type="text"
            placeholder="cool_trader"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && (
            <p className="text-sm text-[var(--accent-red)]">{error}</p>
          )}

          <Button type="submit" size="lg" loading={isLoading} className="w-full mt-2">
            Create Account
          </Button>
        </form>

        <p className="text-sm text-[var(--text-secondary)] text-center mt-6">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-[var(--accent-indigo)] hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
