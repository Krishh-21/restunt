import { asyncHandler } from '../../lib/asyncHandler';
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../../middleware/auth';
import { emitToOutlet } from '../../lib/socket';

export const kdsRouter = Router();
kdsRouter.use(authenticate, requireOutletAccess);

function elapsedColor(createdAt: Date): 'green' | 'yellow' | 'red' {
  const mins = (Date.now() - createdAt.getTime()) / 60000;
  if (mins < 5) return 'green';
  if (mins <= 10) return 'yellow';
  return 'red';
}

kdsRouter.get('/orders', requirePermission('view_kds'), asyncHandler(async (req, res) => {
  const stationId = req.query.stationId as string | undefined;
  const orders = await prisma.order.findMany({
    where: {
      tenantId: req.user!.tenantId,
      outletId: req.outletId as string,
      status: { in: ['SUBMITTED', 'PREPARING', 'READY'] },
    },
    include: { items: { include: { menuItem: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const enriched = orders.map((o) => ({
    ...o,
    elapsedMinutes: Math.floor((Date.now() - o.createdAt.getTime()) / 60000),
    color: elapsedColor(o.createdAt),
    items: stationId
      ? o.items.filter((i) => i.menuItem.stationId === stationId || (!i.menuItem.stationId && !stationId))
      : o.items,
  }));

  res.json(enriched.filter((o) => o.items.length > 0));
}));

kdsRouter.patch('/orders/:orderId/items/:itemId', requirePermission('update_order_status'), asyncHandler(async (req, res) => {
  const existing = await prisma.orderItem.findFirst({
    where: { id: req.params.itemId as string, orderId: req.params.orderId as string,
      order: { tenantId: req.user!.tenantId, outletId: req.outletId!, status: { in: ['SUBMITTED', 'PREPARING', 'READY'] } } },
  });
  if (!existing) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active order item not found' } }); return; }

  const item = await prisma.$transaction(async tx => {
    const updated = await tx.orderItem.update({
      where: { id: req.params.itemId as string, orderId: req.params.orderId as string,
        order: { tenantId: req.user!.tenantId, outletId: req.outletId!, status: { in: ['SUBMITTED', 'PREPARING', 'READY'] } } },
      data: { status: 'READY' },
    });
    const pending = await tx.orderItem.count({ where: { orderId: req.params.orderId as string, status: { not: 'READY' } } });
    await tx.order.update({
      where: { id: req.params.orderId as string, tenantId: req.user!.tenantId, outletId: req.outletId!, status: { in: ['SUBMITTED', 'PREPARING', 'READY'] } },
      data: { status: pending === 0 ? 'READY' : 'PREPARING' },
    });
    return updated;
  });

  emitToOutlet(req.user!.tenantId, req.outletId as string, 'order:update', { orderId: req.params.orderId, item });
  res.json(item);
}));

kdsRouter.post('/orders/:id/ready', requirePermission('update_order_status'), asyncHandler(async (req, res) => {
  const existing = await prisma.order.findFirst({ where: {
    id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId!,
    status: { in: ['SUBMITTED', 'PREPARING', 'READY'] },
  } });
  if (!existing) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active order not found' } }); return; }

  const order = await prisma.order.update({
    where: { id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId!, status: { in: ['SUBMITTED', 'PREPARING', 'READY'] } },
    data: { status: 'READY', items: { updateMany: { where: {}, data: { status: 'READY' } } } },
    include: { items: true },
  });
  emitToOutlet(req.user!.tenantId, req.outletId as string, 'order:update', order);
  res.json(order);
}));

kdsRouter.get('/stations', requirePermission('view_kds'), asyncHandler(async (req, res) => {
  const stations = await prisma.kitchenStation.findMany({
    where: { tenantId: req.user!.tenantId, outletId: req.outletId as string, isActive: true },
  });
  res.json(stations);
}));

kdsRouter.post('/stations', requirePermission('manage_inventory'), asyncHandler(async (req, res) => {
  const { name, type } = req.body as { name: string; type?: string };
  const station = await prisma.kitchenStation.create({
    data: {
      tenantId: req.user!.tenantId,
      outletId: req.outletId as string,
      name,
      type: type ?? 'general',
    },
  });
  res.status(201).json(station);
}));
