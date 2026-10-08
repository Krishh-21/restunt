jest.mock('../lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn() } } }));
import { requirePermission, requireOutletAccess } from './auth';
import type { Request, Response } from 'express';
function request(role: string) {
  return { user: { role, outletIds: ['outlet'] }, outletId: 'outlet' } as unknown as Request;
}
function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}
it.each([
  ['CASHIER', 'view_tables'],
  ['KITCHEN', 'update_order_status'],
  ['MANAGER', 'inventory:view'],
  ['ADMIN', 'process_payments'],
])('allows %s to %s using canonical role permissions', (role, permission) => {
  const next = jest.fn();
  requirePermission(permission)(request(role), response(), next);
  expect(next).toHaveBeenCalled();
});
it('rejects kitchen staff attempting to process payments', () => {
  const next = jest.fn();
  const res = response();
  requirePermission('process_payments')(request('KITCHEN'), res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
it('rejects a staff member selecting an unassigned outlet', () => {
  const req = request('CASHIER');
  req.outletId = 'foreign';
  const res = response();
  const next = jest.fn();
  requireOutletAccess(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
