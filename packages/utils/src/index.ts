import Dexie, { type Table } from 'dexie';
export interface PendingOperation {
  id: string;
  userId: string;
  createdAt: string;
  type: 'order:create' | 'order:settle' | 'order:status';
  payload: unknown;
  error?: string;
}
export class OfflineStore extends Dexie {
  operations!: Table<PendingOperation, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  cache!: Table<{ key: string; value: unknown }, string>;
  constructor(scope: string) {
    super('dinely-' + scope);
    this.version(1).stores({ operations: 'id,createdAt,userId', cache: 'key' });
    this.version(2).stores({ operations: 'id,createdAt,userId', cache: 'key', meta: 'key' });
  }
}
export async function syncPending(
  store: OfflineStore,
  send: (
    body: unknown
  ) => Promise<{
    accepted: string[];
    conflicts: { id: string; message: string }[];
    timestamp?: string;
    delta?: {
      orders: Record<string, unknown>[];
      tables: Record<string, unknown>[];
      menu: Record<string, unknown>[];
    };
  }>
) {
  const pending = (await store.operations.orderBy('createdAt').toArray()).slice(0, 100);

  const lastSync = (await store.meta.get('lastSync'))?.value;
  const response = await send({ operations: pending, ...(lastSync ? { lastSync } : {}) });
  const sent = new Set(pending.map((p) => p.id));
  await store.transaction('rw', store.operations, store.cache, store.meta, async () => {
    for (const id of response.accepted) if (sent.has(id)) await store.operations.delete(id);
    const remaining = await store.operations.toArray();
    if (response.delta) {
      for (const fresh of response.delta.orders) {
        const payment = remaining.find(
          (p) =>
            p.type === 'order:settle' &&
            [(p.payload as { orderId: string }).orderId].some(
              (id) => id === fresh.id || id === 'offline:' + fresh.clientOperationId
            )
        );
        const order =
          payment && fresh.status !== 'SETTLED'
            ? { ...fresh, paymentStatus: 'PENDING_SYNC', pendingSync: true }
            : fresh;
        await store.cache.put({ key: '/api/pos/orders/' + order.id, value: order });
        if (order.clientOperationId)
          await store.cache.put({
            key: '/api/pos/orders/offline:' + order.clientOperationId,
            value: order,
          });
      }
      const tables = (await store.cache.get('/api/pos/tables'))?.value as
        Record<string, unknown>[] | undefined;
      if (tables) {
        const merged = new Map(tables.map((t) => [t.id, t]));
        for (const t of response.delta.tables) {
          const create = remaining.find(
            (p) => p.type === 'order:create' && (p.payload as { tableId?: string }).tableId === t.id
          );
          merged.set(
            t.id,
            create ? { ...t, status: 'OCCUPIED', currentOrderId: 'offline:' + create.id } : t
          );
        }
        await store.cache.put({ key: '/api/pos/tables', value: [...merged.values()] });
      }
      if (response.timestamp) await store.meta.put({ key: 'lastSync', value: response.timestamp });
    }
    for (const conflict of response.conflicts)
      if (sent.has(conflict.id))
        await store.operations.update(conflict.id, { error: conflict.message });
  });
}
export function compareVectorClocks(
  a: Record<string, number>,
  b: Record<string, number>
): 'before' | 'after' | 'equal' | 'concurrent' {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let less = false,
    greater = false;
  for (const key of keys) {
    const left = a[key] ?? 0,
      right = b[key] ?? 0;
    if (left < right) less = true;
    if (left > right) greater = true;
  }
  return less && greater ? 'concurrent' : less ? 'before' : greater ? 'after' : 'equal';
}

let lastTime = 0;
export function operationTime() {
  lastTime = Math.max(Date.now(), lastTime + 1);
  return new Date(lastTime).toISOString();
}
