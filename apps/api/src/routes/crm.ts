import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { fail, scope } from '../lib/domain';
import { awardLoyalty, loyaltyTier } from '../services/loyaltyService';
import { emitToOutlet } from '../lib/socket';
export const crmRouter = Router();
crmRouter.use(authenticate, requireOutletAccess);
const customerInput = z.object({ name: z.string().min(2), phone: z.string().regex(/^\+?[1-9]\d{6,14}$/), email: z.string().email().optional(), address: z.string().optional(), dateOfBirth: z.coerce.date().optional(), tags: z.array(z.string()).default([]), notes: z.string().optional(), whatsappOptIn: z.boolean().default(false), emailOptIn: z.boolean().default(false) });
crmRouter.get('/customers', requirePermission('customers:view'), asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  res.json(await prisma.customer.findMany({ where: { tenantId: req.user!.tenantId, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { name: 'asc' }, take: 100 }));
}));
crmRouter.post('/customers', requirePermission('customers:create'), asyncHandler(async (req, res) => { const body = customerInput.parse(req.body); const duplicate = await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId: req.user!.tenantId, phone: body.phone } } }); if (duplicate) { res.status(409).json({ error: { code: 'DUPLICATE_CUSTOMER', message: 'Phone already registered', details: { id: duplicate.id } } }); return; } res.status(201).json(await prisma.customer.create({ data: { ...body, tenantId: req.user!.tenantId } })); }));
crmRouter.get('/customers/:id', requirePermission('customers:view'), asyncHandler(async (req, res) => { const customer = await prisma.customer.findFirst({ where: { id: req.params.id as string, tenantId: req.user!.tenantId }, include: { orders: { where: { outletId: { in: req.user!.outletIds } }, orderBy: { createdAt: 'desc' }, take: 50 }, loyaltyTransactions: { orderBy: { createdAt: 'desc' }, take: 100 } } }); if (!customer) fail('Customer not found', 404); res.json(customer); }));
crmRouter.patch('/customers/:id', requirePermission('customers:update'), asyncHandler(async (req, res) => { const body = customerInput.omit({ phone: true }).partial().parse(req.body); res.json(await prisma.customer.update({ where: { id: req.params.id as string, tenantId: req.user!.tenantId }, data: body })); }));
crmRouter.get('/segments', requirePermission('customers:manage'), asyncHandler(async (req, res) => { const customers = await prisma.customer.findMany({ where: { tenantId: req.user!.tenantId }, select: { id: true, name: true, phone: true, loyaltyTier: true, lifetimeValue: true, orderCount: true, tags: true, whatsappOptIn: true } }); res.json({ tiers: ['BRONZE','SILVER','GOLD','PLATINUM'].map(tier => ({ tier, customers: customers.filter(c => c.loyaltyTier === tier) })), frequent: customers.filter(c => c.orderCount >= 10), highValue: customers.filter(c => Number(c.lifetimeValue) >= 10000), optedIn: customers.filter(c => c.whatsappOptIn) }); }));
crmRouter.post('/loyalty/award', requirePermission('loyalty:award'), asyncHandler(async (req, res) => { const body = z.object({ customerId: z.string().uuid(), orderId: z.string().uuid() }).parse(req.body); const order = await prisma.order.findFirst({ where: { ...scope(req), id: body.orderId, customerId: body.customerId, status: 'SETTLED' } }); if (!order) fail('Settled customer order not found', 404); res.json(await prisma.$transaction(tx => awardLoyalty(tx, req.user!.tenantId, body.customerId, order.id, Number(order.total)))); }));
crmRouter.post('/loyalty/redeem', requirePermission('loyalty:redeem'), asyncHandler(async (req, res) => {
  const body = z.object({ customerId: z.string().uuid(), orderId: z.string().uuid(), points: z.number().int().positive() }).parse(req.body);
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user!.tenantId + ':customer:' + body.customerId}))::text`;
    const order = await tx.order.findFirst({ where: { ...scope(req), id: body.orderId, customerId: body.customerId, status: 'DRAFT' } }); if (!order || Number(order.discountAmount) > 0) fail('Eligible draft order required; discounts cannot stack');
    const customer = await tx.customer.findFirst({ where: { tenantId: req.user!.tenantId, id: body.customerId } }); if (!customer || customer.loyaltyPoints < body.points || body.points > Number(order.total)) fail('Insufficient points or order value');
    const changed = await tx.customer.updateMany({ where: { tenantId: req.user!.tenantId, id: customer.id, loyaltyPoints: { gte: body.points } }, data: { loyaltyPoints: { decrement: body.points }, loyaltyTier: loyaltyTier(customer.loyaltyPoints - body.points) } }); if (!changed.count) fail('Insufficient points', 409);
    await tx.order.update({ where: { id: order.id, tenantId: req.user!.tenantId, status: 'DRAFT', discountAmount: 0 }, data: { discountAmount: body.points, total: { decrement: body.points }, discountCode: 'LOYALTY' } });
    return tx.loyaltyTransaction.create({ data: { tenantId: req.user!.tenantId, customerId: customer.id, orderId: order.id, type: 'REDEEM', points: -body.points, balanceBefore: customer.loyaltyPoints, balanceAfter: customer.loyaltyPoints - body.points, reason: 'Order discount' } });
  }); res.json(result);
}));
crmRouter.get('/feedback', requirePermission('feedback:respond'), asyncHandler(async (req, res) => { res.json(await prisma.feedback.findMany({ where: scope(req), orderBy: { submittedAt: 'desc' }, take: 100 })); }));
crmRouter.post('/feedback', requirePermission('customers:view'), asyncHandler(async (req, res) => {
  const body = z.object({ orderId: z.string().uuid(), foodQualityRating: z.number().int().min(1).max(5), serviceSpeedRating: z.number().int().min(1).max(5), overallRating: z.number().int().min(1).max(5), comments: z.string().max(2000).optional() }).parse(req.body);
  const order = await prisma.order.findFirst({ where: { ...scope(req), id: body.orderId } }); if (!order) fail('Order not found', 404);
  const feedback = await prisma.feedback.create({ data: { ...scope(req), ...body, customerId: order.customerId } }); if (body.overallRating < 3) emitToOutlet(req.user!.tenantId, req.outletId!, 'feedback:negative', { id: feedback.id, rating: body.overallRating }); res.status(201).json(feedback);
}));
crmRouter.post('/feedback/:id/respond', requirePermission('feedback:respond'), asyncHandler(async (req, res) => { const body = z.object({ response: z.string().min(1).max(2000) }).parse(req.body); res.json(await prisma.feedback.update({ where: { ...scope(req), id: req.params.id as string }, data: { response: body.response, respondedByUserId: req.user!.id, respondedAt: new Date(), status: 'ACKNOWLEDGED' } })); }));
crmRouter.patch('/feedback/:id/status', requirePermission('feedback:respond'), asyncHandler(async (req, res) => { const body = z.object({ status: z.enum(['ACKNOWLEDGED','RESOLVED']) }).parse(req.body); res.json(await prisma.feedback.update({ where: { ...scope(req), id: req.params.id as string }, data: body })); }));
