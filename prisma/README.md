# Dinely Database Setup - Multi-Tenant PostgreSQL with Prisma ORM

This document describes the database architecture and setup for the Dinely Restaurant Operating System.

## Architecture Overview

### Multi-Tenant Strategy: Schema-Per-Tenant
- **Public Schema**: Contains tenant management and global configuration
- **Tenant Schema**: Contains all tenant-specific data with `tenantId` isolation
- **Connection Pooling**: Optimized for high-concurrency SaaS workloads
- **Offline Support**: Vector clock-based conflict resolution for POS devices

## Database Setup

### Prerequisites
- PostgreSQL 14+ with required extensions
- Node.js 18+ and npm 9+
- Environment variables configured (see `.env.example`)

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Full development setup (creates DB, runs migrations, seeds data)
npm run db:setup-dev

# 4. Start Prisma Studio (optional)
npm run db:studio
```

### Production Setup

```bash
# Standard production setup (no seeding)
npm run db:setup-production

# Production setup with initial data (if needed)
npm run db:setup-production-full

# Manual migration deployment
npm run db:migrate:deploy
```

## Database Configuration

### Connection Pooling
- **Development**: 20 connections with 20-second timeout
- **Production**: 100+ connections via PgBouncer or similar
- **Connection Strings**: Use `pgbouncer=true` parameter for pooled connections

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=100
DIRECT_URL=postgresql://user:pass@host:5432/db  # For migrations
```

## Multi-Tenant Implementation

### Tenant Isolation
- All tenant data includes `tenantId` field for Row-Level Security
- Application-level tenant isolation via `MultiTenantPrismaClient`
- Automatic tenant scoping in all database operations

### Usage Example
```typescript
import { getTenantClient } from '@/lib/prisma';

const tenantDb = getTenantClient('tenant-uuid');
const orders = await tenantDb.tenant.order.findMany({
  where: { status: 'ACTIVE' }
  // tenantId automatically added
});
```

## Schema Overview

### Core Domains
1. **Tenant Management**: Multi-tenant configuration and billing
2. **Menu & Inventory**: Items, categories, recipes, and stock management  
3. **Orders & POS**: Complete order lifecycle and payment processing
4. **Customer Management**: CRM with loyalty points and feedback
5. **Operations**: Tables, reservations, staff, and reporting
6. **Offline Sync**: Device management and conflict resolution

### Key Features
- **Comprehensive Audit Trail**: All changes tracked with user attribution
- **Flexible Pricing**: Support for modifiers, discounts, and tax configurations
- **Inventory Integration**: Recipe-based cost calculation and stock deduction
- **Multi-Format Orders**: Dine-in, takeaway, delivery, and aggregator support
- **Real-time Updates**: WebSocket integration for live order updates

## Performance Optimizations

### Indexes
- Multi-column indexes on common query patterns
- Partial indexes for active records only
- GIN indexes for full-text search
- Concurrent index creation for zero-downtime

### Query Optimization
- Connection pooling with configurable limits
- Prepared statement caching
- Automatic query analysis and optimization
- Read replicas support for reporting queries

## Monitoring & Maintenance

### Built-in Views
- `tenant_statistics`: Per-tenant usage and revenue metrics
- `performance_metrics`: Database performance monitoring

### Health Checks
```bash
npm run db:check          # Basic connection test
npm run db:validate       # Schema validation
```

### Backup Strategy
1. **Automated Backups**: Daily full backups with point-in-time recovery
2. **Cross-Region Replication**: For disaster recovery
3. **Application-Level Exports**: Per-tenant data export capabilities

## Development Workflow

### Making Schema Changes
```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name description

# 3. Generate updated types  
npm run db:generate

# 4. Update application code
# 5. Test thoroughly before deployment
```

### Testing
- Property-based testing for data integrity
- Multi-tenant isolation testing
- Performance testing under load
- Backup and recovery testing

## Deployment Checklist

### Pre-Deployment
- [ ] Database backup created
- [ ] Migration tested on staging  
- [ ] Performance impact assessed
- [ ] Rollback plan prepared

### Deployment
- [ ] Apply migrations with `npm run db:migrate:deploy`
- [ ] Verify application connectivity
- [ ] Run health checks
- [ ] Monitor performance metrics

### Post-Deployment  
- [ ] Verify all tenants operational
- [ ] Check error logs
- [ ] Update monitoring dashboards
- [ ] Document changes

## Troubleshooting

### Common Issues
1. **Connection Pool Exhaustion**: Increase `connection_limit` or add more pools
2. **Migration Failures**: Use `DIRECT_URL` for schema changes
3. **Tenant Isolation**: Verify `tenantId` is included in all queries
4. **Performance**: Check query plans and index usage

### Monitoring Queries
```sql
-- Active connections
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Slow queries  
SELECT query, mean_exec_time FROM pg_stat_statements 
ORDER BY mean_exec_time DESC LIMIT 10;

-- Tenant data distribution
SELECT tenant_id, COUNT(*) FROM tenant.orders 
GROUP BY tenant_id ORDER BY count DESC;
```

## Security Considerations

### Data Protection
- All sensitive data encrypted at rest
- Row-level security policies enforced
- Audit logging for compliance
- Regular security assessments

### Access Control
- Principle of least privilege
- Separate credentials for different environments
- Regular credential rotation
- Multi-factor authentication for admin access

---

For technical support, refer to the [Prisma documentation](https://www.prisma.io/docs/) or contact the development team.