import '../apps/api/src/lib/loadEnv';
import { randomBytes, randomInt } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const schema = z.array(z.object({
  username: z.string().min(3), fullName: z.string().min(2),
  email: z.string().email(), password: z.string().min(16),
  pin: z.string().regex(/^\d{4}$/).optional(),
  role: z.enum(['MANAGER', 'CASHIER', 'SERVER', 'KITCHEN']),
})).min(1);
async function main() {
  const mode = process.argv[2];
  const path = resolve(process.argv[3] ?? '.data/staff-accounts.json');
  if (mode === '--prepare') {
    const accounts = ['MANAGER', 'CASHIER', 'SERVER', 'KITCHEN'].map(role => ({
      username: role.toLowerCase(), fullName: `Dinely ${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@staff.invalid`, role,
      password: randomBytes(24).toString('base64url'),
      ...(role === 'SERVER' ? { pin: randomInt(10000).toString().padStart(4, '0') } : {}),
    }));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(accounts, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Private staff credentials prepared. Replace names/emails before applying. Existing files are never overwritten.');
    return;
  }
  if (mode !== '--apply') throw new Error('Use --prepare [private-file] or --apply [private-file]');
  const accounts = schema.parse(JSON.parse(await readFile(path, 'utf8')));
  if (new Set(accounts.map(account => account.username)).size !== accounts.length ||
      new Set(accounts.map(account => account.email)).size !== accounts.length)
    throw new Error('Each account needs a unique username and email');
  const { prisma } = await import('../apps/api/src/lib/prisma');
  try {
    const tenant = await prisma.tenant.findUnique({ where: { subdomain: process.env.INITIAL_RESTAURANT_SLUG ?? '' } });
    if (!tenant) throw new Error('Create the restaurant first and set INITIAL_RESTAURANT_SLUG');
    const outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id, isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!outlet) throw new Error('Restaurant has no active outlet');
    const prepared = await Promise.all(accounts.map(async ({ password, pin, ...account }) => ({
      ...account, passwordHash: await bcrypt.hash(password, 12),
      pinHash: pin ? await bcrypt.hash(pin, 12) : undefined, tenantId: tenant.id, outletAssignments: [outlet.id],
    })));
    const result = await prisma.$transaction(async tx => {
      let created = 0;
      for (const data of prepared) {
        const existing = await tx.user.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username: data.username } } });
        if (existing) continue; // Never change an existing user's credentials or permissions.
        await tx.user.create({ data });
        created++;
      }
      return created;
    });
    console.log(JSON.stringify({ created: result, skippedExisting: accounts.length - result }));
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Staff setup failed. Check mode, private file, restaurant slug and database. Credentials were not logged.'); process.exitCode = 1; });
