import { z } from 'zod';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { prisma } from '../lib/prisma';
import { confirmGatewayPayment } from './paymentService';
export async function sendWhatsApp(data: unknown) {
  const body = z
    .object({
      tenantId: z.string().uuid(),
      customerId: z.string().uuid(),
      contentSid: z.string().regex(/^HX[a-f0-9]{32}$/i),
      variables: z.record(z.string()).default({}),
    })
    .parse(data);
  const customer = await prisma.customer.findFirst({
    where: { id: body.customerId, tenantId: body.tenantId, whatsappOptIn: true },
  });
  if (!customer) throw new Error('Customer has not opted in');
  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_WHATSAPP_FROM: from,
  } = process.env;
  if (!sid || !token || !from) throw new Error('Twilio WhatsApp is not configured');
  if (!/^\+[1-9]\d{6,14}$/.test(customer.phone))
    throw new Error('WhatsApp requires an E.164 customer phone number');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: from,
      To: 'whatsapp:' + customer.phone,
      ContentSid: body.contentSid,
      ContentVariables: JSON.stringify(body.variables),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Twilio rejected message: HTTP ' + response.status);
  const result = (await response.json()) as { sid: string; status: string };
  return { sid: result.sid, status: result.status };
}
export async function reconcilePayment(data: unknown) {
  const body = z
    .object({ gateway: z.enum(['stripe', 'razorpay']), reference: z.string().min(1) })
    .parse(data);
  if (body.gateway === 'stripe') {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe not configured');
    const session = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(
      body.reference
    );
    if (session.payment_status !== 'paid') throw new Error('Payment not captured');
    await confirmGatewayPayment(
      'stripe',
      session.id,
      session.amount_total ?? -1,
      session.currency ?? ''
    );
  } else {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      throw new Error('Razorpay not configured');
    const order = await new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    }).orders.fetch(body.reference);
    if (order.status !== 'paid') throw new Error('Payment not captured');
    await confirmGatewayPayment('razorpay', order.id, Number(order.amount_paid), order.currency);
  }
  return { reconciled: true };
}
export async function verifyInventoryDeduction(data: unknown) {
  const body = z.object({ tenantId: z.string().uuid(), orderId: z.string().uuid() }).parse(data);
  const order = await prisma.order.findFirst({
    where: { tenantId: body.tenantId, id: body.orderId, status: 'SETTLED' },
  });
  if (!order) throw new Error('Order is not settled');
  // Settlement deducts inventory in the invoice transaction. Never deduct again on retry.
  return { verified: true, orderId: order.id };
}
export async function backupUnavailable() {
  throw new Error(
    'Backup worker requires an installed and configured backup adapter; no backup was created'
  );
}
