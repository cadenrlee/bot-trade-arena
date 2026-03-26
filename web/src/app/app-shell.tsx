'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

// Pages that should NOT show the sidebar (full-screen experiences)
const FULL_SCREEN_PAGES = ['/', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PAGES.includes(pathname);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Full screen pages — no sidebar, no topbar
  if (isFullScreen) {
    return <>{children}</>;
  }

  // Regular pages — sidebar on desktop, bottom nav on mobile
  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex-col z-40">
        <div className="p-5 border-b border-[var(--border-default)]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-xs">BT</div>
            <span className="text-sm font-bold font-[family-name:var(--font-display)]">Bot Trade Arena</span>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavLink href="/" icon="⚔" label="Battle" />
          <NavLink href="/armory" icon="🗡" label="Armory" />
          <NavLink href="/battlepass" icon="⭐" label="Battle Pass" />
          <NavLink href="/history" icon="📜" label="History" />
          <NavLink href="/leaderboards" icon="🏆" label="Rankings" />
          <NavLink href="/social" icon="👥" label="Friends" />
          {user && <NavLink href="/bots" icon="🤖" label="My Bots" />}
          {user && <NavLink href="/bots/connect" icon="⚡" label="Go Ranked" highlight />}
        </nav>
        {user ? (
          <div className="p-3 border-t border-[var(--border-default)]">
            <Link href={`/profile/${user.username}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-tertiary)]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white text-xs font-bold">
                {(user.username || '?')[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium truncate">{user.username}</span>
            </Link>
            <button
              onClick={() => { logout(); window.location.href = '/'; }}
              className="w-full mt-1 text-left px-2 py-1.5 rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-[var(--border-default)] space-y-1.5">
            <Link href="/auth/register" className="block text-center py-2 rounded-lg text-xs font-bold btn-primary text-white">Sign Up</Link>
            <Link href="/auth/login" className="block text-center py-1.5 text-xs text-[var(--text-tertiary)]">Sign In</Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-56 flex flex-col h-full pb-16 md:pb-0">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] z-40 flex">
        <MobileTab href="/" icon="⚔" label="Battle" />
        <MobileTab href="/armory" icon="🗡" label="Armory" />
        <MobileTab href="/leaderboards" icon="🏆" label="Rank" />
        <MobileTab href="/social" icon="👥" label="Friends" />
        <MobileTab href={user ? `/profile/${user.username}` : '/auth/login'} icon="👤" label={user ? 'Me' : 'Sign In'} />
        {user && (
          <button
            onClick={() => { logout(); window.location.href = '/'; }}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-center transition-colors text-[var(--text-tertiary)] cursor-pointer"
          >
            <span className="text-lg">🚪</span>
            <span className="text-[10px]">Sign Out</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function NavLink({ href, icon, label, highlight }: { href: string; icon: string; label: string; highlight?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} className={cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
      active ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] font-medium' :
      highlight ? 'text-[var(--accent-purple)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
    )}>
      <span>{icon}</span>
      <span>{label}</span>
      {highlight && !active && <span className="ml-auto text-[8px] font-bold bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] px-1.5 py-0.5 rounded">PRO</span>}
    </Link>
  );
}

function MobileTab({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} className={cn(
      'flex-1 flex flex-col items-center gap-0.5 py-2 text-center transition-colors',
      active ? 'text-[var(--accent-indigo)]' : 'text-[var(--text-tertiary)]',
    )}>
      <span className="text-lg">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </Link>
  );
}
