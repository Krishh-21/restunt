import type { Request } from 'express';
export function fail(message: string, status = 400, code = 'BUSINESS_ERROR'): never { throw Object.assign(new Error(message), { status, code }); }
export function scope(req: Request) { return { tenantId: req.user!.tenantId, outletId: req.outletId! }; }
export const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
