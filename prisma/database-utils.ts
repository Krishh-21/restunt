#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Parse DATABASE_URL into components
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  const parsed = new URL(url.replace('postgresql://', 'postgres://'));
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    username: parsed.username,
    password: parsed.password
  };
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Create database if it doesn't exist
 */
export async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const config = parseDatabaseUrl(databaseUrl);
  
  // Connect to postgres database to create our target database
  const adminUrl = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/postgres`;
  
  // Temporarily set the admin URL for connection
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = adminUrl;
  
  const adminPrisma = new PrismaClient();

  try {
    // Check if database exists
    const result = await adminPrisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM pg_database WHERE datname = ${config.database}
      ) as exists
    `;

    if (!result[0].exists) {
      console.log(`Creating database: ${config.database}`);
      await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${config.database}"`);
      console.log('✅ Database created successfully');
    } else {
      console.log(`✅ Database ${config.database} already exists`);
    }
  } finally {
    await adminPrisma.$disconnect();
    // Restore original URL
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
  }
}

/**
 * Setup database extensions and schemas
 */
export async function setupDatabaseExtensions(): Promise<void> {
  try {
    // Create schemas
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS "public"`;
    await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS "tenant"`;
    
    // Create extensions
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    console.log('✅ Database schemas and extensions setup complete');
  } catch (error) {
    console.error('❌ Failed to setup database extensions:', error);
    throw error;
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: true
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

/**
 * Seed database with initial data
 */
export async function seedDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const seed = spawn('tsx', ['prisma/seed.ts'], {
      stdio: 'inherit',
      shell: true
    });

    seed.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Database seeding completed successfully');
        resolve();
      } else {
        reject(new Error(`Seeding failed with exit code ${code}`));
      }
    });
  });
}

/**
 * Full database setup for development
 */
export async function setupDevDatabase(): Promise<void> {
  console.log('🚀 Setting up development database...');
  
  try {
    await createDatabase();
    await setupDatabaseExtensions();
    await runMigrations();
    await seedDatabase();
    
    console.log('🎉 Development database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Production database setup (without seeding)
 */
export async function setupProductionDatabase(): Promise<void> {
  console.log('🚀 Setting up production database...');
  
  try {
    await setupDatabaseExtensions();
    await runMigrations();
    
    console.log('🎉 Production database setup complete!');
  } catch (error) {
    console.error('❌ Production database setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      checkConnection().then(success => process.exit(success ? 0 : 1));
      break;
    case 'create':
      createDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'setup-dev':
      setupDevDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'setup-prod':
      setupProductionDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'migrate':
      runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'seed':
      seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    default:
      console.log('Available commands:');
      console.log('  check      - Check database connection');
      console.log('  create     - Create database if it doesn\'t exist');
      console.log('  setup-dev  - Full development setup (create, migrate, seed)');
      console.log('  setup-prod - Production setup (migrate only)');
      console.log('  migrate    - Run database migrations');
      console.log('  seed       - Seed database with demo data');
      process.exit(1);
  }
}