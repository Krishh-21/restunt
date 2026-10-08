import { asyncHandler } from '../lib/asyncHandler';
import { receiveStock } from '../services/inventoryCalculation';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { emitToOutlet } from '../lib/socket';
export const inventoryRouter = Router();
inventoryRouter.use(authenticate, requireOutletAccess);
const itemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  currentQuantity: z.number().finite().nonnegative().default(0),
  minimumThreshold: z.number().finite().nonnegative(),
  reorderQuantity: z.number().finite().positive(),
  weightedAverageCost: z.number().finite().nonnegative().default(0),
});
inventoryRouter.get(
  '/items',
  requirePermission('inventory:view'),
  asyncHandler(async (req, res) => {
    const items = await prisma.inventoryItem.findMany({
      where: {
        tenantId: req.user!.tenantId,
        outletId: req.outletId!,
        ...(typeof req.query.category === 'string' ? { category: req.query.category } : {}),
      },
      orderBy: { name: 'asc' },
    });
    res.json(
      items.map((item) => ({
        ...item,
        stockValue: Number(item.currentQuantity) * Number(item.weightedAverageCost),
        lowStock: Number(item.currentQuantity) < Number(item.minimumThreshold),
      }))
    );
  })
);
inventoryRouter.post(
  '/items',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) => {
    const input = itemSchema.parse(req.body);
    const item = await prisma.inventoryItem.create({
      data: { ...input, tenantId: req.user!.tenantId, outletId: req.outletId! },
    });
    res.status(201).json(item);
  })
);
const adjustment = z
  .object({
    version: z.number().int().positive(),
    quantityChange: z.number().finite(),
    reason: z.string().min(3),
    type: z.enum(['ADJUSTMENT', 'PURCHASE', 'WASTE']).default('ADJUSTMENT'),
    costPerUnit: z.number().finite().nonnegative().optional(),
  })
  .refine(
    (x) => x.type !== 'PURCHASE' || (x.quantityChange > 0 && x.costPerUnit !== undefined),
    'Purchases require a positive quantity and cost'
  )
  .refine((x) => x.type !== 'WASTE' || x.quantityChange < 0, 'Waste must decrease stock');
inventoryRouter.patch(
  '/items/:id/adjust',
  requirePermission('inventory:adjust'),
  asyncHandler(async (req, res) => {
    if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
      res.status(403).json({
        error: { code: 'APPROVAL_REQUIRED', message: 'A manager must perform stock adjustments' },
      });
      return;
    }
    const input = adjustment.parse(req.body);
    const scope = {
      id: req.params.id as string,
      tenantId: req.user!.tenantId,
      outletId: req.outletId!,
    };
    const current = await prisma.inventoryItem.findFirst({ where: scope });
    if (!current) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found' } });
      return;
    }
    if (current.version !== input.version) {
      res.status(409).json({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Inventory changed. Refresh and retry',
          details: current,
        },
      });
      return;
    }
    const before = Number(current.currentQuantity);
    const after = Math.round((before + input.quantityChange) * 1000) / 1000;
    if (after < 0) {
      res
        .status(400)
        .json({ error: { code: 'INSUFFICIENT_STOCK', message: 'Stock cannot become negative' } });
      return;
    }
    const cost =
      input.type === 'PURCHASE'
        ? receiveStock(
            before,
            Number(current.weightedAverageCost),
            input.quantityChange,
            input.costPerUnit!
          ).weightedAverageCost
        : Number(current.weightedAverageCost);
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.inventoryItem.updateMany({
        where: { ...scope, version: input.version },
        data: {
          currentQuantity: after,
          weightedAverageCost: Math.round(cost * 100) / 100,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw Object.assign(new Error('Inventory changed. Refresh and retry'), {
          status: 409,
          code: 'VERSION_CONFLICT',
        });
      const transaction = await tx.stockTransaction.create({
        data: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          inventoryItemId: current.id,
          transactionType: input.type,
          quantityChange: input.quantityChange,
          quantityBefore: before,
          quantityAfter: after,
          costPerUnit: input.costPerUnit,
          reason: input.reason,
          referenceType: 'manual',
          createdByUserId: req.user!.id,
          approvedByUserId: req.user!.id,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          userId: req.user!.id,
          action: 'stock_adjustment',
          entityType: 'inventory',
          entityId: current.id,
          beforeState: { quantity: before, version: current.version },
          afterState: { quantity: after, version: current.version + 1 },
          reason: input.reason,
          approvedByUserId: req.user!.id,
          ipAddress: req.ip || 'unknown',
          deviceId: String(req.headers['x-device-id'] || 'unknown'),
        },
      });
      return transaction;
    });
    if (before >= Number(current.minimumThreshold) && after < Number(current.minimumThreshold))
      emitToOutlet(req.user!.tenantId, req.outletId!, 'inventory:low-stock', {
        itemId: current.id,
        name: current.name,
        quantity: after,
        threshold: Number(current.minimumThreshold),
      });
    res.json(result);
  })
);
inventoryRouter.get(
  '/transactions',
  requirePermission('inventory:view'),
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.stockTransaction.findMany({
        where: { tenantId: req.user!.tenantId, outletId: req.outletId! },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    );
  })
);
inventoryRouter.get(
  '/vendors',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.vendor.findMany({
        where: { tenantId: req.user!.tenantId, isActive: true },
        orderBy: { name: 'asc' },
      })
    );
  })
);
inventoryRouter.post(
  '/vendors',
  requirePermission('inventory:manage'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        contactPerson: z.string().min(1),
        phone: z.string().min(5),
        email: z.string().email().optional(),
        address: z.string().optional(),
        paymentTerms: z.string().optional(),
        gstin: z.string().optional(),
      })
      .parse(req.body);
    res
      .status(201)
      .json(await prisma.vendor.create({ data: { ...body, tenantId: req.user!.tenantId } }));
  })
);
