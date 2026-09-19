/**
 * Constants and configuration values for Dinely Restaurant Operating System
 * Application-wide constants, limits, defaults, and configuration
 */

import {
  UserRole,
  CustomerTier,
  OrderStatus,
  TableStatus,
  PaymentMethod,
  OrderType,
  OutletType,
  SubscriptionTier,
} from './enums.js';

// ========== API Constants ==========
export const API_CONFIG = {
  VERSION: 'v1',
  BASE_PATH: '/api/v1',
  TIMEOUT: 30000, // 30 seconds
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 1000,
    BURST_LIMIT: 100,
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ========== Business Rules & Limits ==========
export const BUSINESS_RULES = {
  // Order limits
  MAX_ORDER_ITEMS: 50,
  MAX_ORDER_VALUE: 1000000, // 10 lakh INR
  MIN_ORDER_VALUE: 1, // 1 INR
  ORDER_TIMEOUT_MINUTES: 120, // 2 hours
  
  // Table limits
  MAX_TABLE_CAPACITY: 50,
  MAX_TABLES_PER_OUTLET: 1000,
  TABLE_CLEANING_TIME_MINUTES: 15,
  
  // Menu limits
  MAX_MENU_ITEMS_PER_CATEGORY: 500,
  MAX_CATEGORIES_PER_OUTLET: 100,
  MAX_MODIFIERS_PER_ITEM: 20,
  MAX_MODIFIER_OPTIONS: 50,
  
  // Customer limits
  MAX_LOYALTY_POINTS_EARN_PER_ORDER: 1000,
  MAX_LOYALTY_POINTS_REDEEM_PERCENT: 50, // 50% of order value
  LOYALTY_POINTS_EXPIRY_MONTHS: 12,
  
  // Inventory limits
  MAX_INVENTORY_ITEMS_PER_OUTLET: 5000,
  MIN_STOCK_QUANTITY: 0,
  MAX_STOCK_QUANTITY: 999999,
  
  // Staff limits
  MAX_USERS_PER_TENANT: 500,
  MAX_OUTLETS_PER_USER: 20,
  SESSION_TIMEOUT_HOURS: 8,
  
  // Financial limits
  MAX_DISCOUNT_PERCENT: 100,
  MAX_SERVICE_CHARGE_PERCENT: 25,
  MAX_TAX_RATE_PERCENT: 28, // GST limit in India
  MAX_CASH_DRAWER_VARIANCE: 1000, // 1000 INR
} as const;

// ========== Default Values ==========
export const DEFAULTS = {
  CURRENCY: 'INR',
  TIMEZONE: 'Asia/Kolkata',
  COUNTRY: 'IN',
  LANGUAGE: 'en',
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Order defaults
  ORDER_TYPE: OrderType.DINE_IN,
  PAYMENT_METHOD: PaymentMethod.CASH,
  SERVICE_CHARGE_PERCENT: 10,
  
  // Customer defaults
  LOYALTY_TIER: CustomerTier.BRONZE,
  LOYALTY_POINTS_RATE: 1, // 1 point per 1 INR
  
  // Table defaults
  TABLE_STATUS: TableStatus.AVAILABLE,
  TABLE_CAPACITY: 4,
  
  // Outlet defaults
  OUTLET_TYPE: OutletType.DINE_IN,
  OPENING_TIME: '09:00',
  CLOSING_TIME: '22:00',
  
  // Subscription defaults
  SUBSCRIPTION_TIER: SubscriptionTier.STARTER,
  
  // Inventory defaults
  MINIMUM_THRESHOLD: 10,
  REORDER_QUANTITY: 100,
} as const;

// ========== Validation Rules ==========
export const VALIDATION = {
  // String lengths
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_DESCRIPTION_LENGTH: 5,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_NOTES_LENGTH: 1000,
  
  // Phone validation
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  INDIA_PHONE_REGEX: /^(\+91|91|0)?[6-9]\d{9}$/,
  
  // Email validation
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // GST validation
  GSTIN_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  
  // PIN validation
  PIN_REGEX: /^\d{4,6}$/,
  
  // Numeric ranges
  MIN_PRICE: 0.01,
  MAX_PRICE: 999999.99,
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 9999,
  MIN_RATING: 1,
  MAX_RATING: 5,
  MIN_PERCENTAGE: 0,
  MAX_PERCENTAGE: 100,
} as const;

// ========== Feature Flags ==========
export const FEATURES = {
  LOYALTY_PROGRAM: true,
  RESERVATIONS: true,
  INVENTORY_MANAGEMENT: true,
  ANALYTICS: true,
  WHATSAPP_INTEGRATION: true,
  QR_ORDERING: true,
  ONLINE_PAYMENTS: true,
  MULTI_CURRENCY: false,
  AGGREGATOR_INTEGRATION: true,
  OFFLINE_MODE: true,
  VOICE_ORDERING: false,
  AI_RECOMMENDATIONS: false,
} as const;

// ========== User Permissions ==========
export const PERMISSIONS = {
  [UserRole.ADMIN]: [
    '*', // Full access
  ],
  [UserRole.MANAGER]: [
    'orders:view',
    'orders:create',
    'orders:update',
    'orders:void',
    'tables:manage',
    'menu:manage',
    'customers:manage',
    'reservations:manage',
    'inventory:manage',
    'inventory:adjust',
    'reports:view',
    'reports:export',
    'users:view',
    'users:create',
    'users:update',
    'settings:view',
    'settings:update',
    'cash-drawer:manage',
    'payments:refund',
    'feedback:respond',
  ],
  [UserRole.CASHIER]: [
    'orders:view',
    'orders:create',
    'orders:update',
    'tables:view',
    'tables:assign',
    'menu:view',
    'customers:view',
    'customers:create',
    'customers:update',
    'payments:process',
    'cash-drawer:open',
    'cash-drawer:close',
    'reports:basic',
    'loyalty:redeem',
    'loyalty:award',
  ],
  [UserRole.SERVER]: [
    'orders:view',
    'orders:create',
    'orders:update',
    'tables:view',
    'tables:assign',
    'tables:clean',
    'menu:view',
    'customers:view',
    'customers:create',
    'reservations:view',
    'reservations:create',
    'reservations:update',
  ],
  [UserRole.KITCHEN]: [
    'orders:view',
    'orders:update-status',
    'kds:view',
    'kds:update',
    'menu:view',
    'inventory:view',
    'recipes:view',
  ],
  [UserRole.RIDER]: [
    'orders:view',
    'orders:update-status',
    'customers:contact',
  ],
} as const;

// ========== Subscription Limits ==========
export const SUBSCRIPTION_LIMITS = {
  [SubscriptionTier.STARTER]: {
    MAX_OUTLETS: 1,
    MAX_USERS: 5,
    MAX_ORDERS_PER_MONTH: 1000,
    MAX_MENU_ITEMS: 100,
    MAX_TABLES: 20,
    MAX_STORAGE_MB: 1000, // 1GB
    FEATURES: [
      'basic_pos',
      'basic_reports',
      'qr_menu',
    ],
  },
  [SubscriptionTier.PROFESSIONAL]: {
    MAX_OUTLETS: 5,
    MAX_USERS: 25,
    MAX_ORDERS_PER_MONTH: 10000,
    MAX_MENU_ITEMS: 500,
    MAX_TABLES: 100,
    MAX_STORAGE_MB: 5000, // 5GB
    FEATURES: [
      'advanced_pos',
      'inventory_management',
      'loyalty_program',
      'reservations',
      'advanced_reports',
      'whatsapp_integration',
      'aggregator_integration',
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    MAX_OUTLETS: -1, // Unlimited
    MAX_USERS: -1, // Unlimited
    MAX_ORDERS_PER_MONTH: -1, // Unlimited
    MAX_MENU_ITEMS: -1, // Unlimited
    MAX_TABLES: -1, // Unlimited
    MAX_STORAGE_MB: -1, // Unlimited
    FEATURES: [
      'all_features',
      'api_access',
      'custom_integrations',
      'dedicated_support',
      'advanced_analytics',
      'multi_location',
      'franchise_management',
    ],
  },
} as const;

// ========== Tax Rates (India GST) ==========
export const TAX_RATES = {
  GST_RATES: {
    EXEMPT: 0,
    GST_5: 5,
    GST_12: 12,
    GST_18: 18,
    GST_28: 28,
  },
  FOOD_CATEGORIES: {
    STAPLES: 0, // Rice, wheat, etc.
    PROCESSED_FOOD: 5, // Packaged food items under Rs. 1000
    RESTAURANT_SERVICES: 5, // Restaurant services (AC)
    RESTAURANT_SERVICES_NON_AC: 0, // Non-AC restaurants
    ALCOHOL: 28, // Alcoholic beverages
    BEVERAGES: 12, // Non-alcoholic beverages
  },
} as const;

// ========== Order Status Flow ==========
export const ORDER_STATUS_FLOW = {
  ALLOWED_TRANSITIONS: {
    [OrderStatus.DRAFT]: [OrderStatus.SUBMITTED, OrderStatus.VOIDED],
    [OrderStatus.SUBMITTED]: [OrderStatus.PREPARING, OrderStatus.VOIDED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.VOIDED],
    [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.VOIDED],
    [OrderStatus.SERVED]: [OrderStatus.SETTLED, OrderStatus.VOIDED],
    [OrderStatus.SETTLED]: [], // Terminal state
    [OrderStatus.VOIDED]: [], // Terminal state
  },
  TERMINAL_STATUSES: [OrderStatus.SETTLED, OrderStatus.VOIDED],
  KITCHEN_STATUSES: [OrderStatus.PREPARING, OrderStatus.READY],
} as const;

// ========== Payment Configuration ==========
export const PAYMENT_CONFIG = {
  GATEWAYS: {
    RAZORPAY: {
      NAME: 'Razorpay',
      SUPPORTED_METHODS: [PaymentMethod.CARD, PaymentMethod.UPI, PaymentMethod.WALLET],
      MIN_AMOUNT: 1,
      MAX_AMOUNT: 1000000,
      CURRENCY: 'INR',
    },
    STRIPE: {
      NAME: 'Stripe',
      SUPPORTED_METHODS: [PaymentMethod.CARD, PaymentMethod.ONLINE],
      MIN_AMOUNT: 0.5,
      MAX_AMOUNT: 999999,
      CURRENCY: 'USD',
    },
  },
  CASH_DENOMINATIONS: [1, 2, 5, 10, 20, 50, 100, 200, 500, 2000],
  REFUND_WINDOW_DAYS: 7,
  MAX_PARTIAL_REFUNDS: 3,
} as const;

// ========== File Upload Configuration ==========
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
  MAX_IMAGES_PER_ITEM: 5,
  IMAGE_QUALITY: 0.85,
  THUMBNAIL_SIZE: { width: 300, height: 300 },
  LARGE_IMAGE_SIZE: { width: 1200, height: 1200 },
} as const;

// ========== Cache Configuration ==========
export const CACHE_CONFIG = {
  TTL: {
    MENU_ITEMS: 3600, // 1 hour
    OUTLET_SETTINGS: 1800, // 30 minutes
    USER_PERMISSIONS: 900, // 15 minutes
    TAX_RATES: 86400, // 24 hours
    EXCHANGE_RATES: 3600, // 1 hour
  },
  KEYS: {
    MENU: (outletId: string) => `menu:${outletId}`,
    USER_PERMISSIONS: (userId: string) => `permissions:${userId}`,
    OUTLET_SETTINGS: (outletId: string) => `settings:${outletId}`,
    INVENTORY: (outletId: string) => `inventory:${outletId}`,
  },
} as const;

// ========== WebSocket Configuration ==========
export const WEBSOCKET_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  RECONNECT_DELAY: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
  MESSAGE_QUEUE_SIZE: 1000,
  COMPRESSION: true,
  PING_TIMEOUT: 10000, // 10 seconds
} as const;

// ========== Error Codes ==========
export const ERROR_CODES = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  ACCOUNT_SUSPENDED: 'AUTH_004',
  
  // Validation
  VALIDATION_ERROR: 'VAL_001',
  MISSING_REQUIRED_FIELD: 'VAL_002',
  INVALID_FORMAT: 'VAL_003',
  VALUE_OUT_OF_RANGE: 'VAL_004',
  
  // Business Logic
  ORDER_NOT_FOUND: 'BIZ_001',
  TABLE_OCCUPIED: 'BIZ_002',
  INSUFFICIENT_STOCK: 'BIZ_003',
  INVALID_ORDER_STATUS: 'BIZ_004',
  PAYMENT_FAILED: 'BIZ_005',
  MENU_ITEM_UNAVAILABLE: 'BIZ_006',
  LOYALTY_INSUFFICIENT_POINTS: 'BIZ_007',
  
  // System
  DATABASE_ERROR: 'SYS_001',
  EXTERNAL_SERVICE_ERROR: 'SYS_002',
  RATE_LIMIT_EXCEEDED: 'SYS_003',
  SERVICE_UNAVAILABLE: 'SYS_004',
  
  // Integration
  PAYMENT_GATEWAY_ERROR: 'INT_001',
  AGGREGATOR_ERROR: 'INT_002',
  WHATSAPP_ERROR: 'INT_003',
  SMS_ERROR: 'INT_004',
} as const;

// ========== Date & Time Formats ==========
export const DATE_FORMATS = {
  API: 'YYYY-MM-DDTHH:mm:ss.SSSZ', // ISO 8601
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm',
  TIME_ONLY: 'HH:mm',
  MONTH_YEAR: 'MMM YYYY',
  BILL_FORMAT: 'DD-MMM-YYYY HH:mm:ss',
} as const;

// ========== Notification Templates ==========
export const NOTIFICATION_TEMPLATES = {
  ORDER_READY: {
    title: 'Order Ready',
    message: 'Your order #{{orderNumber}} is ready for pickup',
  },
  RESERVATION_REMINDER: {
    title: 'Reservation Reminder',
    message: 'Your table reservation at {{outletName}} is in {{minutes}} minutes',
  },
  LOW_STOCK_ALERT: {
    title: 'Low Stock Alert',
    message: '{{itemName}} is running low ({{quantity}} remaining)',
  },
  PAYMENT_FAILED: {
    title: 'Payment Failed',
    message: 'Payment for order #{{orderNumber}} failed. Please try again.',
  },
} as const;

// ========== Analytics Configuration ==========
export const ANALYTICS_CONFIG = {
  METRICS: {
    REAL_TIME: ['orders_per_minute', 'revenue_per_hour', 'table_turnover'],
    DAILY: ['total_orders', 'total_revenue', 'avg_order_value', 'customer_count'],
    WEEKLY: ['growth_rate', 'top_items', 'peak_hours', 'staff_performance'],
    MONTHLY: ['profitability', 'customer_retention', 'menu_performance'],
  },
  RETENTION_DAYS: {
    RAW_EVENTS: 7,
    AGGREGATED_HOURLY: 90,
    AGGREGATED_DAILY: 365,
    AGGREGATED_MONTHLY: 1095, // 3 years
  },
} as const;

// ========== Loyalty Program Configuration ==========
export const LOYALTY_CONFIG = {
  TIER_THRESHOLDS: {
    [CustomerTier.BRONZE]: 0,
    [CustomerTier.SILVER]: 1000,
    [CustomerTier.GOLD]: 5000,
    [CustomerTier.PLATINUM]: 10000,
  },
  TIER_MULTIPLIERS: {
    [CustomerTier.BRONZE]: 1,
    [CustomerTier.SILVER]: 1.25,
    [CustomerTier.GOLD]: 1.5,
    [CustomerTier.PLATINUM]: 2,
  },
  POINTS_EXPIRY_MONTHS: 12,
  MIN_REDEEM_POINTS: 10,
  MAX_REDEEM_PERCENT: 50, // Maximum 50% of order value can be paid with points
} as const;

// ========== Export all constants ==========
export const CONSTANTS = {
  API_CONFIG,
  HTTP_STATUS,
  BUSINESS_RULES,
  DEFAULTS,
  VALIDATION,
  FEATURES,
  PERMISSIONS,
  SUBSCRIPTION_LIMITS,
  TAX_RATES,
  ORDER_STATUS_FLOW,
  PAYMENT_CONFIG,
  UPLOAD_CONFIG,
  CACHE_CONFIG,
  WEBSOCKET_CONFIG,
  ERROR_CODES,
  DATE_FORMATS,
  NOTIFICATION_TEMPLATES,
  ANALYTICS_CONFIG,
  LOYALTY_CONFIG,
} as const;

export default CONSTANTS;