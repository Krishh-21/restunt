import { consumeDiscount } from './discountService';
import { awardLoyalty } from './loyaltyService';
import { deductRecipes } from './stockService';
import { resolveModifiers } from './orderModifiers';
import { prisma } from '../lib/prisma';
import {
  calculateOrderTotals,
  generateOrderNumber,
  generateInvoiceNumber,
} from './orderCalculation';
import { emitToOutlet } from '../lib/socket';
import type { CreateOrderInput, OutletSettings, SettleOrderInput } from '@dinely/types';
import type { OrderStatus, Prisma } from '@prisma/client';

function defaultOutletSettings(): OutletSettings {
  return {
    serviceChargePercent: 10,
    taxRates: [{ category: 'food', cgst: 2.5, sgst: 2.5 }],
    tablePrefix: 'OUT1',
    orderPrefix: 'ORD',
    billPrefix: 'BIL',
    autoKotPrint: true,
    requireManagerApprovalForVoids: true,
    requireManagerApprovalForDiscounts: true,
    cashDrawerSettings: {
      requireOpeningAmount: true,
      allowNegativeVariance: false,
      maxVarianceAmount: 0,
    },
  };
}

function parseSettings(raw: unknown): OutletSettings {
  if (!raw || typeof raw !== 'object') return defaultOutletSettings();
  const s = raw as Partial<OutletSettings>;
  const defaults = defaultOutletSettings();
  return {
    serviceChargePercent: s.serviceChargePercent ?? defaults.serviceChargePercent,
    taxRates: s.taxRates ?? defaults.taxRates,
    tablePrefix: s.tablePrefix ?? defaults.tablePrefix,
    orderPrefix: s.orderPrefix ?? defaults.orderPrefix,
    billPrefix: s.billPrefix ?? defaults.billPrefix,
    autoKotPrint: s.autoKotPrint ?? defaults.autoKotPrint,
    requireManagerApprovalForVoids:
      s.requireManagerApprovalForVoids ?? defaults.requireManagerApprovalForVoids,
    requireManagerApprovalForDiscounts:
      s.requireManagerApprovalForDiscounts ?? defaults.requireManagerApprovalForDiscounts,
    cashDrawerSettings: s.cashDrawerSettings ?? defaults.cashDrawerSettings,
  };
}

async function nextOrderSequence(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string
): Promise<number> {
  const year = new Date().getFullYear();
  const count = await tx.order.count({
    where: { tenantId, outletId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  return count + 1;
}

async function nextInvoiceSequence(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outletId: string
): Promise<number> {
  const year = new Date().getFullYear();
  const seq = await tx.invoiceSequence.upsert({
    where: { tenantId_outletId_year: { tenantId, outletId, year } },
    create: { tenantId, outletId, year, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });
  return seq.lastSequence;
}

export async function createOrder(
  tenantId: string,
  outletId: string,
  userId: string,
  input: CreateOrderInput,
  operation?: { id: string; createdAt: Date }
) {
  if (operation) {
    const existing = await prisma.order.findFirst({
      where: { tenantId, outletId, clientOperationId: operation.id },
      include: { items: true },
    });
    if (existing) return existing;
  }
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new Error('Outlet not found');

  if (
    input.tableId &&
    !(await prisma.table.findFirst({ where: { id: input.tableId, tenantId, outletId } }))
  )
    throw new Error('Table not found in outlet');
  if (
    input.customerId &&
    !(await prisma.customer.findFirst({ where: { id: input.customerId, tenantId } }))
  )
    throw new Error('Customer not found');
  const settings = parseSettings(outlet.settings);
  const menuItemIds = [...new Set(input.items.map((i) => i.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      tenantId,
      isAvailable: true,
      OR: [{ outletId }, { outletId: null }],
    },
    include: { category: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new Error('One or more menu items not found or unavailable');
  }

  const itemMap = new Map(menuItems.map((m) => [m.id, m]));
  const resolvedItems = input.items.map((i) => ({
    ...i,
    modifiers: resolveModifiers(itemMap.get(i.menuItemId)!.modifiers, i.modifiers),
  }));
  const calcItems = resolvedItems.map((i) => {
    const menu = itemMap.get(i.menuItemId)!;
    return {
      unitPrice: Number(menu.price),
      quantity: i.quantity,
      modifiers: (i.modifiers ?? []) as any,
      taxCategory: menu.category.taxCategory ?? 'food',
    };
  });

  const totals = calculateOrderTotals({
    items: calcItems,
    serviceChargePercent: settings.serviceChargePercent,
    discountAmount: 0,
    taxRates: settings.taxRates,
  });

  const order = await prisma.$transaction(async (tx) => {
    // Serialize numbering within an outlet; rolled-back orders consume no number.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + outletId}))::text`;
    if (operation) {
      const existing = await tx.order.findFirst({
        where: { tenantId, outletId, clientOperationId: operation.id },
        include: { items: true },
      });
      if (existing) return existing;
    }
    const seq = await nextOrderSequence(tx, tenantId, outletId);
    const orderNumber = generateOrderNumber(settings.tablePrefix, new Date().getFullYear(), seq);
    const created = await tx.order.create({
      data: {
        tenantId,
        outletId,
        orderNumber,
        clientOperationId: operation?.id,
        clientCreatedAt: operation?.createdAt,
        tableId: input.tableId,
        customerId: input.customerId,
        source: (input.source?.toUpperCase() as 'POS') ?? 'POS',
        type: (input.type?.toUpperCase().replace('-', '_') as 'DINE_IN') ?? 'DINE_IN',
        status: 'DRAFT',
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        taxBreakdown: totals.taxBreakdown as any,
        serviceCharge: totals.serviceCharge,
        discountAmount: totals.discountAmount,
        total: totals.total,
        createdByUserId: userId,
        notes: input.notes,
        items: {
          create: resolvedItems.map((i) => {
            const menu = itemMap.get(i.menuItemId)!;
            return {
              menuItemId: menu.id,
              menuItemName: menu.name,
              quantity: i.quantity,
              unitPrice: menu.price,
              modifiers: (i.modifiers ?? []) as any,
              specialInstructions: i.specialInstructions,
            };
          }),
        },
      },
      include: { items: true },
    });

    if (input.tableId && !['qr', 'online'].includes(input.source ?? 'pos')) {
      const occupied = await tx.table.updateMany({
        where: {
          id: input.tableId,
          tenantId,
          outletId,
          status: { in: ['AVAILABLE', 'RESERVED'] },
          currentOrderId: null,
        },
        data: { status: 'OCCUPIED', currentOrderId: created.id, occupiedAt: new Date() },
      });
      if (occupied.count !== 1) throw new Error('Table not available in this outlet');
    }

    return created;
  });

  if (input.tableId && !['qr', 'online'].includes(input.source ?? 'pos'))
    emitToOutlet(tenantId, outletId, 'table:occupied', {
      tableId: input.tableId,
      orderId: order.id,
    });
  emitToOutlet(tenantId, outletId, 'order:created', order);
  return order;
}

export async function updateOrderStatus(
  tenantId: string,
  outletId: string,
  orderId: string,
  status: OrderStatus
) {
  const current = await prisma.order.findFirst({ where: { id: orderId, tenantId, outletId } });
  if (!current) throw new Error('Order not found');
  const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['PREPARING'],
    PREPARING: ['READY'],
    READY: ['SERVED'],
  };
  if (!transitions[current.status]?.includes(status)) {
    throw new Error(`Invalid order transition: ${current.status} to ${status}`);
  }
  const order = await prisma.order.update({
    where: { id: orderId, tenantId, outletId, status: current.status },
    data: { status },
    include: { items: true },
  });

  emitToOutlet(tenantId, outletId, 'order:updated', order);
  return order;
}

export async function settleOrder(
  tenantId: string,
  outletId: string,
  orderId: string,
  input: SettleOrderInput
) {
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new Error('Outlet not found');
  const settings = parseSettings(outlet.settings);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, outletId },
    include: { items: { include: { menuItem: { include: { category: true } } } } },
  });
  if (!order) throw new Error('Order not found');
  if (order.status === 'SETTLED') throw new Error('Order already settled');
  if (order.status === 'VOIDED') throw new Error('Cannot settle voided order');
  if (order.paymentStatus === 'PAID' && input.paymentMethod.toUpperCase() !== 'ONLINE')
    throw new Error('This order has a verified online payment; settle using ONLINE');

  const discountAmountNum =
    input.discountAmount !== undefined
      ? Number(input.discountAmount)
      : typeof order.discountAmount === 'number'
        ? order.discountAmount
        : Number(order.discountAmount?.toString() ?? 0);

  const calculation = {
    items: order.items.map((i) => ({
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      modifiers: (i.modifiers as any) ?? [],
      taxCategory: i.menuItem.category.taxCategory ?? 'food',
    })),
    serviceChargePercent: settings.serviceChargePercent,
    discountAmount: discountAmountNum,
    taxRates: settings.taxRates,
  };

  const settled = await prisma.$transaction(async (tx) => {
    // Claim settlement before allocating an invoice. A concurrent attempt rolls back.
    const claim = await tx.order.updateMany({
      where: { id: orderId, tenantId, outletId, status: { notIn: ['SETTLED', 'VOIDED'] } },
      data: { status: 'SETTLED' },
    });
    if (claim.count !== 1) throw new Error('Order already settled or voided');
    if (input.discountCode && discountAmountNum > 0)
      throw new Error('Cannot combine a discount code and manual discount');
    if (input.discountCode && order.discountAmount.gt(0)) throw new Error('Cannot stack discounts');
    const discount = input.discountCode
      ? await consumeDiscount(
          tx,
          tenantId,
          outletId,
          input.discountCode,
          Number(order.subtotal),
          order.items
        )
      : discountAmountNum;
    const totals = calculateOrderTotals({ ...calculation, discountAmount: discount });
    await deductRecipes(tx, tenantId, outletId, orderId, order.createdByUserId, order.items);
    if (order.customerId) await awardLoyalty(tx, tenantId, order.customerId, orderId, totals.total);
    if (input.paymentMethod.toUpperCase() === 'CASH') {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':drawer:' + outletId}))::text`;
      const drawer = await tx.cashDrawerSession.findFirst({
        where: { tenantId, outletId, status: 'OPEN' },
      });
      if (!drawer) throw new Error('Open a cash drawer before accepting cash');
      await tx.cashDrawerSession.update({
        where: { id: drawer.id, status: 'OPEN' },
        data: { expectedClosingAmount: { increment: totals.total } },
      });
    }
    await tx.journalEntry.create({
      data: {
        tenantId,
        outletId,
        orderId,
        revenue: totals.total - totals.taxAmount,
        gst: totals.taxAmount,
        stream:
          order.source === 'AGGREGATOR'
            ? 'AGGREGATOR'
            : order.source === 'ONLINE' || order.source === 'QR'
              ? 'ONLINE'
              : order.type,
      },
    });
    const invSeq = await nextInvoiceSequence(tx, tenantId, outletId);
    const invoiceNumber = generateInvoiceNumber(
      settings.tablePrefix,
      new Date().getFullYear(),
      invSeq
    );
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'SETTLED',
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        taxBreakdown: totals.taxBreakdown as any,
        serviceCharge: totals.serviceCharge,
        discountAmount: totals.discountAmount,
        discountCode: input.discountCode,
        total: totals.total,
        paymentMethod: input.paymentMethod.toUpperCase() as 'CASH',
        paymentStatus: 'PAID',
        paymentTransactionId: input.paymentTransactionId,
        settledAt: new Date(),
      },
      include: { items: true },
    });

    if (input.paymentMethod.toUpperCase() === 'ONLINE') {
      const verified = await tx.payment.findFirst({
        where: { tenantId, orderId, status: 'PAID', amount: totals.total },
      });
      if (!verified) throw new Error('Online payment has not been verified by the gateway');
    } else {
      await tx.payment.create({
        data: {
          tenantId,
          orderId,
          amount: totals.total,
          method: input.paymentMethod.toUpperCase() as 'CASH',
          status: 'PAID',
          gatewayTransactionId: input.paymentTransactionId,
        },
      });
    }

    await tx.bill.create({
      data: {
        tenantId,
        outletId,
        orderId,
        billNumber: invoiceNumber,
        customerName: input.customerDetails?.name,
        customerPhone: input.customerDetails?.phone,
        customerGstin: input.customerDetails?.gstin,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        taxBreakdown: totals.taxBreakdown as any,
        serviceCharge: totals.serviceCharge,
        discountAmount: totals.discountAmount,
        total: totals.total,
        paymentMethod: input.paymentMethod.toUpperCase() as 'CASH',
      },
    });

    if (order.tableId) {
      await tx.table.updateMany({
        where: { id: order.tableId, tenantId, outletId, currentOrderId: orderId },
        data: { status: 'AVAILABLE', currentOrderId: null, occupiedAt: null },
      });
    }

    return { ...updated, invoiceNumber };
  });

  if (order.tableId)
    emitToOutlet(tenantId, outletId, 'table:available', { tableId: order.tableId });
  emitToOutlet(tenantId, outletId, 'order:updated', settled);
  return settled;
}

export async function generateKOT(tenantId: string, outletId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, outletId },
    include: { items: { include: { menuItem: true } } },
  });
  if (!order) throw new Error('Order not found');

  let tableNumber: string | null = null;
  if (order.tableId) {
    const table = await prisma.table.findUnique({ where: { id: order.tableId } });
    tableNumber = table?.number ?? null;
  }

  const now = new Date();
  await prisma.orderItem.updateMany({
    where: { orderId, kotPrintedAt: null },
    data: { kotPrintedAt: now },
  });

  if (order.status === 'DRAFT') {
    await updateOrderStatus(tenantId, outletId, orderId, 'SUBMITTED');
  }

  const items = order.items.map((i) => ({
    name: i.menuItemName,
    quantity: i.quantity,
    modifiers: (i.modifiers as any) ?? [],
    specialInstructions: i.specialInstructions,
    stationId: i.menuItem.stationId,
  }));

  const stations: Record<string, typeof items> = {};
  for (const item of items) {
    const key = item.stationId ?? 'general';
    stations[key] = stations[key] ?? [];
    stations[key].push(item);
  }

  const kot = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    tableNumber,
    items,
    timestamp: now.toISOString(),
    stations,
  };

  emitToOutlet(tenantId, outletId, 'order:new', kot);
  return kot;
}

export async function voidOrder(
  tenantId: string,
  outletId: string,
  userId: string,
  orderId: string,
  input: {
    reason: string;
    approvedByUserId: string;
    ipAddress: string;
    deviceId: string;
  }
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, outletId },
    include: { items: true },
  });
  if (!order) throw new Error('Order not found');
  if (order.status === 'VOIDED') throw new Error('Order is already voided');
  if (order.status === 'SETTLED') throw new Error('Cannot void a settled order');
  if (order.paymentStatus === 'PAID')
    throw new Error('Paid orders require a refund before voiding');

  // Verify that the approvedByUserId exists and is a manager/admin
  const manager = await prisma.user.findFirst({
    where: { id: input.approvedByUserId, tenantId },
  });
  if (!manager) throw new Error('Approving manager not found');

  const allowedRoles = ['ADMIN', 'MANAGER'];
  if (!allowedRoles.includes(manager.role)) {
    throw new Error('Approving user is not a manager or admin');
  }

  const beforeState = JSON.parse(JSON.stringify(order));

  const voided = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId, tenantId, outletId, status: { notIn: ['SETTLED', 'VOIDED'] } },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedByUserId: input.approvedByUserId,
        voidedReason: input.reason,
      },
      include: { items: true },
    });

    if (order.tableId) {
      await tx.table.updateMany({
        where: { id: order.tableId, tenantId, outletId, currentOrderId: orderId },
        data: { status: 'AVAILABLE', currentOrderId: null, occupiedAt: null },
      });
    }

    const afterState = JSON.parse(JSON.stringify(updated));

    await tx.auditLog.create({
      data: {
        tenantId,
        outletId,
        userId,
        action: 'void_order',
        entityType: 'order',
        entityId: orderId,
        beforeState,
        afterState,
        ipAddress: input.ipAddress,
        deviceId: input.deviceId,
        reason: input.reason,
        approvedByUserId: input.approvedByUserId,
      },
    });

    return updated;
  });

  if (order.tableId)
    emitToOutlet(tenantId, outletId, 'table:available', { tableId: order.tableId });
  emitToOutlet(tenantId, outletId, 'order:updated', voided);
  return voided;
}
