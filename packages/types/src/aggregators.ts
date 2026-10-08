/**
 * Aggregator integration types for Dinely Restaurant Operating System
 * Types for third-party food delivery platform integrations
 */

import type { ID, DateString, DecimalValue } from './database.js';
import type { OrderType, PaymentMethod, PaymentStatus } from './enums.js';

// ========== Supported Aggregators ==========
export type AggregatorPlatform =
  | 'zomato'
  | 'swiggy'
  | 'talabat'
  | 'deliveroo'
  | 'uber_eats'
  | 'foodpanda'
  | 'grubhub'
  | 'doordash';

// ========== Aggregator Order Types ==========
export interface AggregatorOrder {
  id: ID;
  platform: AggregatorPlatform;
  platformOrderId: string;
  internalOrderId?: ID;
  status: AggregatorOrderStatus;
  customer: AggregatorCustomer;
  items: AggregatorOrderItem[];
  delivery: AggregatorDeliveryInfo;
  payment: AggregatorPaymentInfo;
  timing: AggregatorTimingInfo;
  fees: AggregatorFeeBreakdown;
  metadata: AggregatorOrderMetadata;
  createdAt: DateString;
  updatedAt: DateString;
}

export enum AggregatorOrderStatus {
  RECEIVED = 'RECEIVED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  PICKED_UP = 'PICKED_UP',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface AggregatorCustomer {
  platformCustomerId: string;
  name: string;
  phone: string;
  email?: string;
  deliveryAddress: AggregatorAddress;
  billingAddress?: AggregatorAddress;
  specialRequests?: string[];
  contactlessDelivery: boolean;
}

export interface AggregatorAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  landmarks?: string;
}

export interface AggregatorOrderItem {
  platformItemId: string;
  internalMenuItemId?: ID;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: DecimalValue;
  totalPrice: DecimalValue;
  modifiers: AggregatorItemModifier[];
  specialInstructions?: string;
  tags?: string[];
}

export interface AggregatorItemModifier {
  name: string;
  options: string[];
  priceAdjustment: DecimalValue;
}

export interface AggregatorDeliveryInfo {
  type: 'pickup' | 'delivery';
  expectedPickupTime?: DateString;
  expectedDeliveryTime?: DateString;
  actualPickupTime?: DateString;
  actualDeliveryTime?: DateString;
  riderInfo?: {
    name: string;
    phone: string;
    vehicleNumber?: string;
    trackingUrl?: string;
  };
  deliveryInstructions?: string;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
}

export interface AggregatorPaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  isPrepaid: boolean;
  paymentId?: string;
  transactionId?: string;
  gateway?: string;
  amount: DecimalValue;
  currency: string;
}

export interface AggregatorTimingInfo {
  orderReceivedAt: DateString;
  acceptanceDeadline: DateString;
  preparationTime: number; // minutes
  estimatedReadyTime: DateString;
  actualReadyTime?: DateString;
  pickupWindow?: {
    start: DateString;
    end: DateString;
  };
}

export interface AggregatorFeeBreakdown {
  subtotal: DecimalValue;
  itemTotal: DecimalValue;
  taxes: DecimalValue;
  deliveryFee: DecimalValue;
  packagingFee: DecimalValue;
  platformCommission: DecimalValue;
  paymentGatewayFee: DecimalValue;
  discount: DecimalValue;
  total: DecimalValue;
  restaurantEarnings: DecimalValue;
}

export interface AggregatorOrderMetadata {
  orderNumber: string;
  orderType: OrderType;
  sourceApp: string;
  appVersion?: string;
  deviceType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  isScheduled: boolean;
  scheduledFor?: DateString;
  isReorder: boolean;
  originalOrderId?: string;
}

// ========== Webhook Types ==========
export interface AggregatorWebhook {
  id: ID;
  platform: AggregatorPlatform;
  eventType: AggregatorWebhookEvent;
  signature: string;
  timestamp: DateString;
  data: AggregatorOrder;
  verified: boolean;
  processed: boolean;
  processedAt?: DateString;
  errors?: string[];
}

export enum AggregatorWebhookEvent {
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  RIDER_ASSIGNED = 'RIDER_ASSIGNED',
  RIDER_ARRIVED = 'RIDER_ARRIVED',
  ORDER_PICKED_UP = 'ORDER_PICKED_UP',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  PAYMENT_UPDATED = 'PAYMENT_UPDATED',
  REFUND_INITIATED = 'REFUND_INITIATED',
}

// ========== API Types ==========
export interface UpdateAggregatorOrderStatusRequest {
  platformOrderId: string;
  status: AggregatorOrderStatus;
  estimatedReadyTime?: DateString;
  actualReadyTime?: DateString;
  reason?: string;
  rejectionReason?: AggregatorRejectionReason;
}

export enum AggregatorRejectionReason {
  RESTAURANT_CLOSED = 'RESTAURANT_CLOSED',
  ITEM_UNAVAILABLE = 'ITEM_UNAVAILABLE',
  HIGH_PREPARATION_TIME = 'HIGH_PREPARATION_TIME',
  DELIVERY_AREA_NOT_SERVED = 'DELIVERY_AREA_NOT_SERVED',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  OTHER = 'OTHER',
}

export interface AggregatorMenuSyncRequest {
  platform: AggregatorPlatform;
  outletId: ID;
  fullSync: boolean; // true = full menu, false = incremental
  categories?: ID[];
  items?: ID[];
}

export interface AggregatorMenuSyncResponse {
  platform: AggregatorPlatform;
  syncId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  itemsSynced: number;
  itemsFailed: number;
  errors?: Array<{
    itemId: ID;
    error: string;
  }>;
  completedAt?: DateString;
}

export interface AggregatorAvailabilityUpdate {
  platform: AggregatorPlatform;
  outletId: ID;
  isAvailable: boolean;
  reason?: string;
  estimatedAvailableTime?: DateString;
  affectedItems?: Array<{
    platformItemId: string;
    internalItemId: ID;
    isAvailable: boolean;
  }>;
}

// ========== Analytics Types ==========
export interface AggregatorAnalytics {
  platform: AggregatorPlatform;
  period: {
    startDate: DateString;
    endDate: DateString;
  };
  metrics: {
    totalOrders: number;
    acceptedOrders: number;
    rejectedOrders: number;
    cancelledOrders: number;
    averageOrderValue: DecimalValue;
    totalRevenue: DecimalValue;
    platformCommission: DecimalValue;
    netEarnings: DecimalValue;
    averagePreparationTime: number;
    averageRating: number;
  };
  topItems: Array<{
    itemName: string;
    quantity: number;
    revenue: DecimalValue;
  }>;
  performanceMetrics: {
    acceptanceRate: number; // percentage
    onTimeDeliveryRate: number; // percentage
    customerRating: number;
    orderAccuracyRate: number;
  };
}

export interface AggregatorReconciliation {
  platform: AggregatorPlatform;
  period: {
    startDate: DateString;
    endDate: DateString;
  };
  summary: {
    totalOrders: number;
    totalRevenue: DecimalValue;
    platformCommission: DecimalValue;
    taxes: DecimalValue;
    adjustments: DecimalValue;
    netSettlement: DecimalValue;
  };
  discrepancies: Array<{
    orderId: string;
    platformOrderId: string;
    internalAmount: DecimalValue;
    platformAmount: DecimalValue;
    difference: DecimalValue;
    reason: string;
    status: 'pending' | 'resolved' | 'disputed';
  }>;
  settlementDetails: {
    expectedSettlementDate: DateString;
    actualSettlementDate?: DateString;
    settlementReference?: string;
    status: 'pending' | 'completed' | 'failed' | 'disputed';
  };
}

// ========== Configuration Types ==========
export interface AggregatorConfiguration {
  platform: AggregatorPlatform;
  outletId: ID;
  isEnabled: boolean;
  credentials: {
    apiKey?: string;
    secretKey?: string;
    merchantId?: string;
    storeId?: string;
    webhookUrl: string;
    webhookSecret: string;
  };
  settings: {
    autoAcceptOrders: boolean;
    maxPreparationTime: number; // minutes
    bufferTime: number; // additional minutes added to prep time
    defaultRejectionReason: AggregatorRejectionReason;
    enableMenuSync: boolean;
    syncFrequency: number; // minutes
    notificationPreferences: {
      newOrders: boolean;
      cancellations: boolean;
      paymentIssues: boolean;
    };
  };
  operatingHours: Array<{
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
    openTime: string; // HH:mm
    closeTime: string; // HH:mm
    isActive: boolean;
  }>;
  deliveryZones?: Array<{
    name: string;
    polygon: Array<{
      latitude: number;
      longitude: number;
    }>;
    isActive: boolean;
    deliveryFee: DecimalValue;
    minimumOrderValue: DecimalValue;
  }>;
}

// ========== Error Types ==========
export interface AggregatorError {
  platform: AggregatorPlatform;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  orderId?: string;
  timestamp: DateString;
  resolved: boolean;
  resolution?: string;
}

export enum AggregatorErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',

  // Order errors
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATUS = 'INVALID_ORDER_STATUS',
  ORDER_ALREADY_PROCESSED = 'ORDER_ALREADY_PROCESSED',

  // Menu errors
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  MENU_SYNC_FAILED = 'MENU_SYNC_FAILED',
  INVALID_MENU_DATA = 'INVALID_MENU_DATA',

  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  SETTLEMENT_ERROR = 'SETTLEMENT_ERROR',

  // Webhook errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  WEBHOOK_PROCESSING_FAILED = 'WEBHOOK_PROCESSING_FAILED',
  DUPLICATE_WEBHOOK = 'DUPLICATE_WEBHOOK',
}
