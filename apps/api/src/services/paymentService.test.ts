import { createHmac } from 'crypto';
import { confirmGatewayPayment } from './paymentService';
import { verifyHmac } from '../routes/payments';
import { prisma } from '../lib/prisma';
import { emitToOutlet } from '../lib/socket';
jest.mock('../lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('../lib/socket', () => ({ emitToOutlet: jest.fn() }));
const transaction = prisma.$transaction as jest.Mock;
const record = () => ({
  id: 'p',
  tenantId: 't',
  orderId: 'o',
  amount: 100,
  currency: 'INR',
  status: 'PENDING',
  order: {
    id: 'o',
    tenantId: 't',
    outletId: 'out',
    total: 100,
    status: 'DRAFT',
    paymentStatus: 'PENDING',
    tableId: null,
  },
});
let tx: any;
beforeEach(() => {
  jest.clearAllMocks();
  tx = {
    $queryRaw: jest.fn(),
    payment: {
      findUnique: jest.fn().mockResolvedValue(record()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: { update: jest.fn().mockResolvedValue({ id: 'o', tenantId: 't', outletId: 'out' }) },
  };
  transaction.mockImplementation((fn) => fn(tx));
});
test('HMAC binds the exact raw body and rejects changed or malformed signatures', () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac('sha256', 'secret').update(raw).digest('hex');
  expect(verifyHmac(raw, signature, 'secret')).toBe(true);
  expect(verifyHmac(Buffer.from('{}'), signature, 'secret')).toBe(false);
  expect(verifyHmac(raw, 'bad', 'secret')).toBe(false);
});
test.each([
  [9999, 'INR'],
  [10000, 'USD'],
])('amount and currency must match stored payment', async (amount, currency) => {
  await expect(
    confirmGatewayPayment('razorpay', 'ref', amount as number, currency as string)
  ).rejects.toThrow('mismatch');
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
});
test('duplicate webhook returns without mutating order or broadcasting', async () => {
  tx.payment.findUnique.mockResolvedValue({ ...record(), status: 'PAID' });
  expect(await confirmGatewayPayment('stripe', 'ref', 10000, 'inr')).toBeNull();
  expect(tx.order.update).not.toHaveBeenCalled();
  expect(emitToOutlet).not.toHaveBeenCalled();
});
test('captured payment transitions draft only after verifying gateway amount', async () => {
  await confirmGatewayPayment('stripe', 'ref', 10000, 'inr');
  expect(tx.order.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ paymentStatus: { not: 'PAID' } }),
      data: expect.objectContaining({
        paymentStatus: 'PAID',
        status: 'SUBMITTED',
        paymentMethod: 'ONLINE',
      }),
    })
  );
  expect(emitToOutlet).toHaveBeenCalledTimes(2);
});
test('second provider payment requires refund review', async () => {
  const payment = record();
  payment.order.paymentStatus = 'PAID';
  tx.payment.findUnique.mockResolvedValue(payment);
  await expect(confirmGatewayPayment('stripe', 'ref', 10000, 'INR')).rejects.toThrow(
    'refund review'
  );
  expect(tx.payment.updateMany).not.toHaveBeenCalled();
});
test('voided order cannot be resurrected by a late webhook', async () => {
  const payment = record();
  payment.order.status = 'VOIDED';
  tx.payment.findUnique.mockResolvedValue(payment);
  await expect(confirmGatewayPayment('stripe', 'ref', 10000, 'INR')).rejects.toThrow('voided');
  expect(tx.order.update).not.toHaveBeenCalled();
});
