import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { scope, fail, money } from '../lib/domain';
import { changeStock } from '../services/stockService';
import { emitToOutlet } from '../lib/socket';
export const procurementRouter = Router();
procurementRouter.use(authenticate, requireOutletAccess, requirePermission('inventory:manage'));
const ingredientSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive().multipleOf(0.001),
});
procurementRouter.get(
  '/recipes',
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.recipe.findMany({
        where: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          menuItem: { OR: [{ outletId: req.outletId! }, { outletId: null }] },
        },
        include: { ingredients: true },
        orderBy: { version: 'desc' },
      })
    );
  })
);
procurementRouter.post(
  '/recipes',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        menuItemId: z.string().uuid(),
        effectiveDate: z.coerce.date(),
        ingredients: z.array(ingredientSchema).min(1),
      })
      .parse(req.body);
    if (new Set(body.ingredients.map((i) => i.inventoryItemId)).size !== body.ingredients.length)
      fail('Duplicate ingredients');
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user!.tenantId + ':recipe:' + body.menuItemId}))::text`;
      const menu = await tx.menuItem.findFirst({
        where: {
          id: body.menuItemId,
          tenantId: req.user!.tenantId,
          OR: [{ outletId: req.outletId! }, { outletId: null }],
        },
      });
      if (!menu) fail('Menu item not found', 404);
      const items = await tx.inventoryItem.findMany({
        where: { ...scope(req), id: { in: body.ingredients.map((i) => i.inventoryItemId) } },
      });
      if (items.length !== body.ingredients.length) fail('Ingredients must belong to this outlet');
      const latest = await tx.recipe.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          menuItemId: body.menuItemId,
        },
        orderBy: { version: 'desc' },
      });
      return tx.recipe.create({
        data: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          menuItemId: body.menuItemId,
          effectiveDate: body.effectiveDate,
          version: (latest?.version ?? 0) + 1,
          ingredients: {
            create: body.ingredients.map((i) => ({
              ...i,
              inventoryItemName: items.find((x) => x.id === i.inventoryItemId)!.name,
              unitOfMeasure: items.find((x) => x.id === i.inventoryItemId)!.unitOfMeasure,
            })),
          },
        },
        include: { ingredients: true },
      });
    });
    res.status(201).json(result);
  })
);
const poLine = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive().multipleOf(0.001),
  costPerUnit: z.number().nonnegative().multipleOf(0.01),
});
procurementRouter.get(
  '/purchase-orders',
  asyncHandler(async (req, res) => {
    res.json(
      await prisma.purchaseOrder.findMany({
        where: scope(req),
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    );
  })
);
procurementRouter.post(
  '/purchase-orders',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        vendorId: z.string().uuid(),
        lineItems: z.array(poLine).min(1),
        taxAmount: z.number().nonnegative().default(0),
        notes: z.string().optional(),
      })
      .parse(req.body);
    if (new Set(body.lineItems.map((i) => i.inventoryItemId)).size !== body.lineItems.length)
      fail('Duplicate purchase lines');
    const po = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user!.tenantId + ':po:' + req.outletId}))::text`;
      const vendor = await tx.vendor.findFirst({
        where: { id: body.vendorId, tenantId: req.user!.tenantId, isActive: true },
      });
      if (!vendor) fail('Vendor not found', 404);
      const count = await tx.inventoryItem.count({
        where: { ...scope(req), id: { in: body.lineItems.map((i) => i.inventoryItemId) } },
      });
      if (count !== body.lineItems.length) fail('Invalid inventory items');
      const year = new Date().getFullYear();
      const sequence = await tx.purchaseOrder.count({
        where: { ...scope(req), createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
      });
      const subtotal = money(
        body.lineItems.reduce((sum, i) => sum + i.quantity * i.costPerUnit, 0)
      );
      return tx.purchaseOrder.create({
        data: {
          ...scope(req),
          vendorId: vendor.id,
          vendorName: vendor.name,
          poNumber: `PO-${year}-${String(sequence + 1).padStart(5, '0')}`,
          lineItems: body.lineItems,
          subtotal,
          taxAmount: body.taxAmount,
          total: money(subtotal + body.taxAmount),
          notes: body.notes,
          createdByUserId: req.user!.id,
        },
      });
    });
    res.status(201).json(po);
  })
);
procurementRouter.post(
  '/purchase-orders/:id/receive',
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { ...scope(req), id: req.params.id as string },
      });
      if (!po) fail('Purchase order not found', 404);
      const claim = await tx.purchaseOrder.updateMany({
        where: { ...scope(req), id: po.id, status: { in: ['DRAFT', 'SENT'] } },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
      if (!claim.count) fail('Purchase order already received or cancelled', 409);
      const lines = z.array(poLine).parse(po.lineItems);
      const changes = [];
      for (const line of lines.sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId)))
        changes.push(
          await changeStock(tx, {
            ...scope(req),
            inventoryItemId: line.inventoryItemId,
            quantityChange: line.quantity,
            cost: line.costPerUnit,
            userId: req.user!.id,
            reason: 'Purchase order received',
            type: 'PURCHASE',
            referenceId: po.id,
          })
        );
      return { id: po.id, status: 'RECEIVED', total: po.total, changes };
    });
    emitToOutlet(req.user!.tenantId, req.outletId!, 'inventory:updated', result);
    res.json(result);
  })
);

procurementRouter.post(
  '/transfers',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        sourceItemId: z.string().uuid(),
        destinationItemId: z.string().uuid(),
        destinationOutletId: z.string().uuid(),
        quantity: z.number().positive().multipleOf(0.001),
        reason: z.string().min(3),
      })
      .parse(req.body);
    if (
      body.destinationOutletId === req.outletId ||
      !req.user!.outletIds.includes(body.destinationOutletId)
    )
      fail('Choose another assigned outlet', 403);
    const referenceId = randomUUID();
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.inventoryItem.findFirst({
        where: { ...scope(req), id: body.sourceItemId },
      });
      const target = await tx.inventoryItem.findFirst({
        where: {
          tenantId: req.user!.tenantId,
          outletId: body.destinationOutletId,
          id: body.destinationItemId,
        },
      });
      if (!source || !target || source.unitOfMeasure !== target.unitOfMeasure)
        fail('Items require matching units');
      const movements = [
        {
          tenantId: req.user!.tenantId,
          outletId: req.outletId!,
          inventoryItemId: source.id,
          quantityChange: -body.quantity,
          userId: req.user!.id,
          reason: body.reason,
          type: 'TRANSFER' as const,
          referenceId,
        },
        {
          tenantId: req.user!.tenantId,
          outletId: body.destinationOutletId,
          inventoryItemId: target.id,
          quantityChange: body.quantity,
          userId: req.user!.id,
          reason: body.reason,
          type: 'TRANSFER' as const,
          referenceId,
        },
      ].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));
      for (const movement of movements) await changeStock(tx, movement);
      const quantity = Number(target.currentQuantity) + body.quantity;
      await tx.inventoryItem.update({
        where: { id: target.id, tenantId: req.user!.tenantId },
        data: {
          weightedAverageCost: money(
            (Number(target.currentQuantity) * Number(target.weightedAverageCost) +
              body.quantity * Number(source.weightedAverageCost)) /
              quantity
          ),
        },
      });
      return { referenceId, quantity: body.quantity };
    });
    emitToOutlet(req.user!.tenantId, req.outletId!, 'inventory:updated', result);
    emitToOutlet(req.user!.tenantId, body.destinationOutletId, 'inventory:updated', result);
    res.status(201).json(result);
  })
);
