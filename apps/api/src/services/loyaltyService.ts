import type { Prisma } from '@prisma/client';
import { fail } from '../lib/domain';
export function loyaltyTier(points: number) { return points >= 10000 ? 'PLATINUM' as const : points >= 5000 ? 'GOLD' as const : points >= 1000 ? 'SILVER' as const : 'BRONZE' as const; }
export function earnedPoints(amount: number, rate: number) { if (![amount,rate].every(Number.isFinite) || amount < 0 || rate < 0) fail('Invalid loyalty amount/rate'); return Math.floor(amount * rate); }
export async function awardLoyalty(tx: Prisma.TransactionClient, tenantId: string, customerId: string, orderId: string, amount: number) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':customer:' + customerId}))::text`;
  if (await tx.loyaltyTransaction.findFirst({ where: { tenantId, customerId, orderId, type: 'EARN' } })) return null;
  const customer = await tx.customer.findFirst({ where: { tenantId, id: customerId } }); if (!customer) fail('Customer not found', 404);
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  const settings = tenant?.settings as { loyaltyPointsRate?: number } | null;
  const points = earnedPoints(amount, settings?.loyaltyPointsRate ?? 0.01); const balance = customer.loyaltyPoints + points;
  await tx.customer.update({ where: { id: customer.id, tenantId }, data: { loyaltyPoints: balance, loyaltyTier: loyaltyTier(balance), lifetimeValue: { increment: amount }, orderCount: { increment: 1 }, lastOrderDate: new Date() } });
  return tx.loyaltyTransaction.create({ data: { tenantId, customerId, orderId, type: 'EARN', points, balanceBefore: customer.loyaltyPoints, balanceAfter: balance, reason: 'Order settlement' } });
}
