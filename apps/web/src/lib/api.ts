import { offlineStore } from './offline';
import { useAuthStore } from '../store/authStore';
const API_BASE = import.meta.env.VITE_API_URL || '';

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

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error?.code ?? 'ERROR', data.error?.message ?? 'Request failed');
  }
  if ((!options.method || options.method === 'GET') && token)
    await offlineStore().cache.put({ key: path, value: data });
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
    request<{ categories: MenuCategoryResponse[] }>('/api/menu', {}, token, outletId),

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
      createdAt = new Date().toISOString();
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
      await offlineStore().operations.put({
        id,
        userId: user.id,
        createdAt,
        type: 'order:create',
        payload: body,
      });
      return {
        id: 'offline:' + id,
        pendingSync: true,
        orderNumber: 'Pending sync',
        status: 'DRAFT',
        items: [],
        subtotal: 0,
        taxAmount: 0,
        serviceCharge: 0,
        discountAmount: 0,
        total: 0,
        invoiceNumber: null,
      } as OrderResponse;
    }
  },

  generateKOT: (token: string, outletId: string, orderId: string) =>
    request('/api/pos/orders/' + orderId + '/kot', { method: 'POST' }, token, outletId),

  settleOrder: (token: string, outletId: string, orderId: string, paymentMethod: string) =>
    request<OrderResponse>(
      '/api/pos/orders/' + orderId + '/settle',
      { method: 'POST', body: JSON.stringify({ paymentMethod }) },
      token,
      outletId
    ),

  getInvoice: (token: string, outletId: string, orderId: string) =>
    request<OrderResponse>('/api/pos/orders/' + orderId + '/invoice', {}, token, outletId),
  getOrder: (token: string, outletId: string, orderId: string) =>
    request<OrderResponse>('/api/pos/orders/' + orderId, {}, token, outletId),
};

export interface MenuCategoryResponse {
  id: string;
  name: string;
  items: MenuItemResponse[];
}

export interface MenuItemResponse {
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
