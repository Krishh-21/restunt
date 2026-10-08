import { prisma } from '../lib/prisma';
import { fail } from '../lib/domain';
import { emitToOutlet } from '../lib/socket';
export async function confirmGatewayPayment(gateway: string, reference: string, amount: number, currency: string) {
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${gateway + ':' + reference}))::text`;
    const payment = await tx.payment.findUnique({ where: { gateway_gatewayTransactionId: { gateway, gatewayTransactionId: reference } }, include: { order: true } });
    if (!payment) fail('Payment reference not registered', 409);
    if (Math.round(Number(payment.amount) * 100) !== amount || payment.currency.toUpperCase() !== currency.toUpperCase() || Math.round(Number(payment.order.total)*100)!==amount) fail('Payment amount/currency mismatch', 409);
    if (payment.status === 'PAID') return null;
    if (payment.order.paymentStatus === 'PAID') fail('Order already paid; duplicate payment requires refund review', 409);
    if (payment.order.status === 'VOIDED') fail('Order was voided; refund review required', 409);
    if (payment.order.tableId && payment.order.status === 'DRAFT') {
      const table = await tx.table.updateMany({ where: { id: payment.order.tableId, tenantId: payment.tenantId, outletId: payment.order.outletId, currentOrderId: null, status: { in: ['AVAILABLE', 'RESERVED'] } }, data: { currentOrderId: payment.orderId, status: 'OCCUPIED', occupiedAt: new Date() } });
      if (!table.count) fail('Table unavailable after payment; refund review required', 409);
    }
    const changed = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'PAID', settledAt: new Date() } }); if (!changed.count) return null;
    return tx.order.update({ where: { id: payment.orderId, tenantId: payment.tenantId, paymentStatus: { not: 'PAID' } }, data: { paymentStatus: 'PAID', paymentMethod: 'ONLINE', paymentTransactionId: reference, ...(payment.order.status==='DRAFT'?{status:'SUBMITTED'}:{}) }, include: { items: true } });
  });
  if (result) { emitToOutlet(result.tenantId, result.outletId, 'order:new', result); emitToOutlet(result.tenantId,result.outletId,'order:updated',result); }
  return result;
}
