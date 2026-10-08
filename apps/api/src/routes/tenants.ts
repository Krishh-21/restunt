import { rateLimit } from '../middleware/rateLimit';
import { fail } from '../lib/domain';
import { asyncHandler } from '../lib/asyncHandler';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import {
  provisionTenant,
  updateTenantSettings,
  updateOutletSettings,
} from '../services/tenantService';
import { prisma } from '../lib/prisma';

export const tenantRouter = Router();

const createTenantSchema = z.object({
  name: z.string().min(2),
  subdomain: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  adminUsername: z.string().min(3),
  adminPassword: z.string().min(8),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2),
  outletName: z.string().optional(),
  gstin: z.string().optional(),
});

tenantRouter.post(
  '/',
  rateLimit(3, 3600000),
  asyncHandler(async (req, res) => {
    try {
      const input = createTenantSchema.parse(req.body);
      const result = await provisionTenant(input);
      res.status(201).json({
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          subdomain: result.tenant.subdomain,
        },
        outlet: { id: result.outlet.id, name: result.outlet.name },
        admin: { id: result.admin.id, username: result.admin.username },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      res.status(400).json({ error: { code: 'PROVISION_ERROR', message } });
    }
  })
);

tenantRouter.get(
  '/:id/settings',
  authenticate,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: req.params.id as string },
    });
    if (!tenant || tenant.id !== req.user!.tenantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      return;
    }
    res.json({
      settings: tenant.settings,
      gstin: tenant.gstin,
      currency: tenant.currency,
      timezone: tenant.timezone,
    });
  })
);

tenantRouter.patch(
  '/:id/settings',
  authenticate,
  requirePermission('manage_users'),
  asyncHandler(async (req, res) => {
    try {
      if (req.params.id !== req.user!.tenantId) {
        res
          .status(403)
          .json({ error: { code: 'FORBIDDEN', message: 'Cannot modify other tenant settings' } });
        return;
      }
      const tenant = await updateTenantSettings(req.params.id as string, req.body);
      res.json(tenant);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      res.status(400).json({ error: { code: 'UPDATE_ERROR', message } });
    }
  })
);

tenantRouter.patch(
  '/outlets/:outletId/settings',
  authenticate,
  requirePermission('manage_users'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.user!.outletIds.includes(req.params.outletId as string))
        fail('Outlet access denied', 403);
      const outlet = await updateOutletSettings(
        req.user!.tenantId,
        req.params.outletId as string,
        req.body
      );
      res.json(outlet);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      res.status(400).json({ error: { code: 'UPDATE_ERROR', message } });
    }
  })
);

tenantRouter.get(
  '/outlets',
  authenticate,
  asyncHandler(async (req, res) => {
    const outlets = await prisma.outlet.findMany({
      where: { tenantId: req.user!.tenantId, id: { in: req.user!.outletIds }, isActive: true },
    });
    res.json(outlets);
  })
);
