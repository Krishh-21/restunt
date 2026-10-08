/**
 * Main entry point for @dinely/types package
 * Exports all TypeScript interfaces, types, enums, and utilities
 * for the Dinely Restaurant Operating System
 */

// ========== Core Exports ==========

// Export all database entity types
export * from './database.js';

// Export all enums
export * from './enums.js';

// Export real-time event types
export * from './realtime.js';

// Export constants and configuration
export * from './constants.js';

// Export utility types and functions (selective to avoid conflicts)
export {
  // Utility functions and helpers
  Utils,
  DinelyError,
  createErrorResponse,

  // Type guards
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isObject,

  // Business logic utilities
  calculateTax,
  calculateDiscount,
  calculateServiceCharge,
  generateOrderNumber,
  generateBillNumber,

  // Date utilities
  formatDateForAPI,
  parseAPIDate,
  isToday,
  isBetweenDates,

  // Array utilities
  chunk,
  groupBy,
  uniqueBy,
  sortBy,

  // String utilities
  slugify,
  capitalize,
  truncate,
  maskPhone,
  maskEmail,

  // Validation utilities
  isValidID,
  isValidEmail,
  isValidPhone,
  isValidGSTIN,

  // Currency utilities
  formatCurrency,
  parseDecimal,
  roundDecimal,
} from './utils.js';

// Export API types (selective to avoid conflicts)
export type {
  // Response types
  ApiResponse,
  ApiError,
  ResponseMeta,

  // Authentication
  LoginResponse,
  AuthUser,
  RefreshTokenRequest,
  ChangePasswordRequest,
  SetPinRequest,

  // Menu management
  MenuResponse,
  MenuCategoryWithItems,
  UpdateMenuItemAvailabilityRequest,

  // Order management
  UpdateOrderItemsRequest,
  UpdateOrderItemRequest,
  UpdateOrderStatusRequest,
  SettleOrderRequest,
  VoidOrderRequest,
  ApplyDiscountRequest,
  GenerateKOTRequest,
  KOTResponse,
  KOTStationData,
  KOTItemData,

  // Order queries
  OrdersResponse,
  OrderSummary,
  OrderDetailsResponse,

  // Table management
  CreateTableRequest,
  UpdateTableRequest,
  UpdateTableStatusRequest,
  TablesResponse,
  TableWithDetails,
  MergeTablesRequest,
  SplitTableRequest,

  // Customer management
  UpdateCustomerRequest as UpdateCustomerAPIRequest,
  CustomerDetailsResponse,
  CustomerOrderSummary,
  CustomerLoyaltyTransaction,
  CustomerPreferences,
  CustomerStats,

  // Loyalty program
  AwardLoyaltyPointsRequest,
  RedeemLoyaltyPointsRequest,
  LoyaltyTransactionResponse,

  // Reservations
  UpdateReservationRequest as UpdateReservationAPIRequest,
  ReservationDetailsResponse,

  // KDS
  KDSOrdersFilter,
  KDSOrderResponse,
  KDSOrderItem,
  KDSOrderItemDetail,
  KitchenStationInfo,
  UpdateKDSItemStatusRequest,
  MarkOrderReadyRequest,

  // Dashboard and reporting
  DashboardResponse,
  DashboardSummary,
  ChartData,
  ChartDataset,
  TopMenuItem,
  SystemAlert,
  SalesReportFilter,
  SalesReportResponse,

  // Payment processing
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ProcessRefundRequest,
  RefundResponse,
} from './api.js';

// Export validation schemas (selective to avoid conflicts)
export {
  // Base schemas
  IDSchema,
  DateStringSchema,
  TimeStringSchema,
  DecimalSchema,
  PhoneSchema,
  EmailSchema,
  PasswordSchema,
  PinSchema,

  // Enum schemas
  UserRoleSchema,
  OrderTypeSchema,
  OrderSourceSchema,
  OrderStatusSchema,
  PaymentMethodSchema,
  PaymentStatusSchema,
  TableStatusSchema,

  // Common schemas
  PaginationSchema,
  DateRangeSchema,
  SearchSchema,
  TaxRateSchema,
  FloorPlanPositionSchema,

  // Authentication schemas
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  SetPinRequestSchema,

  // Entity schemas
  CreateTenantRequestSchema,
  CreateOutletRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  CreateMenuCategoryRequestSchema,
  CreateMenuItemRequestSchema,
  UpdateMenuItemAvailabilityRequestSchema,
  CreateOrderRequestSchema,
  UpdateOrderItemsRequestSchema,
  UpdateOrderStatusRequestSchema,
  SettleOrderRequestSchema,
  VoidOrderRequestSchema,
  CreateTableRequestSchema,
  UpdateTableStatusRequestSchema,
  CreateCustomerRequestSchema,
  UpdateCustomerRequestSchema,

  // Validation helpers
  validateOrThrow,
  validatePartial,
  ValidationConfig,
} from './validation.js';

// ========== Legacy Compatibility Exports ==========
// Maintain backward compatibility with existing code

import type {
  User,
  Order,
  OrderItem,
  MenuItem,
  MenuCategory,
  Table,
  Customer,
  TaxBreakdownLine,
  OrderItemModifier,
  TenantSettings,
  OutletSettings,
  TaxRate,
} from './database.js';

import type {
  CreateOrderRequest as APICreateOrderRequest,
  SettleOrderRequest as APISettleOrderRequest,
} from './api.js';

import {
  UserRole,
  OrderStatus,
  OrderSource,
  OrderType,
  PaymentMethod,
  TableStatus,
} from './enums.js';

// Re-export commonly used types for backward compatibility
export type {
  // Database types
  User,
  Order,
  OrderItem,
  MenuItem,
  MenuCategory,
  Table,
  Customer,
  TaxBreakdownLine,
  OrderItemModifier,
  TenantSettings,
  OutletSettings,
  TaxRate,

  // API types (renamed to avoid conflicts)
  APICreateOrderRequest as CreateOrderInput,
  APISettleOrderRequest as SettleOrderInput,

  // Enum types for backward compatibility
  UserRole,
  OrderStatus,
  OrderSource,
  OrderType,
  PaymentMethod,
  TableStatus,
};

// Legacy interfaces for backward compatibility
export interface KOTItem {
  name: string;
  quantity: number;
  modifiers: OrderItemModifier[];
  specialInstructions: string | null;
  stationId: string | null;
}

export interface KOTDocument {
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  items: KOTItem[];
  timestamp: string;
  stations: Record<string, KOTItem[]>;
}

// ========== Package Information ==========
export const PACKAGE_INFO = {
  name: '@dinely/types',
  version: '1.0.0',
  description: 'TypeScript types and interfaces for Dinely Restaurant Operating System',
  author: 'Dinely Team',
  license: 'MIT',
} as const;

// ========== Type Guards for Runtime Validation ==========
export const TypeGuards = {
  isValidID: (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),

  isValidEmail: (value: unknown): value is string =>
    typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),

  isValidPhone: (value: unknown): value is string =>
    typeof value === 'string' && /^\+?[1-9]\d{1,14}$/.test(value),

  isOrder: (value: unknown): value is Order =>
    typeof value === 'object' && value !== null && 'id' in value && 'orderNumber' in value,

  isOrderItem: (value: unknown): value is OrderItem =>
    typeof value === 'object' && value !== null && 'id' in value && 'menuItemId' in value,

  isTable: (value: unknown): value is Table =>
    typeof value === 'object' && value !== null && 'id' in value && 'number' in value,

  isMenuItem: (value: unknown): value is MenuItem =>
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'price' in value,
} as const;

export { calculateOrderTotals, type CalcLineItem, type OrderCalcInput, type OrderCalcResult } from './orderCalculation';
