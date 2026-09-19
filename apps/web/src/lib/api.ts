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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error?.code ?? 'ERROR', data.error?.message ?? 'Request failed');
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: import('@dinely/types').AuthUser; outletId: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

  getMenu: (token: string, outletId: string) =>
    request<{ categories: MenuCategoryResponse[] }>('/api/menu', {}, token, outletId),

  getTables: (token: string, outletId: string) =>
    request<TableResponse[]>('/api/pos/tables', {}, token, outletId),

  createOrder: (
    token: string,
    outletId: string,
    body: {
      tableId?: string;
      items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
    }
  ) =>
    request<OrderResponse>('/api/pos/orders', { method: 'POST', body: JSON.stringify(body) }, token, outletId),

  generateKOT: (token: string, outletId: string, orderId: string) =>
    request('/api/pos/orders/' + orderId + '/kot', { method: 'POST' }, token, outletId),

  settleOrder: (
    token: string,
    outletId: string,
    orderId: string,
    paymentMethod: string
  ) =>
    request<OrderResponse>(
      '/api/pos/orders/' + orderId + '/settle',
      { method: 'POST', body: JSON.stringify({ paymentMethod }) },
      token,
      outletId
    ),

  getOrder: (token: string, outletId: string, orderId: string) =>
    request<OrderResponse>('/api/pos/orders/' + orderId, {}, token, outletId),
};

export interface MenuCategoryResponse {
  id: string;
  name: string;
  items: MenuItemResponse[];
}

export interface MenuItemResponse {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  tags: string[];
  isAvailable: boolean;
}

export interface TableResponse {
  id: string;
  number: string;
  capacity: number;
  status: string;
  floorPlanPosition?: { x: number; y: number; shape: string };
}

export interface OrderResponse {
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
