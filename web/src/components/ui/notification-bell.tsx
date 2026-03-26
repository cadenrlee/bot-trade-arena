'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { timeAgo } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  STREAK_WARNING: '🔥',
  MATCH_RESULT: '⚔',
  TOURNAMENT: '🏆',
  RANK_UP: '📈',
  FRIEND_ACTIVITY: '👥',
  DECAY_WARNING: '⏳',
  NEW_SEASON: '🌟',
  ACHIEVEMENT: '🎖',
};

const POLL_INTERVAL = 30000;

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getUnreadNotifications();
      const list = Array.isArray(data) ? data : [];
      setUnreadCount(list.length);
    } catch {
      // silently fail
    }
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getNotifications();
      const list = Array.isArray(data) ? data : data?.data || data?.notifications || [];
      setNotifications(list.slice(0, 20));
      // Also refresh unread count
      const unread = await api.getUnreadNotifications();
      setUnreadCount(Array.isArray(unread) ? unread.length : 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Poll for unread count
  useEffect(() => {
    if (!user) return;
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, fetchUnread]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently fail
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-secondary)]"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-[var(--accent-red)] rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-[420px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
            <span className="text-sm font-bold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--accent-indigo)] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[360px]">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                  }}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer border-b border-[var(--border-default)] last:border-b-0 ${
                    !n.read ? 'bg-[var(--accent-indigo)]/5' : ''
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {NOTIFICATION_ICONS[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-medium truncate ${!n.read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent-indigo)] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1 font-[family-name:var(--font-mono)]">
                      {n.createdAt ? timeAgo(n.createdAt) : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
