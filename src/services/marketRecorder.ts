import prisma from '../lib/prisma';
import { config } from '../lib/config';
import { MarketDataService } from './marketData';
import type { MarketTick } from '../engine/match';

/**
 * Market Data Recorder
 *
 * During trading hours, records real stock price data in chunks.
 * Each chunk = 5 minutes of tick data for a set of symbols.
 * These chunks are used for:
 *   1. Async matches — both bots play the same recorded data
 *   2. Off-hours play — replay today's market data
 *   3. Challenges — play a specific market scenario
 *
 * This is what makes head-to-head work without both players being online.
 */

interface RecordedChunk {
  id: string;
  symbols: string[];
  startTime: Date;
  endTime: Date;
  ticks: MarketTick[];
  sessionType: 'MARKET_HOURS' | 'CRYPTO_24H';
}

// In-memory buffer during recording
let currentBuffer: MarketTick[] = [];
let currentChunkStart: Date | null = null;
const CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes per chunk

export class MarketRecorder {
  private recording = false;
  private marketData: MarketDataService;
  private chunkTimer: NodeJS.Timeout | null = null;

  constructor(marketData: MarketDataService) {
    this.marketData = marketData;
  }

  /**
   * Start recording market ticks
   */
  start(): void {
    if (this.recording) return;
    this.recording = true;
    currentBuffer = [];
    currentChunkStart = new Date();

    // Listen to all market ticks
    this.marketData.on('tick', this.onTick);

    // Save chunks every 5 minutes
    this.chunkTimer = setInterval(() => this.saveChunk(), CHUNK_DURATION_MS);

    console.log('[Recorder] Recording market data for async matches');
  }

  stop(): void {
    this.recording = false;
    this.marketData.off('tick', this.onTick);
    if (this.chunkTimer) { clearInterval(this.chunkTimer); this.chunkTimer = null; }
    // Save any remaining data
    if (currentBuffer.length > 0) this.saveChunk();
  }

  private onTick = (tick: MarketTick): void => {
    currentBuffer.push({ ...tick });
  };

  private async saveChunk(): Promise<void> {
    if (currentBuffer.length === 0) return;

    const ticks = currentBuffer;
    const startTime = currentChunkStart || new Date();
    const endTime = new Date();
    const symbols = [...new Set(ticks.map(t => t.symbol))];

    // Reset buffer
    currentBuffer = [];
    currentChunkStart = new Date();

    try {
      await prisma.marketChunk.create({
        data: {
          symbols: JSON.stringify(symbols),
          startTime,
          endTime,
          tickData: JSON.stringify(ticks),
          tickCount: ticks.length,
          sessionType: this.isMarketHours() ? 'MARKET_HOURS' : 'CRYPTO_24H',
        },
      });
      console.log(`[Recorder] Saved chunk: ${ticks.length} ticks, ${symbols.length} symbols`);
    } catch (err) {
      console.error('[Recorder] Failed to save chunk:', err);
    }
  }

  /**
   * Get a random recent chunk for async matches
   */
  static async getRandomChunk(sessionType?: string): Promise<RecordedChunk | null> {
    const where: any = {};
    if (sessionType) where.sessionType = sessionType;

    const count = await prisma.marketChunk.count({ where });
    if (count === 0) return null;

    const skip = Math.floor(Math.random() * count);
    const chunk = await prisma.marketChunk.findFirst({
      where,
      skip,
      orderBy: { startTime: 'desc' },
    });

    if (!chunk) return null;

    return {
      id: chunk.id,
      symbols: JSON.parse(chunk.symbols),
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      ticks: JSON.parse(chunk.tickData),
      sessionType: chunk.sessionType as 'MARKET_HOURS' | 'CRYPTO_24H',
    };
  }

  /**
   * Get today's chunks for replay
   */
  static async getTodayChunks(): Promise<RecordedChunk[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const chunks = await prisma.marketChunk.findMany({
      where: { startTime: { gte: today } },
      orderBy: { startTime: 'asc' },
    });

    return chunks.map(c => ({
      id: c.id,
      symbols: JSON.parse(c.symbols),
      startTime: c.startTime,
      endTime: c.endTime,
      ticks: JSON.parse(c.tickData),
      sessionType: c.sessionType as 'MARKET_HOURS' | 'CRYPTO_24H',
    }));
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const timeMinutes = hours * 60 + minutes;

    // Mon-Fri, 9:30 AM - 4:00 PM ET
    return day >= 1 && day <= 5 && timeMinutes >= 570 && timeMinutes < 960;
  }
}
