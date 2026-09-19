# Implementation Plan: Dinely Restaurant Operating System

## Overview

This implementation plan breaks down the Dinely Restaurant Operating System into discrete coding tasks. The system is a multi-tenant SaaS platform built with TypeScript, React 18, Node.js/Express, PostgreSQL, and Redis. The architecture follows offline-first principles with real-time synchronization via Socket.IO.

The implementation follows a layered approach:
1. **Foundation Layer**: Database schema, multi-tenant infrastructure, and core types
2. **Backend Services**: API endpoints for POS, KDS, Inventory, CRM, and other modules
3. **Frontend Applications**: React applications for POS terminals, KDS displays, and customer-facing interfaces
4. **Integration Layer**: Third-party integrations for payments, WhatsApp, and aggregators
5. **Real-time & Offline**: Socket.IO implementation and IndexedDB sync engine
6. **Testing & Validation**: Property-based tests for correctness properties

## Tasks

- [ ] 1. Set up project infrastructure and database foundation
  - [ ] 1.1 Initialize monorepo with TypeScript, Node.js/Express backend, and React frontend workspaces
    - Create package.json with workspaces for backend, frontend-pos, frontend-kds, frontend-captain, frontend-qr, frontend-online
    - Configure TypeScript with strict mode and shared tsconfig.base.json
    - Set up ESLint and Prettier for code formatting
    - Configure Vite for frontend bundling
    - _Requirements: System architecture foundation_

  - [ ] 1.2 Set up PostgreSQL with Prisma ORM and multi-tenant schema-per-tenant architecture
    - Install Prisma and PostgreSQL client
    - Create base Prisma schema with tenant, outlet, user models
    - Implement tenant_id filtering middleware at ORM level
    - Configure connection pooling and read replica support
    - _Requirements: 1.1, 1.5_

  - [ ] 1.3 Define core TypeScript interfaces and types for all domain entities
    - Create types for Tenant, Outlet, MenuItem, MenuCategory, ItemModifier
    - Create types for Order, OrderItem, Table, Reservation
    - Create types for InventoryItem, Recipe, StockTransaction, Vendor, PurchaseOrder
    - Create types for Customer, LoyaltyTransaction, Feedback, User
    - Create types for AuditLog, CashDrawerSession, DiscountCode, Expense
    - Create types for Device, SyncQueueEntry, and sync protocol messages
    - _Requirements: All requirements depend on these types_

  - [ ] 1.4 Set up Redis for caching, session management, and Bull queue processing
    - Install Redis client and Bull queue library
    - Configure Redis connection with cluster mode support
    - Create job queue instances for WhatsApp, inventory deduction, payment reconciliation, backups
    - Implement job processors with retry logic and exponential backoff
    - _Requirements: Infrastructure for async operations_

  - [ ] 1.5 Implement authentication and authorization middleware
    - Create JWT-based authentication for API requests
    - Implement PIN-based authentication for tablet devices
    - Create role-based permission checking middleware
    - Define ROLE_PERMISSIONS constant with admin, manager, cashier, server, kitchen roles
    - Implement session timeout logic (30 minutes)
    - _Requirements: 3.1, 21.7, 26.1, 26.2, 26.3, 26.4_

  - [ ] 1.6 Set up AWS S3 for backup storage and CloudFront for asset delivery
    - Configure S3 bucket with lifecycle policies (30 days retention, then Glacier)
    - Set up CloudFront distribution for menu images
    - Implement file upload utilities with AES-256 encryption
    - _Requirements: 27.3, 27.4, 27.5_

- [ ] 2. Implement tenant management and provisioning
  - [ ] 2.1 Create tenant registration and schema provisioning API
    - POST /api/tenants endpoint for creating new tenants
    - Automatically provision dedicated PostgreSQL schema
    - Create default outlet and admin user for new tenant
    - Generate S3 bucket paths for tenant assets
    - Complete provisioning within 30 seconds
    - _Requirements: 1.4_

  - [ ] 2.2 Implement tenant settings and configuration management
    - Create API endpoints for tenant and outlet settings
    - Support timezone, currency, loyalty rate, service charge, tax rates configuration
    - Implement setting validation and effective date management
    - _Requirements: 30.1, 30.5_

  - [ ]* 2.3 Write property test for tenant data isolation
    - **Property 1: Tenant Data Isolation**
    - **Validates: Requirements 1.2, 1.3, 1.5**
    - Generate random authenticated requests from two different tenants
    - Verify no endpoint returns data from the other tenant
    - Test with various API endpoints (orders, inventory, customers, reports)

- [ ] 3. Implement menu management system
  - [ ] 3.1 Create menu CRUD API endpoints
    - POST /api/menu/categories - Create menu category
    - POST /api/menu/items - Create menu item with modifiers
    - PATCH /api/menu/items/:id - Update item price, availability, modifiers
    - PATCH /api/menu/items/:id/availability - Toggle availability
    - GET /api/menu - Get complete menu with categories and items
    - Support scheduling menu changes with effective dates
    - Tag items with dietary attributes (vegetarian, vegan, gluten-free, spicy, allergens)
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.6, 24.7_

  - [ ] 3.2 Implement real-time menu synchronization via Socket.IO
    - Broadcast menu updates to all connected devices within 10 seconds
    - Emit events: menu:item:updated, menu:item:availability
    - Filter broadcasts by tenant and outlet
    - _Requirements: 24.5_

- [ ] 4. Implement POS order management
  - [ ] 4.1 Create order creation and calculation API
    - POST /api/pos/orders - Create new order
    - Implement order calculation: subtotal, tax (CGST/SGST), service charge, discounts, total
    - PATCH /api/pos/orders/:id/items - Add/remove items with modifiers
    - Support special instructions per order item
    - Generate sequential order numbers (OUT1-2024-00123 format)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write property test for order calculation correctness
    - **Property 2: Order Calculation Correctness**
    - **Validates: Requirements 2.3**
    - Generate orders with random items, modifiers, tax rates, service charges, discounts
    - Verify total = (sum of prices + service charge) × (1 + tax) - discount
    - Verify subtotal + tax + service charge - discount = total


  - [ ]* 4.3 Write property test for GST compliance
    - **Property 4: GST Compliance**
    - **Validates: Requirements 2.6, 30.2, 30.6**
    - Generate orders with GST-applicable items
    - Verify CGST = SGST = (rate / 2) × taxable_amount
    - Verify CGST + SGST = total GST
    - Verify GSTIN appears on bills and invoices

  - [ ] 4.4 Implement KOT generation and printing
    - POST /api/pos/orders/:id/kot - Generate KOT document
    - Include table number, items, quantities, modifiers, special instructions, timestamp
    - Route KOT to correct kitchen station based on menu item station_id
    - Mark items as kot_printed with timestamp
    - _Requirements: 2.4, 2.5_

  - [ ]* 4.5 Write property test for KOT document completeness
    - **Property 3: KOT Document Completeness**
    - **Validates: Requirements 2.4, 2.5**
    - Generate orders with random items, modifiers, instructions
    - Verify KOT includes all required fields: table, items, quantities, modifiers, instructions, timestamp

  - [ ] 4.6 Implement order state machine and status transitions
    - Implement states: draft → submitted → preparing → ready → served → settled
    - Implement void and refund states with manager approval
    - PATCH /api/pos/orders/:id/status - Update order status
    - Emit Socket.IO events for status changes
    - _Requirements: Order lifecycle management_

  - [ ] 4.7 Implement payment processing and settlement
    - POST /api/pos/orders/:id/settle - Process payment
    - Support payment methods: cash, card, UPI, wallet
    - Transition order to settled status and clear table
    - Record payment transaction with payment_method and transaction_id
    - _Requirements: 2.7, 2.8_

  - [ ]* 4.8 Write property test for order state transition
    - **Property 5: Order State Transition**
    - **Validates: Requirements 2.8**
    - Generate orders with completed payments
    - Verify order transitions to 'settled'
    - Verify associated table transitions to 'available'


  - [ ] 4.9 Implement invoice generation with sequential numbering
    - GET /api/pos/invoices/next-number - Get next invoice number with locking
    - Generate gapless sequential invoice numbers per tenant-outlet
    - Include GST breakdown, GSTIN, payment details on invoice
    - _Requirements: 2.9_

  - [ ]* 4.10 Write property test for invoice number sequential integrity
    - **Property 6: Invoice Number Sequential Integrity**
    - **Validates: Requirements 2.9**
    - Generate multiple concurrent settlements
    - Verify invoice numbers are gapless, monotonically increasing, no duplicates

  - [ ] 4.11 Implement order voiding with manager approval
    - POST /api/pos/orders/:id/void - Void order (requires manager approval)
    - Record void reason and manager user_id
    - Create immutable audit log entry
    - Send push notification to managers for approval
    - _Requirements: 21.3, 21.4_

- [ ] 5. Checkpoint - Verify POS order flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement table management
  - [ ] 6.1 Create table CRUD and status management API
    - GET /api/pos/tables - List tables with status
    - PATCH /api/pos/tables/:id/status - Update table status (available, occupied, reserved, cleaning)
    - Support table merging and splitting for large parties
    - Display visual floor plan with table positions
    - Record occupied_at timestamp when table is occupied
    - Calculate table turnover time
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.7_

  - [ ] 6.2 Implement reservation management
    - POST /api/pos/reservations - Create reservation
    - GET /api/pos/reservations - List reservations with filtering
    - PATCH /api/pos/reservations/:id/status - Update status (confirmed, seated, cancelled, no-show)
    - Send push notification reminder when reservation time arrives
    - _Requirements: 23.5, 23.6_

  - [ ] 6.3 Implement real-time table synchronization
    - Broadcast table status changes via Socket.IO to all devices
    - Synchronize within 500ms across devices
    - Scope Socket.IO rooms by tenant and outlet
    - Emit events: table:status:updated, table:occupied, table:available
    - _Requirements: 20.2_

- [ ] 7. Implement Kitchen Display System (KDS)
  - [ ] 7.1 Create KDS order display API
    - GET /api/kds/orders - List active orders for kitchen station
    - Filter orders by station based on menu item station_id
    - PATCH /api/kds/orders/:id/items/:itemId - Mark item complete
    - POST /api/kds/orders/:id/ready - Mark entire order ready
    - Calculate elapsed time and color-code orders (green < 5min, yellow 5-10min, red > 10min)
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 7.2 Implement KDS real-time order routing via WebSocket
    - Broadcast new orders to KDS stations via Socket.IO
    - Emit events: order:new, order:update, order:priority
    - Emit audio alerts for new orders
    - Highlight rush/priority orders
    - _Requirements: 3.4, 4.5, 4.6_

  - [ ] 7.3 Implement KDS station configuration
    - GET /api/kds/stations - List configured kitchen stations
    - POST /api/kds/stations - Create station (grill, fryer, cold station, etc.)
    - Assign menu items to stations via station_id
    - _Requirements: 4.3_

- [ ] 8. Implement inventory management
  - [ ] 8.1 Create inventory item CRUD API
    - POST /api/inventory/items - Create inventory item
    - GET /api/inventory/items - List inventory items with filtering
    - PATCH /api/inventory/items/:id/adjust - Adjust stock (requires manager approval)
    - Support categories: vegetables, meats, dairy, dry-goods
    - Track unit_of_measure: kg, liter, piece, etc.
    - Implement optimistic locking with version field
    - _Requirements: 8.1, 8.5_

  - [ ] 8.2 Implement stock transaction audit trail
    - POST /api/inventory/transactions - Record stock transaction
    - Record transaction types: purchase, adjustment, deduction, transfer, waste
    - Store quantity_before, quantity_after, cost_per_unit, reason, reference
    - Require manager approval for adjustments
    - Create immutable audit log entries
    - _Requirements: 8.4, 8.5_

  - [ ] 8.3 Implement recipe management and automatic deduction
    - POST /api/inventory/recipes - Create recipe specification
    - GET /api/inventory/recipes - List recipes with ingredients
    - Validate all ingredients exist in inventory when saving recipe
    - Support recipe versioning with effective dates
    - Implement automatic inventory deduction when order is settled
    - Use Bull job queue for async deduction processing
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.4 Write property test for recipe-based inventory deduction
    - **Property 8: Recipe-Based Inventory Deduction**
    - **Validates: Requirements 8.2, 8.4**
    - Generate orders with menu items that have recipes
    - Verify ingredient quantities deducted = recipe quantity × order quantity
    - Verify stock transactions created with order reference

  - [ ] 8.5 Implement stock alert system
    - Monitor inventory levels against minimum_threshold
    - Emit alert when quantity falls below threshold
    - Send push notifications to managers
    - _Requirements: 8.3_

  - [ ]* 8.6 Write property test for stock alert threshold
    - **Property 9: Stock Alert Threshold**
    - **Validates: Requirements 8.3**
    - Generate transactions that reduce stock below threshold
    - Verify alert is emitted when threshold crossed

  - [ ] 8.7 Implement weighted average cost calculation
    - Calculate WAC when goods are received: (prev_qty × prev_WAC + new_qty × new_cost) / (prev_qty + new_qty)
    - Update inventory item with new WAC and quantity
    - Calculate current stock value for reporting
    - _Requirements: 8.6, 8.7_


  - [ ]* 8.8 Write property test for weighted average cost calculation
    - **Property 10: Weighted Average Cost Calculation**
    - **Validates: Requirements 8.6, 8.7**
    - Generate goods receipt transactions with various quantities and costs
    - Verify new WAC = (prev_qty × prev_WAC + Q × C) / (prev_qty + Q)
    - Verify new quantity = prev_qty + Q

- [ ] 9. Implement vendor and purchase order management
  - [ ] 9.1 Create vendor management API
    - POST /api/inventory/vendors - Create vendor
    - GET /api/inventory/vendors - List vendors
    - Store contact person, phone, email, address, payment terms, GSTIN
    - _Requirements: 10.1_

  - [ ] 9.2 Create purchase order management API
    - POST /api/inventory/purchase-orders - Create PO with line items
    - Generate sequential PO numbers (PO-2024-00045)
    - Track status: draft, sent, received, cancelled
    - POST /api/inventory/purchase-orders/:id/receive - Receive goods
    - Update stock levels and WAC when goods received
    - Calculate vendor payment amounts
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 10. Checkpoint - Verify inventory flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Customer Relationship Management (CRM)
  - [ ] 11.1 Create customer profile management API
    - POST /api/crm/customers - Create customer profile
    - GET /api/crm/customers - List customers with filtering
    - GET /api/crm/customers/:id - Get customer details with order history
    - Use phone number as primary identifier (unique per tenant)
    - Detect duplicates and suggest merging
    - Track lifetime_value, order_count, last_order_date
    - Support customer tags for preferences (prefers-spicy, gluten-free, etc.)
    - _Requirements: 11.1, 11.2, 11.3, 11.6_

  - [ ] 11.2 Implement customer segmentation
    - GET /api/crm/segments - List customer segments
    - Segment by spend level, visit frequency, preferences
    - Support filtering for marketing campaigns
    - _Requirements: 11.4, 11.5_

  - [ ] 11.3 Implement loyalty program
    - POST /api/crm/loyalty/award - Award loyalty points after order settlement
    - Calculate points: ⌊order_amount × loyalty_rate⌋
    - POST /api/crm/loyalty/redeem - Redeem points for discount
    - Validate redemption amount ≤ available balance
    - Create loyalty transaction records with balance_before, balance_after
    - _Requirements: 12.1, 12.4, 12.5, 12.6_

  - [ ]* 11.4 Write property test for loyalty points accumulation
    - **Property 11: Loyalty Points Accumulation**
    - **Validates: Requirements 12.1, 12.6**
    - Generate orders with various amounts and loyalty rates
    - Verify points earned = ⌊amount × rate⌋
    - Verify loyalty transaction created with correct balances and order reference

  - [ ] 11.5 Implement loyalty tier management
    - Assign tiers: Bronze (0), Silver (1000), Gold (5000), Platinum (10000)
    - Auto-upgrade tier when points reach threshold
    - Track tier history
    - _Requirements: 12.2, 12.3_

  - [ ]* 11.6 Write property test for loyalty tier assignment
    - **Property 12: Loyalty Tier Assignment**
    - **Validates: Requirements 12.2, 12.3**
    - Generate customers with various point balances
    - Verify tier assignment: Bronze < 1000, Silver 1000-4999, Gold 5000-9999, Platinum ≥ 10000

  - [ ]* 11.7 Write property test for loyalty points redemption validation
    - **Property 13: Loyalty Points Redemption Validation**
    - **Validates: Requirements 12.4, 12.5, 12.6**
    - Generate redemption requests with various amounts
    - Verify redemption succeeds when R ≤ B, balance updated to B - R
    - Verify redemption fails when R > B, balance unchanged


- [ ] 12. Implement feedback system
  - [ ] 12.1 Create feedback collection API
    - POST /api/crm/feedback - Submit feedback
    - Collect 5-star ratings: food_quality, service_speed, overall
    - Collect optional text comments
    - Associate with order and customer
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 12.2 Implement feedback alerts and responses
    - Send push notification to managers when rating < 3 stars
    - POST /api/crm/feedback/:id/respond - Manager response
    - PATCH /api/crm/feedback/:id/status - Mark as acknowledged or resolved
    - Display average ratings and trends in analytics
    - _Requirements: 17.4, 17.5, 17.6_

- [ ] 13. Implement discount and promotion management
  - [ ] 13.1 Create discount code management API
    - POST /api/pos/discounts - Create discount code
    - Support types: percentage, fixed amount
    - Configure rules: min_order_value, max_discount, applicable_items, date range
    - Track usage_count against usage_limit
    - Support outlet-specific and chain-wide promotions
    - _Requirements: 29.1, 29.2, 29.6_

  - [ ] 13.2 Implement discount validation and application
    - POST /api/pos/orders/:id/apply-discount - Apply discount code
    - Validate code against rules, date range, usage limits
    - Prevent stacking unless explicitly allowed
    - Display discount amount on bills
    - Create audit log for discount application over 20%
    - _Requirements: 29.3, 29.4, 29.5, 29.7_

  - [ ]* 13.3 Write unit tests for discount validation logic
    - Test minimum order value enforcement
    - Test date range validation
    - Test usage limit enforcement
    - Test applicable items filtering

- [ ] 14. Implement cash drawer monitoring
  - [ ] 14.1 Create cash drawer session management API
    - POST /api/pos/cash-drawer/open - Open drawer with opening amount
    - POST /api/pos/cash-drawer/close - Close drawer with cash count
    - Track expected_closing_amount based on cash transactions
    - Calculate variance: actual - expected
    - Require manager verification when variance exists
    - Prevent cash payments when drawer not open
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.6_

  - [ ] 14.2 Implement cash reconciliation reporting
    - GET /api/accounting/reconcile/cash - Cash reconciliation report
    - Show variances by user and shift
    - Create variance records for audit trail
    - _Requirements: 15.6, 22.5_

- [ ] 15. Implement accounting system
  - [ ] 15.1 Create expense tracking API
    - POST /api/accounting/expenses - Record expense
    - Categorize: food_cost, labor, rent, utilities, marketing, other
    - Store amount, payment_method, vendor_name, description, receipt_url, expense_date
    - _Requirements: 15.1, 15.2_

  - [ ] 15.2 Implement automatic revenue recording
    - Create journal entries when orders are settled
    - Categorize revenue by stream: dine-in, delivery, online, aggregator
    - Record GST collected amounts
    - _Requirements: 15.7_

  - [ ] 15.3 Implement financial reporting
    - GET /api/accounting/reports/pl - Profit & Loss statement
    - GET /api/accounting/reports/gst - GST report in GSTR-1 format
    - Calculate GST collected and payable
    - POST /api/accounting/export/tally - Export to Tally format
    - _Requirements: 15.3, 15.4, 15.5_

  - [ ]* 15.4 Write property test for service charge calculation
    - **Property 17: Service Charge Line Item Separation**
    - **Validates: Requirements 30.4**
    - Generate orders with various service charge percentages
    - Verify service_charge = subtotal × S as separate line item
    - Verify service charge included in taxable amount for GST

  - [ ]* 15.5 Write property test for tax rate effective dating
    - **Property 18: Tax Rate Effective Dating**
    - **Validates: Requirements 30.5**
    - Create orders with various timestamps and menu categories
    - Create tax rates with different effective dates
    - Verify correct rate applied based on order timestamp

- [ ] 16. Implement analytics and reporting
  - [ ] 16.1 Create real-time dashboard API
    - GET /api/analytics/dashboard - Real-time metrics
    - Display daily revenue, order count, average order value
    - Update every 60 seconds
    - Query from read replicas to avoid transactional workload impact
    - _Requirements: 13.1, 13.6_

  - [ ] 16.2 Implement business reports
    - GET /api/analytics/reports/sales - Sales report with date range filtering
    - GET /api/analytics/reports/menu-performance - Menu item performance
    - GET /api/analytics/reports/exceptions - Exception report (voids, discounts, refunds)
    - Support outlet comparison and filtering
    - _Requirements: 13.2, 13.3_

  - [ ] 16.3 Implement report export functionality
    - POST /api/analytics/reports/export - Export to PDF/Excel
    - Queue large exports as Bull jobs
    - _Requirements: 13.4_

  - [ ] 16.4 Implement KPI calculations
    - Calculate food cost % = (ingredient cost / revenue) × 100
    - Calculate labor cost % = (labor cost / revenue) × 100
    - Calculate table turnover = orders per table per day
    - _Requirements: 13.5_

- [ ] 17. Implement multi-outlet management
  - [ ] 17.1 Create outlet management API
    - POST /api/outlets - Create new outlet for tenant
    - GET /api/outlets - List all outlets for tenant
    - PATCH /api/outlets/:id/settings - Update outlet-specific settings
    - _Requirements: 16.1_

  - [ ] 17.2 Implement consolidated reporting across outlets
    - GET /api/analytics/dashboard?outlets=all - Consolidated dashboard
    - Support filtering by individual outlet or groups
    - Aggregate metrics across outlets
    - _Requirements: 16.2, 16.3_

  - [ ] 17.3 Implement inter-outlet stock transfer
    - POST /api/inventory/transfers - Create stock transfer between outlets
    - Require manager approval workflow
    - Update inventory at both source and destination outlets
    - _Requirements: 16.4_

  - [ ] 17.4 Implement central menu management with outlet overrides
    - Support tenant-level menu with outlet-specific pricing/availability
    - Allow outlet to override item prices and availability
    - _Requirements: 16.5_

  - [ ] 17.5 Implement unified customer profiles across outlets
    - Merge customer data across outlets within same tenant
    - Track customer visits at different outlets
    - Calculate lifetime value across all outlets
    - _Requirements: 16.6_

- [ ] 18. Checkpoint - Verify backend services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Implement notification system
  - [ ] 19.1 Set up Firebase Cloud Messaging for push notifications
    - Configure FCM credentials and device token management
    - Create notification sending utility
    - Support notification delivery to specific user roles
    - _Requirements: 18.1, 18.6_

  - [ ] 19.2 Implement notification triggers and preferences
    - Trigger notifications for: low stock, negative feedback, failed payments, manager approvals
    - POST /api/notifications/preferences - Configure user notification preferences per event type
    - _Requirements: 18.4, 18.5_

  - [ ] 19.3 Set up SMTP integration for email alerts
    - Configure email service with templates
    - Send alerts for critical events
    - _Requirements: 18.2_

- [ ] 20. Implement WhatsApp messaging service
  - [ ] 20.1 Set up Twilio WhatsApp Business API integration
    - Configure Twilio credentials and phone number
    - Implement message sending utility with rate limiting (80 msg/sec)
    - _Requirements: 14.1_

  - [ ] 20.2 Implement transactional messaging
    - Send order confirmation after order creation
    - Send order ready notification when KDS marks order ready
    - Send payment receipt after settlement
    - No opt-out required for transactional messages
    - _Requirements: 6.6, 14.2, 28.5_

  - [ ] 20.3 Implement marketing campaign management
    - POST /api/whatsapp/campaigns - Create broadcast campaign
    - GET /api/whatsapp/campaigns/:id/status - Track delivery status
    - POST /api/whatsapp/opt-out - Handle customer opt-out
    - Respect opt-out preferences and rate limits
    - Queue messages using Bull with exponential backoff retry (1s, 5s, 30s, 5m)
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7_

  - [ ] 20.4 Implement feedback request via WhatsApp
    - Send feedback request after order completion
    - Include link to feedback form
    - _Requirements: 17.1_

- [ ] 21. Implement payment gateway integrations
  - [ ] 21.1 Integrate Razorpay payment gateway
    - Configure Razorpay credentials and webhook endpoints
    - POST /api/payments/razorpay/intent - Create payment intent
    - POST /api/payments/razorpay/webhook - Handle payment confirmation webhook
    - Verify webhook signatures
    - Update order status on successful payment
    - _Requirements: 25.1, 25.3, 25.4_

  - [ ] 21.2 Integrate Stripe payment gateway
    - Configure Stripe credentials and webhook endpoints
    - POST /api/payments/stripe/intent - Create payment intent
    - POST /api/payments/stripe/webhook - Handle payment events
    - Verify webhook signatures
    - _Requirements: 25.2, 25.3, 25.4_

  - [ ] 21.3 Implement payment failure handling and refunds
    - Mark order as payment_pending when payment fails
    - Send notification to customer
    - POST /api/payments/:id/refund - Process refund through gateway API
    - Store transaction IDs and gateway response codes
    - Never store card numbers (PCI-DSS compliance)
    - _Requirements: 25.5, 25.6, 25.7, 25.8_

  - [ ]* 21.4 Write integration tests for payment flows
    - Test payment intent creation
    - Test webhook processing with mock payloads
    - Test refund processing
    - Test payment failure handling

- [ ] 22. Implement aggregator integration hub
  - [ ] 22.1 Create webhook handlers for third-party platforms
    - POST /api/aggregator/webhook/zomato - Zomato webhook handler
    - POST /api/aggregator/webhook/swiggy - Swiggy webhook handler
    - POST /api/aggregator/webhook/talabat - Talabat webhook handler
    - POST /api/aggregator/webhook/deliveroo - Deliveroo webhook handler
    - Verify HMAC signatures (platform-specific algorithms)
    - _Requirements: 7.1, 7.6_

  - [ ] 22.2 Implement order transformation from aggregator formats
    - Parse Zomato order format to internal schema
    - Parse Swiggy order format to internal schema
    - Parse Talabat order format to internal schema
    - Parse Deliveroo order format to internal schema
    - Inject orders into POS with source: 'aggregator' metadata
    - Label orders with aggregator_source
    - _Requirements: 7.2, 7.3_

  - [ ] 22.3 Implement status synchronization to aggregators
    - POST /api/aggregator/orders/:id/status - Update external order status
    - Push status changes from POS to aggregator platforms
    - _Requirements: 7.4_

  - [ ] 22.4 Implement payment reconciliation
    - GET /api/aggregator/reconciliation - Payment reconciliation report
    - Compare aggregator payments with internal records
    - Flag discrepancies for review
    - _Requirements: 7.5_

  - [ ]* 22.5 Write integration tests for aggregator webhooks
    - Test webhook parsing for each platform
    - Test signature verification
    - Test order transformation and creation

- [ ] 23. Implement audit logging and security
  - [ ] 23.1 Create immutable audit log system
    - Record all sensitive operations: void orders, apply discounts, adjust inventory
    - Store user_id, timestamp, action, entity_type, entity_id, before_state, after_state
    - Prevent deletion or modification of audit logs
    - Record IP address and device_id
    - _Requirements: 21.1, 21.2_

  - [ ] 23.2 Implement manager approval workflow
    - Require manager approval for: voiding orders, discounts > 20%, inventory adjustments
    - Send push notifications to all managers when approval requested
    - POST /api/approvals/:id/approve - Manager approval endpoint
    - _Requirements: 21.3, 21.4_

  - [ ] 23.3 Implement exception reporting
    - GET /api/analytics/reports/exceptions - Generate exception report
    - Highlight suspicious patterns: excessive voids, discounts, refunds
    - Alert when anomalies detected
    - _Requirements: 21.6_

  - [ ] 23.4 Implement cash drawer opening audit
    - Log all cash drawer openings with user and reason
    - Track non-transaction drawer opens
    - _Requirements: 21.5_

- [ ] 24. Implement user management
  - [ ] 24.1 Create user management API
    - POST /api/users - Create user with username, password, role
    - PATCH /api/users/:id - Update user details
    - PATCH /api/users/:id/role - Assign role
    - Assign outlet-level permissions for multi-outlet tenants
    - Enforce unique usernames per tenant
    - Enforce password complexity rules
    - _Requirements: 26.1, 26.5, 26.6_

  - [ ] 24.2 Implement role-based access control enforcement
    - Check permissions before executing operations
    - Prevent access to unauthorized features based on role
    - Load user role and permissions on authentication
    - _Requirements: 26.2, 26.3, 26.4_

  - [ ]* 24.3 Write integration tests for RBAC
    - Test permission enforcement for each role
    - Test unauthorized access attempts are blocked
    - Test outlet-level access restrictions

- [ ] 25. Implement data export and backup
  - [ ] 25.1 Create data export API
    - POST /api/export - Generate full data export in JSON format
    - Support date range filtering
    - Export orders, customers, inventory, financial records
    - Comply with GDPR data portability requirements
    - _Requirements: 27.1, 27.2, 27.6_

  - [ ] 25.2 Implement automated backup system
    - Schedule daily automated backups to S3
    - Encrypt backups with AES-256
    - Implement backup retention: 30 days daily, 1 year monthly
    - Queue backup generation as Bull job
    - _Requirements: 27.3, 27.4, 27.5_

  - [ ]* 25.3 Write integration tests for backup system
    - Test backup file generation
    - Test encryption
    - Test S3 upload
    - Test backup restoration

- [ ] 26. Checkpoint - Verify backend integrations
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Implement offline-first capabilities for POS
  - [ ] 27.1 Set up IndexedDB storage with Dexie.js
    - Define IndexedDB schema for menu, tables, orders, sync queue
    - Implement CRUD operations using Dexie
    - Cache menu data, table status, pending orders
    - _Requirements: 19.1_

  - [ ] 27.2 Implement offline mode detection and visual indicators
    - Detect network connectivity loss
    - Enter offline mode automatically
    - Display visual banner: "You are offline - orders will sync when reconnected"
    - Show connection status icon in navigation
    - _Requirements: 19.2, 19.6_

  - [ ] 27.3 Implement offline operations for POS
    - Allow creating orders in offline mode, store in IndexedDB
    - Allow generating KOTs locally
    - Allow processing cash payments offline
    - Block operations requiring server: online payments, report generation
    - _Requirements: 19.3_

  - [ ]* 27.4 Write property test for offline operations resilience
    - **Property 14: Offline Operations Resilience**
    - **Validates: Requirements 19.3**
    - Generate sequences of offline operations (orders, KOTs, cash payments)
    - Verify all operations succeed without server connectivity
    - Verify operations stored locally in IndexedDB


- [ ] 28. Implement sync engine for multi-device synchronization
  - [ ] 28.1 Create sync queue in IndexedDB
    - Define SyncQueueEntry schema with operation_id, type, entity, data, timestamp, vector_clock
    - Track create/update/delete operations with timestamps
    - _Requirements: Sync infrastructure_

  - [ ] 28.2 Implement vector clock management
    - Maintain per-device vector clock: { [device_id]: counter }
    - Increment local device counter on each operation
    - Include vector clock with all operations
    - _Requirements: Conflict detection foundation_

  - [ ] 28.3 Implement sync protocol client-side
    - POST /api/sync - Send pending operations with vector clocks
    - Receive server response with accepted ops, conflicts, delta
    - Update local state with delta changes
    - Handle conflicts based on server resolution
    - _Requirements: 3.6, 19.4_

  - [ ] 28.4 Implement sync protocol server-side
    - Receive sync request with pending operations
    - Validate and apply operations to database
    - Detect conflicts using vector clock comparison
    - Generate delta based on last_sync_timestamp
    - Return accepted ops, conflicts, and delta
    - _Requirements: 19.4_

  - [ ] 28.5 Implement conflict resolution strategies
    - Orders: Last-write-wins based on vector clock
    - Table status: Most recent valid session wins
    - Inventory: Reject and require manual resolution
    - _Requirements: 19.5, 20.5_

  - [ ]* 28.6 Write property test for offline sync data preservation
    - **Property 7: Offline Sync Data Preservation**
    - **Validates: Requirements 3.5, 3.6, 19.4, 19.7**
    - Generate sequence of offline operations with timestamps and user attribution
    - Simulate reconnection and sync
    - Verify all operations uploaded with original data preserved


  - [ ]* 28.7 Write property test for sync conflict resolution
    - **Property 15: Sync Conflict Resolution**
    - **Validates: Requirements 19.5, 20.5**
    - Generate concurrent modifications to same table on multiple devices
    - Simulate offline edits and reconnection
    - Verify conflict resolution using vector clocks, most recent valid session wins

  - [ ] 28.8 Implement delta sync for reconnection
    - Query changes since last_sync_timestamp
    - Return only changed records to minimize bandwidth
    - Update client state to converge with server
    - _Requirements: 20.4_

  - [ ]* 28.9 Write property test for delta sync completeness
    - **Property 16: Delta Sync Completeness**
    - **Validates: Requirements 20.4**
    - Simulate device disconnection at T1, changes on other devices, reconnection at T2
    - Verify delta sync delivers all updates between T1 and T2
    - Verify device state converges to server state

- [ ] 29. Implement real-time synchronization with Socket.IO
  - [ ] 29.1 Set up Socket.IO server with room-based broadcasting
    - Configure Socket.IO with WebSocket and long-polling fallback
    - Create rooms scoped by tenant and outlet: tenant_{tenantId}_outlet_{outletId}
    - Authenticate Socket.IO connections with JWT
    - _Requirements: Real-time infrastructure_

  - [ ] 29.2 Implement order broadcast to all devices
    - Emit order:created event when new order created
    - Emit order:updated event when order status changes
    - Broadcast to all connected devices in same tenant-outlet
    - Update UI optimistically on all clients
    - _Requirements: 20.1_

  - [ ] 29.3 Implement table status synchronization
    - Emit table:status:updated event when table status changes
    - Synchronize within 500ms across devices
    - _Requirements: 20.2, 20.3_

  - [ ] 29.4 Implement optimistic locking for concurrent edits
    - Use version field for optimistic locking on inventory
    - Return conflict error with current state when version mismatch
    - Require client retry with fresh data
    - _Requirements: 20.5_

  - [ ]* 29.5 Write integration tests for Socket.IO synchronization
    - Test order broadcast to multiple clients
    - Test table status sync latency
    - Test room-based message isolation (no cross-tenant leakage)

- [ ] 30. Implement Captain App offline capabilities
  - [ ] 30.1 Set up IndexedDB for Captain App
    - Cache menu data for offline access
    - Store pending orders in sync queue
    - Track assigned tables
    - _Requirements: 3.3, 3.5_

  - [ ] 30.2 Implement Captain App authentication with PIN
    - POST /api/captain/auth/pin - Authenticate with PIN code
    - Generate JWT token for tablet session
    - _Requirements: 3.1_

  - [ ] 30.3 Implement Captain App order creation with offline support
    - GET /api/captain/tables/assigned - Get assigned tables
    - POST /api/captain/orders - Create order with offline sync support
    - POST /api/captain/sync - Batch sync offline orders on reconnection
    - GET /api/captain/menu - Get menu for offline caching
    - Send orders to kitchen via Socket.IO
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 31. Checkpoint - Verify offline and real-time features
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 32. Build POS Terminal React application
  - [ ] 32.1 Create POS UI components
    - Build table selection view with floor plan
    - Build menu browsing with categories and items
    - Build cart with item modifiers and special instructions
    - Build payment processing screen
    - Build invoice display and printing

    - Build cash drawer management screen
    - Display offline mode indicator
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 19.6, 22.1_

  - [ ] 32.2 Integrate POS UI with backend APIs
    - Connect table management to API
    - Connect order creation and item management to API
    - Connect payment settlement to API
    - Connect KOT generation to API
    - Handle API errors with user-friendly messages
    - _Requirements: POS integration_

  - [ ] 32.3 Implement POS offline mode with IndexedDB
    - Set up Dexie.js for local storage
    - Cache menu and tables locally
    - Queue operations when offline
    - Sync on reconnection
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [ ] 32.4 Integrate POS with Socket.IO for real-time updates
    - Connect to Socket.IO server with JWT authentication
    - Listen for order and table status updates
    - Update UI in real-time when events received
    - _Requirements: 20.1, 20.2_

  - [ ]* 32.5 Write UI component tests for POS
    - Test table selection interaction
    - Test cart item management
    - Test payment flow
    - Test offline mode banner display

- [ ] 33. Build Kitchen Display System (KDS) React application
  - [ ] 33.1 Create KDS UI components
    - Build order card component with color-coding by elapsed time
    - Build station filter selector
    - Build item completion checkboxes
    - Build audio alert system
    - Display rush/priority order indicators
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [ ] 33.2 Integrate KDS with backend APIs and Socket.IO
    - GET active orders for station
    - Mark items complete via API
    - Mark orders ready via API
    - Listen for order:new, order:update, order:priority via Socket.IO
    - Play audio alerts on new orders
    - _Requirements: 4.1, 4.4_

  - [ ]* 33.3 Write UI component tests for KDS
    - Test order color-coding logic
    - Test station filtering
    - Test item completion interaction
    - Test audio alert triggering

- [ ] 34. Build Captain App React application
  - [ ] 34.1 Create Captain App UI components
    - Build PIN authentication screen
    - Build assigned tables view
    - Build menu browsing with cart
    - Build order submission screen
    - Display offline sync status
    - _Requirements: 3.1, 3.2_

  - [ ] 34.2 Integrate Captain App with backend APIs
    - Authenticate with PIN
    - Fetch assigned tables
    - Create orders via API
    - Batch sync offline orders
    - Cache menu locally
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [ ] 34.3 Implement Captain App offline capabilities
    - Store orders in IndexedDB when offline
    - Queue operations with timestamps and user attribution
    - Sync on reconnection
    - _Requirements: 3.5, 3.6_

  - [ ]* 34.4 Write UI component tests for Captain App
    - Test PIN authentication
    - Test table selection
    - Test order creation
    - Test offline mode behavior

- [ ] 35. Build QR Menu PWA React application
  - [ ] 35.1 Create QR Menu UI components
    - Build branded menu display with images and descriptions
    - Build cart with modifiers
    - Build order submission form
    - Display order status updates
    - Show dietary tags (vegetarian, vegan, gluten-free, spicy, allergens)
    - _Requirements: 5.1, 5.2_

  - [ ] 35.2 Integrate QR Menu with payment gateway
    - Integrate Razorpay/Stripe payment before order submission
    - Handle payment success/failure callbacks
    - Submit order after successful payment
    - _Requirements: 5.3, 5.6_

  - [ ] 35.3 Implement QR Menu real-time order status
    - Connect to Socket.IO for order updates
    - Display status: submitted, preparing, ready
    - _Requirements: 5.4, 5.5_

  - [ ]* 35.4 Write UI component tests for QR Menu
    - Test menu display
    - Test cart management
    - Test payment flow
    - Test order status updates

- [ ] 36. Build Online Store React application
  - [ ] 36.1 Create Online Store UI components
    - Build branded storefront with logo and colors
    - Build menu display with filtering
    - Build delivery address form with validation
    - Build payment integration screen
    - Display estimated preparation time
    - _Requirements: 6.1, 6.2, 6.7_

  - [ ] 36.2 Implement delivery address validation and fee calculation
    - Validate delivery address
    - Calculate delivery fee based on distance
    - Support pickup order type
    - _Requirements: 6.3_

  - [ ] 36.3 Integrate Online Store with payment gateways
    - Integrate Razorpay for Indian market
    - Integrate Stripe for international market
    - Process payment before order submission
    - _Requirements: 6.4, 25.1, 25.2_

  - [ ] 36.4 Implement Online Store order submission and confirmation
    - Submit order after successful payment
    - Send to POS and KDS with order type label
    - Send confirmation via email and WhatsApp
    - _Requirements: 6.5, 6.6_

  - [ ]* 36.5 Write UI component tests for Online Store
    - Test storefront display
    - Test address validation
    - Test delivery fee calculation
    - Test payment flow
    - Test order confirmation

- [ ] 37. Build Analytics Dashboard React application
  - [ ] 37.1 Create analytics dashboard UI
    - Build real-time metrics display (revenue, orders, AOV)
    - Build date range picker for reports
    - Build report cards for sales, menu performance, exceptions
    - Build export buttons (PDF, Excel)
    - Support outlet filtering and comparison
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 16.2, 16.3_

  - [ ] 37.2 Integrate dashboard with analytics API
    - Fetch real-time metrics every 60 seconds
    - Fetch reports with date range filters
    - Trigger export jobs
    - Display consolidated outlet metrics
    - _Requirements: 13.6, 16.2_

  - [ ] 37.3 Implement KPI visualizations
    - Display food cost %, labor cost %, table turnover
    - Create charts and graphs for trends
    - _Requirements: 13.5_

  - [ ]* 37.4 Write UI component tests for dashboard
    - Test metrics display
    - Test date range filtering
    - Test outlet comparison
    - Test export triggering

- [ ] 38. Implement delivery management features
  - [ ] 38.1 Create delivery driver management API
    - POST /api/delivery/drivers - Create driver profile
    - GET /api/delivery/drivers - List available drivers
    - Calculate driver earnings and tips
    - _Requirements: 28.7_

  - [ ] 38.2 Implement delivery assignment and tracking
    - POST /api/delivery/orders/:id/assign - Assign driver to order
    - PATCH /api/delivery/orders/:id/status - Update delivery status (preparing, out for delivery, delivered)
    - Send push notification to driver with order details
    - Send WhatsApp update to customer on status changes
    - Calculate estimated delivery time based on preparation + distance
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5_

  - [ ] 38.3 Implement delivery tracking map view
    - GET /api/delivery/active - List active deliveries
    - Display deliveries on map with driver locations
    - Update locations in real-time via Socket.IO
    - _Requirements: 28.6_

  - [ ]* 38.4 Write integration tests for delivery management
    - Test driver assignment
    - Test status updates
    - Test notification sending
    - Test estimated time calculation

- [ ] 39. Implement error handling and monitoring
  - [ ] 39.1 Set up Sentry for error tracking
    - Configure Sentry with tenant_id, user_id, request_id context
    - Capture all exceptions with stack traces
    - Set up alert thresholds (error rate > 1%, database exhaustion, payment failures)
    - _Requirements: Error monitoring_

  - [ ] 39.2 Implement error response formatting
    - Return consistent error format: { code, message, field, details }
    - Categorize errors: validation (4xx), infrastructure (5xx), business logic, network
    - _Requirements: Error handling strategy_

  - [ ] 39.3 Implement retry logic and graceful degradation
    - Database failures: Exponential backoff (1s, 2s, 4s, 8s)
    - Redis unavailable: Fallback to database queries
    - S3 failures: Queue for retry
    - External APIs: Queue for retry with exponential backoff
    - WebSocket disconnections: Auto-reconnect with backoff
    - _Requirements: Infrastructure resilience_

  - [ ] 39.4 Implement critical error handling
    - Tenant isolation violation: Log to security audit, alert platform operator
    - Audit log write failure: Halt operation
    - Optimistic lock mismatch: Reject with current state
    - Referential integrity violation: Rollback transaction
    - _Requirements: Data integrity safeguards_

  - [ ]* 39.5 Write tests for error handling
    - Test validation error responses
    - Test retry logic with mock failures
    - Test graceful degradation scenarios

- [ ] 40. Final integration and deployment preparation
  - [ ] 40.1 Set up deployment configuration
    - Create Dockerfiles for backend services
    - Configure AWS ECS Fargate task definitions
    - Set up Application Load Balancer with health checks
    - Configure CloudWatch logging and metrics
    - _Requirements: Deployment architecture_

  - [ ] 40.2 Set up environment configuration management
    - Define environment variables for database, Redis, S3, API keys
    - Create .env templates for development, staging, production
    - Configure secrets management with AWS Secrets Manager
    - _Requirements: Infrastructure security_

  - [ ] 40.3 Set up monitoring and alerting
    - Configure CloudWatch dashboards
    - Set up Datadog APM for distributed tracing
    - Create alert rules for critical metrics
    - Test alert delivery to on-call engineers
    - _Requirements: Operational monitoring_

  - [ ] 40.4 Implement database migration system
    - Set up Prisma migrations for schema changes
    - Create migration scripts for tenant schema provisioning
    - Test migration rollback procedures
    - _Requirements: Database management_

  - [ ] 40.5 Deploy to staging environment and perform smoke tests
    - Deploy all services to staging
    - Verify service health endpoints
    - Test critical user flows end-to-end
    - Verify real-time synchronization
    - Test offline mode and reconnection
    - _Requirements: Deployment validation_

- [ ] 41. Final checkpoint - System validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- **Testing Strategy**: Property-based test tasks (marked with `*`) validate universal correctness properties from the design document. These tests use property-based testing libraries (e.g., fast-check for TypeScript) to generate random inputs and verify properties hold across all cases.

- **Task Dependencies**: Tasks are designed to build incrementally, with each phase depending on the previous one. Backend services are implemented before frontend applications to ensure APIs are available for integration.

- **Implementation Language**: All code is written in **TypeScript** as specified in the design document. Backend uses Node.js/Express, frontend uses React 18.

- **Offline-First Approach**: POS and Captain App prioritize offline functionality using IndexedDB, with sync occurring on reconnection. This architecture ensures restaurant operations continue during network outages.

- **Multi-Tenant Isolation**: Every API endpoint enforces tenant_id filtering at the ORM level to prevent cross-tenant data access. Property test 2.3 validates this isolation.

- **Real-Time Synchronization**: Socket.IO provides sub-second latency for order and table updates across devices within the same tenant-outlet.

- **Checkpoints**: Multiple checkpoints throughout the task list provide natural stopping points to verify functionality before proceeding to the next phase.

- **Optional Tasks**: Tasks marked with `*` are optional and can be skipped for faster MVP delivery. However, property-based tests significantly improve correctness guarantees.


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.6"] },
    { "id": 1, "tasks": ["1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "23.1"] },
    { "id": 3, "tasks": ["3.2", "4.1", "6.1", "8.1", "24.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "6.2", "8.2", "9.1", "11.1", "13.1", "14.1", "15.1", "17.1", "19.1", "21.1", "21.2", "22.1", "24.2", "25.1"] },
    { "id": 5, "tasks": ["4.5", "4.6", "4.7", "6.3", "7.1", "8.3", "8.5", "9.2", "11.2", "11.3", "12.1", "13.2", "14.2", "15.2", "17.2", "19.2", "19.3", "20.1", "21.3", "22.2", "23.2", "24.3", "25.2"] },
    { "id": 6, "tasks": ["4.8", "4.9", "7.2", "7.3", "8.4", "8.6", "8.7", "11.4", "11.5", "12.2", "13.3", "15.3", "17.3", "20.2", "21.4", "22.3", "23.3", "25.3"] },
    { "id": 7, "tasks": ["4.10", "8.8", "11.6", "11.7", "15.4", "15.5", "16.1", "17.4", "20.3", "22.4", "23.4", "27.1"] },
    { "id": 8, "tasks": ["4.11", "16.2", "17.5", "20.4", "22.5", "27.2", "28.1", "29.1", "30.1", "38.1", "39.1"] },
    { "id": 9, "tasks": ["16.3", "16.4", "27.3", "28.2", "28.3", "29.2", "30.2", "38.2", "39.2"] },
    { "id": 10, "tasks": ["27.4", "28.4", "28.5", "28.6", "29.3", "30.3", "38.3", "39.3"] },
    { "id": 11, "tasks": ["28.7", "28.8", "28.9", "29.4", "29.5", "38.4", "39.4", "39.5"] },
    { "id": 12, "tasks": ["32.1", "33.1", "34.1", "35.1", "36.1", "37.1"] },
    { "id": 13, "tasks": ["32.2", "32.3", "33.2", "34.2", "35.2", "36.2", "36.3", "37.2"] },
    { "id": 14, "tasks": ["32.4", "32.5", "33.3", "34.3", "35.3", "36.4", "37.3"] },
    { "id": 15, "tasks": ["34.4", "35.4", "36.5", "37.4", "40.1", "40.2"] },
    { "id": 16, "tasks": ["40.3", "40.4"] },
    { "id": 17, "tasks": ["40.5"] }
  ]
}
```
