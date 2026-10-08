import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, type JwtPayload } from './middleware/auth';

import { prisma, disconnectPrisma } from './lib/prisma';
import { paymentsRouter, paymentWebhooks } from './routes/payments';
import { rateLimit } from './middleware/rateLimit';
import { discountsRouter } from './routes/discounts';
import { publicRouter } from './routes/public';
import { syncRouter } from './routes/sync';
import { analyticsRouter } from './routes/analytics';
import { usersRouter, outletsRouter, auditRouter } from './routes/management';
import { accountingRouter, drawerRouter } from './routes/accounting';
import { crmRouter } from './routes/crm';
import { procurementRouter } from './routes/procurement';
import { inventoryRouter } from './routes/inventory';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth';
import { tenantRouter } from './routes/tenants';
import { menuRouter } from './routes/menu';
import { posOrdersRouter } from './routes/pos/orders';
import { posTablesRouter } from './routes/pos/tables';
import { posReservationsRouter } from './routes/pos/reservations';
import { kdsRouter } from './routes/kds/orders';
import { setSocketIO } from './lib/socket';
import type { AuthUser } from '@dinely/types';
import { redisClient, closeRedisConnection } from './lib/redis';
import { shutdownQueues } from './lib/queue';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

export const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*', methods: ['GET', 'POST', 'PATCH'] },
});

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
      outletId?: string;
    }
  }
}

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments', paymentWebhooks);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redisClient.ping()]);
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', rateLimit(15), authRouter);
app.use('/api/tenants', tenantRouter);
app.use('/api/menu', menuRouter);
app.use('/api/pos/orders', posOrdersRouter);
app.use('/api/pos/tables', posTablesRouter);
app.use('/api/pos/reservations', posReservationsRouter);
app.use('/api/kds', kdsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/inventory', procurementRouter);
app.use('/api/crm', crmRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/public', rateLimit(120), publicRouter);
app.use('/api/sync', syncRouter);
app.use('/api/outlets', outletsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/pos/cash-drawer', drawerRouter);

setSocketIO(io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!payload.iat || Date.now() - payload.iat * 1000 > 30 * 60 * 1000)
      return next(new Error('Session expired'));
    const current = await prisma.user.findFirst({
      where: { id: payload.id, tenantId: payload.tenantId, isActive: true },
    });
    if (!current) return next(new Error('Account inactive'));
    payload.outletIds = current.outletAssignments;
    socket.data.user = payload;
    socket.data.tenantId = payload.tenantId;
    const requestedOutlet = socket.handshake.auth.outletId as string | undefined;
    const outletId = requestedOutlet ?? payload.outletId ?? payload.outletIds[0];
    if (!outletId || !payload.outletIds.includes(outletId))
      return next(new Error('No outlet access'));
    socket.data.outletId = outletId;
    const expires = setTimeout(
      () => socket.disconnect(true),
      Math.max(1, payload.iat * 1000 + 30 * 60 * 1000 - Date.now())
    );
    socket.on('disconnect', () => clearTimeout(expires));
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const tenantId = socket.data.tenantId as string;
  const outletId = socket.data.outletId as string;
  const room = `tenant_${tenantId}_outlet_${outletId}`;
  socket.join(room);
  socket.on('disconnect', () => socket.leave(room));
});

app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err instanceof ZodError) {
      res
        .status(400)
        .json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() },
        });
      return;
    }
    console.error(err);
    const status = err.status ?? 500;
    res
      .status(status)
      .json({
        error: {
          code: err.code ?? 'INTERNAL_ERROR',
          message: status < 500 ? err.message : 'Internal server error',
        },
      });
  }
);

const serverInstance = httpServer.listen(PORT, () => {
  console.log(`🚀 Dinely API running on port ${PORT}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  serverInstance.close((err) => {
    if (err) {
      console.error('[Server] Error during HTTP server close:', err);
    } else {
      console.log('[Server] HTTP server closed.');
    }
  });

  try {
    await shutdownQueues();
    await closeRedisConnection();
    await disconnectPrisma();
    console.log('Shutdown complete. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { prisma };
export default app;
