import { asyncHandler } from '../lib/asyncHandler';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { fail } from '../lib/domain';
import { emitToOutlet } from '../lib/socket';

export const menuRouter = Router();
menuRouter.use(authenticate, requireOutletAccess);

const categorySchema = z.object({
  name: z.string().min(1),
  displayOrder: z.number().int().optional(),
  taxCategory: z.string().optional(),
  outletId: z.string().uuid().optional(),
});

const menuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  stationId: z.string().uuid().optional(),
  preparationTimeMinutes: z.number().int().positive().optional(),
  taxCategory: z.string().optional(),
  outletId: z.string().uuid().optional(),
  modifiers: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['single', 'multiple']).optional(),
        required: z.boolean().optional(),
        options: z.array(
          z.object({ id: z.string(), name: z.string(), priceAdjustment: z.number() })
        ),
      })
    )
    .optional(),
});

menuRouter.get(
  '/',
  requireOutletAccess,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const outletId = req.outletId as string;

    const categories = await prisma.menuCategory.findMany({
      where: {
        tenantId,
        outletId,
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        menuItems: {
          where: { isAvailable: true, OR: [{ outletId: null }, { outletId }] },
          orderBy: { name: 'asc' },
        },
      },
    });

    const outlet=await prisma.outlet.findFirst({where:{id:outletId,tenantId}});
    const settings=outlet?.settings as {serviceChargePercent?:number;taxRates?:unknown}|null;
    res.json({
      pricing:{serviceChargePercent:settings?.serviceChargePercent??10,taxRates:settings?.taxRates??[{category:'food',cgst:2.5,sgst:2.5}]},
      categories: categories.map(({ menuItems, ...category }) => ({
        ...category,
        items: menuItems.map(item=>({...item,taxCategory:category.taxCategory??'food'})),
      })),
    });
  })
);

menuRouter.post(
  '/categories',
  requirePermission('manage_inventory'),
  asyncHandler(async (req, res) => {
    try {
      const body = categorySchema.parse(req.body);
      const targetOutlet = body.outletId ?? req.outletId!;
      if (
        !req.user!.outletIds.includes(targetOutlet) ||
        !(await prisma.outlet.findFirst({
          where: { id: targetOutlet, tenantId: req.user!.tenantId },
        }))
      )
        fail('Outlet access denied', 403);
      const category = await prisma.menuCategory.create({
        data: {
          tenantId: req.user!.tenantId,
          outletId: (body.outletId ?? req.outletId) as string,
          name: body.name,
          displayOrder: body.displayOrder ?? 0,
          taxCategory: body.taxCategory ?? 'food',
        },
      });
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
        return;
      }
      throw err;
    }
  })
);

menuRouter.post(
  '/items',
  requirePermission('manage_inventory'),
  asyncHandler(async (req, res) => {
    try {
      const body = menuItemSchema.parse(req.body);
      const targetOutlet = body.outletId ?? req.outletId!;
      if (!req.user!.outletIds.includes(targetOutlet)) fail('Outlet access denied', 403);
      if (
        !(await prisma.menuCategory.findFirst({
          where: { id: body.categoryId, tenantId: req.user!.tenantId, outletId: targetOutlet },
        }))
      )
        fail('Category not found in outlet', 404);
      if (
        body.stationId &&
        !(await prisma.kitchenStation.findFirst({
          where: { id: body.stationId, tenantId: req.user!.tenantId, outletId: targetOutlet },
        }))
      )
        fail('Station not found in outlet', 404);
      const item = await prisma.menuItem.create({
        data: {
          tenantId: req.user!.tenantId,
          outletId: body.outletId ?? (req.outletId as string),
          categoryId: body.categoryId,
          name: body.name,
          description: body.description,
          price: body.price,
          image: body.imageUrl,
          tags: body.tags ?? [],
          stationId: body.stationId,
          preparationTimeMinutes: body.preparationTimeMinutes ?? 15,
          modifiers: body.modifiers as any,
        },
      });

      emitToOutlet(req.user!.tenantId, req.outletId as string, 'menu:item:updated', item);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
        return;
      }
      throw err;
    }
  })
);

menuRouter.patch(
  '/items/:id',
  requirePermission('manage_inventory'),
  asyncHandler(async (req, res) => {
    const { price, isAvailable, name, description, tags } = z
      .object({
        price: z.number().positive().optional(),
        isAvailable: z.boolean().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const item = await prisma.menuItem.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId },
      data: {
        ...(price !== undefined && { price: Number(price) }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(name !== undefined && { name: String(name) }),
        ...(description !== undefined && { description: String(description) }),
        ...(tags !== undefined && { tags: tags as string[] }),
      },
    });

    if (item.count === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Menu item not found' } });
      return;
    }

    const updated = await prisma.menuItem.findUnique({
      where: { id: req.params.id as string },
    });
    emitToOutlet(req.user!.tenantId, req.outletId as string, 'menu:item:updated', updated);
    res.json(updated);
  })
);

menuRouter.patch(
  '/items/:id/availability',
  requirePermission('manage_inventory'),
  asyncHandler(async (req, res) => {
    const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
    const updated = await prisma.menuItem.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, outletId: req.outletId },
      data: { isAvailable: Boolean(isAvailable) },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Menu item not found' } });
      return;
    }

    const item = await prisma.menuItem.findUnique({ where: { id: req.params.id as string } });
    emitToOutlet(req.user!.tenantId, req.outletId as string, 'menu:item:availability', item);
    res.json(item);
  })
);
