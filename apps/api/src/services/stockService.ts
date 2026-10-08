import type { Prisma, StockTransactionType } from '@prisma/client';
import { receiveStock } from './inventoryCalculation';
import { fail } from '../lib/domain';
export async function changeStock(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    outletId: string;
    inventoryItemId: string;
    quantityChange: number;
    userId: string;
    reason: string;
    type: StockTransactionType;
    referenceId: string;
    cost?: number;
  }
) {
  const item = await tx.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: input.tenantId, outletId: input.outletId },
  });
  if (!item) fail('Inventory item not found', 404);
  const before = Number(item.currentQuantity);
  const after = Math.round((before + input.quantityChange) * 1000) / 1000;
  if (after < 0) fail(`Insufficient stock: ${item.name}`, 409, 'INSUFFICIENT_STOCK');
  const cost =
    input.type === 'PURCHASE'
      ? receiveStock(before, Number(item.weightedAverageCost), input.quantityChange, input.cost!)
          .weightedAverageCost
      : Number(item.weightedAverageCost);
  const updated = await tx.inventoryItem.updateMany({
    where: {
      id: item.id,
      tenantId: input.tenantId,
      outletId: input.outletId,
      version: item.version,
    },
    data: { currentQuantity: after, weightedAverageCost: cost, version: { increment: 1 } },
  });
  if (!updated.count) fail('Concurrent stock change; retry', 409, 'VERSION_CONFLICT');
  await tx.stockTransaction.create({
    data: {
      tenantId: input.tenantId,
      outletId: input.outletId,
      inventoryItemId: item.id,
      transactionType: input.type,
      quantityChange: input.quantityChange,
      quantityBefore: before,
      quantityAfter: after,
      costPerUnit: input.cost ?? Number(item.weightedAverageCost),
      reason: input.reason,
      referenceType: input.type === 'DEDUCTION' ? 'order' : 'purchase_order',
      referenceId: input.referenceId,
      createdByUserId: input.userId,
    },
  });
  return {
    itemId: item.id,
    name: item.name,
    quantity: after,
    crossedThreshold:
      before >= Number(item.minimumThreshold) && after < Number(item.minimumThreshold),
  };
}
export async function deductRecipes(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string,
  orderId: string,
  userId: string,
  lines: { menuItemId: string; quantity: number }[]
) {
  const recipes = await tx.recipe.findMany({
    where: {
      tenantId,
      outletId,
      menuItemId: { in: lines.map((l) => l.menuItemId) },
      isActive: true,
      effectiveDate: { lte: new Date() },
    },
    include: { ingredients: true },
    orderBy: [{ effectiveDate: 'desc' }, { version: 'desc' }],
  });
  const requirements = new Map<string, number>();
  for (const line of lines)
    for (const ingredient of recipes.find((r) => r.menuItemId === line.menuItemId)?.ingredients ??
      [])
      requirements.set(
        ingredient.inventoryItemId,
        (requirements.get(ingredient.inventoryItemId) ?? 0) +
          Number(ingredient.quantity) * line.quantity
      );
  const changes = [];
  for (const [inventoryItemId, quantity] of [...requirements].sort(([a], [b]) =>
    a.localeCompare(b)
  ))
    changes.push(
      await changeStock(tx, {
        tenantId,
        outletId,
        inventoryItemId,
        quantityChange: -quantity,
        userId,
        type: 'DEDUCTION',
        referenceId: orderId,
        reason: 'Recipe deduction on settlement',
      })
    );
  return changes;
}
