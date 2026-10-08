/**
 * Production-ready connection pool management for Prisma
 * Handles connection pooling, monitoring, and graceful shutdowns
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

export interface ConnectionPoolConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class PrismaConnectionPool {
  private static instance: PrismaConnectionPool;
  private client: PrismaClient;
  private config: Required<ConnectionPoolConfig>;
  private connectionCount = 0;
  private healthCheck: NodeJS.Timeout | null = null;

  private constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      connectionTimeout: config.connectionTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxLifetime: config.maxLifetime || 3600000, // 1 hour
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.client = this.createClient();
    this.setupHealthCheck();
    this.setupGracefulShutdown();
  }

  public static getInstance(config?: ConnectionPoolConfig): PrismaConnectionPool {
    if (!PrismaConnectionPool.instance) {
      PrismaConnectionPool.instance = new PrismaConnectionPool(config);
    }
    return PrismaConnectionPool.instance;
  }

  private createClient(): PrismaClient {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      errorFormat: 'minimal'
    });
  }

  public getClient(): PrismaClient {
    return this.client;
  }

  private setupHealthCheck(): void {
    // Perform health checks every 30 seconds
    this.healthCheck = setInterval(async () => {
      try {
        await this.client.$queryRaw`SELECT 1`;
      } catch (error) {
        console.error('Database health check failed:', error);
        await this.reconnect();
      }
    }, 30000);
  }

  private async reconnect(): Promise<void> {
    console.log('Attempting to reconnect to database...');
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.client.$disconnect();
        this.client = this.createClient();
        await this.client.$connect();
        console.log('Database reconnection successful');
        return;
      } catch (error) {
        console.error(`Reconnection attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }
    
    console.error('Failed to reconnect to database after all attempts');
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`Received ${signal}, closing database connections...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('beforeExit', () => shutdownHandler('beforeExit'));
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheck) {
      clearInterval(this.healthCheck);
    }
    
    try {
      await this.client.$disconnect();
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }

  public async checkConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }

  public getStats(): { connectionCount: number; config: Required<ConnectionPoolConfig> } {
    return {
      connectionCount: this.connectionCount,
      config: this.config
    };
  }
}

// Export configured pool instance
export const connectionPool = PrismaConnectionPool.getInstance({
  maxConnections: parseInt(process.env.PRISMA_CLIENT_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(process.env.PRISMA_CLIENT_CONNECTION_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.PRISMA_CLIENT_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.PRISMA_CLIENT_RETRY_DELAY || '1000')
});

// Export the client for convenience
export const pooledPrisma = connectionPool.getClient();