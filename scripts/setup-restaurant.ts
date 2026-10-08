import '../apps/api/src/lib/loadEnv';
import { z } from 'zod';
import { prisma } from '../apps/api/src/lib/prisma';
import { provisionTenant } from '../apps/api/src/services/tenantService';
async function main() {
  const parsed = z
    .object({
      name: z.string().min(2),
      subdomain: z
        .string()
        .min(2)
        .regex(/^[a-z0-9-]+$/),
      adminUsername: z.string().min(3),
      adminPassword: z.string().min(12),
      adminEmail: z.string().email(),
      adminFullName: z.string().min(2),
    })
    .safeParse({
      name: process.env.INITIAL_RESTAURANT_NAME,
      subdomain: process.env.INITIAL_RESTAURANT_SLUG,
      adminUsername: process.env.INITIAL_ADMIN_USERNAME,
      adminPassword: process.env.INITIAL_ADMIN_PASSWORD,
      adminEmail: process.env.INITIAL_ADMIN_EMAIL,
      adminFullName: process.env.INITIAL_ADMIN_NAME,
    });
  if (!parsed.success)
    throw new Error(
      'Fill the six INITIAL_* settings in .env; use a password of at least 12 characters'
    );
  if (await prisma.tenant.findUnique({ where: { subdomain: parsed.data.subdomain } })) {
    console.log('Restaurant already exists; existing users and passwords left unchanged.');
    return;
  }
  const result = await provisionTenant(parsed.data);
  console.log(
    JSON.stringify({
      tenantId: result.tenant.id,
      restaurantSlug: result.tenant.subdomain,
      outletId: result.outlet.id,
      adminUsername: result.admin.username,
    })
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
