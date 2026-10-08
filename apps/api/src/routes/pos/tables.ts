import { asyncHandler } from '../../lib/asyncHandler';
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../../middleware/auth';
import { emitToOutlet } from '../../lib/socket';

export const posTablesRouter = Router();
posTablesRouter.use(authenticate, requireOutletAccess);

posTablesRouter.get(
  '/',
  requirePermission('view_tables'),
  asyncHandler(async (req, res) => {
    const tables = await prisma.table.findMany({
      where: { tenantId: req.user!.tenantId, outletId: req.outletId as string },
      orderBy: { number: 'asc' },
    });
    res.json(tables);
  })
);

posTablesRouter.patch(
  '/:id/status',
  requirePermission('view_tables'),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: string };
    const valid = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
    const upper = typeof status === 'string' ? status.toUpperCase() : '';
    if (!valid.includes(upper)) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid table status' } });
      return;
    }

    const data: Record<string, unknown> = { status: upper };
    if (upper === 'OCCUPIED') data.occupiedAt = new Date();
    if (upper === 'AVAILABLE') {
      data.currentOrderId = null;
      data.occupiedAt = null;
    }

    const result = await prisma.table.updateMany({
      where: {
        id: req.params.id as string,
        tenantId: req.user!.tenantId,
        outletId: req.outletId as string,
      },
      data,
    });

    if (result.count === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Table not found' } });
      return;
    }

    const table = await prisma.table.findUnique({ where: { id: req.params.id as string } });
    emitToOutlet(req.user!.tenantId, req.outletId as string, 'table:status:updated', table);
    res.json(table);
  })
);

posTablesRouter.post(
  '/:id/merge',
  requirePermission('view_tables'),
  asyncHandler(async (req, res) => {
    const { targetTableIds } = req.body as { targetTableIds: string[] };
    const primary = await prisma.table.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId! },
    });
    if (!primary) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Primary table not found' } });
      return;
    }

    await prisma.table.updateMany({
      where: {
        id: { in: targetTableIds },
        tenantId: req.user!.tenantId,
        outletId: req.outletId as string,
      },
      data: { status: 'OCCUPIED', currentOrderId: primary.currentOrderId, occupiedAt: new Date() },
    });

    res.json({ merged: targetTableIds.length + 1, primaryTableId: primary.id });
  })
);
