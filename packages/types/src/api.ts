/**
 * API request/response types for Dinely Restaurant Operating System
 * Comprehensive types for all API endpoints and data transfer objects
 */

import type {
  ID,
  DateString,
  TimeString,
  DecimalValue,
  Order,
  OrderItem,
  MenuItem,
  MenuCategory,
  Table,
  Customer,
  Reservation,
  InventoryItem,
  Recipe,
  Payment,
  CashDrawerSession,
  Outlet,
  OrderItemModifier,
} from './database.js';

import {
  UserRole,
  OrderType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TableStatus,
  CustomerTier,
  ReservationStatus,
  FeedbackStatus,
  StockTransactionType,
} from './enums.js';

// ========== Common Response Types ==========
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
  trace?: string; // Only in development
}

export interface ResponseMeta {
  timestamp: DateString;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: PaginationMeta;
  };
}

// ========== Pagination & Filtering ==========
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeFilter {
  startDate?: DateString;
  endDate?: DateString;
}

export interface SearchFilter {
  search?: string;
  searchFields?: string[];
}

// ========== Authentication & Authorization ==========
export interface LoginRequest {
  username: string;
  password?: string;
  pin?: string;
  outletId: ID;
  deviceId?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  outlet: Outlet;
  permissions: string[];
}

export interface AuthUser {
  id: ID;
  tenantId: ID;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  outletIds: ID[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetPinRequest {
  pin: string;
  password: string;
}

// ========== Menu Management ==========
export interface CreateMenuCategoryRequest {
  name: string;
  displayOrder?: number;
  image?: string;
  taxCategory?: string;
}

export interface UpdateMenuCategoryRequest extends Partial<CreateMenuCategoryRequest> {
  isActive?: boolean;
}

export interface CreateMenuItemRequest {
  categoryId: ID;
  name: string;
  description?: string;
  price: DecimalValue;
  costPrice?: DecimalValue;
  image?: string;
  tags?: string[];
  stationId?: ID;
  preparationTimeMinutes?: number;
  modifiers?: ItemModifierInput[];
}

export interface ItemModifierInput {
  id?: ID; // For updates
  name: string;
  type: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  maxSelections?: number;
  options: ModifierOptionInput[];
}

export interface ModifierOptionInput {
  id?: ID; // For updates
  name: string;
  priceAdjustment: DecimalValue;
  isDefault?: boolean;
}

export interface UpdateMenuItemRequest extends Partial<CreateMenuItemRequest> {
  isAvailable?: boolean;
}

export interface MenuResponse {
  categories: MenuCategoryWithItems[];
}

export interface MenuCategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

export interface UpdateMenuItemAvailabilityRequest {
  isAvailable: boolean;
  reason?: string;
}

// ========== Order Management ==========
export interface CreateOrderRequest {
  tableId?: ID;
  customerId?: ID;
  type?: OrderType;
  source?: OrderSource;
  notes?: string;
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  menuItemId: ID;
  quantity: number;
  modifiers?: OrderItemModifierInput[];
  specialInstructions?: string;
}

export interface OrderItemModifierInput {
  modifierId: ID;
  optionId: ID;
}

export interface UpdateOrderItemsRequest {
  items: UpdateOrderItemRequest[];
}

export interface UpdateOrderItemRequest {
  id?: ID; // For existing items
  menuItemId: ID;
  quantity: number;
  modifiers?: OrderItemModifierInput[];
  specialInstructions?: string;
  action?: 'add' | 'update' | 'remove';
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  reason?: string;
}

export interface SettleOrderRequest {
  paymentMethod: PaymentMethod;
  paymentTransactionId?: string;
  discountAmount?: DecimalValue;
  discountCode?: string;
  customerDetails?: {
    name?: string;
    phone?: string;
    gstin?: string;
  };
}

export interface VoidOrderRequest {
  reason: string;
  managerApproval?: {
    userId: ID;
    password: string;
  };
}

export interface ApplyDiscountRequest {
  discountCode: string;
  manualDiscount?: {
    amount: DecimalValue;
    reason: string;
    managerApproval: {
      userId: ID;
      password: string;
    };
  };
}

export interface GenerateKOTRequest {
  items?: ID[]; // Specific items, empty = all items
  stations?: ID[]; // Specific stations
}

export interface KOTResponse {
  kotId: ID;
  orderNumber: string;
  tableNumber?: string;
  stations: KOTStationData[];
  timestamp: DateString;
}

export interface KOTStationData {
  stationId: ID;
  stationName: string;
  items: KOTItemData[];
}

export interface KOTItemData {
  name: string;
  quantity: number;
  modifiers: OrderItemModifier[];
  specialInstructions?: string;
  allergies?: string[];
}

// ========== Order Queries & Filters ==========
export interface OrdersFilter extends PaginationParams, DateRangeFilter, SearchFilter {
  status?: OrderStatus[];
  type?: OrderType[];
  source?: OrderSource[];
  tableId?: ID;
  customerId?: ID;
  outletId?: ID;
  createdByUserId?: ID;
}

export interface OrdersResponse extends PaginatedResponse<OrderSummary> {}

export interface OrderSummary {
  id: ID;
  orderNumber: string;
  tableNumber?: string;
  customerName?: string;
  status: OrderStatus;
  type: OrderType;
  source: OrderSource;
  itemCount: number;
  total: DecimalValue;
  createdAt: DateString;
  settledAt?: DateString;
}

export interface OrderDetailsResponse {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  canVoid: boolean;
  canRefund: boolean;
  estimatedReadyTime?: DateString;
}

// ========== Table Management ==========
export interface CreateTableRequest {
  number: string;
  name?: string;
  capacity: number;
  section?: string;
  floorPlanPosition?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    shape: 'square' | 'round' | 'rectangle';
  };
}

export interface UpdateTableRequest extends Partial<CreateTableRequest> {}

export interface UpdateTableStatusRequest {
  status: TableStatus;
  reason?: string;
}

export interface TablesResponse {
  tables: TableWithDetails[];
  floorPlan?: {
    width: number;
    height: number;
    backgroundImage?: string;
  };
}

export interface TableWithDetails extends Table {
  currentOrder?: {
    id: ID;
    orderNumber: string;
    total: DecimalValue;
    createdAt: DateString;
    guestCount?: number;
  };
  nextReservation?: {
    id: ID;
    time: TimeString;
    customerName: string;
    partySize: number;
  };
  occupancyDuration?: number; // minutes
}

export interface MergeTablesRequest {
  primaryTableId: ID;
  secondaryTableIds: ID[];
  mergedName?: string;
}

export interface SplitTableRequest {
  tableId: ID;
  splitInto: number;
  orderItemDistribution: {
    tableNumber: number;
    itemIds: ID[];
  }[];
}

// ========== Customer Management ==========
export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  dateOfBirth?: DateString;
  tags?: string[];
  notes?: string;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {}

export interface CustomersFilter extends PaginationParams, SearchFilter {
  loyaltyTier?: CustomerTier[];
  tags?: string[];
  lastOrderDateRange?: DateRangeFilter;
  lifetimeValueRange?: {
    min?: DecimalValue;
    max?: DecimalValue;
  };
}

export interface CustomerDetailsResponse {
  customer: Customer;
  orderHistory: CustomerOrderSummary[];
  loyaltyTransactions: CustomerLoyaltyTransaction[];
  preferences: CustomerPreferences;
  stats: CustomerStats;
}

export interface CustomerOrderSummary {
  id: ID;
  orderNumber: string;
  outletName: string;
  total: DecimalValue;
  date: DateString;
  rating?: number;
}

export interface CustomerLoyaltyTransaction {
  id: ID;
  type: 'EARN' | 'REDEEM';
  points: number;
  orderId?: ID;
  reason: string;
  date: DateString;
}

export interface CustomerPreferences {
  favoriteItems: ID[];
  dietaryRestrictions: string[];
  allergies: string[];
  preferredPaymentMethod: PaymentMethod;
  averageOrderValue: DecimalValue;
  visitFrequency: 'weekly' | 'monthly' | 'occasional';
}

export interface CustomerStats {
  totalOrders: number;
  totalSpent: DecimalValue;
  averageOrderValue: DecimalValue;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  currentBalance: number;
  memberSince: DateString;
  lastVisit: DateString;
  favoriteOutlet: string;
}

// ========== Loyalty Program ==========
export interface AwardLoyaltyPointsRequest {
  customerId: ID;
  orderId: ID;
  pointsEarned: number;
}

export interface RedeemLoyaltyPointsRequest {
  customerId: ID;
  pointsToRedeem: number;
  orderId?: ID;
}

export interface LoyaltyTransactionResponse {
  transactionId: ID;
  balanceBefore: number;
  balanceAfter: number;
  pointsChanged: number;
  reason: string;
}

// ========== Reservations ==========
export interface CreateReservationRequest {
  tableId: ID;
  customerId?: ID;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: DateString;
  reservationTime: TimeString;
  notes?: string;
}

export interface UpdateReservationRequest extends Partial<CreateReservationRequest> {
  status?: ReservationStatus;
}

export interface ReservationsFilter extends PaginationParams, DateRangeFilter {
  status?: ReservationStatus[];
  tableId?: ID;
  customerId?: ID;
}

export interface ReservationDetailsResponse {
  reservation: Reservation;
  table: Table;
  customer?: Customer;
  conflictingReservations?: Reservation[];
}

// ========== Kitchen Display System (KDS) ==========
export interface KDSOrdersFilter {
  stationId?: ID;
  status?: OrderStatus[];
  priority?: 'normal' | 'rush' | 'priority';
  maxAge?: number; // minutes
}

export interface KDSOrderResponse {
  orders: KDSOrderItem[];
  stationInfo: KitchenStationInfo;
}

export interface KDSOrderItem {
  id: ID;
  orderNumber: string;
  tableNumber?: string;
  customerName?: string;
  items: KDSOrderItemDetail[];
  specialInstructions?: string[];
  orderTime: DateString;
  elapsedMinutes: number;
  priority: 'normal' | 'rush' | 'priority';
  status: OrderStatus;
}

export interface KDSOrderItemDetail {
  id: ID;
  name: string;
  quantity: number;
  modifiers: OrderItemModifier[];
  specialInstructions?: string;
  status: 'pending' | 'preparing' | 'ready';
  preparationTime?: number;
}

export interface KitchenStationInfo {
  id: ID;
  name: string;
  type: string;
  activeOrders: number;
  avgPrepTime: number;
  efficiency: number; // percentage
}

export interface UpdateKDSItemStatusRequest {
  itemId: ID;
  status: 'preparing' | 'ready';
  estimatedReadyTime?: DateString;
}

export interface MarkOrderReadyRequest {
  notes?: string;
  quality?: 'excellent' | 'good' | 'poor';
}

// ========== Inventory Management ==========
export interface CreateInventoryItemRequest {
  name: string;
  category: string;
  unitOfMeasure: string;
  currentQuantity: DecimalValue;
  minimumThreshold: DecimalValue;
  reorderQuantity: DecimalValue;
  weightedAverageCost?: DecimalValue;
}

export interface UpdateInventoryItemRequest extends Partial<CreateInventoryItemRequest> {}

export interface AdjustInventoryRequest {
  reason: string;
  adjustments: InventoryAdjustment[];
  managerApproval?: {
    userId: ID;
    password: string;
  };
}

export interface InventoryAdjustment {
  inventoryItemId: ID;
  quantityChange: DecimalValue;
  costPerUnit?: DecimalValue;
  reason: string;
}

export interface InventoryFilter extends PaginationParams, SearchFilter {
  category?: string[];
  lowStock?: boolean;
  outOfStock?: boolean;
}

export interface InventoryResponse extends PaginatedResponse<InventoryItemWithStats> {}

export interface InventoryItemWithStats extends InventoryItem {
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockValue: DecimalValue;
  lastTransaction?: {
    type: StockTransactionType;
    quantity: DecimalValue;
    date: DateString;
  };
  turnoverRate?: number;
  daysOfStock?: number;
}

export interface StockAlertResponse {
  alerts: StockAlert[];
}

export interface StockAlert {
  inventoryItemId: ID;
  itemName: string;
  currentQuantity: DecimalValue;
  minimumThreshold: DecimalValue;
  suggestedReorderQuantity: DecimalValue;
  outletName: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ========== Recipe Management ==========
export interface CreateRecipeRequest {
  menuItemId: ID;
  ingredients: RecipeIngredientInput[];
  effectiveDate?: DateString;
}

export interface RecipeIngredientInput {
  inventoryItemId: ID;
  quantity: DecimalValue;
  unitOfMeasure: string;
}

export interface RecipeResponse {
  recipe: Recipe;
  ingredients: RecipeIngredientWithDetails[];
  costAnalysis: RecipeCostAnalysis;
}

export interface RecipeIngredientWithDetails {
  id: ID;
  inventoryItemId: ID;
  inventoryItemName: string;
  quantity: DecimalValue;
  unitOfMeasure: string;
  currentCost: DecimalValue;
  availability: 'available' | 'low-stock' | 'out-of-stock';
}

export interface RecipeCostAnalysis {
  totalCost: DecimalValue;
  costPerServing: DecimalValue;
  marginPercentage: number;
  profitPerServing: DecimalValue;
  lastUpdated: DateString;
}

// ========== Vendor & Purchasing ==========
export interface CreateVendorRequest {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  gstin?: string;
}

export interface CreatePurchaseOrderRequest {
  vendorId: ID;
  lineItems: POLineItemInput[];
  notes?: string;
}

export interface POLineItemInput {
  inventoryItemId: ID;
  quantity: DecimalValue;
  unitPrice: DecimalValue;
}

export interface ReceiveGoodsRequest {
  poId: ID;
  receivedItems: ReceivedItem[];
  notes?: string;
}

export interface ReceivedItem {
  inventoryItemId: ID;
  quantityReceived: DecimalValue;
  actualUnitPrice?: DecimalValue;
  expiryDate?: DateString;
  batchNumber?: string;
}

// ========== Reports & Analytics ==========
export interface DashboardResponse {
  summary: DashboardSummary;
  salesChart: ChartData;
  topItems: TopMenuItem[];
  recentOrders: OrderSummary[];
  alerts: SystemAlert[];
}

export interface DashboardSummary {
  todaySales: DecimalValue;
  todayOrders: number;
  averageOrderValue: DecimalValue;
  occupiedTables: number;
  totalTables: number;
  pendingOrders: number;
  lowStockItems: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

export interface TopMenuItem {
  id: ID;
  name: string;
  quantity: number;
  revenue: DecimalValue;
  category: string;
}

export interface SystemAlert {
  id: ID;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: DateString;
  actionRequired: boolean;
  actionUrl?: string;
}

export interface SalesReportFilter extends DateRangeFilter {
  outletIds?: ID[];
  groupBy?: 'day' | 'week' | 'month';
  includeVoided?: boolean;
  paymentMethods?: PaymentMethod[];
  orderSources?: OrderSource[];
}

export interface SalesReportResponse {
  summary: SalesReportSummary;
  breakdown: SalesBreakdown[];
  trends: SalesTerritory[];
}

export interface SalesReportSummary {
  totalRevenue: DecimalValue;
  totalOrders: number;
  averageOrderValue: DecimalValue;
  totalTax: DecimalValue;
  totalServiceCharge: DecimalValue;
  totalDiscounts: DecimalValue;
  netSales: DecimalValue;
}

export interface SalesBreakdown {
  date: DateString;
  revenue: DecimalValue;
  orders: number;
  avgOrderValue: DecimalValue;
  byPaymentMethod: Record<PaymentMethod, DecimalValue>;
  byOrderType: Record<OrderType, DecimalValue>;
}

export interface SalesTerritory {
  outletId: ID;
  outletName: string;
  revenue: DecimalValue;
  orders: number;
  growth: number; // percentage
}

// ========== Feedback Management ==========
export interface SubmitFeedbackRequest {
  orderId: ID;
  foodQualityRating: number; // 1-5
  serviceSpeedRating: number; // 1-5
  overallRating: number; // 1-5
  comments?: string;
  customerInfo?: {
    name: string;
    phone: string;
    email?: string;
  };
}

export interface RespondToFeedbackRequest {
  response: string;
  followUpRequired?: boolean;
  compensationOffered?: {
    type: 'discount' | 'free-item' | 'refund';
    amount?: DecimalValue;
    description: string;
  };
}

export interface FeedbackFilter extends PaginationParams, DateRangeFilter {
  rating?: {
    min?: number;
    max?: number;
  };
  status?: FeedbackStatus[];
  hasComments?: boolean;
}

export interface FeedbackAnalyticsResponse {
  summary: FeedbackSummary;
  trends: FeedbackTrend[];
  commonComplaints: string[];
  improvementSuggestions: string[];
}

export interface FeedbackSummary {
  totalFeedbacks: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  responseRate: number;
  resolutionRate: number;
}

export interface FeedbackTrend {
  period: DateString;
  averageRating: number;
  totalFeedbacks: number;
  byCategory: {
    foodQuality: number;
    serviceSpeed: number;
    overall: number;
  };
}

// ========== Cash Management ==========
export interface OpenCashDrawerRequest {
  openingAmount: DecimalValue;
  notes?: string;
}

export interface CloseCashDrawerRequest {
  actualClosingAmount: DecimalValue;
  variance?: DecimalValue;
  notes?: string;
  managerApproval?: {
    userId: ID;
    password: string;
  };
}

export interface CashReconciliationResponse {
  session: CashDrawerSession;
  transactions: CashTransaction[];
  summary: CashSummary;
}

export interface CashTransaction {
  id: ID;
  type: 'sale' | 'refund' | 'expense' | 'drawer-adjustment';
  amount: DecimalValue;
  orderId?: ID;
  description: string;
  timestamp: DateString;
}

export interface CashSummary {
  openingAmount: DecimalValue;
  salesTotal: DecimalValue;
  refundsTotal: DecimalValue;
  expensesTotal: DecimalValue;
  expectedClosing: DecimalValue;
  actualClosing: DecimalValue;
  variance: DecimalValue;
  variancePercentage: number;
}

// ========== Notifications ==========
export interface NotificationPreferencesRequest {
  lowStock: boolean;
  newOrders: boolean;
  negativefeedback: boolean;
  paymentFailures: boolean;
  managerApprovals: boolean;
  systemAlerts: boolean;
  deliveryChannels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
}

export interface SendNotificationRequest {
  recipients: ID[];
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('push' | 'email' | 'sms')[];
  data?: Record<string, unknown>;
}

// ========== WhatsApp Integration ==========
export interface SendWhatsAppMessageRequest {
  to: string; // Phone number
  templateName: string;
  parameters?: string[];
  type: 'transactional' | 'promotional';
}

export interface WhatsAppCampaignRequest {
  name: string;
  templateName: string;
  recipients: WhatsAppRecipient[];
  scheduledAt?: DateString;
  parameters?: Record<string, string>;
}

export interface WhatsAppRecipient {
  phone: string;
  name?: string;
  customerId?: ID;
  personalizedParams?: Record<string, string>;
}

export interface WhatsAppCampaignResponse {
  campaignId: ID;
  status: 'scheduled' | 'sending' | 'completed' | 'failed';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  estimatedCost: DecimalValue;
}

// ========== Payment Processing ==========
export interface CreatePaymentIntentRequest {
  orderId: ID;
  amount: DecimalValue;
  method: PaymentMethod;
  gateway?: 'razorpay' | 'stripe';
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResponse {
  paymentId: ID;
  clientSecret: string;
  amount: DecimalValue;
  currency: string;
  status: PaymentStatus;
  paymentUrl?: string;
}

export interface ProcessRefundRequest {
  paymentId: ID;
  amount?: DecimalValue; // Partial refund if less than original
  reason: string;
  managerApproval: {
    userId: ID;
    password: string;
  };
}

export interface RefundResponse {
  refundId: ID;
  amount: DecimalValue;
  status: 'pending' | 'completed' | 'failed';
  estimatedArrival?: DateString;
  gatewayResponse?: Record<string, unknown>;
}

// ========== Aggregator Integration ==========
export interface AggregatorOrderWebhook {
  platform: 'zomato' | 'swiggy' | 'talabat' | 'deliveroo';
  orderId: string;
  platformOrderId: string;
  signature: string;
  timestamp: DateString;
  data: Record<string, unknown>;
}

export interface UpdateAggregatorOrderStatusRequest {
  platformOrderId: string;
  status: OrderStatus;
  estimatedReadyTime?: DateString;
  reason?: string;
}

export interface ReconcileAggregatorPaymentsRequest {
  platform: string;
  dateRange: DateRangeFilter;
}

export interface AggregatorReconciliationResponse {
  platform: string;
  period: DateRangeFilter;
  summary: AggregatorPaymentSummary;
  discrepancies: PaymentDiscrepancy[];
}

export interface AggregatorPaymentSummary {
  totalOrders: number;
  totalRevenue: DecimalValue;
  platformFee: DecimalValue;
  netAmount: DecimalValue;
  pendingSettlement: DecimalValue;
}

export interface PaymentDiscrepancy {
  orderId: ID;
  platformOrderId: string;
  internalAmount: DecimalValue;
  platformAmount: DecimalValue;
  difference: DecimalValue;
  reason?: string;
}

// ========== Settings & Configuration ==========
export interface TenantSettingsRequest {
  loyaltyPointsRate?: number;
  currency?: string;
  timezone?: string;
  features?: {
    loyaltyProgram?: boolean;
    reservations?: boolean;
    inventory?: boolean;
    analytics?: boolean;
    whatsappIntegration?: boolean;
  };
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    receiptHeader?: string;
    receiptFooter?: string;
  };
}

export interface OutletSettingsRequest {
  serviceChargePercent?: number;
  taxRates?: {
    category: string;
    cgst: number;
    sgst: number;
    igst?: number;
    effectiveFrom?: DateString;
  }[];
  tablePrefix?: string;
  orderPrefix?: string;
  billPrefix?: string;
  autoKotPrint?: boolean;
  requireManagerApprovalForVoids?: boolean;
  requireManagerApprovalForDiscounts?: boolean;
  cashDrawerSettings?: {
    requireOpeningAmount?: boolean;
    allowNegativeVariance?: boolean;
    maxVarianceAmount?: number;
  };
}

// ========== Export & Import ==========
export interface ExportDataRequest {
  type: 'orders' | 'customers' | 'inventory' | 'reports';
  format: 'csv' | 'xlsx' | 'pdf';
  dateRange?: DateRangeFilter;
  filters?: Record<string, unknown>;
}

export interface ExportResponse {
  jobId: ID;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: DateString;
}

export interface ImportDataRequest {
  type: 'menu-items' | 'customers' | 'inventory';
  fileUrl: string;
  mapping: Record<string, string>;
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    validateOnly?: boolean;
  };
}

// ========== Utility Types ==========
export type ApiRequest<T = Record<string, unknown>> = T;
export type ApiResponseData<T> = ApiResponse<T>['data'];

// Type helpers for strongly typed API calls
export type GetResponse<T> = ApiResponse<T>;
export type ListResponse<T> = PaginatedResponse<T>;
export type CreateResponse<T> = ApiResponse<T & { id: ID; createdAt: DateString }>;
export type UpdateResponse<T> = ApiResponse<T & { updatedAt: DateString }>;
export type DeleteResponse = ApiResponse<{ deleted: boolean; deletedAt: DateString }>;

// ========== Real-time Event Types ==========
export interface SocketEvent<T = unknown> {
  type: string;
  tenantId: ID;
  outletId?: ID;
  data: T;
  timestamp: DateString;
  userId?: ID;
}

export interface OrderUpdatedEvent extends SocketEvent<Order> {
  type: 'order:updated';
}

export interface TableStatusChangedEvent extends SocketEvent<Table> {
  type: 'table:status:changed';
}

export interface MenuItemUpdatedEvent extends SocketEvent<MenuItem> {
  type: 'menu:item:updated';
}

export interface KDSOrderUpdatedEvent extends SocketEvent<KDSOrderItem> {
  type: 'kds:order:updated';
}

export interface InventoryAlertEvent extends SocketEvent<StockAlert> {
  type: 'inventory:alert';
}

export type DinelySocketEvent = 
  | OrderUpdatedEvent
  | TableStatusChangedEvent
  | MenuItemUpdatedEvent
  | KDSOrderUpdatedEvent
  | InventoryAlertEvent;