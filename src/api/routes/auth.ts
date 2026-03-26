import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { config } from '../../lib/config';
import { authMiddleware, type AuthPayload } from '../middleware/auth';
import { sendPasswordResetEmail } from '../../services/email';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
});

const loginSchema = z.object({
  login: z.string(),
  password: z.string(),
});

const resetRequestSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// In-memory reset tokens (production would use Redis or DB)
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();

function signTokens(user: { id: string; username: string; plan: string }) {
  const payload: AuthPayload & { plan: string } = {
    userId: user.id,
    username: user.username,
    plan: user.plan,
  };
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

function userResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    elo: user.elo,
    tier: user.tier,
    plan: user.plan,
    totalWins: user.totalWins || 0,
    totalLosses: user.totalLosses || 0,
    totalMatches: user.totalMatches || 0,
    xp: user.xp || 0,
    level: user.level || 1,
    credits: user.credits || 0,
  };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      res.status(409).json({
        error: existing.email === data.email ? 'Email already registered' : 'Username already taken',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        displayName: data.username,
      },
    });

    const tokens = signTokens(user);
    res.status(201).json({ user: userResponse(user), ...tokens });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: data.login }, { username: data.login }] },
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});

    const tokens = signTokens(user);
    res.json({ user: userResponse(user), ...tokens });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = jwt.verify(refreshToken, config.jwt.secret) as AuthPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const tokens = signTokens(user);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/forgot-password — request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = resetRequestSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success (don't reveal if email exists)
    if (!user) {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    resetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    // Send the reset email
    const emailSent = await sendPasswordResetEmail(user.email, token);

    if (config.nodeEnv === 'development' && !process.env.RESEND_API_KEY) {
      // Dev mode without email service — return token directly
      res.json({ message: 'Reset link generated (dev mode)', token, resetUrl: `/auth/reset-password?token=${token}` });
    } else {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password — reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const entry = resetTokens.get(token);
    if (!entry || Date.now() > entry.expiresAt) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    });

    // Invalidate token
    resetTokens.delete(token);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password — change password while logged in
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of resetTokens) {
    if (now > entry.expiresAt) resetTokens.delete(token);
  }
}, 600000);

export default router;
