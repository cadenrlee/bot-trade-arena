'use client';
import { useAuthStore } from '@/stores/auth';

export function Topbar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-default)] flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Streak + XP */}
      <div className="flex items-center gap-6">
        {user && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-lg">&#x1F525;</span>
              <span className="font-[var(--font-mono)] text-sm font-bold text-[var(--text-primary)]">
                {user.streak || 0}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 w-32 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent-indigo)] to-[var(--accent-purple)]"
                  style={{ width: `${((user.xp || 0) % 1000) / 10}%` }}
                />
              </div>
              <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">
                Lv.{user.level || 1}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Season info */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-[var(--text-tertiary)]">Season 1</span>
        <button className="relative p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
          <span className="text-[var(--text-secondary)]">&#x1F514;</span>
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent-red)]" />
        </button>
      </div>
    </header>
  );
}
