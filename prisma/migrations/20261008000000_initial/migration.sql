-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant";

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant"."OutletType" AS ENUM ('DINE_IN', 'QSR', 'CLOUD_KITCHEN', 'CAFE', 'BAR', 'FOOD_TRUCK');

-- CreateEnum
CREATE TYPE "tenant"."UserRole" AS ENUM ('ADMIN', 'MANAGER', 'CASHIER', 'SERVER', 'KITCHEN', 'RIDER');

-- CreateEnum
CREATE TYPE "tenant"."ModifierType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "tenant"."TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- CreateEnum
CREATE TYPE "tenant"."OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "tenant"."OrderSource" AS ENUM ('POS', 'CAPTAIN', 'QR', 'ONLINE', 'AGGREGATOR');

-- CreateEnum
CREATE TYPE "tenant"."OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'SETTLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "tenant"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE');

-- CreateEnum
CREATE TYPE "tenant"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "tenant"."OrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "tenant"."CustomerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "tenant"."LoyaltyType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "tenant"."StockTransactionType" AS ENUM ('PURCHASE', 'ADJUSTMENT', 'DEDUCTION', 'TRANSFER', 'WASTE');

-- CreateEnum
CREATE TYPE "tenant"."POStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "tenant"."ExpenseCategory" AS ENUM ('FOOD_COST', 'LABOR', 'RENT', 'UTILITIES', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "tenant"."ReservationStatus" AS ENUM ('CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "tenant"."FeedbackStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "tenant"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "tenant"."CashDrawerStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "tenant"."DeviceType" AS ENUM ('POS', 'KDS', 'CAPTAIN_TABLET', 'MANAGER_TABLET');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "logo" TEXT,
    "gstin" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "country" TEXT NOT NULL DEFAULT 'IN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."outlets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" "tenant"."OutletType" NOT NULL DEFAULT 'DINE_IN',
    "open_time" TEXT,
    "close_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "settings" JSONB,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "full_name" TEXT NOT NULL,
    "role" "tenant"."UserRole" NOT NULL DEFAULT 'CASHIER',
    "outlet_assignments" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."menu_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tax_category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."menu_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "station_id" TEXT,
    "preparation_time_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "modifiers" JSONB,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."item_modifiers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "tenant"."ModifierType" NOT NULL,
    "required" BOOLEAN NOT NULL,

    CONSTRAINT "item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."modifier_options" (
    "id" TEXT NOT NULL,
    "modifier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_adjustment" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."tables" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER NOT NULL,
    "section" TEXT,
    "status" "tenant"."TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qr_code_url" TEXT,
    "current_order_id" TEXT,
    "occupied_at" TIMESTAMP(3),
    "floor_plan_position" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."orders" (
    "customer_access_token_hash" TEXT,
    "delivery_address" JSONB,
    "client_operation_id" TEXT,
    "client_created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "table_id" TEXT,
    "customer_id" TEXT,
    "type" "tenant"."OrderType" NOT NULL DEFAULT 'DINE_IN',
    "source" "tenant"."OrderSource" NOT NULL DEFAULT 'POS',
    "aggregator_source" TEXT,
    "status" "tenant"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "tax_breakdown" JSONB,
    "service_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_code" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method" "tenant"."PaymentMethod",
    "payment_status" "tenant"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_transaction_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "voided_by_user_id" TEXT,
    "voided_reason" TEXT,
    "vector_clock" JSONB,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "menu_item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "modifiers" JSONB,
    "special_instructions" TEXT,
    "status" "tenant"."OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "kot_printed_at" TIMESTAMP(3),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "tenant"."PaymentMethod" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" TEXT,
    "gateway_transaction_id" TEXT,
    "status" "tenant"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "loyalty_tier" "tenant"."CustomerTier" NOT NULL DEFAULT 'BRONZE',
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "last_order_date" TIMESTAMP(3),
    "tags" TEXT[],
    "notes" TEXT,
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "email_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."loyalty_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "tenant"."LoyaltyType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "order_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."inventory_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "current_quantity" DECIMAL(10,3) NOT NULL,
    "minimum_threshold" DECIMAL(10,3) NOT NULL,
    "reorder_quantity" DECIMAL(10,3) NOT NULL,
    "weighted_average_cost" DECIMAL(10,2) NOT NULL,
    "last_updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."recipes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "inventory_item_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_of_measure" TEXT NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."stock_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "transaction_type" "tenant"."StockTransactionType" NOT NULL,
    "quantity_change" DECIMAL(10,3) NOT NULL,
    "quantity_before" DECIMAL(10,3) NOT NULL,
    "quantity_after" DECIMAL(10,3) NOT NULL,
    "cost_per_unit" DECIMAL(10,2),
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "approved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."kitchen_stations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."vendors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" TEXT,
    "gstin" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."purchase_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "status" "tenant"."POStatus" NOT NULL DEFAULT 'DRAFT',
    "line_items" JSONB NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."expenses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "category" "tenant"."ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "tenant"."PaymentMethod" NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "receipt_url" TEXT,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "recorded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."bills" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_gstin" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "tax_breakdown" JSONB NOT NULL,
    "service_charge" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method" "tenant"."PaymentMethod" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."reservations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "reservation_date" TIMESTAMP(3) NOT NULL,
    "reservation_time" TEXT NOT NULL,
    "status" "tenant"."ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."feedback" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "food_quality_rating" INTEGER NOT NULL,
    "service_speed_rating" INTEGER NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "comments" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" TEXT,
    "responded_by_user_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "status" "tenant"."FeedbackStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."discount_codes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "tenant"."DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "min_order_value" DECIMAL(10,2),
    "max_discount" DECIMAL(10,2),
    "applicable_items" TEXT[],
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "outlet_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "reason" TEXT,
    "approved_by_user_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."cash_drawer_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "opened_by_user_id" TEXT NOT NULL,
    "closed_by_user_id" TEXT,
    "opening_amount" DECIMAL(10,2) NOT NULL,
    "expected_closing_amount" DECIMAL(10,2) NOT NULL,
    "actual_closing_amount" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "status" "tenant"."CashDrawerStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "cash_drawer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "type" "tenant"."DeviceType" NOT NULL,
    "name" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "vector_clock" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant"."invoice_sequences" (
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("tenant_id","outlet_id","year")
);

-- CreateTable
CREATE TABLE "tenant"."journal_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "gst" DECIMAL(10,2) NOT NULL,
    "stream" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "outlets_tenant_id_idx" ON "tenant"."outlets"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "tenant"."users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "tenant"."users"("tenant_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "tenant"."users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "menu_categories_tenant_id_outlet_id_idx" ON "tenant"."menu_categories"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_outlet_id_idx" ON "tenant"."menu_items"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "tenant"."menu_items"("category_id");

-- CreateIndex
CREATE INDEX "item_modifiers_tenant_id_idx" ON "tenant"."item_modifiers"("tenant_id");

-- CreateIndex
CREATE INDEX "modifier_options_modifier_id_idx" ON "tenant"."modifier_options"("modifier_id");

-- CreateIndex
CREATE INDEX "tables_tenant_id_outlet_id_idx" ON "tenant"."tables"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_outlet_id_idx" ON "tenant"."orders"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "tenant"."orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_outlet_id_client_operation_id_key" ON "tenant"."orders"("tenant_id", "outlet_id", "client_operation_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "tenant"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "tenant"."payments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_gateway_transaction_id_key" ON "tenant"."payments"("gateway", "gateway_transaction_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "tenant"."customers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_phone_key" ON "tenant"."customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "loyalty_transactions_tenant_id_customer_id_idx" ON "tenant"."loyalty_transactions"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_outlet_id_idx" ON "tenant"."inventory_items"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "recipes_tenant_id_menu_item_id_idx" ON "tenant"."recipes"("tenant_id", "menu_item_id");

-- CreateIndex
CREATE INDEX "stock_transactions_tenant_id_outlet_id_idx" ON "tenant"."stock_transactions"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "kitchen_stations_tenant_id_outlet_id_idx" ON "tenant"."kitchen_stations"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "vendors_tenant_id_idx" ON "tenant"."vendors"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_outlet_id_idx" ON "tenant"."purchase_orders"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "expenses_tenant_id_outlet_id_idx" ON "tenant"."expenses"("tenant_id", "outlet_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_order_id_key" ON "tenant"."bills"("order_id");

-- CreateIndex
CREATE INDEX "bills_tenant_id_outlet_id_idx" ON "tenant"."bills"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "bills_bill_number_idx" ON "tenant"."bills"("bill_number");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_outlet_id_idx" ON "tenant"."reservations"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "reservations_reservation_date_reservation_time_idx" ON "tenant"."reservations"("reservation_date", "reservation_time");

-- CreateIndex
CREATE INDEX "feedback_tenant_id_idx" ON "tenant"."feedback"("tenant_id");

-- CreateIndex
CREATE INDEX "discount_codes_tenant_id_code_idx" ON "tenant"."discount_codes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_timestamp_idx" ON "tenant"."audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "cash_drawer_sessions_tenant_id_outlet_id_idx" ON "tenant"."cash_drawer_sessions"("tenant_id", "outlet_id");

-- CreateIndex
CREATE INDEX "devices_tenant_id_outlet_id_idx" ON "tenant"."devices"("tenant_id", "outlet_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_order_id_key" ON "tenant"."journal_entries"("order_id");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_outlet_id_created_at_idx" ON "tenant"."journal_entries"("tenant_id", "outlet_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant"."menu_categories" ADD CONSTRAINT "menu_categories_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."menu_items" ADD CONSTRAINT "menu_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tenant"."menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."modifier_options" ADD CONSTRAINT "modifier_options_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "tenant"."item_modifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."tables" ADD CONSTRAINT "tables_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."orders" ADD CONSTRAINT "orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tenant"."tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tenant"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."orders" ADD CONSTRAINT "orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."orders" ADD CONSTRAINT "orders_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "tenant"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "tenant"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "tenant"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tenant"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."inventory_items" ADD CONSTRAINT "inventory_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."recipes" ADD CONSTRAINT "recipes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "tenant"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "tenant"."recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "tenant"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."stock_transactions" ADD CONSTRAINT "stock_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "tenant"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."stock_transactions" ADD CONSTRAINT "stock_transactions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."kitchen_stations" ADD CONSTRAINT "kitchen_stations_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "tenant"."vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."expenses" ADD CONSTRAINT "expenses_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."bills" ADD CONSTRAINT "bills_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."bills" ADD CONSTRAINT "bills_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "tenant"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."reservations" ADD CONSTRAINT "reservations_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tenant"."tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."reservations" ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tenant"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."feedback" ADD CONSTRAINT "feedback_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "tenant"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."feedback" ADD CONSTRAINT "feedback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tenant"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "tenant"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant"."devices" ADD CONSTRAINT "devices_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "tenant"."outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
