/**
 * Core enums for Dinely Restaurant Operating System
 * Generated from Prisma schema enums with TypeScript best practices
 */

// ========== Subscription & Tenant ==========
export enum SubscriptionTier {
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

// ========== Outlet & Location ==========
export enum OutletType {
  DINE_IN = 'DINE_IN',
  QSR = 'QSR',
  CLOUD_KITCHEN = 'CLOUD_KITCHEN',
  CAFE = 'CAFE',
  BAR = 'BAR',
  FOOD_TRUCK = 'FOOD_TRUCK',
}

// ========== User & Authentication ==========
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  SERVER = 'SERVER',
  KITCHEN = 'KITCHEN',
  RIDER = 'RIDER',
}

// ========== Menu & Items ==========
export enum ModifierType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}

// ========== Tables & Seating ==========
export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
}

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  SEATED = 'SEATED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

// ========== Orders & Sales ==========
export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEAWAY = 'TAKEAWAY',
  DELIVERY = 'DELIVERY',
}

export enum OrderSource {
  POS = 'POS',
  CAPTAIN = 'CAPTAIN',
  QR = 'QR',
  ONLINE = 'ONLINE',
  AGGREGATOR = 'AGGREGATOR',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  SETTLED = 'SETTLED',
  VOIDED = 'VOIDED',
}

export enum OrderItemStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
}

// ========== Payments ==========
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  WALLET = 'WALLET',
  ONLINE = 'ONLINE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// ========== Customers & CRM ==========
export enum CustomerTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum LoyaltyType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
  ADJUSTMENT = 'ADJUSTMENT',
}

// ========== Inventory & Stock ==========
export enum StockTransactionType {
  PURCHASE = 'PURCHASE',
  ADJUSTMENT = 'ADJUSTMENT',
  DEDUCTION = 'DEDUCTION',
  TRANSFER = 'TRANSFER',
  WASTE = 'WASTE',
}

// ========== Purchasing ==========
export enum POStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

// ========== Accounting & Expenses ==========
export enum ExpenseCategory {
  FOOD_COST = 'FOOD_COST',
  LABOR = 'LABOR',
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER',
}

// ========== Feedback & Reviews ==========
export enum FeedbackStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

// ========== Discounts & Promotions ==========
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

// ========== Cash Management ==========
export enum CashDrawerStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

// ========== Devices & Sync ==========
export enum DeviceType {
  POS = 'POS',
  KDS = 'KDS',
  CAPTAIN_TABLET = 'CAPTAIN_TABLET',
  MANAGER_TABLET = 'MANAGER_TABLET',
}

// ========== Type Guards ==========
export const isValidUserRole = (role: string): role is UserRole =>
  Object.values(UserRole).includes(role as UserRole);

export const isValidOrderStatus = (status: string): status is OrderStatus =>
  Object.values(OrderStatus).includes(status as OrderStatus);

export const isValidPaymentMethod = (method: string): method is PaymentMethod =>
  Object.values(PaymentMethod).includes(method as PaymentMethod);

export const isValidTableStatus = (status: string): status is TableStatus =>
  Object.values(TableStatus).includes(status as TableStatus);

// ========== Enum Arrays (for UI dropdowns) ==========
export const USER_ROLES = Object.values(UserRole);
export const ORDER_STATUSES = Object.values(OrderStatus);
export const ORDER_TYPES = Object.values(OrderType);
export const ORDER_SOURCES = Object.values(OrderSource);
export const PAYMENT_METHODS = Object.values(PaymentMethod);
export const PAYMENT_STATUSES = Object.values(PaymentStatus);
export const TABLE_STATUSES = Object.values(TableStatus);
export const CUSTOMER_TIERS = Object.values(CustomerTier);
export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);
export const OUTLET_TYPES = Object.values(OutletType);

// ========== Constants ==========
export const LOYALTY_TIER_THRESHOLDS = {
  [CustomerTier.BRONZE]: 0,
  [CustomerTier.SILVER]: 1000,
  [CustomerTier.GOLD]: 5000,
  [CustomerTier.PLATINUM]: 10000,
} as const;

export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.MANAGER]: [
    'view_orders',
    'create_orders',
    'void_orders',
    'access_reports',
    'manage_inventory',
    'approve_adjustments',
    'manage_users',
    'manage_settings',
  ],
  [UserRole.CASHIER]: [
    'view_orders',
    'create_orders',
    'process_payments',
    'open_cash_drawer',
    'view_reports_basic',
  ],
  [UserRole.SERVER]: [
    'view_orders',
    'create_orders',
    'view_tables',
    'manage_reservations',
  ],
  [UserRole.KITCHEN]: [
    'view_orders',
    'update_order_status',
    'view_kds',
    'view_recipes',
  ],
  [UserRole.RIDER]: [
    'view_delivery_orders',
    'update_delivery_status',
  ],
} as const;