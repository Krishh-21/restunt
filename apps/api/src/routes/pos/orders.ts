import { asyncHandler } from '../../lib/asyncHandler';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../../middleware/auth';
import {
  createOrder,
  settleOrder,
  generateKOT,
  updateOrderStatus,
  voidOrder,
} from '../../services/orderService';

export const posOrdersRouter = Router();
posOrdersRouter.use(authenticate, requireOutletAccess);

export const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  clientOperationId: z.string().uuid().optional(),
  clientCreatedAt: z.coerce.date().optional(),
  type: z.enum(['dine-in', 'takeaway', 'delivery']).optional(),
  source: z.enum(['pos', 'captain', 'qr', 'online', 'aggregator']).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
        modifiers: z
          .array(
            z.object({
              name: z.string(),
              option: z.string(),
              priceAdjustment: z.number(),
            })
          )
          .optional(),
        specialInstructions: z.string().optional(),
      })
    )
    .min(1),
});

posOrdersRouter.get(
  '/',
  requirePermission('view_orders'),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const orders = await prisma.order.findMany({
      where: {
        tenantId: req.user!.tenantId,
        outletId: req.outletId as string,
        ...(status && { status: status.toUpperCase() as 'DRAFT' }),
      },
      include: { items: true, bills:{select:{billNumber:true},take:1} },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(orders.map(({bills,...order})=>({...order,invoiceNumber:bills[0]?.billNumber??null})));
  })
);

posOrdersRouter.get(
  '/invoices/next-number',
  requirePermission('process_payments'),
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const seq = await prisma.invoiceSequence.findUnique({
      where: {
        tenantId_outletId_year: {
          tenantId: req.user!.tenantId,
          outletId: req.outletId as string,
          year,
        },
      },
    });
    res.json({ nextSequence: (seq?.lastSequence ?? 0) + 1, year });
  })
);

posOrdersRouter.get(
  '/:id/invoice',
  requirePermission('view_orders'),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId! },
      include: { items: true, bills: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order || !order.bills[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
    res.json({
      ...order,
      invoiceNumber: order.bills[0].billNumber,
      gstin: tenant?.gstin,
      restaurantName: tenant?.name,
      bill: order.bills[0],
    });
  })
);

posOrdersRouter.get(
  '/:id',
  requirePermission('view_orders'),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.user!.tenantId,
        outletId: req.outletId as string,
      },
      include: { items: true, bills:{select:{billNumber:true},take:1} },
    });
    if (!order) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }
    res.json({...order,invoiceNumber:order.bills[0]?.billNumber??null});
  })
);

posOrdersRouter.post(
  '/',
  requirePermission('create_orders'),
  asyncHandler(async (req, res) => {
    try {
      const input = createOrderSchema.parse(req.body);
      const order = await createOrder(
        req.user!.tenantId,
        req.outletId as string,
        req.user!.id,
        input as any,
        input.clientOperationId
          ? { id: input.clientOperationId, createdAt: input.clientCreatedAt ?? new Date() }
          : undefined
      );
      res.status(201).json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      res.status(400).json({ error: { code: 'ORDER_ERROR', message } });
    }
  })
);

posOrdersRouter.patch(
  '/:id/status',
  requirePermission('create_orders'),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    const valid = ['DRAFT', 'SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'SETTLED', 'VOIDED'];
    if (typeof status !== 'string' || !valid.includes(status.toUpperCase())) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
      return;
    }
    try {
      const order = await updateOrderStatus(
        req.user!.tenantId,
        req.outletId as string,
        req.params.id as string,
        status.toUpperCase() as 'DRAFT'
      );
      res.json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status update failed';
      res.status(400).json({ error: { code: 'STATUS_ERROR', message } });
    }
  })
);

posOrdersRouter.post(
  '/:id/kot',
  requirePermission('create_orders'),
  asyncHandler(async (req, res) => {
    try {
      const kot = await generateKOT(
        req.user!.tenantId,
        req.outletId as string,
        req.params.id as string
      );
      res.json(kot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KOT generation failed';
      res.status(400).json({ error: { code: 'KOT_ERROR', message } });
    }
  })
);

const settleSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'upi', 'wallet', 'online']),
  paymentTransactionId: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  discountCode: z.string().optional(),
});

posOrdersRouter.post(
  '/:id/settle',
  requirePermission('process_payments'),
  asyncHandler(async (req, res) => {
    try {
      const input = settleSchema.parse(req.body);
      if (
        (input.discountAmount || input.discountCode) &&
        !['ADMIN', 'MANAGER'].includes(req.user!.role)
      )
        throw new Error('Manager approval required for discounts');
      const order = await settleOrder(
        req.user!.tenantId,
        req.outletId as string,
        req.params.id as string,
        input as any
      );
      res.json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Settlement failed';
      res.status(400).json({ error: { code: 'SETTLE_ERROR', message } });
    }
  })
);

const voidSchema = z.object({
  reason: z.string().min(3),
  approvedByUserId: z.string().uuid(),
});

posOrdersRouter.post(
  '/:id/void',
  requirePermission('orders:void'),
  asyncHandler(async (req, res) => {
    try {
      const input = voidSchema.parse(req.body);
      if (input.approvedByUserId !== req.user!.id)
        throw new Error('Approving manager must perform this action');
      const order = await voidOrder(
        req.user!.tenantId,
        req.outletId as string,
        req.user!.id,
        req.params.id as string,
        {
          reason: input.reason,
          approvedByUserId: input.approvedByUserId,
          ipAddress: req.ip || '127.0.0.1',
          deviceId: (req.headers['x-device-id'] as string) || 'unknown_device',
        }
      );
      res.json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Void failed';
      res.status(400).json({ error: { code: 'VOID_ERROR', message } });
    }
  })
);
