'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/ui/tier-badge';
import { cn, timeAgo } from '@/lib/utils';

function MiniEquityChart({ data }: { data: { date: string; equity: number }[] }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 400;
  const h = 100;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 10) - 5;
    return `${x},${y}`;
  });
  const up = values[values.length - 1] >= values[0];
  const color = up ? 'var(--accent-emerald)' : 'var(--accent-red)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="feed-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points.join(' ')} ${w},${h}`} fill="url(#feed-fill)" />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function FeedPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Compose
  const [content, setContent] = useState('');
  const [attachStats, setAttachStats] = useState(false);
  const [posting, setPosting] = useState(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFeed(page);
      setPosts(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch { setPosts([]); }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const post = await api.createPost({
        content: content.trim(),
        type: attachStats ? 'STATS_SNAPSHOT' : 'TEXT',
        attachStats,
      });
      setPosts(prev => [{ ...post, isLiked: false, likeCount: 0, commentCount: 0, comments: [] }, ...prev]);
      setContent('');
      setAttachStats(false);
    } catch { /* */ }
    setPosting(false);
  };

  const handleLike = async (postId: string) => {
    try { return await api.likePost(postId); } catch { return null; }
  };

  const handleDelete = async (postId: string) => {
    try {
      await api.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { /* */ }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">Feed</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">See what traders are up to. Share your wins.</p>
      </div>

      {/* Compose */}
      {user ? (
        <Card hover={false}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Share a trading milestone, strategy insight, or flex your P&L..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-tertiary)]"
            rows={3}
            maxLength={500}
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-default)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={attachStats}
                onChange={e => setAttachStats(e.target.checked)}
                className="rounded border-[var(--border-default)] accent-[var(--accent-indigo)]"
              />
              <span className="text-xs text-[var(--text-secondary)]">Attach live trading stats</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-tertiary)] font-[var(--font-mono)]">{content.length}/500</span>
              <Button size="sm" onClick={handlePost} loading={posting} disabled={!content.trim()}>
                Post
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card hover={false} className="text-center py-6">
          <p className="text-sm text-[var(--text-secondary)]">Sign in to post and interact with the community.</p>
          <Button className="mt-3" onClick={() => router.push('/auth/login')}>Sign In</Button>
        </Card>
      )}

      {/* Posts */}
      {loading ? (
        <div className="text-center py-16 text-[var(--text-tertiary)]">Loading feed...</div>
      ) : posts.length === 0 ? (
        <Card hover={false} className="text-center py-16">
          <div className="text-4xl mb-4">📝</div>
          <p className="text-lg text-[var(--text-secondary)]">No posts yet</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Be the first to share something!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <FeedPost
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-sm text-[var(--text-secondary)] font-[var(--font-mono)]">Page {page} of {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function FeedPost({ post, currentUserId, onLike, onDelete }: any) {
  const stats = post.statsSnapshot ? JSON.parse(post.statsSnapshot) : null;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);

  const toggleLike = async () => {
    const res = await onLike(post.id);
    if (res) {
      setLiked(res.liked);
      setLikeCount((c: number) => res.liked ? c + 1 : c - 1);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      const c = await api.commentOnPost(post.id, commentText.trim());
      setComments(prev => [...prev, { ...c, user: { username: 'you' } }]);
      setCommentText('');
    } catch { /* */ }
  };

  return (
    <Card hover={false} className="space-y-3">
      {/* Author */}
      <div className="flex items-center justify-between">
        <a href={`/profile/${post.user?.username}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-purple)] flex items-center justify-center text-white text-sm font-bold">
            {(post.user?.username || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{post.user?.displayName || post.user?.username}</span>
              <TierBadge tier={post.user?.tier || 'Bronze'} size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-[var(--font-mono)] text-[var(--text-tertiary)]">{post.user?.elo} ELO</span>
              <span className="text-xs text-[var(--text-tertiary)]">{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </a>
        {post.userId === currentUserId && (
          <button onClick={() => onDelete(post.id)} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-red)] cursor-pointer">Delete</button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{post.content}</p>

      {/* Stats snapshot */}
      {stats && (
        <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--border-default)] p-4 space-y-3">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Live Trading Stats</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Equity</p>
              <p className="text-sm font-bold font-[var(--font-mono)]">${stats.equity?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Total P&L</p>
              <p className={cn('text-sm font-bold font-[var(--font-mono)]', stats.totalPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]')}>
                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl?.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Win Rate</p>
              <p className="text-sm font-bold font-[var(--font-mono)] text-[var(--accent-emerald)]">{stats.winRate?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)]">Profit Factor</p>
              <p className="text-sm font-bold font-[var(--font-mono)]">{stats.profitFactor?.toFixed(2)}</p>
            </div>
          </div>
          {stats.equityCurve && stats.equityCurve.length > 1 && (
            <MiniEquityChart data={stats.equityCurve} />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button onClick={toggleLike} className={cn('flex items-center gap-1.5 text-sm cursor-pointer transition-colors', liked ? 'text-[var(--accent-red)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent-red)]')}>
          {liked ? '\u2665' : '\u2661'} <span className="font-[var(--font-mono)]">{likeCount}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
          <span>💬</span> <span className="font-[var(--font-mono)]">{post.commentCount || comments.length}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
          {comments.map((c: any, i: number) => (
            <div key={c.id || i} className="flex gap-2">
              <span className="text-xs font-semibold text-[var(--accent-indigo)]">{c.user?.username || 'anon'}</span>
              <span className="text-xs text-[var(--text-secondary)]">{c.content}</span>
            </div>
          ))}
          {currentUserId && (
            <div className="flex gap-2 mt-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                className="flex-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] outline-none"
              />
              <button onClick={submitComment} className="text-xs text-[var(--accent-indigo)] font-medium cursor-pointer">Post</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
