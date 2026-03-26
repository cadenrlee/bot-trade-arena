'use client';

const STORAGE_KEY = 'bta-sound-enabled';

let audioCtx: AudioContext | null = null;
let soundEnabled: boolean = true;

// Load preference from localStorage on module init
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    soundEnabled = stored === 'true';
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  startTime?: number,
): { osc: OscillatorNode; gain: GainNode } {
  const t = startTime ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
  return { osc, gain };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function initAudio(): void {
  getCtx();
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

// ── Sound Effects ────────────────────────────────────────────────────────────

/** Short punchy synth hit — quick sine sweep down, 100ms */
export function playAttack(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Impact sound — noise burst + low thud, 150ms */
export function playHit(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Noise burst
  const noiseBuffer = createNoiseBuffer(ctx, 0.15);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1000, t);
  bandpass.Q.setValueAtTime(0.5, t);
  noiseSrc.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSrc.start(t);
  noiseSrc.stop(t + 0.15);

  // Low thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

/** Bigger version of attack — chord + sweep, 200ms */
export function playCrit(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(1200, t);
  sweep.frequency.exponentialRampToValueAtTime(150, t + 0.2);
  sweepGain.gain.setValueAtTime(0.25, t);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  sweep.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweep.start(t);
  sweep.stop(t + 0.2);

  // Chord (major triad)
  [440, 554, 659].forEach((freq) => {
    playTone(ctx, freq, 0.18, 'sine', 0.15, t);
  });
}

/** Victory fanfare — ascending arpeggio, 3 notes, major chord */
export function playWin(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    playTone(ctx, freq, 0.3 - i * 0.05, 'triangle', 0.3, t + i * 0.12);
  });
}

/** Defeat sound — descending minor, 2 notes */
export function playLose(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(ctx, 440, 0.25, 'triangle', 0.25, t);
  playTone(ctx, 349.23, 0.3, 'triangle', 0.25, t + 0.15); // F4 — minor feel
}

/** Attention-grabbing alert — two-tone ping, like a notification */
export function playMarketEvent(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(ctx, 880, 0.08, 'sine', 0.3, t);
  playTone(ctx, 1175, 0.12, 'sine', 0.3, t + 0.1);
}

/** Satisfying catch sound — coin/powerup feel, ascending */
export function playEventCaught(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(ctx, 987, 0.08, 'square', 0.15, t);
  playTone(ctx, 1318, 0.08, 'square', 0.15, t + 0.06);
  playTone(ctx, 1568, 0.14, 'square', 0.15, t + 0.12);
}

/** Miss sound — sad descending whomp */
export function playEventMissed(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Tick sound for last 5 seconds — short blip */
export function playCountdown(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  playTone(ctx, 1000, 0.05, 'square', 0.2);
}

/** Combo sound that gets higher pitched with higher combo count */
export function playCombo(count: number): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const baseFreq = 600 + Math.min(count, 10) * 80;
  const t = ctx.currentTime;
  playTone(ctx, baseFreq, 0.06, 'square', 0.2, t);
  playTone(ctx, baseFreq * 1.5, 0.08, 'square', 0.15, t + 0.05);
}

/** Rank up sound — triumphant, 400ms */
export function playEloUp(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    playTone(ctx, freq, 0.35 - i * 0.06, 'triangle', 0.25, t + i * 0.09);
  });
}

/** Rank down — subtle, not punishing, 200ms */
export function playEloDown(): void {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(ctx, 350, 0.12, 'sine', 0.15, t);
  playTone(ctx, 280, 0.15, 'sine', 0.15, t + 0.08);
}
