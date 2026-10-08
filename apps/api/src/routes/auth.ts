import { asyncHandler } from '../lib/asyncHandler';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';
import type { AuthUser } from '@dinely/types';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  outletId: z.string().uuid().optional(),
});

authRouter.post('/login', asyncHandler(async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { username: body.username, isActive: true },
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      return;
    }

    const outletId = body.outletId ?? user.outletAssignments[0];
    if (!outletId || !user.outletAssignments.includes(outletId)) {
      res.status(400).json({ error: { code: 'NO_OUTLET', message: 'User has no assigned outlet' } });
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AuthUser['role'],
      outletIds: user.outletAssignments,
    };

    const token = signToken(authUser, outletId);
    res.json({ token, user: authUser, outletId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }
    throw err;
  }
}));

const pinSchema = z.object({
  pin: z.string().length(4),
  outletId: z.string().uuid(),
});

authRouter.post('/pin', asyncHandler(async (req, res) => {
  try {
    const body = pinSchema.parse(req.body);
    const users = await prisma.user.findMany({ where: { isActive: true, pinHash: { not: null }, outletAssignments: { has: body.outletId } } });

    for (const user of users) {
      if (user.pinHash && (await bcrypt.compare(body.pin, user.pinHash))) {
        const outletId = body.outletId ?? user.outletAssignments[0];
        const authUser: AuthUser = {
          id: user.id,
          tenantId: user.tenantId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role as AuthUser['role'],
          outletIds: user.outletAssignments,
        };
        res.json({ token: signToken(authUser, outletId!), user: authUser, outletId });
        return;
      }
    }

    res.status(401).json({ error: { code: 'INVALID_PIN', message: 'Invalid PIN' } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      return;
    }
    throw err;
  }
}));
