import { prisma } from '../lib/prisma';
import { calculateOrderTotals, generateOrderNumber, generateInvoiceNumber } from './orderCalculation';
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
    requireManagerApprovalForVoids: s.requireManagerApprovalForVoids ?? defaults.requireManagerApprovalForVoids,
    requireManagerApprovalForDiscounts: s.requireManagerApprovalForDiscounts ?? defaults.requireManagerApprovalForDiscounts,
    cashDrawerSettings: s.cashDrawerSettings ?? defaults.cashDrawerSettings,
  };
}

async function nextOrderSequence(tenantId: string, outletId: string): Promise<number> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({
    where: { tenantId, outletId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  return count + 1;
}

async function nextInvoiceSequence(tenantId: string, outletId: string): Promise<number> {
  const year = new Date().getFullYear();
  const seq = await prisma.invoiceSequence.upsert({
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
  input: CreateOrderInput
) {
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new Error('Outlet not found');

  const settings = parseSettings(outlet.settings);
  const menuItemIds = input.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, tenantId, isAvailable: true },
    include: { category: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new Error('One or more menu items not found or unavailable');
  }

  const itemMap = new Map(menuItems.map((m) => [m.id, m]));
  const calcItems = input.items.map((i) => {
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

  const seq = await nextOrderSequence(tenantId, outletId);
  const orderNumber = generateOrderNumber(settings.tablePrefix, new Date().getFullYear(), seq);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        tenantId,
        outletId,
        orderNumber,
        tableId: input.tableId,
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
          create: input.items.map((i) => {
            const menu = itemMap.get(i.menuItemId)!;
            return {
              menuItemId: menu.id,
              menuItemName: menu.name,
              quantity: i.quantity,
              unitPrice: menu.price,
              modifiers: (i.modifiers ?? []) as any,
              specialInstructions: i.specialInstructions,
              stationId: menu.stationId,
            };
          }),
        },
      },
      include: { items: true },
    });

    if (input.tableId) {
      await tx.table.updateMany({
        where: { id: input.tableId, tenantId, outletId },
        data: { status: 'OCCUPIED', currentOrderId: created.id, occupiedAt: new Date() },
      });
    }

    return created;
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
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { items: true },
  });

  if (order.tenantId !== tenantId || order.outletId !== outletId) {
    throw new Error('Order not found');
  }

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
    include: { items: true },
  });
  if (!order) throw new Error('Order not found');
  if (order.status === 'SETTLED') throw new Error('Order already settled');
  if (order.status === 'VOIDED') throw new Error('Cannot settle voided order');

  const discountAmountNum = input.discountAmount
    ? Number(input.discountAmount)
    : (typeof order.discountAmount === 'number'
      ? order.discountAmount
      : Number(order.discountAmount?.toString() ?? 0));

  const totals = calculateOrderTotals({
    items: order.items.map((i) => ({
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      modifiers: (i.modifiers as any) ?? [],
    })),
    serviceChargePercent: settings.serviceChargePercent,
    discountAmount: discountAmountNum,
    taxRates: settings.taxRates,
  });

  const invSeq = await nextInvoiceSequence(tenantId, outletId);
  const invoiceNumber = generateInvoiceNumber(
    settings.tablePrefix,
    new Date().getFullYear(),
    invSeq
  );

  const settled = await prisma.$transaction(async (tx) => {
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
        where: { id: order.tableId },
        data: { status: 'AVAILABLE', currentOrderId: null, occupiedAt: null },
      });
      emitToOutlet(tenantId, outletId, 'table:available', { tableId: order.tableId });
    }

    return updated;
  });

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
      where: { id: orderId },
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
        where: { id: order.tableId },
        data: { status: 'AVAILABLE', currentOrderId: null, occupiedAt: null },
      });
      emitToOutlet(tenantId, outletId, 'table:available', { tableId: order.tableId });
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

  emitToOutlet(tenantId, outletId, 'order:updated', voided);
  return voided;
}

