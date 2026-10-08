#!/usr/bin/env tsx

/**
 * Production Database Setup Script
 * Comprehensive setup for PostgreSQL with Prisma in production environments
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { spawn } from 'child_process';
import * as fs from 'fs';

interface ProductionConfig {
  skipSeed?: boolean;
  enableExtensions?: boolean;
  setupMonitoring?: boolean;
  createIndexes?: boolean;
  optimizeQueries?: boolean;
}

class ProductionDatabaseSetup {
  private prisma: PrismaClient;
  private config: ProductionConfig;

  constructor(config: ProductionConfig = {}) {
    this.config = {
      skipSeed: config.skipSeed ?? true,
      enableExtensions: config.enableExtensions ?? true,
      setupMonitoring: config.setupMonitoring ?? true,
      createIndexes: config.createIndexes ?? true,
      optimizeQueries: config.optimizeQueries ?? true,
    };

    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: ['error', 'warn'],
      errorFormat: 'minimal',
    });
  }

  async setup(): Promise<void> {
    console.log('🚀 Starting production database setup...');

    try {
      await this.verifyConnection();

      if (this.config.enableExtensions) {
        await this.setupExtensions();
      }

      await this.runMigrations();

      if (this.config.createIndexes) {
        await this.createPerformanceIndexes();
      }

      if (this.config.optimizeQueries) {
        await this.optimizeDatabase();
      }

      if (this.config.setupMonitoring) {
        await this.setupMonitoring();
      }

      if (!this.config.skipSeed) {
        await this.seedProductionData();
      }

      await this.verifySetup();

      console.log('🎉 Production database setup completed successfully!');
    } catch (error) {
      console.error('❌ Production database setup failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async verifyConnection(): Promise<void> {
    console.log('🔍 Verifying database connection...');

    try {
      await this.prisma.$queryRaw`SELECT version()`;
      console.log('✅ Database connection verified');
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  private async setupExtensions(): Promise<void> {
    console.log('🔧 Setting up PostgreSQL extensions...');

    try {
      // Create schemas
      await this.prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS "public"`;
      await this.prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS "tenant"`;

      // Essential extensions
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      // Performance extensions
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"`;
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`;
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "btree_gin"`;
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "btree_gist"`;

      console.log('✅ PostgreSQL extensions setup completed');
    } catch (error) {
      console.error('❌ Failed to setup extensions:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    console.log('📦 Running database migrations...');

    return new Promise((resolve, reject) => {
      const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL },
      });

      migrate.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Migrations completed successfully');
          resolve();
        } else {
          reject(new Error(`Migration failed with exit code ${code}`));
        }
      });
    });
  }

  private async createPerformanceIndexes(): Promise<void> {
    console.log('🚀 Creating performance indexes...');

    try {
      // Multi-column indexes for common query patterns
      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_tenant_outlet_status" 
        ON "tenant"."orders" ("tenant_id", "outlet_id", "status")
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_tenant_created_at" 
        ON "tenant"."orders" ("tenant_id", "created_at" DESC)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_menu_items_tenant_outlet_available" 
        ON "tenant"."menu_items" ("tenant_id", "outlet_id", "is_available")
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customers_tenant_phone" 
        ON "tenant"."customers" ("tenant_id", "phone")
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inventory_tenant_outlet_threshold" 
        ON "tenant"."inventory_items" ("tenant_id", "outlet_id", "current_quantity", "minimum_threshold")
      `;

      // Partial indexes for better performance
      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_active" 
        ON "tenant"."orders" ("tenant_id", "outlet_id", "created_at") 
        WHERE "status" IN ('DRAFT', 'SUBMITTED', 'PREPARING', 'READY')
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tables_available" 
        ON "tenant"."tables" ("tenant_id", "outlet_id") 
        WHERE "status" = 'AVAILABLE'
      `;

      // Text search indexes
      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_menu_items_name_gin" 
        ON "tenant"."menu_items" USING gin("name" gin_trgm_ops)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_customers_name_gin" 
        ON "tenant"."customers" USING gin("name" gin_trgm_ops)
      `;

      console.log('✅ Performance indexes created successfully');
    } catch (error) {
      console.error('❌ Failed to create performance indexes:', error);
      // Don't throw - indexes are optional
      console.log('⚠️  Continuing setup without performance indexes');
    }
  }

  private async optimizeDatabase(): Promise<void> {
    console.log('⚡ Optimizing database settings...');

    try {
      // Update table statistics
      await this.prisma.$executeRaw`ANALYZE`;

      // Set optimal PostgreSQL settings for the workload
      await this.prisma.$executeRaw`
        ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET max_connections = '200'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET shared_buffers = '256MB'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET effective_cache_size = '1GB'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET maintenance_work_mem = '64MB'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET checkpoint_completion_target = '0.7'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET wal_buffers = '16MB'
      `;

      await this.prisma.$executeRaw`
        ALTER SYSTEM SET default_statistics_target = '100'
      `;

      console.log('✅ Database optimization completed');
      console.log('ℹ️  Note: Some settings require a PostgreSQL restart to take effect');
    } catch (error) {
      console.error('❌ Failed to optimize database:', error);
      // Don't throw - optimization is optional
      console.log('⚠️  Continuing setup without optimization');
    }
  }

  private async setupMonitoring(): Promise<void> {
    console.log('📊 Setting up database monitoring...');

    try {
      // Create monitoring views
      await this.prisma.$executeRaw`
        CREATE OR REPLACE VIEW "public"."tenant_statistics" AS
        SELECT 
          t.id,
          t.name,
          t.subdomain,
          COUNT(DISTINCT o.id) as outlet_count,
          COUNT(DISTINCT ord.id) as total_orders,
          COUNT(DISTINCT c.id) as customer_count,
          COALESCE(SUM(ord.total), 0) as total_revenue
        FROM "public"."tenants" t
        LEFT JOIN "tenant"."outlets" o ON t.id = o.tenant_id
        LEFT JOIN "tenant"."orders" ord ON t.id = ord.tenant_id
        LEFT JOIN "tenant"."customers" c ON t.id = c.tenant_id
        WHERE t.is_active = true
        GROUP BY t.id, t.name, t.subdomain
      `;

      await this.prisma.$executeRaw`
        CREATE OR REPLACE VIEW "public"."performance_metrics" AS
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_writes,
          n_tup_ins,
          n_tup_upd, 
          n_tup_del,
          seq_scan,
          idx_scan
        FROM pg_stat_user_tables
        WHERE schemaname IN ('public', 'tenant')
        ORDER BY total_writes DESC
      `;

      console.log('✅ Database monitoring setup completed');
    } catch (error) {
      console.error('❌ Failed to setup monitoring:', error);
      // Don't throw - monitoring is optional
      console.log('⚠️  Continuing setup without monitoring');
    }
  }

  private async seedProductionData(): Promise<void> {
    console.log('🌱 Seeding production data...');

    // Only seed if explicitly requested in production
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEED) {
      console.log('⚠️  Skipping seed in production environment (safety measure)');
      return;
    }

    return new Promise((resolve, reject) => {
      const seed = spawn('tsx', ['prisma/seed.ts'], {
        stdio: 'inherit',
        shell: true,
      });

      seed.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Production data seeding completed');
          resolve();
        } else {
          reject(new Error(`Seeding failed with exit code ${code}`));
        }
      });
    });
  }

  private async verifySetup(): Promise<void> {
    console.log('🔍 Verifying database setup...');

    try {
      // Check that all main tables exist
      const tables = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('public', 'tenant')
        ORDER BY table_name
      `;

      const expectedTables = [
        'tenants',
        'outlets',
        'users',
        'customers',
        'orders',
        'order_items',
        'menu_categories',
        'menu_items',
        'tables',
        'payments',
        'bills',
      ];

      const existingTables = tables.map((t) => t.table_name);
      const missingTables = expectedTables.filter((table) => !existingTables.includes(table));

      if (missingTables.length > 0) {
        throw new Error(`Missing tables: ${missingTables.join(', ')}`);
      }

      // Test basic queries
      const tenantCount = await this.prisma.tenant.count();
      console.log(`📊 Found ${tenantCount} tenants in database`);

      console.log('✅ Database setup verification completed');
    } catch (error) {
      throw new Error(`Setup verification failed: ${error}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: ProductionConfig = {};

  // Parse command line arguments
  args.forEach((arg) => {
    switch (arg) {
      case '--with-seed':
        config.skipSeed = false;
        break;
      case '--no-extensions':
        config.enableExtensions = false;
        break;
      case '--no-monitoring':
        config.setupMonitoring = false;
        break;
      case '--no-indexes':
        config.createIndexes = false;
        break;
      case '--no-optimization':
        config.optimizeQueries = false;
        break;
    }
  });

  const setup = new ProductionDatabaseSetup(config);
  setup
    .setup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Production setup failed:', error);
      process.exit(1);
    });
}

export { ProductionDatabaseSetup };
