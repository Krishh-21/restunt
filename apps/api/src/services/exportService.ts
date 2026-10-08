import { prisma } from '../lib/prisma';
const models = [
  'order',
  'customer',
  'inventoryItem',
  'stockTransaction',
  'bill',
  'payment',
  'expense',
  'journalEntry',
  'loyaltyTransaction',
] as const;
export async function streamDataExport(
  tenantId: string,
  range: { start?: Date; end?: Date },
  write: (chunk: string) => Promise<void>
) {
  const snapshotAt = new Date();
  const end = range.end && range.end < snapshotAt ? range.end : snapshotAt;
  await write(
    JSON.stringify({
      format: 'dinely-export',
      version: 1,
      tenantId,
      exportedAt: snapshotAt.toISOString(),
      dateFilter: 'record creation date',
      startDate: range.start?.toISOString() ?? null,
      endDate: end.toISOString(),
    }).slice(0, -1) + ',"data":{'
  );
  let first = true;
  for (const model of models) {
    await write((first ? '' : ',') + JSON.stringify(model) + ':[');
    first = false;
    let cursor: string | undefined;
    let firstRecord = true;
    for (;;) {
      const rows = await (prisma[model] as any).findMany({
        where: {
          tenantId,
          createdAt: { ...(range.start ? { gte: range.start } : {}), lte: end },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 500,
        ...(model === 'order' ? { include: { items: true } } : {}),
      });
      for (const row of rows) {
        await write((firstRecord ? '' : ',') + JSON.stringify(row));
        firstRecord = false;
      }
      if (rows.length < 500) break;
      cursor = rows[rows.length - 1].id;
    }
    await write(']');
  }
  await write('}}');
}
