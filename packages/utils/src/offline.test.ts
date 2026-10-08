import 'fake-indexeddb/auto';
import { OfflineStore, syncPending, operationTime, compareVectorClocks } from './index';
const name = 'test-' + Date.now();
let db: OfflineStore;
beforeEach(() => {
  db = new OfflineStore(name + Math.random());
});
afterEach(async () => {
  await db.delete();
});
const op = (id: string) => ({
  id,
  userId: 'staff',
  createdAt: operationTime(),
  type: 'order:create' as const,
  payload: { tableId: 'table' },
});
test('queued operations survive closing and reopening the app', async () => {
  const databaseName = db.name;
  await db.operations.put(op('one'));
  db.close();
  db = new OfflineStore(databaseName.replace('dinely-', ''));
  expect(await db.operations.count()).toBe(1);
});
test('network failure preserves every operation', async () => {
  await db.operations.bulkPut([op('a'), op('b')]);
  await expect(
    syncPending(db, async () => {
      throw new Error('offline');
    })
  ).rejects.toThrow('offline');
  expect(await db.operations.count()).toBe(2);
});
test('partial acknowledgements preserve conflicts and reject unrelated deletions', async () => {
  await db.operations.bulkPut([op('a'), op('b')]);
  await syncPending(db, async () => ({
    accepted: ['a', 'not-sent'],
    conflicts: [{ id: 'b', message: 'Table occupied' }],
  }));
  expect(await db.operations.get('a')).toBeUndefined();
  expect((await db.operations.get('b'))?.error).toBe('Table occupied');
});
test('batches never exceed server limit and acknowledgements leave later work intact', async () => {
  await db.operations.bulkPut(Array.from({ length: 103 }, (_, i) => op(String(i))));
  await syncPending(db, async (body: any) => {
    expect(body.operations).toHaveLength(100);
    return { accepted: body.operations.map((p: any) => p.id), conflicts: [] };
  });
  expect(await db.operations.count()).toBe(3);
});
test('delta maps provisional orders and stores cursor atomically', async () => {
  await syncPending(db, async () => ({
    accepted: [],
    conflicts: [],
    timestamp: '2026-10-08T00:00:00.000Z',
    delta: {
      orders: [{ id: 'server', clientOperationId: 'local', status: 'SETTLED' }],
      tables: [],
      menu: [],
    },
  }));
  expect((await db.cache.get('/api/pos/orders/offline:local'))?.value).toEqual(
    expect.objectContaining({ id: 'server' })
  );
  expect((await db.meta.get('lastSync'))?.value).toBe('2026-10-08T00:00:00.000Z');
});
test('vector clock comparison and monotonic queue ordering', () => {
  expect(compareVectorClocks({ a: 1 }, { b: 1 })).toBe('concurrent');
  expect(compareVectorClocks({ a: 1 }, { a: 2 })).toBe('before');
  expect(compareVectorClocks({ a: 2 }, { a: 1 })).toBe('after');
  expect(compareVectorClocks({ a: 1 }, { a: 1 })).toBe('equal');
  expect(operationTime() < operationTime()).toBe(true);
});

test('conflicting settlement remains recorded when server delta refreshes the order', async () => {
  await db.operations.put({
    ...op('payment'),
    type: 'order:settle',
    payload: { orderId: 'offline:create', expectedTotal: 100, paymentMethod: 'card' },
  });
  await syncPending(db, async () => ({
    accepted: [],
    conflicts: [{ id: 'payment', message: 'Price changed' }],
    delta: {
      orders: [{ id: 'server', clientOperationId: 'create', status: 'SUBMITTED', total: 110 }],
      tables: [],
      menu: [],
    },
  }));
  expect((await db.cache.get('/api/pos/orders/server'))?.value).toEqual(
    expect.objectContaining({ paymentStatus: 'PENDING_SYNC', pendingSync: true })
  );
  expect(await db.operations.count()).toBe(1);
});
