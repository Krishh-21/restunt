import { operationTime } from '@dinely/utils';
import { offlineStore, flushOffline } from './offline';
import { useAuthStore } from '../store/authStore';
const API_BASE = (globalThis as {__DINELY_CONFIG__?:{apiUrl:string}}).__DINELY_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  outletId?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (outletId) headers['x-outlet-id'] = outletId;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    if ((!options.method || options.method === 'GET') && token) {
      const cached = await offlineStore().cache.get(path);
      if (cached) return cached.value as T;
    }
    throw error;
  }

  let data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error?.code ?? 'ERROR', data.error?.message ?? 'Request failed');
  }
  if ((!options.method || options.method === 'GET') && token) {
    const store=offlineStore(), pending=await store.operations.toArray();
    if(path.startsWith('/api/pos/orders/')&&pending.some(p=>p.type==='order:settle'&&[(p.payload as {orderId:string}).orderId].some(id=>id===data.id||id==='offline:'+data.clientOperationId))&&data.status!=='SETTLED')data={...data,paymentStatus:'PENDING_SYNC',pendingSync:true};
    if(path==='/api/pos/tables')data=data.map((table:TableResponse)=>{const create=pending.find(p=>p.type==='order:create'&&(p.payload as {tableId?:string}).tableId===table.id);return create?{...table,status:'OCCUPIED',currentOrderId:'offline:'+create.id}:table;});
    await store.cache.put({ key: path, value: data });
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string, tenantSubdomain?: string) =>
    request<{ token: string; user: import('@dinely/types').AuthUser; outletId: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, tenantSubdomain: tenantSubdomain || undefined }),
      }
    ),

  getMenu: (token: string, outletId: string) =>
    request<{ categories: MenuCategoryResponse[];pricing:{serviceChargePercent:number;taxRates:{category:string;cgst:number;sgst:number}[]} }>('/api/menu', {}, token, outletId),

  getTables: (token: string, outletId: string) =>
    request<TableResponse[]>('/api/pos/tables', {}, token, outletId),

  createOrder: async (
    token: string,
    outletId: string,
    body: {
      tableId?: string;
      customerId?: string;
      items: Array<{
        menuItemId: string;
        quantity: number;
        specialInstructions?: string;
        modifiers?: { name: string; option: string; priceAdjustment: number }[];
      }>;
    }
  ) => {
    const id = crypto.randomUUID(),
      createdAt = operationTime();
    try {
      return await request<OrderResponse>(
        '/api/pos/orders',
        {
          method: 'POST',
          body: JSON.stringify({ ...body, clientOperationId: id, clientCreatedAt: createdAt }),
        },
        token,
        outletId
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const user = useAuthStore.getState().user;
      if (!user) throw error;
      const store=offlineStore();const cached=(await store.cache.get('/api/menu'))?.value as {categories:MenuCategoryResponse[];pricing:{serviceChargePercent:number;taxRates:{category:string;cgst:number;sgst:number}[]}}|undefined;
      if(!cached?.pricing)throw new Error('Load the menu online once before creating offline orders');
      const lines=body.items.map((line,index)=>{const menu=cached.categories.flatMap(c=>c.items).find(i=>i.id===line.menuItemId);if(!menu)throw new Error('Item is missing from the offline menu');return {...line,id:id+':'+index,menuItemName:menu.name,unitPrice:menu.price,taxCategory:menu.taxCategory??'food'};});
      const subtotal=roundMoney(lines.reduce((sum,line)=>sum+(Number(line.unitPrice)+(line.modifiers??[]).reduce((s,m)=>s+m.priceAdjustment,0))*line.quantity,0));
      const serviceCharge=roundMoney(subtotal*cached.pricing.serviceChargePercent/100);
      const taxAmount=roundMoney(lines.reduce((sum,line)=>{const rate=cached.pricing.taxRates.find(r=>r.category===line.taxCategory)??cached.pricing.taxRates[0];const value=(Number(line.unitPrice)+(line.modifiers??[]).reduce((s,m)=>s+m.priceAdjustment,0))*line.quantity;return sum+value*(1+cached.pricing.serviceChargePercent/100)*((rate?.cgst??0)+(rate?.sgst??0))/100;},0));
      const local={id:'offline:'+id,pendingSync:true,orderNumber:'Provisional '+id.slice(0,8),status:'SUBMITTED',items:lines,subtotal,taxAmount,serviceCharge,discountAmount:0,total:roundMoney(subtotal+serviceCharge+taxAmount),invoiceNumber:null} as OrderResponse;
      await store.transaction('rw',store.operations,store.cache,async()=>{await store.operations.put({id,userId:user.id,createdAt,type:'order:create',payload:body});await store.cache.put({key:'/api/pos/orders/'+local.id,value:local});const tables=(await store.cache.get('/api/pos/tables'))?.value as TableResponse[]|undefined;if(tables&&body.tableId)await store.cache.put({key:'/api/pos/tables',value:tables.map(t=>t.id===body.tableId?{...t,status:'OCCUPIED',currentOrderId:local.id}:t)});});
      return local;
    }
  },

  generateKOT: (token: string, outletId: string, orderId: string) =>
    request('/api/pos/orders/' + orderId + '/kot', { method: 'POST' }, token, outletId),

  settleOrder: async (token:string,outletId:string,orderId:string,paymentMethod:string) => {
    if(paymentMethod==='online'){if(!navigator.onLine)throw new Error('Gateway settlement requires an online connection');return request<OrderResponse>('/api/pos/orders/'+orderId+'/settle',{method:'POST',body:JSON.stringify({paymentMethod})},token,outletId);}
    if(navigator.onLine&&!orderId.startsWith('offline:')){try{await request<OrderResponse>('/api/pos/orders/'+orderId,{},token,outletId);}catch(error){if(error instanceof ApiError)throw error;}}
    if(!['cash','card','upi','wallet'].includes(paymentMethod))throw new Error('Gateway payments require an online connection');
    const store=offlineStore(),user=useAuthStore.getState().user;const order=(await store.cache.get('/api/pos/orders/'+orderId))?.value as OrderResponse|undefined;
    if(!user||!order)throw new Error('Load this order online before recording an offline payment');
    if(order.paymentStatus==='PENDING_SYNC'||order.status==='SETTLED')throw new Error('Payment is already recorded');
    const id=crypto.randomUUID();const local={...order,pendingSync:true,paymentStatus:'PENDING_SYNC',paymentMethod,invoiceNumber:null};
    await store.transaction('rw',store.operations,store.cache,async()=>{await store.operations.put({id,userId:user.id,createdAt:operationTime(),type:'order:settle',payload:{orderId,expectedTotal:Number(order.total),paymentMethod}});await store.cache.put({key:'/api/pos/orders/'+orderId,value:local});});
    await flushOffline().catch(()=>undefined);const refreshed=(await store.cache.get('/api/pos/orders/'+orderId))?.value as OrderResponse|undefined;return refreshed?.status==='SETTLED'?refreshed:local;
  },

  getInvoice: (token: string, outletId: string, orderId: string) =>
    request<OrderResponse>('/api/pos/orders/' + orderId + '/invoice', {}, token, outletId),
  getOrder: async (token: string, outletId: string, orderId: string) => {if(orderId.startsWith('offline:')){const cached=await offlineStore().cache.get('/api/pos/orders/'+orderId);if(cached)return cached.value as OrderResponse;}return request<OrderResponse>('/api/pos/orders/'+orderId,{},token,outletId);},
};

export interface MenuCategoryResponse {
  id: string;
  name: string;
  items: MenuItemResponse[];
}

export interface MenuItemResponse {
  taxCategory?:string;
  modifiers?: {
    name: string;
    type?: 'single' | 'multiple';
    required?: boolean;
    options: { name: string; priceAdjustment: number }[];
  }[];
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  tags: string[];
  isAvailable: boolean;
}

export interface TableResponse {
  currentOrderId?: string | null;
  id: string;
  number: string;
  capacity: number;
  status: string;
  floorPlanPosition?: { x: number; y: number; shape: string };
}

export interface OrderResponse {
  restaurantName?: string;
  gstin?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  taxBreakdown?: { label: string; amount: number }[];
  pendingSync?: boolean;
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string | number;
  taxAmount: string | number;
  serviceCharge: string | number;
  discountAmount: string | number;
  total: string | number;
  invoiceNumber: string | null;
  items: Array<{
    id: string;
    menuItemName: string;
    quantity: number;
    unitPrice: string | number;
  }>;
}

export function formatCurrency(amount: number | string): string {
  return `₹${Number(amount).toFixed(2)}`;
}

function roundMoney(value:number){return Math.round(value*100)/100;}
