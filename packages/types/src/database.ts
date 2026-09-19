/**
 * Database entity types for Dinely Restaurant Operating System
 * Generated from Prisma schema with TypeScript best practices
 */

// Use union type for Decimal compatibility
export type PrismaDecimal = {
  toNumber(): number;
  toString(): string;
  toFixed(digits?: number): string;
};
import {
  SubscriptionTier,
  SubscriptionStatus,
  OutletType,
  UserRole,
  ModifierType,
  TableStatus,
  OrderType,
  OrderSource,
  OrderStatus,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
  CustomerTier,
  LoyaltyType,
  StockTransactionType,
  POStatus,
  ExpenseCategory,
  ReservationStatus,
  FeedbackStatus,
  DiscountType,
  CashDrawerStatus,
  DeviceType,
} from './enums.js';

// ========== Base Types ==========
export type ID = string;
export type DateString = string; // ISO 8601 date string
export type TimeString = string; // HH:mm format
export type DecimalValue = PrismaDecimal | number | string;

// ========== JSON Field Types ==========
export interface TenantSettings {
  loyaltyPointsRate: number;
  defaultTimezone: string;
  defaultCurrency: string;
  features: {
    loyaltyProgram: boolean;
    reservations: boolean;
    inventory: boolean;
    analytics: boolean;
    whatsappIntegration: boolean;
  };
  branding: {
    primaryColor: string;
    logoUrl?: string;
    receiptHeader?: string;
    receiptFooter?: string;
  };
}

export interface OutletSettings {
  serviceChargePercent: number;
  taxRates: TaxRate[];
  tablePrefix: string;
  orderPrefix: string;
  billPrefix: string;
  autoKotPrint: boolean;
  requireManagerApprovalForVoids: boolean;
  requireManagerApprovalForDiscounts: boolean;
  cashDrawerSettings: {
    requireOpeningAmount: boolean;
    allowNegativeVariance: boolean;
    maxVarianceAmount: number;
  };
}

export interface TaxRate {
  category: string; // 'food', 'beverages', 'alcohol'
  cgst: number; // CGST rate (0-28)
  sgst: number; // SGST rate (0-28) 
  igst?: number; // IGST rate for inter-state
  effectiveFrom?: DateString;
}

export interface TaxBreakdownLine {
  label: string; // 'CGST @ 2.5%'
  rate: number; // 2.5
  taxableAmount: DecimalValue;
  amount: DecimalValue;
}

export interface FloorPlanPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  shape: 'square' | 'round' | 'rectangle';
  rotation?: number;
}

export interface VectorClock {
  deviceId: string;
  timestamp: number;
  version: number;
}

// ========== Modifier & Menu Types ==========
export interface ModifierOptionData {
  id: ID;
  name: string;
  priceAdjustment: DecimalValue;
  isDefault?: boolean;
}

export interface ItemModifierData {
  id: ID;
  name: string;
  type: ModifierType;
  required: boolean;
  maxSelections?: number; // For MULTIPLE type
  options: ModifierOptionData[];
}

export interface OrderItemModifier {
  modifierId: ID;
  optionId: ID;
  name: string;
  option: string;
  priceAdjustment: DecimalValue;
}

// ========== Recipe & Inventory Types ==========
export interface POLineItem {
  inventoryItemId: ID;
  inventoryItemName: string;
  quantity: DecimalValue;
  unitPrice: DecimalValue;
  totalPrice: DecimalValue;
  unitOfMeasure: string;
}

// ========== Core Entity Types ==========

// Base tenant model - stored in public schema
export interface Tenant {
  id: ID;
  name: string;
  subdomain: string;
  logo?: string;
  gstin?: string; // GST identification number
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  currency: string;
  timezone: string;
  country: string;
  createdAt: DateString;
  updatedAt: DateString;
  isActive: boolean;
  settings?: TenantSettings;
}

// Outlet model
export interface Outlet {
  id: ID;
  tenantId: ID;
  name: string;
  address: string;
  phone: string;
  email: string;
  type: OutletType;
  openTime?: TimeString;
  closeTime?: TimeString;
  isActive: boolean;
  createdAt: DateString;
  updatedAt: DateString;
  settings?: OutletSettings;
}

// User/Staff model
export interface User {
  id: ID;
  tenantId: ID;
  username: string;
  email: string;
  phone?: string;
  passwordHash: string;
  pinHash?: string; // For tablet quick login
  fullName: string;
  role: UserRole;
  outletAssignments: ID[]; // Array of outlet IDs
  isActive: boolean;
  lastLoginAt?: DateString;
  createdAt: DateString;
  updatedAt: DateString;
}

// Menu Category
export interface MenuCategory {
  id: ID;
  tenantId: ID;
  outletId: ID;
  name: string;
  displayOrder: number;
  image?: string;
  isActive: boolean;
  taxCategory?: string;
  createdAt: DateString;
  updatedAt: DateString;
}

// Menu Item
export interface MenuItem {
  id: ID;
  tenantId: ID;
  outletId?: ID; // null = applies to all outlets
  categoryId: ID;
  name: string;
  description?: string;
  image?: string;
  price: DecimalValue;
  costPrice?: DecimalValue;
  isAvailable: boolean;
  tags: string[]; // vegetarian, vegan, gluten-free, spicy, contains-nuts
  stationId?: ID; // Kitchen station for KDS routing
  preparationTimeMinutes?: number;
  createdAt: DateString;
  updatedAt: DateString;
  modifiers?: ItemModifierData[];
}

// Item Modifier
export interface ItemModifier {
  id: ID;
  tenantId: ID;
  name: string;
  type: ModifierType;
  required: boolean;
}

export interface ModifierOption {
  id: ID;
  modifierId: ID;
  name: string;
  priceAdjustment: DecimalValue;
}

// Table
export interface Table {
  id: ID;
  tenantId: ID;
  outletId: ID;
  number: string;
  name?: string;
  capacity: number;
  section?: string;
  status: TableStatus;
  qrCodeUrl?: string;
  currentOrderId?: ID;
  occupiedAt?: DateString;
  floorPlanPosition?: FloorPlanPosition;
  createdAt: DateString;
  updatedAt: DateString;
}

// Order Item
export interface OrderItem {
  id: ID;
  orderId: ID;
  menuItemId: ID;
  menuItemName: string; // Denormalized for historical accuracy
  quantity: number;
  unitPrice: DecimalValue;
  modifiers?: OrderItemModifier[];
  specialInstructions?: string;
  status: OrderItemStatus;
  kotPrintedAt?: DateString;
}

// Order
export interface Order {
  id: ID;
  tenantId: ID;
  outletId: ID;
  orderNumber: string; // OUT1-2024-00123
  tableId?: ID;
  customerId?: ID;
  type: OrderType;
  source: OrderSource;
  aggregatorSource?: string; // 'zomato', 'swiggy', etc.
  status: OrderStatus;
  items: OrderItem[];
  subtotal: DecimalValue;
  taxAmount: DecimalValue;
  taxBreakdown?: TaxBreakdownLine[];
  serviceCharge: DecimalValue;
  discountAmount: DecimalValue;
  discountCode?: string;
  total: DecimalValue;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTransactionId?: string;
  notes?: string;
  createdByUserId: ID;
  createdAt: DateString;
  settledAt?: DateString;
  voidedAt?: DateString;
  voidedByUserId?: ID;
  voidedReason?: string;
  vectorClock?: VectorClock;
}

// Payment
export interface Payment {
  id: ID;
  tenantId: ID;
  orderId: ID;
  amount: DecimalValue;
  method: PaymentMethod;
  gateway?: string; // Razorpay, Stripe, etc.
  gatewayTransactionId?: string;
  status: PaymentStatus;
  settledAt?: DateString;
  createdAt: DateString;
}

// Customer
export interface Customer {
  id: ID;
  tenantId: ID;
  name: string;
  phone: string; // Primary identifier
  email?: string;
  address?: string;
  dateOfBirth?: DateString;
  loyaltyTier: CustomerTier;
  loyaltyPoints: number;
  lifetimeValue: DecimalValue; // Total spend
  orderCount: number;
  lastOrderDate?: DateString;
  tags: string[]; // 'prefers-spicy', 'gluten-free', etc.
  notes?: string;
  whatsappOptIn: boolean;
  emailOptIn: boolean;
  createdAt: DateString;
  updatedAt: DateString;
}

// Loyalty Transaction
export interface LoyaltyTransaction {
  id: ID;
  tenantId: ID;
  customerId: ID;
  type: LoyaltyType;
  points: number; // Positive for earn, negative for redeem
  balanceBefore: number;
  balanceAfter: number;
  orderId?: ID;
  reason: string;
  createdAt: DateString;
}

// Inventory Item
export interface InventoryItem {
  id: ID;
  tenantId: ID;
  outletId: ID;
  name: string;
  category: string; // 'vegetables', 'meats', 'dairy', 'dry-goods'
  unitOfMeasure: string; // kg, liter, piece
  currentQuantity: DecimalValue;
  minimumThreshold: DecimalValue; // Alert when below this
  reorderQuantity: DecimalValue;
  weightedAverageCost: DecimalValue; // Updated on goods receipt
  lastUpdatedAt: DateString;
  version: number; // For optimistic locking
  createdAt: DateString;
}

// Recipe Specification
export interface Recipe {
  id: ID;
  tenantId: ID;
  menuItemId: ID;
  version: number;
  effectiveDate: DateString;
  isActive: boolean;
  createdAt: DateString;
}

// Recipe Ingredient
export interface RecipeIngredient {
  id: ID;
  recipeId: ID;
  inventoryItemId: ID;
  inventoryItemName: string; // Denormalized
  quantity: DecimalValue;
  unitOfMeasure: string;
}

// Stock Transaction (Audit Trail)
export interface StockTransaction {
  id: ID;
  tenantId: ID;
  outletId: ID;
  inventoryItemId: ID;
  transactionType: StockTransactionType;
  quantityChange: DecimalValue; // Positive or negative
  quantityBefore: DecimalValue;
  quantityAfter: DecimalValue;
  costPerUnit?: DecimalValue;
  reason: string;
  referenceType?: string; // 'order', 'purchase_order', 'manual'
  referenceId?: ID;
  createdByUserId: ID;
  approvedByUserId?: ID;
  createdAt: DateString;
}

// Kitchen Station
export interface KitchenStation {
  id: ID;
  tenantId: ID;
  outletId: ID;
  name: string; // e.g., "Grill", "Fryer", "Cold Station"
  type: string; // "hot", "cold", "beverage", "general"
  displayOrder: number;
  isActive: boolean;
  createdAt: DateString;
}

// Vendor
export interface Vendor {
  id: ID;
  tenantId: ID;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  paymentTerms?: string; // "Net 30", "COD", etc.
  gstin?: string;
  isActive: boolean;
  createdAt: DateString;
}

// Purchase Order
export interface PurchaseOrder {
  id: ID;
  tenantId: ID;
  outletId: ID;
  poNumber: string; // PO-2024-00045
  vendorId: ID;
  vendorName: string; // Denormalized
  status: POStatus;
  lineItems: POLineItem[];
  subtotal: DecimalValue;
  taxAmount: DecimalValue;
  total: DecimalValue;
  createdByUserId: ID;
  createdAt: DateString;
  sentAt?: DateString;
  receivedAt?: DateString;
  notes?: string;
}

// Expense
export interface Expense {
  id: ID;
  tenantId: ID;
  outletId: ID;
  category: ExpenseCategory;
  amount: DecimalValue;
  paymentMethod: PaymentMethod;
  vendorName: string;
  description: string;
  receiptUrl?: string;
  expenseDate: DateString;
  recordedByUserId: ID;
  createdAt: DateString;
}

// Bill/Invoice
export interface Bill {
  id: ID;
  tenantId: ID;
  outletId: ID;
  orderId: ID;
  billNumber: string; // Sequential: OUT1-2024-00123
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  subtotal: DecimalValue;
  taxAmount: DecimalValue;
  taxBreakdown: TaxBreakdownLine[];
  serviceCharge: DecimalValue;
  discountAmount: DecimalValue;
  total: DecimalValue;
  paymentMethod: PaymentMethod;
  createdAt: DateString;
}

// Reservation
export interface Reservation {
  id: ID;
  tenantId: ID;
  outletId: ID;
  tableId: ID;
  customerId: ID;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: DateString;
  reservationTime: TimeString; // HH:mm format
  status: ReservationStatus;
  notes?: string;
  createdAt: DateString;
}

// Feedback
export interface Feedback {
  id: ID;
  tenantId: ID;
  outletId: ID;
  orderId: ID;
  customerId?: ID;
  foodQualityRating: number; // 1-5
  serviceSpeedRating: number; // 1-5
  overallRating: number; // 1-5
  comments?: string;
  submittedAt: DateString;
  response?: string;
  respondedByUserId?: ID;
  respondedAt?: DateString;
  status: FeedbackStatus;
}

// Discount Code
export interface DiscountCode {
  id: ID;
  tenantId: ID;
  code: string; // e.g., "WELCOME10"
  type: DiscountType;
  value: DecimalValue;
  minOrderValue?: DecimalValue;
  maxDiscount?: DecimalValue; // Cap for percentage discounts
  applicableItems: ID[]; // Empty = all items
  validFrom: DateString;
  validUntil: DateString;
  usageLimit?: number; // null = unlimited
  usageCount: number;
  outletIds: ID[]; // Empty = all outlets
  isActive: boolean;
  createdAt: DateString;
}

// Audit Log (Immutable)
export interface AuditLog {
  id: ID;
  tenantId: ID;
  outletId: ID;
  userId: ID;
  action: string; // 'void_order', 'apply_discount', 'adjust_inventory'
  entityType: string; // 'order', 'inventory_item'
  entityId: ID;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress: string;
  deviceId: string;
  reason?: string;
  approvedByUserId?: ID;
  timestamp: DateString;
}

// Cash Drawer Session
export interface CashDrawerSession {
  id: ID;
  tenantId: ID;
  outletId: ID;
  openedByUserId: ID;
  closedByUserId?: ID;
  openingAmount: DecimalValue;
  expectedClosingAmount: DecimalValue;
  actualClosingAmount?: DecimalValue;
  variance?: DecimalValue;
  openedAt: DateString;
  closedAt?: DateString;
  status: CashDrawerStatus;
}

// Device (for offline sync)
export interface Device {
  id: ID;
  tenantId: ID;
  outletId: ID;
  type: DeviceType;
  name: string;
  lastSyncAt?: DateString;
  vectorClock?: VectorClock;
  isActive: boolean;
  registeredAt: DateString;
}

// Sync Queue Entry (for offline sync)
export interface SyncQueueEntry {
  id: ID;
  tenantId: ID;
  deviceId: ID;
  entityType: string;
  entityId: ID;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  vectorClock: VectorClock;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: DateString;
  processedAt?: DateString;
}

// WhatsApp Campaign
export interface WhatsAppCampaign {
  id: ID;
  tenantId: ID;
  name: string;
  message: string;
  targetSegment?: string; // Customer segment filter
  scheduledAt?: DateString;
  sentAt?: DateString;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  createdByUserId: ID;
  createdAt: DateString;
}

// WhatsApp Opt Out
export interface WhatsAppOptOut {
  id: ID;
  tenantId: ID;
  customerPhone: string;
  optedOutAt: DateString;
  reason?: string;
}

// ========== Database Entity Relations ==========
export interface OutletWithRelations extends Outlet {
  tables: Table[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  orders: Order[];
  inventoryItems: InventoryItem[];
  reservations: Reservation[];
  bills: Bill[];
  expenses: Expense[];
  devices: Device[];
  kitchenStations: KitchenStation[];
}

export interface OrderWithRelations extends Order {
  outlet: Outlet;
  table?: Table;
  customer?: Customer;
  createdBy: User;
  voidedBy?: User;
  payments: Payment[];
  bills: Bill[];
  feedback: Feedback[];
}

export interface MenuItemWithRelations extends MenuItem {
  outlet?: Outlet;
  category: MenuCategory;
  recipes: Recipe[];
}

export interface CustomerWithRelations extends Customer {
  orders: Order[];
  reservations: Reservation[];
  loyaltyTransactions: LoyaltyTransaction[];
  feedback: Feedback[];
}

// ========== Utility Types ==========
export type EntityWithTimestamps = {
  createdAt: DateString;
  updatedAt: DateString;
};

export type EntityWithTenant = {
  tenantId: ID;
};

export type EntityWithOutlet = {
  outletId: ID;
};

export type SoftDeletable = {
  isActive: boolean;
  deletedAt?: DateString;
};

export type Versionable = {
  version: number;
};

// ========== Create Input Types ==========
export type CreateTenantInput = Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateOutletInput = Omit<Outlet, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>;
export type CreateMenuCategoryInput = Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateMenuItemInput = Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateTableInput = Omit<Table, 'id' | 'createdAt' | 'updatedAt' | 'occupiedAt' | 'currentOrderId'>;
export type CreateOrderInput = Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'settledAt' | 'voidedAt' | 'vectorClock'>;
export type CreateCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'lifetimeValue' | 'orderCount' | 'lastOrderDate'>;
export type CreateInventoryItemInput = Omit<InventoryItem, 'id' | 'createdAt' | 'lastUpdatedAt' | 'version'>;
export type CreateRecipeInput = Omit<Recipe, 'id' | 'createdAt'>;
export type CreateVendorInput = Omit<Vendor, 'id' | 'createdAt'>;
export type CreatePurchaseOrderInput = Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'sentAt' | 'receivedAt'>;
export type CreateReservationInput = Omit<Reservation, 'id' | 'createdAt'>;
export type CreateFeedbackInput = Omit<Feedback, 'id' | 'submittedAt' | 'respondedAt'>;
export type CreateDiscountCodeInput = Omit<DiscountCode, 'id' | 'usageCount' | 'createdAt'>;
export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt'>;
export type CreateKitchenStationInput = Omit<KitchenStation, 'id' | 'createdAt'>;
export type CreateWhatsAppCampaignInput = Omit<WhatsAppCampaign, 'id' | 'recipientCount' | 'deliveredCount' | 'failedCount' | 'createdAt' | 'sentAt'>;

// ========== Update Input Types ==========
export type UpdateTenantInput = Partial<Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>>;
export type UpdateOutletInput = Partial<Omit<Outlet, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
export type UpdateUserInput = Partial<Omit<User, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
export type UpdateMenuItemInput = Partial<Omit<MenuItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
export type UpdateOrderInput = Partial<Omit<Order, 'id' | 'tenantId' | 'orderNumber' | 'createdAt'>>;
export type UpdateCustomerInput = Partial<Omit<Customer, 'id' | 'tenantId' | 'phone' | 'createdAt' | 'updatedAt'>>;
export type UpdateInventoryItemInput = Partial<Omit<InventoryItem, 'id' | 'tenantId' | 'createdAt' | 'lastUpdatedAt'>>;
export type UpdateTableInput = Partial<Omit<Table, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
export type UpdateReservationInput = Partial<Omit<Reservation, 'id' | 'tenantId' | 'createdAt'>>;
export type UpdateVendorInput = Partial<Omit<Vendor, 'id' | 'tenantId' | 'createdAt'>>;
export type UpdateDiscountCodeInput = Partial<Omit<DiscountCode, 'id' | 'tenantId' | 'createdAt' | 'usageCount'>>;