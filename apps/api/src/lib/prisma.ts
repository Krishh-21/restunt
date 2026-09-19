import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['error'],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown helper
export const disconnectPrisma = async () => {
  console.log('[Prisma] Disconnecting database...');
  await prisma.$disconnect();
};


/**
 * Multi-tenant helper functions
 */
export function tenantScope(tenantId: string) {
  return { tenantId };
}

/**
 * Enhanced Prisma client with multi-tenant support
 * Automatically adds tenant filtering to all queries
 */
export class MultiTenantPrismaClient {
  private tenantId: string;
  private client: PrismaClient;

  constructor(tenantId: string, client: PrismaClient = prisma) {
    this.tenantId = tenantId;
    this.client = client;
  }

  // Getter to access the base client with tenant scope
  get tenant() {
    const self = this;
    
    return {
      // Outlet operations
      outlet: {
        findMany: (args?: any) => 
          self.client.outlet.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.outlet.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findUnique: (args: any) => 
          self.client.outlet.findFirst({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.outlet.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.outlet.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.outlet.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.outlet.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // Order operations  
      order: {
        findMany: (args?: any) => 
          self.client.order.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.order.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findUnique: (args: any) => 
          self.client.order.findFirst({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.order.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.order.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.order.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.order.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // Customer operations
      customer: {
        findMany: (args?: any) => 
          self.client.customer.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.customer.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findUnique: (args: any) => 
          self.client.customer.findFirst({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.customer.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.customer.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.customer.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.customer.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // Menu Item operations
      menuItem: {
        findMany: (args?: any) => 
          self.client.menuItem.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.menuItem.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.menuItem.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.menuItem.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.menuItem.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.menuItem.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // Table operations
      table: {
        findMany: (args?: any) => 
          self.client.table.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.table.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.table.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.table.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.table.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.table.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // User operations
      user: {
        findMany: (args?: any) => 
          self.client.user.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.user.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.user.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.user.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        delete: (args: any) => 
          self.client.user.deleteMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId }
          }),
        count: (args?: any) => 
          self.client.user.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      },

      // Inventory operations
      inventoryItem: {
        findMany: (args?: any) => 
          self.client.inventoryItem.findMany({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        findFirst: (args?: any) => 
          self.client.inventoryItem.findFirst({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          }),
        create: (args: any) => 
          self.client.inventoryItem.create({
            ...args,
            data: { ...args.data, tenantId: self.tenantId }
          }),
        update: (args: any) => 
          self.client.inventoryItem.updateMany({
            ...args,
            where: { ...args.where, tenantId: self.tenantId },
            data: args.data
          }),
        count: (args?: any) => 
          self.client.inventoryItem.count({
            ...args,
            where: { ...args?.where, tenantId: self.tenantId }
          })
      }
    };
  }

  // Direct access to base client for transactions and raw queries
  get raw() {
    return this.client;
  }

  // Tenant-aware transaction wrapper
  async transaction<T>(
    fn: (prisma: any) => Promise<T>,
    options?: any
  ): Promise<T> {
    return this.client.$transaction(fn, options);
  }
}

/**
 * Creates a tenant-scoped Prisma client
 */
export function getTenantClient(tenantId: string): MultiTenantPrismaClient {
  return new MultiTenantPrismaClient(tenantId, prisma);
}

/**
 * Connection pool management for multiple schemas
 */
export class TenantConnectionManager {
  private static connections = new Map<string, PrismaClient>();
  private static maxConnections = 20;

  static async getConnection(tenantId: string): Promise<PrismaClient> {
    if (!this.connections.has(tenantId)) {
      // Check connection limit
      if (this.connections.size >= this.maxConnections) {
        // Clean up old connections (simple LRU)
        const firstKey = Array.from(this.connections.keys())[0];
        if (firstKey) {
          await this.closeConnection(firstKey);
        }
      }

      // For schema-per-tenant, we use the same connection but with tenant isolation
      // The schema isolation is handled at the application layer through tenant_id filtering
      this.connections.set(tenantId, prisma);
    }
    return this.connections.get(tenantId)!;
  }

  static async closeConnection(tenantId: string): Promise<void> {
    const connection = this.connections.get(tenantId);
    if (connection && connection !== prisma) {
      await connection.$disconnect();
    }
    this.connections.delete(tenantId);
  }

  static async closeAllConnections(): Promise<void> {
    const promises = Array.from(this.connections.values())
      .filter(conn => conn !== prisma)
      .map(conn => conn.$disconnect());
    await Promise.all(promises);
    this.connections.clear();
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
