import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

const DEFAULT_TAX_RATES = [{ category: 'food', cgst: 2.5, sgst: 2.5 }];

export interface ProvisionTenantInput {
  name: string;
  subdomain: string;
  adminUsername: string;
  adminPassword: string;
  adminEmail: string;
  adminFullName: string;
  outletName?: string;
  gstin?: string;
}

export async function provisionTenant(input: ProvisionTenantInput) {
  const existing = await prisma.tenant.findUnique({ where: { subdomain: input.subdomain } });
  if (existing) throw new Error('Subdomain already taken');

  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        subdomain: input.subdomain,
        gstin: input.gstin,
        settings: {
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          loyaltyPointsRate: 0.01,
        } as Prisma.InputJsonValue,
      },
    });

    const outlet = await tx.outlet.create({
      data: {
        tenantId: tenant.id,
        name: input.outletName ?? `${input.name} - Main`,
        address: 'Update address',
        phone: '0000000000',
        email: input.adminEmail,
        settings: {
          serviceChargePercent: 10,
          taxRates: DEFAULT_TAX_RATES,
          tablePrefix: 'OUT1',
        } as Prisma.InputJsonValue,
      },
    });

    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        username: input.adminUsername,
        email: input.adminEmail,
        passwordHash,
        fullName: input.adminFullName,
        role: 'ADMIN',
        outletAssignments: [outlet.id],
      },
    });

    const station = await tx.kitchenStation.create({
      data: { tenantId: tenant.id, outletId: outlet.id, name: 'Main Kitchen', type: 'general' },
    });

    const tables = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        tx.table.create({
          data: {
            tenantId: tenant.id,
            outletId: outlet.id,
            number: `T${i + 1}`,
            capacity: i < 4 ? 4 : 6,
            floorPlanPosition: {
              x: (i % 4) * 120 + 40,
              y: Math.floor(i / 4) * 120 + 40,
              shape: i % 2 === 0 ? 'square' : 'round',
            } as Prisma.InputJsonValue,
          },
        })
      )
    );

    return { tenant, outlet, admin, station, tables };
  });
}

export async function updateTenantSettings(
  tenantId: string,
  settings: Record<string, unknown>
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant not found');

  const merged = { ...(tenant.settings as object), ...settings };
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: merged as Prisma.InputJsonValue },
  });
}

export async function updateOutletSettings(
  tenantId: string,
  outletId: string,
  settings: Record<string, unknown>
) {
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
  if (!outlet) throw new Error('Outlet not found');

  const merged = { ...(outlet.settings as object), ...settings };
  return prisma.outlet.update({
    where: { id: outletId },
    data: { settings: merged as Prisma.InputJsonValue },
  });
}
