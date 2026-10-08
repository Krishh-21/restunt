import { createHash } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, hasPermission } from '../middleware/auth';
import { scope, fail } from '../lib/domain';
import { createOrderSchema } from './pos/orders';
import { createOrder, generateKOT, settleOrder, updateOrderStatus } from '../services/orderService';
export const syncRouter = Router();
syncRouter.use(authenticate, requireOutletAccess);
syncRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        operations: z
          .array(
            z.object({
              id: z.string().uuid(),
              userId: z.string().uuid(),
              createdAt: z.coerce.date(),
              type: z.enum(['order:create', 'order:settle', 'order:status']),
              payload: z.unknown(),
            })
          )
          .max(100),
        lastSync: z.coerce.date().optional(),
      })
      .parse(req.body);

    const accepted: string[] = [];
    const conflicts: { id: string; message: string }[] = [];
    for (const operation of body.operations) {
      if (operation.userId !== req.user!.id) fail('Offline operation belongs to another user', 403);
      try {
        const fingerprint = createHash('sha256')
          .update(JSON.stringify({ type: operation.type, payload: operation.payload }))
          .digest('hex');
        const replay = { id: operation.id, userId: req.user!.id, fingerprint };
        if (operation.type === 'order:create') {
          if (!hasPermission(req.user!.role, 'create_orders'))
            fail('No permission to create orders', 403);
          const input = createOrderSchema.parse(operation.payload);
          const order = await createOrder(
            req.user!.tenantId,
            req.outletId!,
            req.user!.id,
            input as never,
            { id: operation.id, createdAt: operation.createdAt }
          );
          if (order.createdByUserId !== req.user!.id)
            fail('Operation belongs to another user', 403);
          if (order.status === 'DRAFT')
            await generateKOT(req.user!.tenantId, req.outletId!, order.id);
        } else {
          const input = z
            .object({
              orderId: z.string(),
              expectedStatus: z.string().optional(),
              expectedTotal: z.number().nonnegative().optional(),
              paymentMethod: z.enum(['cash', 'card', 'upi', 'wallet']).optional(),
              status: z.enum(['SUBMITTED', 'PREPARING', 'READY', 'SERVED']).optional(),
            })
            .parse(operation.payload);
          let orderId = input.orderId;
          if (orderId.startsWith('offline:')) {
            const dependency = await prisma.order.findFirst({
              where: {
                ...scope(req),
                clientOperationId: orderId.slice(8),
                createdByUserId: req.user!.id,
              },
            });
            if (!dependency) fail('Previous order creation needs resolution', 409);
            orderId = dependency.id;
          } else z.string().uuid().parse(orderId);
          if (operation.type === 'order:settle') {
            if (!hasPermission(req.user!.role, 'process_payments'))
              fail('No permission to settle orders', 403);
            if (!input.paymentMethod || input.expectedTotal === undefined)
              fail('Payment method and expected total required');
            const receipt = await prisma.syncOperation.findUnique({
              where: {
                tenantId_outletId_operationId: { ...scope(req), operationId: operation.id },
              },
            });
            if (!receipt) {
              const order = await prisma.order.findFirst({ where: { ...scope(req), id: orderId } });
              if (!order) fail('Order not found', 404);
              if (Math.round(Number(order.total) * 100) !== Math.round(input.expectedTotal * 100))
                fail('Order price changed; review recorded payment', 409);
            }
            await settleOrder(
              req.user!.tenantId,
              req.outletId!,
              orderId,
              { paymentMethod: input.paymentMethod } as never,
              {
                ...replay,
                expectedStatus: input.expectedStatus,
                expectedTotal: input.expectedTotal,
              }
            );
          } else {
            if (!hasPermission(req.user!.role, 'update_order_status'))
              fail('No permission to update orders', 403);
            if (!input.status) fail('Status required');
            await updateOrderStatus(req.user!.tenantId, req.outletId!, orderId, input.status, {
              ...replay,
              expectedStatus: input.expectedStatus,
              expectedTotal: input.expectedTotal,
            });
          }
        }
        accepted.push(operation.id);
      } catch (error) {
        conflicts.push({
          id: operation.id,
          message: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }
    const highWater = new Date();
    const since = body.lastSync ?? new Date(0);
    const dates = { gte: since, lte: highWater };
    const [orders, tables, menu] = await Promise.all([
      prisma.order.findMany({
        where: { ...scope(req), updatedAt: dates },
        include: { items: true },
      }),
      prisma.table.findMany({ where: { ...scope(req), updatedAt: dates } }),
      prisma.menuItem.findMany({
        where: {
          tenantId: req.user!.tenantId,
          OR: [{ outletId: req.outletId! }, { outletId: null }],
          updatedAt: dates,
        },
      }),
    ]);
    res.json({
      accepted,
      conflicts,
      delta: { orders, tables, menu },
      timestamp: highWater.toISOString(),
    });
  })
);
