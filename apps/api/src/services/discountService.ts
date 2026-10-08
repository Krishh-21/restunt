import type { DiscountCode, Prisma } from '@prisma/client';
import { fail, money } from '../lib/domain';
export function discountAmount(
  code: DiscountCode,
  outletId: string,
  subtotal: number,
  items: { menuItemId: string; quantity: number; unitPrice: unknown }[],
  now = new Date()
) {
  if (!code.isActive || now < code.validFrom || now > code.validUntil)
    fail('Discount is inactive or expired');
  if (code.outletIds.length && !code.outletIds.includes(outletId))
    fail('Discount not valid at this outlet');
  if (code.minOrderValue !== null && subtotal < Number(code.minOrderValue))
    fail('Minimum order value not met');
  if (code.usageLimit !== null && code.usageCount >= code.usageLimit)
    fail('Discount usage limit reached');
  const eligible = code.applicableItems.length
    ? items
        .filter((i) => code.applicableItems.includes(i.menuItemId))
        .reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
    : subtotal;
  if (!eligible) fail('No eligible discount items');
  const amount =
    code.type === 'PERCENTAGE' ? (eligible * Number(code.value)) / 100 : Number(code.value);
  return money(
    Math.max(
      0,
      Math.min(eligible, amount, code.maxDiscount === null ? Infinity : Number(code.maxDiscount))
    )
  );
}
export async function consumeDiscount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string,
  code: string,
  subtotal: number,
  items: { menuItemId: string; quantity: number; unitPrice: unknown }[]
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':discount:' + code.toUpperCase()}))::text`;
  const record = await tx.discountCode.findFirst({ where: { tenantId, code: code.toUpperCase() } });
  if (!record) fail('Discount code not found', 404);
  const amount = discountAmount(record, outletId, subtotal, items);
  await tx.discountCode.update({
    where: { id: record.id, tenantId },
    data: { usageCount: { increment: 1 } },
  });
  return amount;
}
