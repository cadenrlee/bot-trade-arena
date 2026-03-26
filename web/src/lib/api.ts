const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bot-trade-arena-production.up.railway.app';

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const authToken = token || this.token;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, body.error || 'Unknown error');
    }

    return res.json();
  }

  // Auth
  register(data: { email: string; username: string; password: string }) {
    return this.request<{ user: any; accessToken: string; refreshToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  login(data: { login: string; password: string }) {
    return this.request<{ user: any; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  refresh(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // Users
  getMe() { return this.request<any>('/api/users/me'); }
  updateMe(data: any) { return this.request<any>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }); }
  getUser(username: string) { return this.request<any>(`/api/users/${username}`); }
  getUserBots(username: string) { return this.request<any[]>(`/api/users/${username}/bots`); }
  followUser(username: string) { return this.request<any>(`/api/users/${username}/follow`, { method: 'POST' }); }
  unfollowUser(username: string) { return this.request<any>(`/api/users/${username}/follow`, { method: 'DELETE' }); }
  getFollowers() { return this.request<any[]>('/api/users/me/followers'); }
  getFollowing() { return this.request<any[]>('/api/users/me/following'); }
  getMyAchievements() { return this.request<any[]>('/api/users/me/achievements'); }

  // Bots
  getBots() { return this.request<any[]>('/api/bots'); }
  createBot(data: { name: string; language: string; description?: string }) {
    return this.request<any>('/api/bots', { method: 'POST', body: JSON.stringify(data) });
  }
  getBot(id: string) { return this.request<any>(`/api/bots/${id}`); }
  updateBot(id: string, data: any) { return this.request<any>(`/api/bots/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  deleteBot(id: string) { return this.request<any>(`/api/bots/${id}`, { method: 'DELETE' }); }
  regenerateKey(id: string) { return this.request<{ apiKey: string }>(`/api/bots/${id}/regenerate-key`, { method: 'POST' }); }

  // Matches
  getLiveMatches() { return this.request<any[]>('/api/matches/live'); }
  getMatch(id: string) { return this.request<any>(`/api/matches/${id}`); }
  getMatchReplay(id: string) { return this.request<any[]>(`/api/matches/${id}/replay`); }
  getMyMatches(page = 1) { return this.request<any[]>(`/api/matches?page=${page}`); }

  // Leaderboards
  getLeaderboard(period: string, params?: { tier?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.tier) query.set('tier', params.tier);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return this.request<any>(`/api/leaderboards/${period}?${query}`);
  }

  // Seasons
  async getSeasons() {
    const res = await this.request<any>('/api/seasons');
    return Array.isArray(res) ? res : (res?.data || []);
  }
  getCurrentSeason() { return this.request<any>('/api/seasons/current'); }

  // Tournaments
  async getTournaments() {
    const res = await this.request<any>('/api/tournaments');
    return Array.isArray(res) ? res : (res?.data || []);
  }
  getTournament(id: string) { return this.request<any>(`/api/tournaments/${id}`); }
  registerTournament(id: string, botId: string) {
    return this.request<any>(`/api/tournaments/${id}/register`, { method: 'POST', body: JSON.stringify({ botId }) });
  }

  // Challenges
  async getChallenges() {
    const res = await this.request<any>('/api/challenges');
    return Array.isArray(res) ? res : (res?.data || []);
  }
  getDailyChallenge() { return this.request<any>('/api/challenges/daily'); }
  startChallenge(id: string, botId: string) {
    return this.request<any>(`/api/challenges/${id}/start`, { method: 'POST', body: JSON.stringify({ botId }) });
  }

  // Clans
  async getClans() {
    const res = await this.request<any>('/api/clans');
    return Array.isArray(res) ? res : (res?.data || []);
  }
  createClan(data: { name: string; tag: string; description?: string }) {
    return this.request<any>('/api/clans', { method: 'POST', body: JSON.stringify(data) });
  }
  joinClan(id: string) { return this.request<any>(`/api/clans/${id}/join`, { method: 'POST' }); }
  leaveClan(id: string) { return this.request<any>(`/api/clans/${id}/leave`, { method: 'DELETE' }); }

  // Billing
  getPlans() { return this.request<any[]>('/api/billing/plans'); }
  subscribe(plan: string) { return this.request<any>('/api/billing/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }); }

  // Alpaca real trading stats
  getAlpacaProfile(username: string) { return this.request<any>(`/api/alpaca/profile/${username}`); }
  getAlpacaStats() { return this.request<any>('/api/alpaca/stats-by-keys'); }

  // Performance leaderboard
  getPerformanceLeaderboard(sort?: string) {
    const q = sort ? `?sort=${sort}` : '';
    return this.request<any>(`/api/performance-leaderboard${q}`);
  }

  // Feed
  getFeed(page = 1) { return this.request<any>(`/api/feed?page=${page}`); }
  getUserPosts(username: string) { return this.request<any[]>(`/api/feed/user/${username}`); }
  createPost(data: { content: string; type?: string; attachStats?: boolean }) {
    return this.request<any>('/api/feed', { method: 'POST', body: JSON.stringify(data) });
  }
  likePost(id: string) { return this.request<any>(`/api/feed/${id}/like`, { method: 'POST' }); }
  commentOnPost(id: string, content: string) {
    return this.request<any>(`/api/feed/${id}/comment`, { method: 'POST', body: JSON.stringify({ content }) });
  }
  getPostComments(id: string) { return this.request<any[]>(`/api/feed/${id}/comments`); }
  deletePost(id: string) { return this.request<any>(`/api/feed/${id}`, { method: 'DELETE' }); }

  // Health
  getHealth() { return this.request<any>('/api/health'); }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const api = new ApiClient(API_URL);
