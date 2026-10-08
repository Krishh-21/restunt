import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { createOrder, settleOrder } from './orderService';
jest.mock('../lib/socket', () => ({ emitToOutlet: jest.fn() }));
const enabled = !!process.env.INTEGRATION_DATABASE_URL;
(enabled ? describe : describe.skip)('PostgreSQL order transactions', () => {
  const tenantId = randomUUID(),
    outletId = randomUUID(),
    userId = randomUUID(),
    categoryId = randomUUID(),
    menuId = randomUUID(),
    customerId = randomUUID(),
    stockId = randomUUID();
  beforeAll(async () => {
    if (
      process.env.INTEGRATION_DATABASE_URL !== process.env.DATABASE_URL ||
      !new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')
    )
      throw new Error('Integration tests require a dedicated *_test database');
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Integration',
        subdomain: tenantId,
        settings: { loyaltyPointsRate: 0.1 },
      },
    });
    await prisma.outlet.create({
      data: {
        id: outletId,
        tenantId,
        name: 'Test',
        address: 'Test',
        phone: '1234567890',
        email: 'test@example.com',
        settings: {
          serviceChargePercent: 0,
          tablePrefix: tenantId.slice(0, 8),
          taxRates: [{ category: 'food', cgst: 2.5, sgst: 2.5 }],
        },
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        username: 'test',
        email: 'test@example.com',
        fullName: 'Test',
        passwordHash: 'unused',
        role: 'ADMIN',
        outletAssignments: [outletId],
      },
    });
    await prisma.menuCategory.create({
      data: {
        id: categoryId,
        tenantId,
        outletId,
        name: 'Food',
        displayOrder: 0,
        taxCategory: 'food',
      },
    });
    await prisma.menuItem.create({
      data: { id: menuId, tenantId, outletId, categoryId, name: 'Meal', price: 100, tags: [] },
    });
    await prisma.customer.create({
      data: { id: customerId, tenantId, name: 'Test', phone: '1234567890', tags: [] },
    });
    await prisma.inventoryItem.create({
      data: {
        id: stockId,
        tenantId,
        outletId,
        name: 'Rice',
        category: 'dry',
        unitOfMeasure: 'kg',
        currentQuantity: 10,
        minimumThreshold: 1,
        reorderQuantity: 10,
        weightedAverageCost: 20,
      },
    });
    await prisma.recipe.create({
      data: {
        tenantId,
        outletId,
        menuItemId: menuId,
        effectiveDate: new Date(0),
        ingredients: {
          create: {
            inventoryItemId: stockId,
            inventoryItemName: 'Rice',
            quantity: 0.5,
            unitOfMeasure: 'kg',
          },
        },
      },
    });
  }, 30000);
  afterAll(async () => {
    for (const model of [
      'syncOperation',
      'bill',
      'payment',
      'journalEntry',
      'loyaltyTransaction',
      'stockTransaction',
      'invoiceSequence',
      'order',
      'recipe',
      'inventoryItem',
      'customer',
      'menuItem',
      'menuCategory',
      'user',
      'outlet',
      'tenant',
    ] as const) {
      // Child records without tenantId are deleted through their fixture parent first.
      if (model === 'order') await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
      if (model === 'recipe')
        await prisma.recipeIngredient.deleteMany({ where: { recipe: { tenantId } } });
      await (prisma[model] as any).deleteMany({
        where: model === 'tenant' ? { id: tenantId } : { tenantId },
      });
    }
    await prisma.$disconnect();
  }, 30000);
  const input = () => ({
    type: 'takeaway' as const,
    source: 'pos' as const,
    customerId,
    items: [{ menuItemId: menuId, quantity: 2, modifiers: [] }],
  });
  test('replayed offline operation creates one order and number', async () => {
    const operation = { id: randomUUID(), createdAt: new Date() };
    const results = await Promise.all([
      createOrder(tenantId, outletId, userId, input(), operation),
      createOrder(tenantId, outletId, userId, input(), operation),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.order.count({ where: { tenantId, clientOperationId: operation.id } })).toBe(
      1
    );
  });
  test('concurrent settlement produces one bill, deduction, loyalty award, and journal', async () => {
    const order = await createOrder(tenantId, outletId, userId, input());
    const results = await Promise.allSettled([
      settleOrder(tenantId, outletId, order.id, { paymentMethod: 'card' }),
      settleOrder(tenantId, outletId, order.id, { paymentMethod: 'card' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.bill.count({ where: { tenantId, orderId: order.id } })).toBe(1);
    expect(await prisma.journalEntry.count({ where: { tenantId, orderId: order.id } })).toBe(1);
    expect(await prisma.loyaltyTransaction.count({ where: { tenantId, orderId: order.id } })).toBe(
      1
    );
    expect(
      Number(
        (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stockId } })).currentQuantity
      )
    ).toBe(9);
    expect(
      (await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).loyaltyPoints
    ).toBe(21);
  });
  test('failed cash settlement rolls back stock, loyalty, invoice allocation, and status', async () => {
    const before = await prisma.invoiceSequence.findFirst({ where: { tenantId, outletId } });
    const order = await createOrder(tenantId, outletId, userId, input());
    await expect(
      settleOrder(tenantId, outletId, order.id, { paymentMethod: 'cash' })
    ).rejects.toThrow('Open a cash drawer');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'DRAFT'
    );
    expect(
      Number(
        (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stockId } })).currentQuantity
      )
    ).toBe(9);
    expect(await prisma.loyaltyTransaction.count({ where: { tenantId, orderId: order.id } })).toBe(
      0
    );
    expect(
      (await prisma.invoiceSequence.findFirst({ where: { tenantId, outletId } }))?.lastSequence
    ).toBe(before?.lastSequence);
  });
  test('offline settlement receipt survives replay and rejects operation ID reuse',async()=>{
    const order=await createOrder(tenantId,outletId,userId,input());
    const operation={id:randomUUID(),userId,fingerprint:'same-request'};
    const first=await settleOrder(tenantId,outletId,order.id,{paymentMethod:'card'},operation);
    const replay=await settleOrder(tenantId,outletId,order.id,{paymentMethod:'card'},operation);
    expect(replay.invoiceNumber).toBe(first.invoiceNumber);
    expect(await prisma.payment.count({where:{tenantId,orderId:order.id}})).toBe(1);
    await expect(settleOrder(tenantId,outletId,order.id,{paymentMethod:'cash'},{...operation,fingerprint:'changed-request'})).rejects.toThrow('different content');
  });
  test('offline recorded amount mismatch rolls back every settlement effect',async()=>{
    const order=await createOrder(tenantId,outletId,userId,input());
    await expect(settleOrder(tenantId,outletId,order.id,{paymentMethod:'card'},{id:randomUUID(),userId,fingerprint:'mismatch',expectedTotal:0})).rejects.toThrow('price changed');
    expect(await prisma.payment.count({where:{tenantId,orderId:order.id}})).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('DRAFT');
  });
  test('foreign tenant cannot settle fixture order', async () => {
    const order = await createOrder(tenantId, outletId, userId, input());
    await expect(
      settleOrder(randomUUID(), outletId, order.id, { paymentMethod: 'card' })
    ).rejects.toThrow('Outlet not found');
  });
});
