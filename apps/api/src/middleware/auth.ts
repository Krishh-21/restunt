import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { AuthUser, UserRole } from '@dinely/types';
import { PERMISSIONS } from '@dinely/types';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
)
  throw new Error('Set JWT_SECRET to at least 32 characters in production');
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export interface JwtPayload extends AuthUser {
  outletId?: string;
  iat?: number;
}

export function signToken(user: AuthUser, outletId: string): string {
  return jwt.sign({ ...user, outletId }, JWT_SECRET, { expiresIn: '8h' });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;

    if (payload.iat && Date.now() - payload.iat * 1000 > SESSION_TIMEOUT_MS) {
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      return;
    }

    const current = await prisma.user.findFirst({
      where: { id: payload.id, tenantId: payload.tenantId, isActive: true },
    });
    if (!current) {
      res
        .status(401)
        .json({
          error: { code: 'UNAUTHORIZED', message: 'Account is inactive or no longer exists' },
        });
      return;
    }
    req.user = {
      id: payload.id,
      tenantId: payload.tenantId,
      username: payload.username,
      email: payload.email,
      fullName: payload.fullName,
      role: current.role as UserRole,
      outletIds: current.outletAssignments,
    };
    req.tenantId = payload.tenantId;
    req.outletId =
      (req.headers['x-outlet-id'] as string) || payload.outletId || payload.outletIds[0];
    next();
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

const permissionNames: Record<string, string[]> = {
  view_orders: ['orders:view'],
  create_orders: ['orders:create'],
  update_order_status: ['orders:update', 'orders:update-status'],
  view_tables: ['tables:view', 'tables:manage'],
  manage_inventory: ['inventory:manage'],
  view_kds: ['kds:view', 'orders:update'],
  process_payments: ['payments:process', 'cash-drawer:manage'],
  'customers:view': ['customers:view', 'customers:manage'],
  'customers:create': ['customers:create', 'customers:manage'],
  'customers:update': ['customers:update', 'customers:manage'],
  'loyalty:award': ['loyalty:award', 'customers:manage'],
  'loyalty:redeem': ['loyalty:redeem', 'customers:manage'],
  'cash-drawer:open': ['cash-drawer:open', 'cash-drawer:manage'],
  'cash-drawer:close': ['cash-drawer:close', 'cash-drawer:manage'],
  'inventory:view': ['inventory:view', 'inventory:manage'],
  manage_users: ['users:update'],
};

export function hasPermission(role:UserRole,permission:string){const list:readonly string[]=PERMISSIONS[role]??[];return list.includes('*')||(permissionNames[permission]??[permission]).some(p=>list.includes(p));}

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const rolePerms: readonly string[] = PERMISSIONS[req.user.role as UserRole] ?? [];
    const allowed =
      rolePerms.includes('*') ||
      permissions.every((p) =>
        (permissionNames[p] ?? [p]).some((name) => rolePerms.includes(name))
      );

    if (!allowed) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }
    next();
  };
}

export function requireOutletAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.outletId) {
    res
      .status(400)
      .json({ error: { code: 'OUTLET_REQUIRED', message: 'Outlet context required' } });
    return;
  }
  if (!req.user.outletIds.includes(req.outletId)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this outlet' } });
    return;
  }
  next();
}
