'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { TierBadge } from '@/components/ui/tier-badge';

const publicNav = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/matches/live', label: 'Live Matches', icon: '◉', live: true },
  { href: '/leaderboards', label: 'Rankings', icon: '☰' },
];

const authedNav = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/matches/live', label: 'Find a Match', icon: '◉', live: true },
  { href: '/social', label: 'Friends & Battle', icon: '⚔' },
  { href: '/armory', label: 'Armory', icon: '🗡', highlight: true },
  { href: '/bots', label: 'My Bots', icon: '⚙' },
  { href: '/bots/connect', label: 'Connect Platform', icon: '⚡', highlight: true },
  { href: '/bots/templates', label: 'Bot Builder', icon: '✦' },
  { href: '/leaderboards', label: 'Rankings', icon: '☰' },
  { href: '/tournaments', label: 'Tournaments', icon: '⚑' },
  { href: '/challenges', label: 'Challenges', icon: '★' },
  { href: '/sandbox', label: 'Sandbox', icon: '▶' },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navItems = user ? authedNav : publicNav;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border-default)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white font-bold text-sm">
            BT
          </div>
          <div>
            <h1 className="text-sm font-bold font-[family-name:var(--font-display)] text-[var(--text-primary)]">
              Bot Trade Arena
            </h1>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
              Compete. Trade. Win.
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isExactMatch = pathname === item.href;
          const isChildMatch = item.href !== '/' && pathname.startsWith(item.href + '/');
          // Don't highlight parent if a more specific child nav item matches
          const hasMoreSpecificMatch = navItems.some(n => n.href !== item.href && n.href.startsWith(item.href) && (pathname === n.href || pathname.startsWith(n.href + '/')));
          const isActive = isExactMatch || (isChildMatch && !hasMoreSpecificMatch);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-150',
                isActive
                  ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] font-medium'
                  : (item as any).highlight
                    ? 'text-[var(--accent-purple)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {(item as any).highlight && !isActive && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-purple)]/20 text-[var(--accent-purple)] px-1.5 py-0.5 rounded">
                  New
                </span>
              )}
              {(item as any).live && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[var(--accent-red)] live-dot" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-[var(--border-default)]">
        {user ? (
          <div className="space-y-2">
            <Link
              href={`/profile/${user.username}`}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white text-sm font-bold">
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.username}</p>
                <div className="flex items-center gap-2">
                  <TierBadge tier={user.tier} size="sm" />
                  <span className="text-xs font-[var(--font-mono)] text-[var(--text-secondary)]">{user.elo}</span>
                </div>
              </div>
            </Link>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href="/auth/register"
              className="block w-full text-center py-2.5 rounded-xl text-sm font-medium btn-primary text-white"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="block w-full text-center py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
