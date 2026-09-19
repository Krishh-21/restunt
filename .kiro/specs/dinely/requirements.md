# Requirements Document - Dinely Restaurant Operating System

## Introduction

Dinely is a comprehensive multi-tenant SaaS platform designed for restaurant businesses. The system provides end-to-end management of restaurant operations including point-of-sale, kitchen operations, inventory management, customer relationship management, online ordering, third-party aggregator integration, analytics, marketing, and accounting. The platform supports multi-outlet operations with centralized management, offline capabilities, and enterprise-grade security.

## Glossary

- **Dinely_Platform**: The complete multi-tenant SaaS system
- **POS_System**: Point of Sale system for in-restaurant order management
- **KDS**: Kitchen Display System for managing cooking orders
- **Captain_App**: Mobile application for table-side ordering on tablets
- **QR_Menu**: Customer-facing digital menu accessed via QR codes
- **Online_Store**: Branded e-commerce website for delivery and takeaway orders
- **Aggregator_Hub**: Integration module for third-party delivery platforms
- **Inventory_Manager**: Stock and recipe management system
- **CRM_Engine**: Customer relationship and loyalty management system
- **Analytics_Engine**: Reporting and business intelligence module
- **WhatsApp_Module**: Marketing and transactional messaging system
- **Accounting_Module**: Financial tracking and reporting system
- **Tenant**: A restaurant business customer using the platform
- **Outlet**: A physical restaurant location within a tenant account
- **KOT**: Kitchen Order Ticket - instruction slip for kitchen staff
- **GST**: Goods and Services Tax - Indian tax compliance requirement
- **Offline_Mode**: Local-first operation using IndexedDB for network resilience
- **Multi_Tenant_DB**: PostgreSQL database with schema-per-tenant architecture
- **Manager_Role**: User role with elevated approval privileges
- **Audit_Log**: Immutable record of sensitive system operations
- **Cash_Drawer**: Physical money storage unit monitored by the system
- **Bill_Settlement**: Process of collecting payment and closing an order
- **Stock_Transaction**: Any operation that changes inventory quantities
- **Recipe_Specification**: Ingredient list and quantities for menu items
- **Purchase_Order**: Document requesting goods from a vendor
- **Loyalty_Points**: Reward currency earned by customers
- **Customer_Tier**: Classification level in the loyalty program
- **Push_Notification**: Real-time alert sent to mobile devices via FCM
- **Sync_Engine**: Background process for multi-device data synchronization

## Requirements

### Requirement 1: Multi-Tenant Architecture

**User Story:** As a platform operator, I want secure tenant isolation, so that each restaurant's data remains private and protected.

#### Acceptance Criteria

1. THE Multi_Tenant_DB SHALL create a separate database schema for each Tenant
2. WHEN a user authenticates, THE Dinely_Platform SHALL enforce tenant-level access control
3. THE Dinely_Platform SHALL prevent cross-tenant data access in all API endpoints
4. WHEN a new Tenant registers, THE Dinely_Platform SHALL provision database schema, storage buckets, and configuration within 30 seconds
5. FOR ALL database queries, tenant_id filtering SHALL be enforced at the ORM level

### Requirement 2: Point of Sale System

**User Story:** As a restaurant cashier, I want to create orders and process payments, so that I can serve customers efficiently.

#### Acceptance Criteria

1. THE POS_System SHALL display available tables with their current status
2. WHEN a table is selected, THE POS_System SHALL load the menu with categories and items
3. WHEN items are added to cart, THE POS_System SHALL calculate subtotal, tax, and total in real-time
4. THE POS_System SHALL generate KOT documents for kitchen stations
5. WHEN printing KOT, THE POS_System SHALL include table number, item names, quantities, modifiers, and timestamp
6. WHEN a bill is generated, THE POS_System SHALL include GST breakdown compliant with Indian tax regulations
7. THE POS_System SHALL support payment methods including cash, card, UPI, and digital wallets
8. WHEN payment is completed, THE POS_System SHALL mark the order as settled and clear the table
9. THE POS_System SHALL generate sequential invoice numbers with no gaps

### Requirement 3: Captain Mobile App

**User Story:** As a restaurant server, I want to take orders at the table using a tablet, so that I can improve service speed and accuracy.

#### Acceptance Criteria

1. THE Captain_App SHALL authenticate users via PIN code on tablet devices
2. THE Captain_App SHALL display assigned tables and their current status
3. WHEN a table is selected, THE Captain_App SHALL allow adding items with modifiers and special instructions
4. THE Captain_App SHALL send orders to the kitchen in real-time via WebSocket
5. THE Captain_App SHALL function in Offline_Mode and sync when connectivity resumes
6. WHEN the Captain_App reconnects, THE Sync_Engine SHALL merge offline changes without data loss

### Requirement 4: Kitchen Display System

**User Story:** As a kitchen manager, I want to view and manage cooking orders on screens, so that I can coordinate food preparation efficiently.

#### Acceptance Criteria

1. THE KDS SHALL display incoming KOT documents in real-time via WebSocket
2. THE KDS SHALL color-code orders based on elapsed time (green under 5 minutes, yellow 5-10 minutes, red over 10 minutes)
3. THE KDS SHALL filter orders by kitchen station (grill, fryer, cold station, etc.)
4. WHEN a chef marks an item complete, THE KDS SHALL update order status and notify the POS_System
5. THE KDS SHALL emit audio alerts for new orders
6. THE KDS SHALL display order priority with rush orders highlighted

### Requirement 5: QR Code Ordering

**User Story:** As a restaurant customer, I want to scan a QR code and order from my phone, so that I can browse the menu and order without waiting for service.

#### Acceptance Criteria

1. WHEN a customer scans a table QR code, THE QR_Menu SHALL display the branded menu for that Outlet
2. THE QR_Menu SHALL show menu items with images, descriptions, prices, and dietary tags
3. THE QR_Menu SHALL allow adding items to cart with modifiers
4. WHEN an order is placed, THE QR_Menu SHALL send it to the POS_System and KDS
5. THE QR_Menu SHALL display order status updates in real-time
6. THE QR_Menu SHALL support payment via integrated gateway before order submission

### Requirement 6: Online Ordering Website

**User Story:** As a customer, I want to order food for delivery from the restaurant's website, so that I can enjoy restaurant food at home.

#### Acceptance Criteria

1. THE Online_Store SHALL display a branded storefront with the Outlet's logo, colors, and menu
2. THE Online_Store SHALL support delivery and pickup order types
3. WHEN delivery is selected, THE Online_Store SHALL validate the delivery address and calculate delivery fee
4. THE Online_Store SHALL integrate with Razorpay and Stripe for payment processing
5. WHEN an order is paid, THE Online_Store SHALL send it to the POS_System and KDS with order type label
6. THE Online_Store SHALL send order confirmation via email and WhatsApp
7. THE Online_Store SHALL display estimated preparation time

### Requirement 7: Aggregator Integration

**User Story:** As a restaurant owner, I want orders from Zomato and Swiggy to appear in my POS, so that I can manage all orders in one system.

#### Acceptance Criteria

1. THE Aggregator_Hub SHALL connect to third-party APIs including Zomato, Swiggy, Talabat, and Deliveroo
2. WHEN an order arrives from an aggregator, THE Aggregator_Hub SHALL parse it and create an order in the POS_System
3. THE Aggregator_Hub SHALL label orders with the aggregator source
4. WHEN order status changes in the POS_System, THE Aggregator_Hub SHALL update the aggregator platform
5. THE Aggregator_Hub SHALL reconcile aggregator payments with internal records
6. THE Aggregator_Hub SHALL handle webhook authentication and signature verification

### Requirement 8: Inventory Management

**User Story:** As a kitchen manager, I want to track ingredient stock levels, so that I can prevent shortages and reduce waste.

#### Acceptance Criteria

1. THE Inventory_Manager SHALL maintain stock quantities for all ingredients
2. WHEN a menu item is ordered, THE Inventory_Manager SHALL deduct ingredient quantities based on Recipe_Specification
3. THE Inventory_Manager SHALL emit alerts when stock levels fall below minimum threshold
4. THE Inventory_Manager SHALL record all Stock_Transaction operations with timestamp, user, and reason
5. THE Inventory_Manager SHALL support stock adjustments with Manager_Role approval
6. THE Inventory_Manager SHALL calculate current stock value based on weighted average cost
7. WHEN goods are received, THE Inventory_Manager SHALL update stock levels and cost basis

### Requirement 9: Recipe Management

**User Story:** As a chef, I want to define ingredient quantities for each menu item, so that inventory deductions are accurate.

#### Acceptance Criteria

1. THE Inventory_Manager SHALL allow creating Recipe_Specification documents for menu items
2. THE Recipe_Specification SHALL list ingredient names, quantities, and units of measure
3. WHEN a Recipe_Specification is saved, THE Inventory_Manager SHALL validate that all ingredients exist in inventory
4. THE Inventory_Manager SHALL support recipe versioning with effective dates
5. FOR ALL menu items with recipes, ordering the item SHALL trigger automatic inventory deduction

### Requirement 10: Vendor Management

**User Story:** As a purchasing manager, I want to manage supplier information and orders, so that I can streamline procurement.

#### Acceptance Criteria

1. THE Inventory_Manager SHALL maintain a database of vendor contacts including name, phone, email, and payment terms
2. THE Inventory_Manager SHALL allow creating Purchase_Order documents with line items and quantities
3. WHEN a Purchase_Order is created, THE Inventory_Manager SHALL assign a sequential PO number
4. THE Inventory_Manager SHALL track Purchase_Order status (draft, sent, received, cancelled)
5. WHEN goods are received against a Purchase_Order, THE Inventory_Manager SHALL update stock levels and close the order
6. THE Inventory_Manager SHALL calculate vendor payment amounts based on received goods

### Requirement 11: Customer Relationship Management

**User Story:** As a restaurant owner, I want to track customer information and purchase history, so that I can provide personalized service.

#### Acceptance Criteria

1. THE CRM_Engine SHALL create customer profiles with name, phone, email, and address
2. WHEN a customer places an order, THE CRM_Engine SHALL associate it with their profile
3. THE CRM_Engine SHALL display customer order history and lifetime value
4. THE CRM_Engine SHALL support customer segmentation by spend level, visit frequency, and preferences
5. THE CRM_Engine SHALL tag customers with dietary preferences and favorite items
6. THE CRM_Engine SHALL detect duplicate customer records and suggest merging

### Requirement 12: Loyalty Program

**User Story:** As a customer, I want to earn points on purchases and redeem rewards, so that I am incentivized to return.

#### Acceptance Criteria

1. THE CRM_Engine SHALL award Loyalty_Points based on order value at a configurable rate
2. THE CRM_Engine SHALL organize customers into Customer_Tier levels (Bronze, Silver, Gold, Platinum)
3. WHEN a customer reaches a tier threshold, THE CRM_Engine SHALL upgrade their tier automatically
4. THE CRM_Engine SHALL allow customers to redeem points for discounts at checkout
5. THE CRM_Engine SHALL prevent point redemption exceeding available balance
6. WHEN points are earned or redeemed, THE CRM_Engine SHALL record the transaction with timestamp and order reference

### Requirement 13: Analytics and Reporting

**User Story:** As a restaurant owner, I want to view sales reports and trends, so that I can make informed business decisions.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL display dashboard with daily revenue, order count, and average order value
2. THE Analytics_Engine SHALL generate reports including sales by time period, menu item performance, payment method breakdown, and server performance
3. THE Analytics_Engine SHALL support date range filtering and outlet comparison
4. THE Analytics_Engine SHALL export reports to PDF and Excel formats
5. THE Analytics_Engine SHALL calculate key metrics including food cost percentage, labor cost percentage, and table turnover rate
6. THE Analytics_Engine SHALL display real-time metrics updated every 60 seconds

### Requirement 14: WhatsApp Marketing

**User Story:** As a marketing manager, I want to send promotional messages via WhatsApp, so that I can increase customer engagement.

#### Acceptance Criteria

1. THE WhatsApp_Module SHALL integrate with Twilio WhatsApp Business API
2. THE WhatsApp_Module SHALL send transactional messages including order confirmation, order ready, and payment receipts
3. THE WhatsApp_Module SHALL support broadcast campaigns to customer segments
4. WHEN a campaign is created, THE WhatsApp_Module SHALL queue messages using Bull job queues
5. THE WhatsApp_Module SHALL respect opt-out preferences and rate limits
6. THE WhatsApp_Module SHALL track message delivery status and response rates
7. THE WhatsApp_Module SHALL comply with WhatsApp business messaging policies

### Requirement 15: Accounting System

**User Story:** As an accountant, I want to track expenses and generate financial reports, so that I can manage the restaurant's finances.

#### Acceptance Criteria

1. THE Accounting_Module SHALL record expense transactions with category, amount, date, and payment method
2. THE Accounting_Module SHALL categorize expenses (food cost, labor, rent, utilities, marketing, etc.)
3. THE Accounting_Module SHALL generate profit and loss statements for specified date ranges
4. THE Accounting_Module SHALL calculate GST collected and payable amounts
5. THE Accounting_Module SHALL export data to Tally accounting software format
6. THE Accounting_Module SHALL reconcile daily cash drawer balances with recorded transactions
7. WHEN revenue is recorded, THE Accounting_Module SHALL categorize by revenue stream (dine-in, delivery, online, aggregators)

### Requirement 16: Multi-Outlet Management

**User Story:** As a restaurant chain owner, I want to view consolidated reports across all outlets, so that I can manage multiple locations efficiently.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL allow a Tenant to create multiple Outlet records
2. THE Analytics_Engine SHALL display consolidated dashboard aggregating metrics across all outlets
3. THE Analytics_Engine SHALL allow filtering reports by individual Outlet or outlet groups
4. THE Inventory_Manager SHALL support inter-outlet stock transfers with approval workflow
5. THE Dinely_Platform SHALL allow central menu management with outlet-specific overrides
6. THE CRM_Engine SHALL unify customer profiles across outlets within the same Tenant

### Requirement 17: Feedback System

**User Story:** As a restaurant manager, I want to collect customer feedback after orders, so that I can improve service quality.

#### Acceptance Criteria

1. WHEN an order is completed, THE Dinely_Platform SHALL send a feedback request via WhatsApp or email
2. THE Dinely_Platform SHALL collect ratings on a 5-star scale for food quality, service speed, and overall experience
3. THE Dinely_Platform SHALL collect optional text comments
4. WHEN a rating below 3 stars is received, THE Dinely_Platform SHALL send a Push_Notification to the Manager_Role
5. THE Analytics_Engine SHALL display average ratings and feedback trends over time
6. THE Dinely_Platform SHALL allow managers to respond to feedback and mark issues as resolved

### Requirement 18: Notification System

**User Story:** As a restaurant staff member, I want to receive alerts for important events, so that I can respond promptly.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL send Push_Notification alerts via Firebase Cloud Messaging
2. THE Dinely_Platform SHALL send email alerts via SMTP integration
3. THE Dinely_Platform SHALL send WhatsApp alerts via Twilio integration
4. THE Dinely_Platform SHALL trigger notifications for events including low stock, negative feedback, failed payments, and manager approval requests
5. THE Dinely_Platform SHALL allow users to configure notification preferences per event type
6. THE Dinely_Platform SHALL support notification delivery to specific user roles

### Requirement 19: Offline Operations

**User Story:** As a restaurant cashier, I want the POS to work during internet outages, so that I can continue serving customers.

#### Acceptance Criteria

1. THE POS_System SHALL cache menu data, table status, and pending orders in IndexedDB
2. WHEN network connectivity is lost, THE POS_System SHALL enter Offline_Mode automatically
3. WHILE in Offline_Mode, THE POS_System SHALL allow creating orders, generating KOTs, and processing cash payments
4. WHEN connectivity is restored, THE Sync_Engine SHALL upload offline transactions to the server
5. THE Sync_Engine SHALL handle conflict resolution when the same table is modified on multiple devices
6. THE POS_System SHALL display a visual indicator when operating in Offline_Mode
7. FOR ALL offline transactions, the Sync_Engine SHALL preserve transaction timestamps and user attribution

### Requirement 20: Multi-Device Synchronization

**User Story:** As a restaurant operator, I want changes on one device to appear on all devices, so that staff have consistent information.

#### Acceptance Criteria

1. WHEN an order is created on any device, THE Sync_Engine SHALL broadcast it to all connected devices via Socket.IO
2. THE Sync_Engine SHALL synchronize table status changes within 500 milliseconds
3. THE Sync_Engine SHALL synchronize menu updates, pricing changes, and availability toggles in real-time
4. WHEN a device reconnects after being offline, THE Sync_Engine SHALL receive missed updates via delta sync
5. THE Sync_Engine SHALL use optimistic locking to prevent lost updates during concurrent edits

### Requirement 21: Security and Audit Logging

**User Story:** As a restaurant owner, I want to track sensitive operations, so that I can detect and prevent theft.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL record all sensitive operations in the Audit_Log including user, timestamp, action, and affected entities
2. THE Audit_Log SHALL be immutable and prevent deletion or modification
3. THE Dinely_Platform SHALL require Manager_Role approval for operations including voiding orders, applying discounts over 20%, and adjusting inventory
4. WHEN a Manager_Role approval is requested, THE Dinely_Platform SHALL send a Push_Notification to all managers
5. THE Dinely_Platform SHALL log all cash drawer openings with user and reason
6. THE Analytics_Engine SHALL generate exception reports highlighting suspicious patterns including excessive voids, discounts, and refunds
7. THE Dinely_Platform SHALL enforce session timeouts of 30 minutes for POS_System users

### Requirement 22: Cash Drawer Monitoring

**User Story:** As a restaurant owner, I want to monitor cash drawer balances, so that I can prevent theft and ensure accurate accounting.

#### Acceptance Criteria

1. THE POS_System SHALL track expected Cash_Drawer balance based on cash transactions
2. WHEN a shift begins, THE POS_System SHALL record the opening cash amount
3. WHEN a shift ends, THE POS_System SHALL prompt for the actual cash count
4. WHEN actual count differs from expected balance, THE POS_System SHALL require Manager_Role verification and create a cash variance record
5. THE Accounting_Module SHALL generate cash reconciliation reports showing variances by user and shift
6. THE POS_System SHALL prevent cash payment acceptance when Cash_Drawer is not opened

### Requirement 23: Table Management

**User Story:** As a restaurant host, I want to manage table assignments and reservations, so that I can optimize seating.

#### Acceptance Criteria

1. THE POS_System SHALL display a visual floor plan with table shapes and positions
2. THE POS_System SHALL show table status including available, occupied, reserved, and being cleaned
3. WHEN a table is assigned, THE POS_System SHALL mark it as occupied and record the start time
4. THE POS_System SHALL support merging and splitting tables for large parties
5. THE POS_System SHALL allow creating reservations with customer name, party size, date, and time
6. WHEN reservation time arrives, THE POS_System SHALL send a reminder Push_Notification to the host
7. THE POS_System SHALL calculate table turnover time from occupied to available

### Requirement 24: Menu Management

**User Story:** As a restaurant manager, I want to update menu items and prices, so that I can adapt to market changes and seasonality.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL allow creating menu categories with display order
2. THE Dinely_Platform SHALL allow creating menu items with name, description, price, image, and category assignment
3. THE Dinely_Platform SHALL support item modifiers including size options, add-ons, and customizations with price adjustments
4. THE Dinely_Platform SHALL allow marking items as unavailable temporarily
5. WHEN a menu item is updated, THE Sync_Engine SHALL propagate changes to all devices within 10 seconds
6. THE Dinely_Platform SHALL support scheduling menu changes with effective dates
7. THE Dinely_Platform SHALL tag items with attributes including vegetarian, vegan, gluten-free, spicy, and allergen warnings

### Requirement 25: Payment Gateway Integration

**User Story:** As a restaurant operator, I want to accept online payments securely, so that customers can pay for delivery orders.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL integrate with Razorpay payment gateway for Indian market
2. THE Dinely_Platform SHALL integrate with Stripe payment gateway for international markets
3. WHEN a customer initiates payment, THE Dinely_Platform SHALL create a payment intent and redirect to the gateway
4. WHEN payment is successful, THE Dinely_Platform SHALL capture the payment and mark the order as paid
5. WHEN payment fails, THE Dinely_Platform SHALL mark the order as payment pending and notify the customer
6. THE Dinely_Platform SHALL store payment transaction IDs and gateway response codes
7. THE Dinely_Platform SHALL support refund processing through the gateway API
8. THE Dingly_Platform SHALL comply with PCI-DSS requirements by never storing card numbers

### Requirement 26: User Management and Permissions

**User Story:** As a restaurant owner, I want to control what each staff member can access, so that I can enforce role-based security.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL define user roles including Admin, Manager, Cashier, Server, and Kitchen Staff
2. THE Dinely_Platform SHALL assign permissions to roles including view orders, create orders, void orders, access reports, manage inventory, and manage users
3. WHEN a user logs in, THE Dinely_Platform SHALL load their assigned role and permissions
4. THE Dinely_Platform SHALL prevent access to features not authorized for the user's role
5. THE Dinely_Platform SHALL allow outlet-level user assignment for multi-outlet tenants
6. THE Dinely_Platform SHALL require unique usernames and enforce password complexity rules

### Requirement 27: Data Export and Backup

**User Story:** As a restaurant owner, I want to export my data regularly, so that I have backups for disaster recovery.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL generate full data exports in JSON format
2. THE Dinely_Platform SHALL support exporting orders, customers, inventory, and financial records within specified date ranges
3. THE Dinely_Platform SHALL upload automated daily backups to AWS S3 storage
4. THE Dinely_Platform SHALL retain daily backups for 30 days and monthly backups for 1 year
5. THE Dinely_Platform SHALL encrypt backup files using AES-256 encryption
6. THE Dinely_Platform SHALL provide data export functionality compliant with GDPR data portability requirements

### Requirement 28: Delivery Management

**User Story:** As a delivery coordinator, I want to assign and track delivery orders, so that customers receive timely service.

#### Acceptance Criteria

1. THE Online_Store SHALL calculate estimated delivery time based on preparation time and distance
2. THE Dinely_Platform SHALL allow assigning delivery orders to delivery drivers
3. WHEN a driver is assigned, THE Dinely_Platform SHALL send order details via Push_Notification
4. THE Dinely_Platform SHALL track delivery status including preparing, out for delivery, and delivered
5. WHEN status changes, THE Dinely_Platform SHALL notify the customer via WhatsApp
6. THE Dinely_Platform SHALL display active deliveries on a map with driver locations
7. THE Dinely_Platform SHALL calculate delivery driver earnings and tips

### Requirement 29: Discount and Promotion Management

**User Story:** As a marketing manager, I want to create discount codes and promotions, so that I can attract customers.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL allow creating discount codes with percentage or fixed amount reductions
2. THE Dinely_Platform SHALL support promotion rules including minimum order value, applicable items, and date ranges
3. WHEN a discount code is applied, THE Dinely_Platform SHALL validate it against current rules
4. THE Dinely_Platform SHALL prevent stacking of multiple discount codes unless explicitly allowed
5. THE Dinely_Platform SHALL track discount code usage and remaining redemption limits
6. THE Dinely_Platform SHALL allow outlet-specific promotions and chain-wide promotions
7. WHEN a promotion is applied, THE Dinely_Platform SHALL display the discount amount on bills and receipts

### Requirement 30: Tax Configuration and Compliance

**User Story:** As a restaurant accountant, I want to configure tax rules, so that bills comply with local regulations.

#### Acceptance Criteria

1. THE Dinely_Platform SHALL allow configuring GST rates by menu item category
2. THE Dinely_Platform SHALL calculate CGST and SGST amounts separately for Indian compliance
3. THE Dinely_Platform SHALL generate GSTR-1 report format for GST filing
4. THE Dinely_Platform SHALL support service charges as a separate line item
5. WHEN tax rates change, THE Dinely_Platform SHALL apply new rates with effective date
6. THE Dinely_Platform SHALL include GSTIN number on all invoices and bills

---

## Requirements Summary

This requirements document defines 30 functional requirement areas covering the complete Dinely Restaurant Operating System. The system architecture follows a multi-tenant SaaS model with schema-per-tenant isolation, real-time synchronization via Socket.IO, offline-first POS capabilities, and comprehensive integrations with payment gateways, WhatsApp messaging, and third-party aggregators.

**Key Technical Characteristics:**
- Multi-tenant PostgreSQL with Prisma ORM
- React 18 + TypeScript frontend with Tailwind CSS
- Node.js + Express backend with Bull queue processing
- Redis for caching and session management
- IndexedDB for offline operation
- AWS S3 for file storage and backups
- Socket.IO for real-time device synchronization
- Firebase Cloud Messaging for push notifications
- Twilio for WhatsApp integration
- Razorpay and Stripe for payment processing

The system is designed to operate reliably in restaurant environments with potential network instability, enforce robust security and audit controls to prevent theft, and scale to support restaurant chains with dozens of outlets while maintaining sub-second synchronization performance.
