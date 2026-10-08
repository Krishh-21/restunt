/**
 * Real-time event types for Dinely Restaurant Operating System
 * WebSocket event definitions and handlers for live updates
 */

import type {
  ID,
  DateString,
  Order,
  OrderItem,
  Table,
  MenuItem,
  Customer,
  Reservation,
} from './database.js';

import type {
  OrderStatus,
  OrderItemStatus,
  TableStatus,
  PaymentStatus,
  ReservationStatus,
  DeviceType,
  UserRole,
} from './enums.js';

// ========== Base Event Types ==========
export interface BaseSocketEvent<T = unknown> {
  type: string;
  tenantId: ID;
  outletId?: ID;
  userId?: ID;
  deviceId?: string;
  timestamp: DateString;
  data: T;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  version: string;
  requestId?: string;
  correlationId?: string;
  source: 'pos' | 'captain' | 'kds' | 'manager' | 'qr' | 'online' | 'system';
  priority: 'low' | 'normal' | 'high' | 'critical';
}

// ========== Order Events ==========
export interface OrderCreatedEvent extends BaseSocketEvent<OrderCreatedData> {
  type: 'order:created';
}

export interface OrderCreatedData {
  order: Order;
  items: OrderItem[];
  table?: Table;
  customer?: Customer;
}

export interface OrderUpdatedEvent extends BaseSocketEvent<OrderUpdatedData> {
  type: 'order:updated';
}

export interface OrderUpdatedData {
  orderId: ID;
  changes: Partial<Order>;
  previousStatus?: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
  affectedItems?: ID[];
}

export interface OrderItemsUpdatedEvent extends BaseSocketEvent<OrderItemsUpdatedData> {
  type: 'order:items:updated';
}

export interface OrderItemsUpdatedData {
  orderId: ID;
  addedItems: OrderItem[];
  updatedItems: OrderItem[];
  removedItems: ID[];
  newSubtotal: number;
  newTotal: number;
}

export interface OrderStatusChangedEvent extends BaseSocketEvent<OrderStatusChangedData> {
  type: 'order:status:changed';
}

export interface OrderStatusChangedData {
  orderId: ID;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: ID;
  reason?: string;
  estimatedReadyTime?: DateString;
  tableNumber?: string;
}

export interface OrderSettledEvent extends BaseSocketEvent<OrderSettledData> {
  type: 'order:settled';
}

export interface OrderSettledData {
  orderId: ID;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  billNumber: string;
  customer?: {
    id: ID;
    name: string;
    phone: string;
  };
}

export interface OrderVoidedEvent extends BaseSocketEvent<OrderVoidedData> {
  type: 'order:voided';
}

export interface OrderVoidedData {
  orderId: ID;
  orderNumber: string;
  reason: string;
  voidedBy: ID;
  managerApproval?: {
    userId: ID;
    timestamp: DateString;
  };
}

// ========== KDS Events ==========
export interface KDSOrderReceivedEvent extends BaseSocketEvent<KDSOrderData> {
  type: 'kds:order:received';
}

export interface KDSOrderData {
  orderId: ID;
  orderNumber: string;
  tableNumber?: string;
  items: KDSOrderItemData[];
  stationId?: ID;
  priority: 'normal' | 'rush' | 'priority';
  specialInstructions?: string[];
  customerRequests?: string[];
}

export interface KDSOrderItemData {
  id: ID;
  name: string;
  quantity: number;
  modifiers: Array<{
    name: string;
    option: string;
  }>;
  specialInstructions?: string;
  allergies?: string[];
  preparationTime?: number;
}

export interface KDSItemStatusUpdatedEvent extends BaseSocketEvent<KDSItemStatusData> {
  type: 'kds:item:status:updated';
}

export interface KDSItemStatusData {
  orderId: ID;
  itemId: ID;
  previousStatus: OrderItemStatus;
  newStatus: OrderItemStatus;
  stationId: ID;
  estimatedReadyTime?: DateString;
  actualReadyTime?: DateString;
}

export interface KDSOrderCompleteEvent extends BaseSocketEvent<KDSOrderCompleteData> {
  type: 'kds:order:complete';
}

export interface KDSOrderCompleteData {
  orderId: ID;
  orderNumber: string;
  completedAt: DateString;
  stationId: ID;
  totalPrepTime: number;
  qualityRating?: 'excellent' | 'good' | 'poor';
  notes?: string;
}

// ========== Table Events ==========
export interface TableStatusChangedEvent extends BaseSocketEvent<TableStatusChangedData> {
  type: 'table:status:changed';
}

export interface TableStatusChangedData {
  tableId: ID;
  tableNumber: string;
  previousStatus: TableStatus;
  newStatus: TableStatus;
  reason?: string;
  occupiedAt?: DateString;
  currentOrderId?: ID;
  guestCount?: number;
}

export interface TableAssignedEvent extends BaseSocketEvent<TableAssignedData> {
  type: 'table:assigned';
}

export interface TableAssignedData {
  tableId: ID;
  tableNumber: string;
  orderId: ID;
  guestCount: number;
  assignedBy: ID;
  estimatedDuration?: number;
}

export interface TableReleasedEvent extends BaseSocketEvent<TableReleasedData> {
  type: 'table:released';
}

export interface TableReleasedData {
  tableId: ID;
  tableNumber: string;
  orderId: ID;
  occupancyDuration: number;
  releasedBy: ID;
  needsCleaning: boolean;
}

// ========== Menu Events ==========
export interface MenuItemUpdatedEvent extends BaseSocketEvent<MenuItemUpdatedData> {
  type: 'menu:item:updated';
}

export interface MenuItemUpdatedData {
  itemId: ID;
  changes: Partial<MenuItem>;
  affectedOutlets: ID[];
  reason?: string;
}

export interface MenuItemAvailabilityChangedEvent extends BaseSocketEvent<MenuItemAvailabilityData> {
  type: 'menu:item:availability:changed';
}

export interface MenuItemAvailabilityData {
  itemId: ID;
  itemName: string;
  isAvailable: boolean;
  reason?: string;
  estimatedAvailableTime?: DateString;
  affectedOrders?: ID[];
}

// ========== Inventory Events ==========
export interface InventoryLowStockEvent extends BaseSocketEvent<InventoryLowStockData> {
  type: 'inventory:low-stock';
}

export interface InventoryLowStockData {
  itemId: ID;
  itemName: string;
  currentQuantity: number;
  minimumThreshold: number;
  recommendedReorderQuantity: number;
  outletId: ID;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface InventoryOutOfStockEvent extends BaseSocketEvent<InventoryOutOfStockData> {
  type: 'inventory:out-of-stock';
}

export interface InventoryOutOfStockData {
  itemId: ID;
  itemName: string;
  outletId: ID;
  affectedMenuItems: Array<{
    itemId: ID;
    itemName: string;
    autoDisabled: boolean;
  }>;
  lastStockDate: DateString;
}

export interface InventoryUpdatedEvent extends BaseSocketEvent<InventoryUpdatedData> {
  type: 'inventory:updated';
}

export interface InventoryUpdatedData {
  itemId: ID;
  previousQuantity: number;
  newQuantity: number;
  changeReason: string;
  transactionType: 'purchase' | 'adjustment' | 'deduction' | 'transfer' | 'waste';
  approvedBy?: ID;
}

// ========== Payment Events ==========
export interface PaymentReceivedEvent extends BaseSocketEvent<PaymentReceivedData> {
  type: 'payment:received';
}

export interface PaymentReceivedData {
  paymentId: ID;
  orderId: ID;
  amount: number;
  method: string;
  status: PaymentStatus;
  transactionId?: string;
  gateway?: string;
}

export interface PaymentFailedEvent extends BaseSocketEvent<PaymentFailedData> {
  type: 'payment:failed';
}

export interface PaymentFailedData {
  paymentId: ID;
  orderId: ID;
  amount: number;
  method: string;
  errorCode: string;
  errorMessage: string;
  retryAttempts: number;
}

export interface RefundProcessedEvent extends BaseSocketEvent<RefundProcessedData> {
  type: 'payment:refund:processed';
}

export interface RefundProcessedData {
  refundId: ID;
  paymentId: ID;
  orderId: ID;
  refundAmount: number;
  reason: string;
  processedBy: ID;
  status: 'pending' | 'completed' | 'failed';
}

// ========== Customer Events ==========
export interface CustomerCreatedEvent extends BaseSocketEvent<CustomerCreatedData> {
  type: 'customer:created';
}

export interface CustomerCreatedData {
  customer: Customer;
  source: 'pos' | 'online' | 'captain' | 'import';
  createdBy?: ID;
}

export interface LoyaltyPointsUpdatedEvent extends BaseSocketEvent<LoyaltyPointsData> {
  type: 'customer:loyalty:updated';
}

export interface LoyaltyPointsData {
  customerId: ID;
  transactionType: 'earn' | 'redeem' | 'expire' | 'adjustment';
  pointsChanged: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: ID;
  reason: string;
}

// ========== Reservation Events ==========
export interface ReservationCreatedEvent extends BaseSocketEvent<ReservationCreatedData> {
  type: 'reservation:created';
}

export interface ReservationCreatedData {
  reservation: Reservation;
  table: Table;
  customer?: Customer;
}

export interface ReservationUpdatedEvent extends BaseSocketEvent<ReservationUpdatedData> {
  type: 'reservation:updated';
}

export interface ReservationUpdatedData {
  reservationId: ID;
  changes: Partial<Reservation>;
  previousStatus?: ReservationStatus;
  newStatus: ReservationStatus;
  reason?: string;
}

export interface ReservationReminderEvent extends BaseSocketEvent<ReservationReminderData> {
  type: 'reservation:reminder';
}

export interface ReservationReminderData {
  reservationId: ID;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  partySize: number;
  reservationTime: string;
  minutesUntil: number;
}

// ========== Staff Events ==========
export interface UserLoginEvent extends BaseSocketEvent<UserLoginData> {
  type: 'user:login';
}

export interface UserLoginData {
  userId: ID;
  username: string;
  fullName: string;
  role: UserRole;
  outletId: ID;
  deviceId?: string;
  ipAddress: string;
}

export interface UserLogoutEvent extends BaseSocketEvent<UserLogoutData> {
  type: 'user:logout';
}

export interface UserLogoutData {
  userId: ID;
  username: string;
  sessionDuration: number;
  reason: 'manual' | 'timeout' | 'forced';
}

export interface CashDrawerEvent extends BaseSocketEvent<CashDrawerData> {
  type: 'cash-drawer:opened' | 'cash-drawer:closed';
}

export interface CashDrawerData {
  sessionId: ID;
  userId: ID;
  openingAmount?: number;
  closingAmount?: number;
  variance?: number;
  reason?: string;
}

// ========== System Events ==========
export interface SystemAlertEvent extends BaseSocketEvent<SystemAlertData> {
  type: 'system:alert';
}

export interface SystemAlertData {
  alertId: ID;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'inventory' | 'payment' | 'device' | 'security' | 'performance';
  title: string;
  message: string;
  actionRequired: boolean;
  actionUrl?: string;
  affectedUsers?: ID[];
}

export interface DeviceStatusEvent extends BaseSocketEvent<DeviceStatusData> {
  type: 'device:status:changed';
}

export interface DeviceStatusData {
  deviceId: string;
  deviceType: DeviceType;
  status: 'online' | 'offline' | 'error' | 'syncing';
  lastSeen: DateString;
  batteryLevel?: number;
  networkStatus?: 'wifi' | 'ethernet' | 'cellular' | 'none';
  errorMessage?: string;
}

export interface SyncStatusEvent extends BaseSocketEvent<SyncStatusData> {
  type: 'sync:status:changed';
}

export interface SyncStatusData {
  deviceId: string;
  status: 'syncing' | 'completed' | 'failed' | 'conflict';
  lastSyncAt: DateString;
  conflictingRecords?: Array<{
    entityType: string;
    entityId: ID;
    conflictType: 'update' | 'delete' | 'version';
  }>;
  progress?: {
    total: number;
    completed: number;
    failed: number;
  };
}

// ========== Aggregator Events ==========
export interface AggregatorOrderEvent extends BaseSocketEvent<AggregatorOrderData> {
  type: 'aggregator:order:received';
}

export interface AggregatorOrderData {
  platform: 'zomato' | 'swiggy' | 'talabat' | 'deliveroo';
  platformOrderId: string;
  orderId: ID;
  customerDetails: {
    name: string;
    phone: string;
    address?: string;
  };
  deliveryDetails: {
    expectedTime: DateString;
    instructions?: string;
    contactlessDelivery: boolean;
  };
  platformFee: number;
  commission: number;
}

// ========== Union Types ==========
export type DinelySocketEvent =
  // Order Events
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | OrderItemsUpdatedEvent
  | OrderStatusChangedEvent
  | OrderSettledEvent
  | OrderVoidedEvent

  // KDS Events
  | KDSOrderReceivedEvent
  | KDSItemStatusUpdatedEvent
  | KDSOrderCompleteEvent

  // Table Events
  | TableStatusChangedEvent
  | TableAssignedEvent
  | TableReleasedEvent

  // Menu Events
  | MenuItemUpdatedEvent
  | MenuItemAvailabilityChangedEvent

  // Inventory Events
  | InventoryLowStockEvent
  | InventoryOutOfStockEvent
  | InventoryUpdatedEvent

  // Payment Events
  | PaymentReceivedEvent
  | PaymentFailedEvent
  | RefundProcessedEvent

  // Customer Events
  | CustomerCreatedEvent
  | LoyaltyPointsUpdatedEvent

  // Reservation Events
  | ReservationCreatedEvent
  | ReservationUpdatedEvent
  | ReservationReminderEvent

  // Staff Events
  | UserLoginEvent
  | UserLogoutEvent
  | CashDrawerEvent

  // System Events
  | SystemAlertEvent
  | DeviceStatusEvent
  | SyncStatusEvent

  // Aggregator Events
  | AggregatorOrderEvent;

// ========== Event Handler Types ==========
export type EventHandler<T extends DinelySocketEvent = DinelySocketEvent> = (
  event: T
) => void | Promise<void>;

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  tenantId?: ID;
  outletId?: ID;
  userId?: ID;
  filters?: Record<string, unknown>;
}

export interface EventEmitter {
  emit<T extends DinelySocketEvent>(event: T): void;
  subscribe<T extends DinelySocketEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
    filters?: Partial<T>
  ): () => void; // Returns unsubscribe function
  unsubscribe(eventType: string, handler: EventHandler): void;
  unsubscribeAll(eventType?: string): void;
}

// ========== WebSocket Connection Types ==========
export interface WebSocketConnection {
  id: string;
  tenantId: ID;
  outletId?: ID;
  userId?: ID;
  deviceId?: string;
  userAgent: string;
  ipAddress: string;
  connectedAt: DateString;
  lastActivity: DateString;
  subscriptions: string[];
}

export interface WebSocketMessage {
  type: 'event' | 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error';
  payload?: unknown;
  requestId?: string;
  timestamp: DateString;
}

export interface SubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  payload: {
    eventTypes: string[];
    filters?: Record<string, unknown>;
  };
}

export interface UnsubscribeMessage extends WebSocketMessage {
  type: 'unsubscribe';
  payload: {
    eventTypes: string[];
  };
}

export interface EventMessage extends WebSocketMessage {
  type: 'event';
  payload: DinelySocketEvent;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    requestId?: string;
  };
}

// ========== Event Filtering Types ==========
export interface EventFilter {
  tenantId?: ID;
  outletId?: ID;
  userId?: ID;
  deviceId?: string;
  eventTypes?: string[];
  dateRange?: {
    startDate: DateString;
    endDate: DateString;
  };
  severity?: Array<'info' | 'warning' | 'error' | 'critical'>;
  categories?: string[];
}

export interface EventQuery extends EventFilter {
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'type';
  sortOrder?: 'asc' | 'desc';
}

// ========== Event Analytics Types ==========
export interface EventAnalytics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByHour: Record<string, number>;
  eventsByOutlet: Record<string, number>;
  criticalAlerts: number;
  averageResponseTime: number;
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
}

export interface RealTimeMetrics {
  activeConnections: number;
  eventsPerMinute: number;
  averageLatency: number;
  failedDeliveries: number;
  queueSize: number;
  lastUpdated: DateString;
}

// ========== Export utility functions ==========
export const createSocketEvent = <T extends DinelySocketEvent>(
  type: T['type'],
  data: T['data'],
  metadata: Partial<BaseSocketEvent> = {}
): T => {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
    ...metadata,
  } as T;
};

export const isEventType = <T extends DinelySocketEvent>(
  event: DinelySocketEvent,
  type: T['type']
): event is T => {
  return event.type === type;
};

export const filterEvents = <T extends DinelySocketEvent>(
  events: DinelySocketEvent[],
  filters: EventFilter
): T[] => {
  return events.filter((event): event is T => {
    if (filters.tenantId && event.tenantId !== filters.tenantId) return false;
    if (filters.outletId && event.outletId !== filters.outletId) return false;
    if (filters.userId && event.userId !== filters.userId) return false;
    if (filters.eventTypes && !filters.eventTypes.includes(event.type)) return false;

    if (filters.dateRange) {
      const eventDate = new Date(event.timestamp);
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      if (eventDate < startDate || eventDate > endDate) return false;
    }

    return true;
  });
};

export const groupEventsByType = (
  events: DinelySocketEvent[]
): Record<string, DinelySocketEvent[]> => {
  return events.reduce(
    (groups, event) => {
      groups[event.type] = groups[event.type] || [];
      groups[event.type]!.push(event);
      return groups;
    },
    {} as Record<string, DinelySocketEvent[]>
  );
};

export default {
  createSocketEvent,
  isEventType,
  filterEvents,
  groupEventsByType,
};
