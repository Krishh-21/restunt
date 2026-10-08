import { updateOrderStatus, settleOrder } from './orderService';
import { prisma } from '../lib/prisma';
import { emitToOutlet } from '../lib/socket';
jest.mock('../lib/prisma', () => ({
  prisma: {
    order: { findFirst: jest.fn(), update: jest.fn() },
    outlet: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../lib/socket', () => ({ emitToOutlet: jest.fn() }));
const db = prisma as unknown as {
  order: { findFirst: jest.Mock; update: jest.Mock };
  outlet: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};
beforeEach(() => jest.clearAllMocks());
it('does not mutate an order outside the tenant and outlet', async () => {
  db.order.findFirst.mockResolvedValue(null);
  await expect(updateOrderStatus('tenant', 'outlet', 'foreign', 'READY')).rejects.toThrow(
    'Order not found'
  );
  expect(db.order.findFirst).toHaveBeenCalledWith({
    where: { id: 'foreign', tenantId: 'tenant', outletId: 'outlet' },
  });
  expect(db.order.update).not.toHaveBeenCalled();
  expect(emitToOutlet).not.toHaveBeenCalled();
});
it.each(['SETTLED', 'VOIDED', 'READY'] as const)(
  'rejects direct DRAFT to %s transitions',
  async (status) => {
    db.order.findFirst.mockResolvedValue({ status: 'DRAFT' });
    await expect(updateOrderStatus('t', 'o', 'id', status)).rejects.toThrow(
      'Invalid order transition'
    );
    expect(db.order.update).not.toHaveBeenCalled();
  }
);
it('compares the current status when applying a lifecycle transition', async () => {
  db.order.findFirst.mockResolvedValue({ status: 'SUBMITTED' });
  db.order.update.mockResolvedValue({ id: 'id', status: 'PREPARING' });
  await updateOrderStatus('t', 'o', 'id', 'PREPARING');
  expect(db.order.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'id', tenantId: 't', outletId: 'o', status: 'SUBMITTED' },
    })
  );
});
it('does not allocate an invoice when another request already settled the order', async () => {
  db.outlet.findFirst.mockResolvedValue({ settings: null });
  db.order.findFirst.mockResolvedValue({ status: 'SERVED', items: [], discountAmount: 0 });
  const tx = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    invoiceSequence: { upsert: jest.fn() },
  };
  db.$transaction.mockImplementation((fn: (client: unknown) => Promise<unknown>) => fn(tx));
  await expect(settleOrder('t', 'o', 'id', { paymentMethod: 'cash' } as never)).rejects.toThrow(
    'already settled'
  );
  expect(tx.invoiceSequence.upsert).not.toHaveBeenCalled();
  expect(emitToOutlet).not.toHaveBeenCalled();
});
