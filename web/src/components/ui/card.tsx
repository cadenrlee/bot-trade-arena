'use client';
import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-sm',
        hover && 'transition-all duration-150 hover:border-[var(--border-hover)] hover:scale-[1.005]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("font-[var(--font-display)] text-base font-semibold text-[var(--text-primary)]", className)}>
      {children}
    </h3>
  );
}
