/**
 * Prisma 7.x Configuration
 * Modern configuration for database connections, connection pooling, and multi-tenant setup
 */

import { defineConfig } from '@prisma/client';

export default defineConfig({
  // Database connection configuration
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL, // For migrations and schema introspection
  },
  
  // Connection pooling and performance optimization
  connection: {
    maxConnections: parseInt(process.env.PRISMA_CLIENT_MAX_CONNECTIONS || '10'),
    connectionTimeout: parseInt(process.env.PRISMA_CLIENT_CONNECTION_TIMEOUT || '30000'),
  },
  
  // Logging configuration
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
    
  // Error formatting
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  
  // Multi-tenant configuration helpers
  tenant: {
    // Helper function to create tenant-scoped where clauses
    scope: (tenantId: string) => ({ tenantId }),
    
    // Tenant isolation middleware
    middleware: (tenantId: string) => ({
      create: (params: any) => ({
        ...params,
        data: { ...params.data, tenantId }
      }),
      
      findMany: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      findFirst: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      findUnique: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      update: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      updateMany: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      delete: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      deleteMany: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      }),
      
      count: (params: any) => ({
        ...params,
        where: { ...params.where, tenantId }
      })
    })
  }
});