const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://bot-trade-arena-production.up.railway.app/ws';

type MessageHandler = (data: any) => void;

class SpectatorSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.token = token || null;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      if (this.token) {
        this.send({ type: 'auth', token: this.token });
      }
      this.emit('connected', {});
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit(msg.type, msg.data);
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', {});
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.token || undefined);
    }, 3000);
  }

  // Subscriptions
  subscribeMatch(matchId: string) {
    this.send({ type: 'subscribe:match', matchId });
  }

  unsubscribeMatch(matchId: string) {
    this.send({ type: 'unsubscribe:match', matchId });
  }

  subscribeQueue() {
    this.send({ type: 'subscribe:queue' });
  }

  subscribeLeaderboard(period: string) {
    this.send({ type: 'subscribe:leaderboard', period });
  }

  // Event system
  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    this.handlers.get(event)?.forEach(h => h(data));
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const spectatorSocket = new SpectatorSocket();
