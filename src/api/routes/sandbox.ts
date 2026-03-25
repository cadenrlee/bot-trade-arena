import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
function createId() { return crypto.randomBytes(12).toString('hex'); }
import { config } from '../../lib/config';

const router = Router();

// ---------------------------------------------------------------------------
// In-memory sandbox session store
// ---------------------------------------------------------------------------

interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  openedAt: number;
}

interface SandboxTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  action: 'OPEN' | 'CLOSE';
  quantity: number;
  price: number;
  pnl: number | null;
  timestamp: number;
}

interface SandboxSession {
  id: string;
  botId: string | null;
  cash: number;
  startingCapital: number;
  positions: Position[];
  trades: SandboxTrade[];
  pnl: number;
  createdAt: number;
}

const sessions = new Map<string, SandboxSession>();

// Auto-clean sessions older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt < oneHourAgo) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const startSchema = z.object({
  botId: z.string().min(1).optional(),
});

const tradeSchema = z.object({
  sessionId: z.string().min(1),
  symbol: z.string().min(1),
  side: z.enum(['LONG', 'SHORT']),
  action: z.enum(['OPEN', 'CLOSE']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  positionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/sandbox/start — start a sandbox session
router.post('/start', (req: Request, res: Response) => {
  try {
    const data = startSchema.parse(req.body);

    const session: SandboxSession = {
      id: createId(),
      botId: data.botId ?? null,
      cash: config.match.startingCapital,
      startingCapital: config.match.startingCapital,
      positions: [],
      trades: [],
      pnl: 0,
      createdAt: Date.now(),
    };

    sessions.set(session.id, session);

    res.status(201).json({
      sessionId: session.id,
      cash: session.cash,
      startingCapital: session.startingCapital,
      symbols: config.symbols,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Sandbox start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sandbox/trade — execute a trade in sandbox
router.post('/trade', (req: Request, res: Response) => {
  try {
    const data = tradeSchema.parse(req.body);
    const session = sessions.get(data.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sandbox session not found' });
      return;
    }

    const tradeValue = data.quantity * data.price;

    if (data.action === 'OPEN') {
      // Check position limit
      if (session.positions.length >= config.match.maxOpenPositions) {
        res.status(400).json({ error: `Max ${config.match.maxOpenPositions} open positions allowed` });
        return;
      }

      // Check capital
      if (tradeValue > session.cash) {
        res.status(400).json({ error: 'Insufficient funds' });
        return;
      }

      // Check max position size
      const maxValue = session.startingCapital * config.match.maxPositionPct;
      if (tradeValue > maxValue) {
        res.status(400).json({ error: `Position exceeds max ${config.match.maxPositionPct * 100}% of starting capital` });
        return;
      }

      const position: Position = {
        id: createId(),
        symbol: data.symbol,
        side: data.side,
        quantity: data.quantity,
        entryPrice: data.price,
        openedAt: Date.now(),
      };

      session.positions.push(position);
      session.cash -= tradeValue;

      const trade: SandboxTrade = {
        id: createId(),
        symbol: data.symbol,
        side: data.side,
        action: 'OPEN',
        quantity: data.quantity,
        price: data.price,
        pnl: null,
        timestamp: Date.now(),
      };
      session.trades.push(trade);

      res.json({
        success: true,
        trade,
        positionId: position.id,
        cash: session.cash,
      });
    } else {
      // CLOSE
      const posIdx = data.positionId
        ? session.positions.findIndex((p) => p.id === data.positionId)
        : session.positions.findIndex((p) => p.symbol === data.symbol && p.side === data.side);

      if (posIdx === -1) {
        res.status(404).json({ error: 'No matching open position found' });
        return;
      }

      const position = session.positions[posIdx];
      const closeQty = Math.min(data.quantity, position.quantity);
      const closeValue = closeQty * data.price;

      let pnl: number;
      if (position.side === 'LONG') {
        pnl = (data.price - position.entryPrice) * closeQty;
      } else {
        pnl = (position.entryPrice - data.price) * closeQty;
      }

      session.cash += closeValue;
      session.pnl += pnl;

      if (closeQty >= position.quantity) {
        session.positions.splice(posIdx, 1);
      } else {
        position.quantity -= closeQty;
      }

      const trade: SandboxTrade = {
        id: createId(),
        symbol: data.symbol,
        side: data.side,
        action: 'CLOSE',
        quantity: closeQty,
        price: data.price,
        pnl,
        timestamp: Date.now(),
      };
      session.trades.push(trade);

      res.json({
        success: true,
        trade,
        cash: session.cash,
        totalPnl: session.pnl,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Sandbox trade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sandbox/state — current sandbox state
router.get('/state', (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId query parameter required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sandbox session not found' });
      return;
    }

    res.json({
      sessionId: session.id,
      botId: session.botId,
      cash: session.cash,
      startingCapital: session.startingCapital,
      positions: session.positions,
      trades: session.trades,
      pnl: session.pnl,
      tradeCount: session.trades.length,
      createdAt: session.createdAt,
    });
  } catch (err) {
    console.error('Sandbox state error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sandbox/reset — reset sandbox
router.post('/reset', (req: Request, res: Response) => {
  try {
    const sessionId = req.body.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required in body' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sandbox session not found' });
      return;
    }

    session.cash = session.startingCapital;
    session.positions = [];
    session.trades = [];
    session.pnl = 0;

    res.json({
      success: true,
      sessionId: session.id,
      cash: session.cash,
    });
  } catch (err) {
    console.error('Sandbox reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
