import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  ioInstance = io;
}

export function emitToOutlet(
  tenantId: string,
  outletId: string,
  event: string,
  data: unknown
): void {
  ioInstance?.to(`tenant_${tenantId}_outlet_${outletId}`).emit(event, data);
}
