import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { fail, scope } from '../lib/domain';
import { confirmGatewayPayment } from '../services/paymentService';
const stripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) fail('Stripe is not configured', 503, 'PROVIDER_UNAVAILABLE');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
};
const razorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    fail('Razorpay is not configured', 503, 'PROVIDER_UNAVAILABLE');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
};
export function verifyHmac(body: Buffer, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const received = Buffer.from(signature);
  const valid = Buffer.from(expected);
  return valid.length === received.length && timingSafeEqual(valid, received);
}
export const paymentWebhooks = Router();
paymentWebhooks.post(
  '/stripe/webhook',
  asyncHandler(async (req, res) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) fail('Stripe webhook is not configured', 503);
    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(
        req.body,
        String(req.headers['stripe-signature'] ?? ''),
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch {
      fail('Invalid webhook signature', 400);
    }
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid')
        await confirmGatewayPayment(
          'stripe',
          session.id,
          session.amount_total ?? -1,
          session.currency ?? ''
        );
    }
    res.json({ received: true });
  })
);
paymentWebhooks.post(
  '/razorpay/webhook',
  asyncHandler(async (req, res) => {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) fail('Razorpay webhook is not configured', 503);
    if (
      !verifyHmac(
        req.body,
        String(req.headers['x-razorpay-signature'] ?? ''),
        process.env.RAZORPAY_WEBHOOK_SECRET!
      )
    )
      fail('Invalid webhook signature');
    const event = z
      .object({
        event: z.string(),
        payload: z.object({
          payment: z
            .object({
              entity: z.object({
                order_id: z.string(),
                amount: z.number(),
                currency: z.string(),
                status: z.string(),
              }),
            })
            .optional(),
        }),
      })
      .parse(JSON.parse(req.body.toString()));
    if (event.event === 'payment.captured' && event.payload.payment?.entity.status === 'captured') {
      const payment = event.payload.payment.entity;
      await confirmGatewayPayment('razorpay', payment.order_id, payment.amount, payment.currency);
    }
    res.json({ received: true });
  })
);
export async function startCheckout(
  order: { id: string; orderNumber: string; total: unknown; tenantId: string },
  currency: string,
  gateway: 'stripe' | 'razorpay'
) {
  const amount = Math.round(Number(order.total) * 100);
  if (amount <= 0) fail('Payment amount must be positive');
  let reference: string;
  let result: unknown;
  if (gateway === 'stripe') {
    const origin = process.env.PUBLIC_STOREFRONT_URL;
    if (!origin) fail('Checkout return URL is not configured', 503);
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: order.id,
        success_url: origin + '?orderId=' + order.id + '&payment=success',
        cancel_url: origin + '?orderId=' + order.id + '&payment=cancelled',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amount,
              product_data: { name: 'Order ' + order.orderNumber },
            },
          },
        ],
      },
      { idempotencyKey: order.id + ':' + amount }
    );
    reference = session.id;
    result = { gateway, url: session.url };
  } else {
    const pending = await prisma.payment.findFirst({
      where: {
        tenantId: order.tenantId,
        orderId: order.id,
        gateway: 'razorpay',
        status: 'PENDING',
        amount: Number(order.total),
        currency,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending?.gatewayTransactionId)
      return {
        gateway,
        key: process.env.RAZORPAY_KEY_ID,
        orderId: pending.gatewayTransactionId,
        amount,
        currency,
      };
    if (currency !== 'INR') fail('Razorpay checkout requires INR');
    const session = await razorpayClient().orders.create({
      amount,
      currency: 'INR',
      receipt: order.id,
    });
    reference = session.id;
    result = { gateway, key: process.env.RAZORPAY_KEY_ID, orderId: session.id, amount, currency };
  }
  await prisma.payment.upsert({
    where: { gateway_gatewayTransactionId: { gateway, gatewayTransactionId: reference } },
    create: {
      tenantId: order.tenantId,
      orderId: order.id,
      amount: Number(order.total),
      currency,
      gateway,
      gatewayTransactionId: reference,
      method: 'ONLINE',
    },
    update: {},
  });
  return result;
}
export const paymentsRouter = Router();
paymentsRouter.use(authenticate, requireOutletAccess, requirePermission('process_payments'));
paymentsRouter.post(
  '/:gateway/intent',
  asyncHandler(async (req, res) => {
    const { orderId } = z.object({ orderId: z.string().uuid() }).parse(req.body);
    const order = await prisma.order.findFirst({
      where: {
        ...scope(req),
        id: orderId,
        status: { notIn: ['VOIDED', 'SETTLED'] },
        paymentStatus: { not: 'PAID' },
      },
    });
    if (!order) fail('Unpaid active order not found', 404);
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
    const gateway = z.enum(['stripe', 'razorpay']).parse(req.params.gateway);
    res.json(await startCheckout(order, tenant?.currency ?? 'INR', gateway));
  })
);
