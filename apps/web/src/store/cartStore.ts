import { create } from 'zustand';
import type { MenuItemResponse } from '../lib/api';

export interface CartItem {
  menuItem: MenuItemResponse;
  quantity: number;
  specialInstructions?: string;
}

interface CartState {
  tableId: string | null;
  tableNumber: string | null;
  items: CartItem[];
  orderId: string | null;
  setTable: (id: string, number: string) => void;
  addItem: (item: MenuItemResponse) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setOrderId: (id: string) => void;
  clear: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  tableId: null,
  tableNumber: null,
  items: [],
  orderId: null,

  setTable: (id, number) => set({ tableId: id, tableNumber: number }),

  addItem: (menuItem) => {
    const existing = get().items.find((i) => i.menuItem.id === menuItem.id);
    if (existing) {
      set({
        items: get().items.map((i) =>
          i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({ items: [...get().items, { menuItem, quantity: 1 }] });
    }
  },

  removeItem: (menuItemId) =>
    set({ items: get().items.filter((i) => i.menuItem.id !== menuItemId) }),

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, quantity } : i
      ),
    });
  },

  setOrderId: (id) => set({ orderId: id }),

  clear: () => set({ tableId: null, tableNumber: null, items: [], orderId: null }),

  subtotal: () =>
    get().items.reduce((sum, i) => sum + Number(i.menuItem.price) * i.quantity, 0),
}));
