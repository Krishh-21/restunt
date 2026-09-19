import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

import { prisma, disconnectPrisma } from './lib/prisma';
import { authRouter } from './routes/auth';
import { tenantRouter } from './routes/tenants';
import { menuRouter } from './routes/menu';
import { posOrdersRouter } from './routes/pos/orders';
import { posTablesRouter } from './routes/pos/tables';
import { posReservationsRouter } from './routes/pos/reservations';
import { kdsRouter } from './routes/kds/orders';
import { setSocketIO } from './lib/socket';
import type { AuthUser } from '@dinely/types';
import { closeRedisConnection } from './lib/redis';
import { shutdownQueues } from './lib/queue';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] },
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantRouter);
app.use('/api/menu', menuRouter);
app.use('/api/pos/orders', posOrdersRouter);
app.use('/api/pos/tables', posTablesRouter);
app.use('/api/pos/reservations', posReservationsRouter);
app.use('/api/kds', kdsRouter);

setSocketIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { outletId?: string };
    socket.data.user = payload;
    socket.data.tenantId = payload.tenantId;
    socket.data.outletId = payload.outletId ?? payload.outletIds[0];
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
  });
});

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
