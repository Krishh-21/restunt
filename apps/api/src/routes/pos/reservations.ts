import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticate, requireOutletAccess, requirePermission } from '../../middleware/auth';
import { emitToOutlet } from '../../lib/socket';

export const posReservationsRouter = Router();
posReservationsRouter.use(authenticate, requireOutletAccess);

const createReservationSchema = z.object({
  tableId: z.string().uuid(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(5),
  partySize: z.number().int().positive(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  notes: z.string().optional(),
});

posReservationsRouter.post('/', requirePermission('create_orders'), async (req, res) => {
  try {
    const input = createReservationSchema.parse(req.body);

    // 1. Find or create customer by phone
    let customer = await prisma.customer.findFirst({
      where: { tenantId: req.user!.tenantId, phone: input.customerPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: req.user!.tenantId,
          name: input.customerName,
          phone: input.customerPhone,
          whatsappOptIn: true,
        },
      });
    }

    // 2. Verify table exists
    const table = await prisma.table.findFirst({
      where: { id: input.tableId, tenantId: req.user!.tenantId, outletId: req.outletId as string },
    });
    if (!table) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Table not found' } });
      return;
    }

    // 3. Create Reservation
    const reservation = await prisma.reservation.create({
      data: {
        tenantId: req.user!.tenantId,
        outletId: req.outletId as string,
        tableId: input.tableId,
        customerId: customer.id,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        partySize: input.partySize,
        reservationDate: new Date(input.reservationDate),
        reservationTime: input.reservationTime,
        status: 'CONFIRMED',
        notes: input.notes,
      },
      include: { table: true },
    });

    emitToOutlet(req.user!.tenantId, req.outletId as string, 'reservation:created', reservation);
    res.status(201).json(reservation);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reservation creation failed';
    res.status(400).json({ error: { code: 'RESERVATION_ERROR', message } });
  }
});

posReservationsRouter.get('/', requirePermission('view_orders'), async (req, res) => {
  const date = req.query.date as string | undefined; // YYYY-MM-DD
  const reservations = await prisma.reservation.findMany({
    where: {
      tenantId: req.user!.tenantId,
      outletId: req.outletId as string,
      ...(date && { reservationDate: new Date(date) }),
    },
    include: { table: true },
    orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
  });
  res.json(reservations);
});

posReservationsRouter.patch('/:id/status', requirePermission('create_orders'), async (req, res) => {
  const { status } = req.body as { status: string };
  const valid = ['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'];
  const upper = status.toUpperCase();
  if (!valid.includes(upper)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid reservation status' } });
    return;
  }

  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, outletId: req.outletId as string },
    });
    if (!reservation) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reservation not found' } });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resv = await tx.reservation.update({
        where: { id: req.params.id },
        data: { status: upper as 'CONFIRMED' },
        include: { table: true },
      });

      // If seated, update table status to OCCUPIED
      if (upper === 'SEATED') {
        await tx.table.updateMany({
          where: { id: reservation.tableId },
          data: { status: 'OCCUPIED', occupiedAt: new Date() },
        });

        const table = await tx.table.findUnique({ where: { id: reservation.tableId } });
        emitToOutlet(req.user!.tenantId, req.outletId as string, 'table:status:updated', table);
      }

      return resv;
    });

    emitToOutlet(req.user!.tenantId, req.outletId as string, 'reservation:updated', updated);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status update failed';
    res.status(400).json({ error: { code: 'STATUS_ERROR', message } });
  }
});
