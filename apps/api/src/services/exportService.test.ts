jest.mock('../lib/prisma', () => ({
  prisma: Object.fromEntries(
    [
      'order',
      'customer',
      'inventoryItem',
      'stockTransaction',
      'bill',
      'payment',
      'expense',
      'journalEntry',
      'loyaltyTransaction',
    ].map((key) => [key, { findMany: jest.fn().mockResolvedValue([]) }])
  ),
}));
import { prisma } from '../lib/prisma';
import { streamDataExport } from './exportService';
test('every exported collection is tenant scoped and bounded; order lines are included', async () => {
  let output = '';
  await streamDataExport(
    'own-tenant',
    { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
    async (chunk) => {
      output += chunk;
    }
  );
  expect(JSON.parse(output)).toEqual(
    expect.objectContaining({
      tenantId: 'own-tenant',
      data: expect.objectContaining({ order: [], customer: [], payment: [] }),
    })
  );
  for (const model of Object.values(prisma) as any[])
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'own-tenant' }),
        take: 500,
      })
    );
  expect(prisma.order.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ include: { items: true } })
  );
});
