import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { fail, scope } from '../lib/domain';
import { discountAmount } from '../services/discountService';
export const discountsRouter = Router();
discountsRouter.use(authenticate, requireOutletAccess);
const schema = z.object({
  code: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((s) => s.toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  minOrderValue: z.number().nonnegative().optional(),
  maxDiscount: z.number().positive().optional(),
  applicableItems: z.array(z.string().uuid()).default([]),
  outletIds: z.array(z.string().uuid()).default([]),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  usageLimit: z.number().int().positive().optional(),
});
discountsRouter.get(
  '/',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) =>
    res.json(
      await prisma.discountCode.findMany({
        where: { tenantId: req.user!.tenantId },
        orderBy: { createdAt: 'desc' },
      })
    )
  )
);
discountsRouter.post(
  '/',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    if (body.validUntil <= body.validFrom) fail('Invalid validity dates');
    if (body.type === 'PERCENTAGE' && body.value > 100) fail('Percentage cannot exceed 100');
    if (body.outletIds.some((id) => !req.user!.outletIds.includes(id)))
      fail('Outlet access denied', 403);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user!.tenantId + ':discount:' + body.code}))::text`;
      if (
        await tx.discountCode.findFirst({
          where: { tenantId: req.user!.tenantId, code: body.code },
        })
      )
        fail('Code already exists', 409);
      if (
        body.applicableItems.length !==
        (await tx.menuItem.count({
          where: { tenantId: req.user!.tenantId, id: { in: body.applicableItems } },
        }))
      )
        fail('Invalid menu items');
      return tx.discountCode.create({ data: { ...body, tenantId: req.user!.tenantId } });
    });
    res.status(201).json(result);
  })
);
discountsRouter.patch(
  '/:id',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) => {
    const body = z.object({ isActive: z.boolean() }).parse(req.body);
    const changed = await prisma.discountCode.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
      data: body,
    });
    if (!changed.count) fail('Discount not found', 404);
    res.json({ updated: true });
  })
);
discountsRouter.post(
  '/validate',
  requirePermission('process_payments'),
  asyncHandler(async (req, res) => {
    const body = z.object({ orderId: z.string().uuid(), code: z.string() }).parse(req.body);
    const order = await prisma.order.findFirst({
      where: { ...scope(req), id: body.orderId },
      include: { items: true },
    });
    const code = await prisma.discountCode.findFirst({
      where: { tenantId: req.user!.tenantId, code: body.code.toUpperCase() },
    });
    if (!order || !code) fail('Order or code not found', 404);
    res.json({
      discountAmount: discountAmount(code, req.outletId!, Number(order.subtotal), order.items),
    });
  })
);
