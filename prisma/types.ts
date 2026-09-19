/**
 * Additional TypeScript types for enhanced type safety
 * These types extend the generated Prisma types with business logic types
 */

import { 
  Order, 
  OrderItem, 
  MenuItem, 
  Customer, 
  Outlet,
  User,
  Table,
  InventoryItem,
  Bill 
} from '@prisma/client';

// Multi-tenant context type
export interface TenantContext {
  tenantId: string;
  outletId?: string;
  userId?: string;
}

// Enhanced Order types with calculations
export interface OrderWithCalculations extends Order {
  items: OrderItemWithMenuItem[];
  calculatedSubtotal: number;
  calculatedTax: number;
  calculatedTotal: number;
  itemCount: number;
}

export interface OrderItemWithMenuItem extends OrderItem {
  menuItem: MenuItem;
  lineTotal: number;
}

// Customer with analytics
export interface CustomerWithAnalytics extends Customer {
  averageOrderValue: number;
  favoriteItems: MenuItem[];
  lastVisitDaysAgo: number;
  loyaltyLevel: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

// Outlet with performance metrics
export interface OutletWithMetrics extends Outlet {
  todaysRevenue: number;
  todaysOrderCount: number;
  activeTableCount: number;
  averageOrderValue: number;
}

// Enhanced table with current state
export interface TableWithCurrentState extends Table {
  currentOrder?: Order;
  occupiedDuration?: number; // minutes
  estimatedTurnover?: Date;
}

// Inventory with alerts
export interface InventoryWithAlerts extends InventoryItem {
  isLowStock: boolean;
  isOutOfStock: boolean;
  daysSinceLastRestock: number;
  projectedStockoutDate?: Date;
}

// Bill with line items detail
export interface BillWithDetails extends Bill {
  order: OrderWithCalculations;
  paymentBreakdown: PaymentBreakdown;
}

// Payment processing types
export interface PaymentBreakdown {
  subtotal: number;
  taxes: TaxBreakdown;
  serviceCharge: number;
  discount: number;
  total: number;
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst?: number;
  totalTax: number;
}

// Menu management types
export interface MenuItemWithAvailability extends MenuItem {
  isAvailable: boolean;
  availabilityReason?: string;
  estimatedPrepTime: number;
  popularityRank?: number;
}

// Reporting types
export interface DailySalesReport {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItems: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    revenue: number;
  }>;
  paymentMethodBreakdown: Record<string, number>;
  hourlyBreakdown: Array<{
    hour: number;
    revenue: number;
    orders: number;
  }>;
}

export interface InventoryReport {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  categoryBreakdown: Record<string, {
    items: number;
    value: number;
  }>;
}

// KDS (Kitchen Display System) types
export interface KDSOrderItem {
  id: string;
  orderNumber: string;
  itemName: string;
  quantity: number;
  modifiers: string[];
  specialInstructions?: string;
  station: string;
  preparationTime: number;
  orderTime: Date;
  status: 'PENDING' | 'PREPARING' | 'READY';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface KDSStation {
  id: string;
  name: string;
  type: 'HOT' | 'COLD' | 'BEVERAGE' | 'GENERAL';
  activeItems: KDSOrderItem[];
  averagePrepTime: number;
  currentLoad: number; // percentage
}

// POS types
export interface POSSession {
  id: string;
  userId: string;
  userName: string;
  outletId: string;
  startTime: Date;
  endTime?: Date;
  openingAmount: number;
  currentAmount?: number;
  totalSales: number;
  totalOrders: number;
  status: 'ACTIVE' | 'CLOSED';
}

export interface POSTransaction {
  orderId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'UPI' | 'WALLET';
  timestamp: Date;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

// Loyalty program types
export interface LoyaltyRule {
  id: string;
  name: string;
  description: string;
  type: 'EARN' | 'REDEEM';
  condition: {
    minOrderValue?: number;
    applicableItems?: string[];
    validDays?: string[];
    validHours?: string[];
  };
  reward: {
    pointsPerRupee?: number;
    fixedPoints?: number;
    discountPercent?: number;
    freeItem?: string;
  };
  isActive: boolean;
}

// Analytics types
export interface CustomerSegment {
  segmentId: string;
  name: string;
  description: string;
  criteria: {
    minOrders?: number;
    minLifetimeValue?: number;
    lastVisitDays?: number;
    loyaltyTier?: string[];
  };
  customerCount: number;
  averageOrderValue: number;
  totalRevenue: number;
}

// API response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    tenantId?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search and filter types
export interface OrderFilters {
  status?: string[];
  type?: string[];
  source?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  customerId?: string;
  tableId?: string;
}

export interface MenuItemFilters {
  categoryId?: string;
  isAvailable?: boolean;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  searchText?: string;
}

// Audit and compliance types
export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  timestamp: Date;
  ipAddress: string;
  deviceId: string;
  reason?: string;
}

// Error types
export class TenantError extends Error {
  constructor(
    message: string,
    public tenantId: string,
    public code: string = 'TENANT_ERROR'
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BusinessRuleError extends Error {
  constructor(
    message: string,
    public rule: string,
    public code: string = 'BUSINESS_RULE_ERROR'
  ) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}