'use client';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-xl border bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:border-[var(--accent-indigo)] focus:ring-1 focus:ring-[var(--accent-indigo)]',
            error
              ? 'border-[var(--accent-red)]'
              : 'border-[var(--border-default)]',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
