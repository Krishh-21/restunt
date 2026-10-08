import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireOutletAccess, requirePermission } from '../middleware/auth';
import { scope, fail } from '../lib/domain';
import { createOrderSchema } from './pos/orders';
import { createOrder, generateKOT } from '../services/orderService';
export const syncRouter=Router();syncRouter.use(authenticate,requireOutletAccess,requirePermission('create_orders'));
syncRouter.post('/',asyncHandler(async(req,res)=>{
  const body=z.object({operations:z.array(z.object({id:z.string().uuid(),userId:z.string().uuid(),createdAt:z.coerce.date(),type:z.literal('order:create'),payload:createOrderSchema})).max(100),lastSync:z.coerce.date().optional()}).parse(req.body);
  const highWater=new Date();const accepted:string[]=[];const conflicts:{id:string;message:string}[]=[];
  for(const operation of body.operations){if(operation.userId!==req.user!.id)fail('Offline operation belongs to another user',403);try{const order=await createOrder(req.user!.tenantId,req.outletId!,req.user!.id,operation.payload as never,{id:operation.id,createdAt:operation.createdAt});if(order.status==='DRAFT')await generateKOT(req.user!.tenantId,req.outletId!,order.id);accepted.push(operation.id);}catch(error){conflicts.push({id:operation.id,message:error instanceof Error?error.message:'Sync failed'});}}
  const since=body.lastSync??new Date(0);const dates={gte:since,lte:highWater};
  const [orders,tables,menu]=await Promise.all([prisma.order.findMany({where:{...scope(req),updatedAt:dates},include:{items:true}}),prisma.table.findMany({where:{...scope(req),updatedAt:dates}}),prisma.menuItem.findMany({where:{tenantId:req.user!.tenantId,OR:[{outletId:req.outletId!},{outletId:null}],updatedAt:dates}})]);
  res.json({accepted,conflicts,delta:{orders,tables,menu},timestamp:highWater.toISOString()});
}));
