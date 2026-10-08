import type { Prisma } from '@prisma/client';
import { fail } from '../lib/domain';
export interface ReplayOperation {
  id: string;
  userId: string;
  fingerprint: string;
  expectedStatus?: string;
  expectedTotal?: number;
}
export async function replayResult(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string,
  operation: ReplayOperation
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':sync:' + operation.id}))::text`;
  const receipt = await tx.syncOperation.findUnique({
    where: { tenantId_outletId_operationId: { tenantId, outletId, operationId: operation.id } },
  });
  if (
    receipt &&
    (receipt.userId !== operation.userId || receipt.fingerprint !== operation.fingerprint)
  )
    fail('Operation ID reused with different content', 409);
  return receipt?.result;
}
export async function acknowledge(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string,
  operation: ReplayOperation | undefined,
  result: unknown
) {
  if (operation)
    await tx.syncOperation.create({
      data: {
        tenantId,
        outletId,
        operationId: operation.id,
        userId: operation.userId,
        fingerprint: operation.fingerprint,
        result: JSON.parse(JSON.stringify(result)),
      },
    });
}
