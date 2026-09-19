/**
 * Validation schemas using Zod for Dinely Restaurant Operating System
 * Runtime validation and type inference for API requests and data
 */

import { z } from 'zod';
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
  ExpenseCategory,
  StockTransactionType,
  ModifierType,
  DiscountType,
  OutletType,
  SubscriptionTier,
  SubscriptionStatus,
} from './enums.js';

// ========== Base Schemas ==========
export const IDSchema = z.string().uuid('Invalid ID format');
export const DateStringSchema = z.string().datetime('Invalid date format');
export const TimeStringSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');
export const DecimalSchema = z.union([z.number(), z.string()]).transform((val) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) throw new Error('Invalid decimal value');
  return num;
});
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');
export const EmailSchema = z.string().email('Invalid email format');
export const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const PinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits');

// ========== Enum Schemas ==========
export const UserRoleSchema = z.nativeEnum(UserRole);
export const OrderTypeSchema = z.nativeEnum(OrderType);
export const OrderSourceSchema = z.nativeEnum(OrderSource);
export const OrderStatusSchema = z.nativeEnum(OrderStatus);
export const PaymentMethodSchema = z.nativeEnum(PaymentMethod);
export const PaymentStatusSchema = z.nativeEnum(PaymentStatus);
export const TableStatusSchema = z.nativeEnum(TableStatus);
export const CustomerTierSchema = z.nativeEnum(CustomerTier);
export const ReservationStatusSchema = z.nativeEnum(ReservationStatus);
export const FeedbackStatusSchema = z.nativeEnum(FeedbackStatus);
export const ExpenseCategorySchema = z.nativeEnum(ExpenseCategory);
export const StockTransactionTypeSchema = z.nativeEnum(StockTransactionType);
export const ModifierTypeSchema = z.nativeEnum(ModifierType);
export const DiscountTypeSchema = z.nativeEnum(DiscountType);
export const OutletTypeSchema = z.nativeEnum(OutletType);
export const SubscriptionTierSchema = z.nativeEnum(SubscriptionTier);
export const SubscriptionStatusSchema = z.nativeEnum(SubscriptionStatus);

// ========== Common Schemas ==========
export const PaginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const DateRangeSchema = z.object({
  startDate: DateStringSchema.optional(),
  endDate: DateStringSchema.optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, 'End date must be after start date');

export const SearchSchema = z.object({
  search: z.string().max(100).optional(),
  searchFields: z.array(z.string()).optional(),
});

export const TaxRateSchema = z.object({
  category: z.string().min(1, 'Tax category is required'),
  cgst: z.number().min(0).max(28, 'CGST rate must be between 0-28%'),
  sgst: z.number().min(0).max(28, 'SGST rate must be between 0-28%'),
  igst: z.number().min(0).max(28, 'IGST rate must be between 0-28%').optional(),
  effectiveFrom: DateStringSchema.optional(),
});

export const FloorPlanPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  shape: z.enum(['square', 'round', 'rectangle']),
  rotation: z.number().min(0).max(360).optional(),
});

// ========== Authentication Schemas ==========
export const LoginRequestSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: PasswordSchema.optional(),
  pin: PinSchema.optional(),
  outletId: IDSchema,
  deviceId: z.string().optional(),
}).refine(data => data.password || data.pin, {
  message: 'Either password or PIN is required',
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: PasswordSchema,
  newPassword: PasswordSchema,
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
});

export const SetPinRequestSchema = z.object({
  pin: PinSchema,
  password: PasswordSchema,
});

// ========== Tenant & Outlet Schemas ==========
export const CreateTenantRequestSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters').max(100),
  subdomain: z.string().min(3, 'Subdomain must be at least 3 characters').max(50).regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  logo: z.string().url('Invalid logo URL').optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
  subscriptionTier: SubscriptionTierSchema.optional(),
  currency: z.string().length(3, 'Currency must be 3 characters (ISO 4217)').optional(),
  timezone: z.string().optional(),
  country: z.string().length(2, 'Country must be 2 characters (ISO 3166-1)').optional(),
});

export const CreateOutletRequestSchema = z.object({
  tenantId: IDSchema,
  name: z.string().min(2, 'Outlet name must be at least 2 characters').max(100),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  phone: PhoneSchema,
  email: EmailSchema,
  type: OutletTypeSchema.optional(),
  openTime: TimeStringSchema.optional(),
  closeTime: TimeStringSchema.optional(),
}).refine(data => {
  if (data.openTime && data.closeTime) {
    return data.openTime !== data.closeTime;
  }
  return true;
}, 'Open time and close time cannot be the same');

// ========== User Management Schemas ==========
export const CreateUserRequestSchema = z.object({
  tenantId: IDSchema,
  username: z.string().min(3, 'Username must be at least 3 characters').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: EmailSchema,
  phone: PhoneSchema.optional(),
  password: PasswordSchema,
  pin: PinSchema.optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  role: UserRoleSchema,
  outletAssignments: z.array(IDSchema).min(1, 'At least one outlet assignment is required'),
});

export const UpdateUserRequestSchema = CreateUserRequestSchema.partial().omit(['tenantId'] as const);

// ========== Menu Management Schemas ==========
export const ModifierOptionInputSchema = z.object({
  id: IDSchema.optional(),
  name: z.string().min(1, 'Modifier option name is required').max(100),
  priceAdjustment: DecimalSchema,
  isDefault: z.boolean().optional(),
});

export const ItemModifierInputSchema = z.object({
  id: IDSchema.optional(),
  name: z.string().min(1, 'Modifier name is required').max(100),
  type: ModifierTypeSchema,
  required: z.boolean(),
  maxSelections: z.number().int().positive().optional(),
  options: z.array(ModifierOptionInputSchema).min(1, 'At least one modifier option is required'),
}).refine(data => {
  if (data.type === ModifierType.SINGLE && data.maxSelections && data.maxSelections > 1) {
    return false;
  }
  return true;
}, 'Single modifier cannot have more than 1 max selection');

export const CreateMenuCategoryRequestSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  displayOrder: z.number().int().min(0).optional(),
  image: z.string().url('Invalid image URL').optional(),
  taxCategory: z.string().max(50).optional(),
});

export const CreateMenuItemRequestSchema = z.object({
  categoryId: IDSchema,
  name: z.string().min(1, 'Item name is required').max(100),
  description: z.string().max(500).optional(),
  price: DecimalSchema.refine(val => val >= 0, 'Price must be non-negative'),
  costPrice: DecimalSchema.refine(val => val >= 0, 'Cost price must be non-negative').optional(),
  image: z.string().url('Invalid image URL').optional(),
  tags: z.array(z.string().max(50)).optional(),
  stationId: IDSchema.optional(),
  preparationTimeMinutes: z.number().int().min(0).max(300).optional(),
  modifiers: z.array(ItemModifierInputSchema).optional(),
});

export const UpdateMenuItemAvailabilityRequestSchema = z.object({
  isAvailable: z.boolean(),
  reason: z.string().max(200).optional(),
});

// ========== Order Management Schemas ==========
export const OrderItemModifierInputSchema = z.object({
  modifierId: IDSchema,
  optionId: IDSchema,
});

export const CreateOrderItemRequestSchema = z.object({
  menuItemId: IDSchema,
  quantity: z.number().int().positive('Quantity must be positive'),
  modifiers: z.array(OrderItemModifierInputSchema).optional(),
  specialInstructions: z.string().max(200).optional(),
});

export const CreateOrderRequestSchema = z.object({
  tableId: IDSchema.optional(),
  customerId: IDSchema.optional(),
  type: OrderTypeSchema.optional(),
  source: OrderSourceSchema.optional(),
  notes: z.string().max(500).optional(),
  items: z.array(CreateOrderItemRequestSchema).min(1, 'Order must have at least one item'),
});

export const UpdateOrderItemRequestSchema = z.object({
  id: IDSchema.optional(),
  menuItemId: IDSchema,
  quantity: z.number().int().positive('Quantity must be positive'),
  modifiers: z.array(OrderItemModifierInputSchema).optional(),
  specialInstructions: z.string().max(200).optional(),
  action: z.enum(['add', 'update', 'remove']).optional(),
});

export const UpdateOrderItemsRequestSchema = z.object({
  items: z.array(UpdateOrderItemRequestSchema).min(1),
});

export const UpdateOrderStatusRequestSchema = z.object({
  status: OrderStatusSchema,
  reason: z.string().max(200).optional(),
});

export const SettleOrderRequestSchema = z.object({
  paymentMethod: PaymentMethodSchema,
  paymentTransactionId: z.string().max(100).optional(),
  discountAmount: DecimalSchema.refine(val => val >= 0, 'Discount amount must be non-negative').optional(),
  discountCode: z.string().max(50).optional(),
  customerDetails: z.object({
    name: z.string().max(100).optional(),
    phone: PhoneSchema.optional(),
    gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
  }).optional(),
});

export const VoidOrderRequestSchema = z.object({
  reason: z.string().min(5, 'Void reason must be at least 5 characters').max(200),
  managerApproval: z.object({
    userId: IDSchema,
    password: PasswordSchema,
  }).optional(),
});

export const ApplyDiscountRequestSchema = z.object({
  discountCode: z.string().max(50).optional(),
  manualDiscount: z.object({
    amount: DecimalSchema.refine(val => val > 0, 'Discount amount must be positive'),
    reason: z.string().min(5, 'Discount reason must be at least 5 characters').max(200),
    managerApproval: z.object({
      userId: IDSchema,
      password: PasswordSchema,
    }),
  }).optional(),
}).refine(data => data.discountCode || data.manualDiscount, {
  message: 'Either discount code or manual discount is required',
});

// ========== Table Management Schemas ==========
export const CreateTableRequestSchema = z.object({
  number: z.string().min(1, 'Table number is required').max(10),
  name: z.string().max(50).optional(),
  capacity: z.number().int().positive('Capacity must be positive').max(50),
  section: z.string().max(50).optional(),
  floorPlanPosition: FloorPlanPositionSchema.optional(),
});

export const UpdateTableStatusRequestSchema = z.object({
  status: TableStatusSchema,
  reason: z.string().max(200).optional(),
});

export const MergeTablesRequestSchema = z.object({
  primaryTableId: IDSchema,
  secondaryTableIds: z.array(IDSchema).min(1, 'At least one secondary table is required'),
  mergedName: z.string().max(50).optional(),
});

export const SplitTableRequestSchema = z.object({
  tableId: IDSchema,
  splitInto: z.number().int().min(2).max(10),
  orderItemDistribution: z.array(z.object({
    tableNumber: z.number().int().positive(),
    itemIds: z.array(IDSchema),
  })).min(2),
});

// ========== Customer Management Schemas ==========
export const CreateCustomerRequestSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  phone: PhoneSchema,
  email: EmailSchema.optional(),
  address: z.string().max(500).optional(),
  dateOfBirth: DateStringSchema.optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(500).optional(),
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
});

export const UpdateCustomerRequestSchema = CreateCustomerRequestSchema.partial().omit(['phone']);

// ========== Loyalty Program Schemas ==========
export const AwardLoyaltyPointsRequestSchema = z.object({
  customerId: IDSchema,
  orderId: IDSchema,
  pointsEarned: z.number().int().positive('Points earned must be positive'),
});

export const RedeemLoyaltyPointsRequestSchema = z.object({
  customerId: IDSchema,
  pointsToRedeem: z.number().int().positive('Points to redeem must be positive'),
  orderId: IDSchema.optional(),
});

// ========== Reservation Schemas ==========
export const CreateReservationRequestSchema = z.object({
  tableId: IDSchema,
  customerId: IDSchema.optional(),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  customerPhone: PhoneSchema,
  partySize: z.number().int().positive('Party size must be positive').max(50),
  reservationDate: DateStringSchema,
  reservationTime: TimeStringSchema,
  notes: z.string().max(500).optional(),
}).refine(data => {
  const reservationDateTime = new Date(`${data.reservationDate}T${data.reservationTime}`);
  return reservationDateTime > new Date();
}, 'Reservation must be in the future');

export const UpdateReservationRequestSchema = CreateReservationRequestSchema.partial().extend({
  status: ReservationStatusSchema.optional(),
});

// ========== Inventory Management Schemas ==========
export const CreateInventoryItemRequestSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  currentQuantity: DecimalSchema.refine(val => val >= 0, 'Current quantity must be non-negative'),
  minimumThreshold: DecimalSchema.refine(val => val >= 0, 'Minimum threshold must be non-negative'),
  reorderQuantity: DecimalSchema.refine(val => val > 0, 'Reorder quantity must be positive'),
  weightedAverageCost: DecimalSchema.refine(val => val >= 0, 'Weighted average cost must be non-negative').optional(),
});

export const InventoryAdjustmentSchema = z.object({
  inventoryItemId: IDSchema,
  quantityChange: DecimalSchema,
  costPerUnit: DecimalSchema.refine(val => val >= 0, 'Cost per unit must be non-negative').optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200),
});

export const AdjustInventoryRequestSchema = z.object({
  reason: z.string().min(5, 'Overall reason must be at least 5 characters').max(200),
  adjustments: z.array(InventoryAdjustmentSchema).min(1, 'At least one adjustment is required'),
  managerApproval: z.object({
    userId: IDSchema,
    password: PasswordSchema,
  }).optional(),
});

// ========== Recipe Management Schemas ==========
export const RecipeIngredientInputSchema = z.object({
  inventoryItemId: IDSchema,
  quantity: DecimalSchema.refine(val => val > 0, 'Ingredient quantity must be positive'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
});

export const CreateRecipeRequestSchema = z.object({
  menuItemId: IDSchema,
  ingredients: z.array(RecipeIngredientInputSchema).min(1, 'Recipe must have at least one ingredient'),
  effectiveDate: DateStringSchema.optional(),
});

// ========== Vendor & Purchase Order Schemas ==========
export const CreateVendorRequestSchema = z.object({
  name: z.string().min(2, 'Vendor name must be at least 2 characters').max(100),
  contactPerson: z.string().min(2, 'Contact person name must be at least 2 characters').max(100),
  phone: PhoneSchema,
  email: EmailSchema.optional(),
  address: z.string().max(500).optional(),
  paymentTerms: z.string().max(100).optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
});

export const POLineItemInputSchema = z.object({
  inventoryItemId: IDSchema,
  quantity: DecimalSchema.refine(val => val > 0, 'Quantity must be positive'),
  unitPrice: DecimalSchema.refine(val => val >= 0, 'Unit price must be non-negative'),
});

export const CreatePurchaseOrderRequestSchema = z.object({
  vendorId: IDSchema,
  lineItems: z.array(POLineItemInputSchema).min(1, 'Purchase order must have at least one line item'),
  notes: z.string().max(500).optional(),
});

export const ReceivedItemSchema = z.object({
  inventoryItemId: IDSchema,
  quantityReceived: DecimalSchema.refine(val => val > 0, 'Quantity received must be positive'),
  actualUnitPrice: DecimalSchema.refine(val => val >= 0, 'Actual unit price must be non-negative').optional(),
  expiryDate: DateStringSchema.optional(),
  batchNumber: z.string().max(50).optional(),
});

export const ReceiveGoodsRequestSchema = z.object({
  poId: IDSchema,
  receivedItems: z.array(ReceivedItemSchema).min(1, 'At least one received item is required'),
  notes: z.string().max(500).optional(),
});

// ========== Feedback Management Schemas ==========
export const SubmitFeedbackRequestSchema = z.object({
  orderId: IDSchema,
  foodQualityRating: z.number().int().min(1).max(5),
  serviceSpeedRating: z.number().int().min(1).max(5),
  overallRating: z.number().int().min(1).max(5),
  comments: z.string().max(1000).optional(),
  customerInfo: z.object({
    name: z.string().min(1, 'Customer name is required').max(100),
    phone: PhoneSchema,
    email: EmailSchema.optional(),
  }).optional(),
});

export const RespondToFeedbackRequestSchema = z.object({
  response: z.string().min(5, 'Response must be at least 5 characters').max(500),
  followUpRequired: z.boolean().optional(),
  compensationOffered: z.object({
    type: z.enum(['discount', 'free-item', 'refund']),
    amount: DecimalSchema.refine(val => val >= 0, 'Compensation amount must be non-negative').optional(),
    description: z.string().min(1, 'Compensation description is required').max(200),
  }).optional(),
});

// ========== Cash Management Schemas ==========
export const OpenCashDrawerRequestSchema = z.object({
  openingAmount: DecimalSchema.refine(val => val >= 0, 'Opening amount must be non-negative'),
  notes: z.string().max(200).optional(),
});

export const CloseCashDrawerRequestSchema = z.object({
  actualClosingAmount: DecimalSchema.refine(val => val >= 0, 'Actual closing amount must be non-negative'),
  variance: DecimalSchema.optional(),
  notes: z.string().max(200).optional(),
  managerApproval: z.object({
    userId: IDSchema,
    password: PasswordSchema,
  }).optional(),
});

// ========== Payment Processing Schemas ==========
export const CreatePaymentIntentRequestSchema = z.object({
  orderId: IDSchema,
  amount: DecimalSchema.refine(val => val > 0, 'Payment amount must be positive'),
  method: PaymentMethodSchema,
  gateway: z.enum(['razorpay', 'stripe']).optional(),
  returnUrl: z.string().url('Invalid return URL').optional(),
  metadata: z.record(z.string()).optional(),
});

export const ProcessRefundRequestSchema = z.object({
  paymentId: IDSchema,
  amount: DecimalSchema.refine(val => val > 0, 'Refund amount must be positive').optional(),
  reason: z.string().min(5, 'Refund reason must be at least 5 characters').max(200),
  managerApproval: z.object({
    userId: IDSchema,
    password: PasswordSchema,
  }),
});

// ========== WhatsApp Integration Schemas ==========
export const SendWhatsAppMessageRequestSchema = z.object({
  to: PhoneSchema,
  templateName: z.string().min(1, 'Template name is required').max(100),
  parameters: z.array(z.string().max(200)).optional(),
  type: z.enum(['transactional', 'promotional']),
});

export const WhatsAppRecipientSchema = z.object({
  phone: PhoneSchema,
  name: z.string().max(100).optional(),
  customerId: IDSchema.optional(),
  personalizedParams: z.record(z.string().max(200)).optional(),
});

export const WhatsAppCampaignRequestSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  templateName: z.string().min(1, 'Template name is required').max(100),
  recipients: z.array(WhatsAppRecipientSchema).min(1, 'At least one recipient is required').max(1000),
  scheduledAt: DateStringSchema.optional(),
  parameters: z.record(z.string().max(200)).optional(),
});

// ========== Filter Schemas ==========
export const OrdersFilterSchema = PaginationSchema.merge(DateRangeSchema).merge(SearchSchema).extend({
  status: z.array(OrderStatusSchema).optional(),
  type: z.array(OrderTypeSchema).optional(),
  source: z.array(OrderSourceSchema).optional(),
  tableId: IDSchema.optional(),
  customerId: IDSchema.optional(),
  outletId: IDSchema.optional(),
  createdByUserId: IDSchema.optional(),
});

export const CustomersFilterSchema = PaginationSchema.merge(SearchSchema).extend({
  loyaltyTier: z.array(CustomerTierSchema).optional(),
  tags: z.array(z.string()).optional(),
  lastOrderDateRange: DateRangeSchema.optional(),
  lifetimeValueRange: z.object({
    min: DecimalSchema.optional(),
    max: DecimalSchema.optional(),
  }).optional(),
});

export const InventoryFilterSchema = PaginationSchema.merge(SearchSchema).extend({
  category: z.array(z.string()).optional(),
  lowStock: z.boolean().optional(),
  outOfStock: z.boolean().optional(),
});

export const ReservationsFilterSchema = PaginationSchema.merge(DateRangeSchema).extend({
  status: z.array(ReservationStatusSchema).optional(),
  tableId: IDSchema.optional(),
  customerId: IDSchema.optional(),
});

export const FeedbackFilterSchema = PaginationSchema.merge(DateRangeSchema).extend({
  rating: z.object({
    min: z.number().int().min(1).max(5).optional(),
    max: z.number().int().min(1).max(5).optional(),
  }).optional(),
  status: z.array(FeedbackStatusSchema).optional(),
  hasComments: z.boolean().optional(),
});

// ========== Validation Helper Functions ==========
export const validateOrThrow = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
    throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  }
  return result.data;
};

export const validatePartial = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: z.ZodError } => {
  const result = schema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    errors: result.success ? undefined : result.error,
  };
};

// ========== Type Inference ==========
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;
export type CreateOutletRequest = z.infer<typeof CreateOutletRequestSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type CreateMenuCategoryRequest = z.infer<typeof CreateMenuCategoryRequestSchema>;
export type CreateMenuItemRequest = z.infer<typeof CreateMenuItemRequestSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;
export type CreateReservationRequest = z.infer<typeof CreateReservationRequestSchema>;
export type CreateInventoryItemRequest = z.infer<typeof CreateInventoryItemRequestSchema>;
export type CreateRecipeRequest = z.infer<typeof CreateRecipeRequestSchema>;
export type CreateVendorRequest = z.infer<typeof CreateVendorRequestSchema>;
export type CreatePurchaseOrderRequest = z.infer<typeof CreatePurchaseOrderRequestSchema>;
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;
export type OrdersFilter = z.infer<typeof OrdersFilterSchema>;
export type CustomersFilter = z.infer<typeof CustomersFilterSchema>;
export type InventoryFilter = z.infer<typeof InventoryFilterSchema>;

// ========== Configuration ==========
export const ValidationConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  maxUploadFiles: 5,
  phoneRegex: /^\+?[1-9]\d{1,14}$/,
  gstinRegex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  passwordRequirements: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
} as const;