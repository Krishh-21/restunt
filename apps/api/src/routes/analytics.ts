import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { fail, money } from '../lib/domain';
import { reportDates } from './accounting';
export const analyticsRouter = Router(); analyticsRouter.use(authenticate,requireOutletAccess,requirePermission('reports:view'));
function outlets(assigned: string[], current: string, query: unknown) { const ids = query === 'all' ? assigned : typeof query === 'string' ? query.split(',') : [current]; if (!ids.length || ids.some(id => !assigned.includes(id))) fail('No access to requested outlets',403); return ids; }
analyticsRouter.get('/dashboard', asyncHandler(async(req,res) => {
  const outletIds = outlets(req.user!.outletIds,req.outletId!,req.query.outlets); const start = new Date(); start.setUTCHours(0,0,0,0);
  const where = { tenantId: req.user!.tenantId, outletId: { in: outletIds }, status: 'SETTLED' as const, settledAt: { gte: start } };
  const [orders, expenses, tables, feedback] = await Promise.all([prisma.order.aggregate({ where, _sum: { total: true }, _count: true }),prisma.expense.groupBy({ by:['category'], where: { tenantId: req.user!.tenantId, outletId: { in: outletIds }, expenseDate: { gte: start } }, _sum: { amount: true } }),prisma.table.count({ where: { tenantId:req.user!.tenantId,outletId:{in:outletIds} } }),prisma.feedback.aggregate({ where: { tenantId:req.user!.tenantId,outletId:{in:outletIds},submittedAt:{gte:start} },_avg:{overallRating:true,foodQualityRating:true,serviceSpeedRating:true} })]);
  const revenue = Number(orders._sum.total ?? 0); const cost = (category: string) => Number(expenses.find(e => e.category === category)?._sum.amount ?? 0);
  res.json({ revenue, orderCount: orders._count, averageOrderValue: orders._count ? money(revenue/orders._count):0, foodCostPercent: revenue ? money(cost('FOOD_COST')/revenue*100):0, laborCostPercent: revenue ? money(cost('LABOR')/revenue*100):0, tableTurnover: tables ? money(orders._count/tables):0, ratings: feedback._avg, outlets:outletIds });
}));
analyticsRouter.get('/reports/sales', asyncHandler(async(req,res) => { const outletIds = outlets(req.user!.outletIds,req.outletId!,req.query.outlets); res.json(await prisma.order.groupBy({ by:['outletId','type','source'],where:{tenantId:req.user!.tenantId,outletId:{in:outletIds},status:'SETTLED',settledAt:reportDates(req.query)},_sum:{total:true,taxAmount:true,serviceCharge:true,discountAmount:true},_count:true })); }));
analyticsRouter.get('/reports/menu-performance', asyncHandler(async(req,res) => { const outletIds=outlets(req.user!.outletIds,req.outletId!,req.query.outlets);res.json(await prisma.orderItem.groupBy({by:['menuItemId','menuItemName'],where:{order:{tenantId:req.user!.tenantId,outletId:{in:outletIds},status:'SETTLED',settledAt:reportDates(req.query)}},_sum:{quantity:true},orderBy:{_sum:{quantity:'desc'}}})); }));
analyticsRouter.get('/reports/exceptions', asyncHandler(async(req,res) => { const outletIds=outlets(req.user!.outletIds,req.outletId!,req.query.outlets);res.json(await prisma.order.findMany({where:{tenantId:req.user!.tenantId,outletId:{in:outletIds},createdAt:reportDates(req.query),OR:[{status:'VOIDED'},{discountAmount:{gt:0}},{paymentStatus:'REFUNDED'}]},orderBy:{createdAt:'desc'},take:500})); }));
