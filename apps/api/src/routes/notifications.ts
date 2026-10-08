import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireOutletAccess } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
export const notificationsRouter = Router();
notificationsRouter.use(authenticate, requireOutletAccess);
const events = ['stock:low', 'feedback:negative', 'order:voided', 'cash:variance'] as const;
notificationsRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const preference = await prisma.notificationPreference.findUnique({
      where: { tenantId_userId: { tenantId: req.user!.tenantId, userId: req.user!.id } },
    });
    res.json({
      preference: preference ?? { email: false, push: false, events: [...events], pushTokens: [] },
      providers: {
        email: !!process.env.SMTP_HOST,
        push: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      },
    });
  })
);
notificationsRouter.put(
  '/preferences',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.boolean(),
        push: z.boolean(),
        events: z.array(z.enum(events)).max(4),
        pushTokens: z.array(z.string().min(10).max(4096)).max(10).default([]),
      })
      .parse(req.body);
    res.json(
      await prisma.notificationPreference.upsert({
        where: { tenantId_userId: { tenantId: req.user!.tenantId, userId: req.user!.id } },
        create: { tenantId: req.user!.tenantId, userId: req.user!.id, ...body },
        update: body,
      })
    );
  })
);
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) =>
    res.json(
      await prisma.notificationDelivery.findMany({
        where: {
          tenantId: req.user!.tenantId,
          userId: req.user!.id,
          outletId: { in: req.user!.outletIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    )
  )
);
notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await prisma.notificationDelivery.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, userId: req.user!.id },
      data: { readAt: new Date() },
    });
    res.json({ read: true });
  })
);
