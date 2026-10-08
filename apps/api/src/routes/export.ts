import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { fail } from '../lib/domain';
import { streamDataExport } from '../services/exportService';
export const exportRouter = Router();
exportRouter.use(authenticate);
exportRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'ADMIN')
      fail('Only restaurant administrators can export tenant data', 403);
    const body = z
      .object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() })
      .parse(req.body);
    if (body.startDate && body.endDate && body.startDate > body.endDate)
      fail('Start date must precede end date');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dinely-export.json"');
    res.setHeader('Cache-Control', 'no-store');
    try {
      await streamDataExport(
        req.user!.tenantId,
        { start: body.startDate, end: body.endDate },
        async (chunk) => {
          if (res.destroyed) throw new Error('Download disconnected');
          if (!res.write(chunk))
            await new Promise<void>((done, reject) => {
              const cleanup = () => {
                res.off('drain', drained);
                res.off('close', closed);
              };
              const drained = () => {
                cleanup();
                done();
              };
              const closed = () => {
                cleanup();
                reject(new Error('Download disconnected'));
              };
              res.once('drain', drained);
              res.once('close', closed);
            });
        }
      );
      res.end();
    } catch (error) {
      if (res.headersSent) res.destroy();
      else throw error;
    }
  })
);
