import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { fail } from '../lib/domain';
import { createOrder } from '../services/orderService';
import { startCheckout } from './payments';
import { createOrderSchema } from './pos/orders';
export const publicRouter = Router();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
publicRouter.get(
  '/outlets',
  asyncHandler(async (req, res) => {
    const restaurant = z.string().min(1).parse(req.query.restaurant);
    const tenant = await prisma.tenant.findUnique({ where: { subdomain: restaurant } });
    if (!tenant?.isActive) fail('Restaurant not found', 404);
    res.json(
      await prisma.outlet.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, address: true },
      })
    );
  })
);
publicRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    const outletId = z.string().uuid().parse(req.query.outletId);
    const outlet = await prisma.outlet.findFirst({ where: { id: outletId, isActive: true } });
    if (!outlet) fail('Outlet not found', 404);
    const tenant = await prisma.tenant.findUnique({ where: { id: outlet.tenantId } });
    if (!tenant?.isActive) fail('Restaurant unavailable', 404);
    const categories = await prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, outletId, isActive: true },
      include: {
        menuItems: {
          where: { tenantId: tenant.id, isAvailable: true },
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            price: true,
            tags: true,
            modifiers: true,
            preparationTimeMinutes: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({
      restaurant: { name: tenant.name, logo: tenant.logo, currency: tenant.currency },
      outlet: { id: outlet.id, name: outlet.name },
      categories: categories.map(({ menuItems, ...category }) => ({
        ...category,
        items: menuItems,
      })),
      paymentProviders: [
        ...(process.env.STRIPE_SECRET_KEY ? ['stripe'] : []),
        ...(process.env.RAZORPAY_KEY_ID ? ['razorpay'] : []),
      ],
    });
  })
);
publicRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        outletId: z.string().uuid(),
        customer: z.object({
          name: z.string().min(2),
          phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
        }),
        type: z.enum(['dine-in', 'takeaway', 'delivery']),
        tableId: z.string().uuid().optional(),
        deliveryAddress: z
          .object({
            line1: z.string().min(5),
            city: z.string().min(2),
            postalCode: z.string().min(3),
            instructions: z.string().optional(),
          })
          .optional(),
        items: createOrderSchema.shape.items,
      })
      .parse(req.body);
    if (body.type === 'dine-in' && !body.tableId) fail('Scan a valid table QR code');
    if (body.type === 'delivery' && !body.deliveryAddress) fail('Delivery address required');
    const outlet = await prisma.outlet.findFirst({ where: { id: body.outletId, isActive: true } });
    if (!outlet) fail('Outlet not found', 404);
    const tenant = await prisma.tenant.findUnique({ where: { id: outlet.tenantId } });
    if (!tenant?.isActive) fail('Restaurant unavailable', 404);
    if (!process.env.STRIPE_SECRET_KEY && !process.env.RAZORPAY_KEY_ID)
      fail('Online payments are not configured for this restaurant', 503, 'PROVIDER_UNAVAILABLE');
    const staff = await prisma.user.findFirst({
      where: {
        tenantId: outlet.tenantId,
        isActive: true,
        role: 'ADMIN',
        outletAssignments: { has: outlet.id },
      },
    });
    if (!staff) fail('Restaurant ordering is not configured', 503);
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: body.customer.phone } },
      create: {
        tenantId: tenant.id,
        name: body.customer.name,
        phone: body.customer.phone,
        tags: [],
      },
      update: {},
    });
    const order = await createOrder(tenant.id, outlet.id, staff.id, {
      tableId: body.tableId,
      customerId: customer.id,
      type: body.type,
      source: body.type === 'dine-in' ? 'qr' : 'online',
      items: body.items,
    } as never);
    const accessToken = randomBytes(32).toString('hex');
    await prisma.order.update({
      where: { id: order.id, tenantId: tenant.id },
      data: { customerAccessTokenHash: hash(accessToken), deliveryAddress: body.deliveryAddress },
    });
    res
      .status(201)
      .json({
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        accessToken,
        paymentRequired: true,
      });
  })
);
publicRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const token = z.string().length(64).parse(req.headers['x-order-token']);
    const order = await prisma.order.findFirst({
      where: { id: req.params.id as string, customerAccessTokenHash: hash(token) },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        items: { select: { menuItemName: true, quantity: true } },
      },
    });
    if (!order) fail('Order not found', 404);
    res.json(order);
  })
);
publicRouter.post(
  '/orders/:id/checkout',
  asyncHandler(async (req, res) => {
    const token = z.string().length(64).parse(req.headers['x-order-token']);
    const gateway = z.enum(['stripe', 'razorpay']).parse(req.body.gateway);
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id as string,
        customerAccessTokenHash: hash(token),
        status: { notIn: ['VOIDED', 'SETTLED'] },
        paymentStatus: { not: 'PAID' },
      },
    });
    if (!order) fail('Unpaid order not found', 404);
    const tenant = await prisma.tenant.findUnique({ where: { id: order.tenantId } });
    res.json(await startCheckout(order, tenant?.currency ?? 'INR', gateway));
  })
);
