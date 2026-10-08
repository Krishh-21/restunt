# Dinely progress audit — 2026-10-08

Reviewed against actual source, not just checkbox history. 152 subtasks: **31 implemented source scope, 75 partial, 46 pending**. Implemented does not mean production certified. Optional test tasks remain unchecked unless their requested test exists.

## Work delivered

All nine active workspaces now build. Captain, QR Menu and Online Store have working source apps. POS includes modifiers, resuming occupied tables, invoice details and offline order replay. Management includes inventory, procurement, CRM, staff, expenses, cash drawers and analytics. Settlement atomically records bill, stock deduction, loyalty and revenue. Discount consumption and same-unit stock transfers are transactional. Stripe/Razorpay have signed webhook adapters; Twilio/reconciliation workers call real services rather than simulated success.

## Portable setup and offline follow-up

Added reusable Docker single-origin hosting for all five apps, generated private `.env` secrets, grouped configuration validation, one-time restaurant provisioning, readiness checks and a detailed portable hosting guide. POS/Captain now persist provisional manual payment records with durable server replay receipts; status replay uses expected-state checks. Conflicts retain recorded payments, and refreshes preserve pending payment/table markers. App shells have scoped service workers. Offline and server pricing now use the same calculation function. New tests cover IndexedDB durability, network failures, bounded batches, aliases, conflicts, amount rollback and replay. Complete offline editing/voiding and generic vector merge remain unfinished.

Added encrypted PostgreSQL custom-format backups, private S3 upload, scheduled Bull jobs and authenticated decryption that never overwrites destinations. CI now exercises container startup, five frontend bundles, readiness and isolated backup restore. Added manager in-app/email notification preferences and retryable SMTP/FCM server adapters. Browser push-token enrollment, transactional notification outbox and local retention pruning remain gaps. Compatible dependency updates remove the previously reported critical advisories; remaining dependency advisories require further maintenance.

## Evidence

The first complete CI run passed all workspace builds, migration deployment and four real PostgreSQL tests: duplicate operation replay, concurrent settlement, transaction rollback and foreign-tenant rejection. The follow-up CI run also passed all workspaces, the updated migration, repeated demo seeding and database tests. Payment regression tests pass locally and are included in the final PR checks. Local unit/property tests pass; database tests are intentionally skipped locally without a dedicated `_test` database. See the PR checks for the final commit evidence. A Chromium offline order/payment/reload/reconnect acceptance smoke is included in the follow-up CI. Provider sandbox/live callbacks and production deployment are not verified here. Follow-up Docker/database CI results are recorded in the pull request checks.

## Unfinished requirements

The full specification is **not complete**. Dedicated per-restaurant schemas/read replicas, complete offline edits/voids/vector merges, printer transport, gateway refunds, delivery/driver maps, aggregator contracts, browser push enrollment, campaign scheduling, provider backup/restore acceptance, Sentry/Datadog/ECS deployment, performance acceptance and many requested UI/property/integration tests remain. Some modules above implement a narrower useful workflow than the full task. No cloud/provider accounts or established hosting target were available, and no production deployment was performed. The user chose portable Docker without a hosting provider.

Run/setup details: [docs/RUNNING.md](../../../docs/RUNNING.md). The task table below records source evidence and gaps explicitly; unchecked work has not been silently declared complete.

## Task-by-task evidence

| Task | Status | Evidence / remaining scope |
| --- | --- | --- |
| 1.1 Initialize monorepo with TypeScript, Node.js/Express backend, and React frontend workspaces | Partial | All nine active workspaces build; duplicate legacy scaffold packages retired from npm workspaces. ESLint modernization remains. |
| 1.2 Set up PostgreSQL with Prisma ORM and multi-tenant schema-per-tenant architecture | Partial | Prisma 7 pg adapter, versioned baseline and real PostgreSQL tests. Shared tenant schema; dedicated schemas/read replicas remain. |
| 1.3 Define core TypeScript interfaces and types for all domain entities | Implemented | Project/workspace configuration, apps/api/src/lib and middleware; dedicated tenant schemas and complete frontend builds remain. |
| 1.4 Set up Redis for caching, session management, and Bull queue processing | Partial | Redis/Bull retry infrastructure; actual Twilio/reconciliation adapters replace simulated successes. Backup adapter remains unavailable. |
| 1.5 Implement authentication and authorization middleware | Partial | Project/workspace configuration, apps/api/src/lib and middleware; dedicated tenant schemas and complete frontend builds remain. |
| 1.6 Set up AWS S3 for backup storage and CloudFront for asset delivery | Partial | Project/workspace configuration, apps/api/src/lib and middleware; dedicated tenant schemas and complete frontend builds remain. |
| 2.1 Create tenant registration and schema provisioning API | Partial | apps/api/src/services/tenantService.ts and routes/tenants.ts; dedicated schema provisioning and effective-dated settings remain. |
| 2.2 Implement tenant settings and configuration management | Partial | apps/api/src/services/tenantService.ts and routes/tenants.ts; dedicated schema provisioning and effective-dated settings remain. |
| 2.3 Write property test for tenant data isolation | Pending | Optional test not implemented. |
| 3.1 Create menu CRUD API endpoints | Partial | Scoped menu CRUD/modifiers/category and station validation; scheduled menus remain. |
| 3.2 Implement real-time menu synchronization via Socket.IO | Implemented | apps/api/src/routes/menu.ts; scheduled updates and complete validation remain. |
| 4.1 Create order creation and calculation API | Partial | Server pricing, modifiers, replay IDs and locked numbering; editing existing orders remains. |
| 4.2 Write property test for order calculation correctness | Implemented | apps/api/src/services/orderService.ts and orderCalculation.ts; item editing, printer transport, refunds and complete invoice presentation remain. |
| 4.3 Write property test for GST compliance | Partial | apps/api/src/services/orderService.ts and orderCalculation.ts; item editing, printer transport, refunds and complete invoice presentation remain. |
| 4.4 Implement KOT generation and printing | Partial | apps/api/src/services/orderService.ts and orderCalculation.ts; item editing, printer transport, refunds and complete invoice presentation remain. |
| 4.5 Write property test for KOT document completeness | Pending | Optional test not implemented. |
| 4.6 Implement order state machine and status transitions | Partial | apps/api/src/services/orderService.ts and orderCalculation.ts; item editing, printer transport, refunds and complete invoice presentation remain. |
| 4.7 Implement payment processing and settlement | Partial | Atomic manual/verified online settlement; gateway refunds and failure recovery remain. |
| 4.8 Write property test for order state transition | Pending | Optional test not implemented. |
| 4.9 Implement invoice generation with sequential numbering | Partial | Transactional sequence/bill and printable detail; complete compliant invoice acceptance testing remains. |
| 4.10 Write property test for invoice number sequential integrity | Pending | Optional test not implemented. |
| 4.11 Implement order voiding with manager approval | Partial | apps/api/src/services/orderService.ts and orderCalculation.ts; item editing, printer transport, refunds and complete invoice presentation remain. |
| 6.1 Create table CRUD and status management API | Partial | apps/api/src/routes/pos/tables.ts and reservations.ts; table split, reminder delivery, merge broadcasts and latency validation remain. |
| 6.2 Implement reservation management | Partial | apps/api/src/routes/pos/tables.ts and reservations.ts; table split, reminder delivery, merge broadcasts and latency validation remain. |
| 6.3 Implement real-time table synchronization | Partial | apps/api/src/routes/pos/tables.ts and reservations.ts; table split, reminder delivery, merge broadcasts and latency validation remain. |
| 7.1 Create KDS order display API | Partial | apps/api/src/routes/kds/orders.ts; concurrent multi-station validation and rush workflow remain. |
| 7.2 Implement KDS real-time order routing via WebSocket | Partial | apps/api/src/routes/kds/orders.ts; concurrent multi-station validation and rush workflow remain. |
| 7.3 Implement KDS station configuration | Implemented | apps/api/src/routes/kds/orders.ts; concurrent multi-station validation and rush workflow remain. |
| 8.1 Create inventory item CRUD API | Implemented | apps/api/src/routes/inventory.ts and services/inventoryCalculation.ts; recipe deduction, transfers and push delivery remain. |
| 8.2 Implement stock transaction audit trail | Implemented | Atomic stock transactions for receipts, recipe deduction, adjustments and transfers. |
| 8.3 Implement recipe management and automatic deduction | Partial | Outlet-specific versioned/effective recipes and deduction inside settlement transaction; modifier-specific recipes remain. |
| 8.4 Write property test for recipe-based inventory deduction | Partial | Real PostgreSQL settlement verifies recipe deduction/rollback; dedicated property generator remains. |
| 8.5 Implement stock alert system | Partial | apps/api/src/routes/inventory.ts and services/inventoryCalculation.ts; recipe deduction, transfers and push delivery remain. |
| 8.6 Write property test for stock alert threshold | Pending | Optional test not implemented. |
| 8.7 Implement weighted average cost calculation | Implemented | apps/api/src/routes/inventory.ts and services/inventoryCalculation.ts; recipe deduction, transfers and push delivery remain. |
| 8.8 Write property test for weighted average cost calculation | Implemented | apps/api/src/routes/inventory.ts and services/inventoryCalculation.ts; recipe deduction, transfers and push delivery remain. |
| 9.1 Create vendor management API | Implemented | apps/api/src/routes/inventory.ts; purchase order workflow remains. |
| 9.2 Create purchase order management API | Partial | Purchase orders and atomic receipts with weighted costs; vendor delivery channels remain. |
| 11.1 Create customer profile management API | Implemented | Tenant customer profiles, phone uniqueness/search, tags, preferences and scoped order history in routes/crm.ts. |
| 11.2 Implement customer segmentation | Partial | Tier, frequent, high-value and consent segments; custom saved segments remain. |
| 11.3 Implement loyalty program | Partial | Transactional earning/redemption and no stacking; complete reversal policy and redemption UX remain. |
| 11.4 Write property test for loyalty points accumulation | Partial | Boundary unit tests and real PostgreSQL earning test; property generator remains. |
| 11.5 Implement loyalty tier management | Partial | Tier thresholds implemented; configurable thresholds/tier history remain. |
| 11.6 Write property test for loyalty tier assignment | Partial | Tier boundary unit tests; property generator remains. |
| 11.7 Write property test for loyalty points redemption validation | Pending | Optional test not implemented. |
| 12.1 Create feedback collection API | Partial | Staff feedback collection API; customer link/form remains. |
| 12.2 Implement feedback alerts and responses | Partial | Negative-feedback alerts/responses and retryable SMTP/FCM adapters with preferences; browser enrollment/provider acceptance remain. |
| 13.1 Create discount code management API | Implemented | Validated tenant discount creation/listing/deactivation; caps, dates, items, outlets and usage fields. |
| 13.2 Implement discount validation and application | Partial | Discount eligibility and locked usage consumption at settlement, manager restriction; threshold audit workflow remains. |
| 13.3 Write unit tests for discount validation logic | Implemented | Tests cover validity, usage, minimum amount, caps and eligible items. |
| 14.1 Create cash drawer session management API | Implemented | Locked open/close drawer, expected cash, variance approval and settlement guard in accounting.ts. |
| 14.2 Implement cash reconciliation reporting | Implemented | Scoped reconciliation listing and opening/closing audit records. |
| 15.1 Create expense tracking API | Implemented | Scoped expense tracking with validated categories, amount, method, vendor, receipt and date. |
| 15.2 Implement automatic revenue recording | Implemented | Revenue/GST journal written exactly once in settlement transaction by stream. |
| 15.3 Implement financial reporting | Partial | P&L, invoice GST detail and basic Tally XML; GSTR-1 and Tally acceptance/compliance remain. |
| 15.4 Write property test for service charge calculation | Pending | Optional test not implemented. |
| 15.5 Write property test for tax rate effective dating | Pending | Optional test not implemented. |
| 16.1 Create real-time dashboard API | Partial | Dashboard aggregates and 60-second UI refresh; read replica configuration remains. |
| 16.2 Implement business reports | Implemented | Date/outlet filtered sales, menu performance and exception APIs. |
| 16.3 Implement report export functionality | Pending | No implementation found for this task. |
| 16.4 Implement KPI calculations | Partial | AOV, expense ratios and table turnover; full ingredient COGS analysis remains. |
| 17.1 Create outlet management API | Partial | Outlet create/list and assignments; full opening-hours/tax management remains. |
| 17.2 Implement consolidated reporting across outlets | Implemented | Consolidated reports restricted to assigned outlets. |
| 17.3 Implement inter-outlet stock transfer | Partial | Atomic same-unit transfer and receiving weighted cost; transfer document/approval workflow remains. |
| 17.4 Implement central menu management with outlet overrides | Pending | No implementation found for this task. |
| 17.5 Implement unified customer profiles across outlets | Implemented | Customer identity and loyalty shared by tenant across outlets with scoped order access. |
| 19.1 Set up Firebase Cloud Messaging for push notifications | Pending | No implementation found for this task. |
| 19.2 Implement notification triggers and preferences | Pending | No implementation found for this task. |
| 19.3 Set up SMTP integration for email alerts | Pending | No implementation found for this task. |
| 20.1 Set up Twilio WhatsApp Business API integration | Partial | Real Twilio approved-template worker with consent/E.164 validation; credentials and provider validation remain. |
| 20.2 Implement transactional messaging | Pending | No implementation found for this task. |
| 20.3 Implement marketing campaign management | Pending | No implementation found for this task. |
| 20.4 Implement feedback request via WhatsApp | Pending | No implementation found for this task. |
| 21.1 Integrate Razorpay payment gateway | Partial | Razorpay checkout, raw HMAC capture validation, amount checks and reconciliation; sandbox/live acceptance remains. |
| 21.2 Integrate Stripe payment gateway | Partial | Stripe hosted checkout, raw signature validation, idempotency and reconciliation; sandbox/live acceptance remains. |
| 21.3 Implement payment failure handling and refunds | Pending | No implementation found for this task. |
| 21.4 Write integration tests for payment flows | Partial | Signature, amount/currency, replay and late-event regression tests; real provider integration remains. |
| 22.1 Create webhook handlers for third-party platforms | Pending | No implementation found for this task. |
| 22.2 Implement order transformation from aggregator formats | Pending | No implementation found for this task. |
| 22.3 Implement status synchronization to aggregators | Pending | No implementation found for this task. |
| 22.4 Implement payment reconciliation | Pending | No implementation found for this task. |
| 22.5 Write integration tests for aggregator webhooks | Pending | Optional test not implemented. |
| 23.1 Create immutable audit log system | Pending | No implementation found for this task. |
| 23.2 Implement manager approval workflow | Pending | No implementation found for this task. |
| 23.3 Implement exception reporting | Implemented | Scoped exceptions report for voids, discounts and refunded status. |
| 23.4 Implement cash drawer opening audit | Implemented | Cash drawer opening/closing audit stored transactionally. |
| 24.1 Create user management API | Partial | Staff creation/edit/deactivation, safe field projection, hashing, assignments and admin restrictions; complete staff UI remains. |
| 24.2 Implement role-based access control enforcement | Partial | API permissions/outlet checks and current account refresh; exhaustive RBAC route coverage remains. |
| 24.3 Write integration tests for RBAC | Pending | Optional test not implemented. |
| 25.1 Create data export API | Pending | No implementation found for this task. |
| 25.2 Implement automated backup system | Partial | Scheduled AES-256-GCM pg_dump backups, private S3 adapter and recovery tooling; retention pruning and provider acceptance remain. |
| 25.3 Write integration tests for backup system | Partial | Crypto tamper/roundtrip tests and CI isolated PostgreSQL restore smoke; actual S3/provider acceptance remains. |
| 27.1 Set up IndexedDB storage with Dexie.js | Partial | Dexie operation queue and authenticated scoped GET cache; complete local entity model remains. |
| 27.2 Implement offline mode detection and visual indicators | Implemented | Network and pending-sync indicator with reconnect processing. |
| 27.3 Implement offline operations for POS | Partial | Durable create-order queue; offline payments, edits and voids remain. |
| 27.4 Write property test for offline operations resilience | Pending | Optional test not implemented. |
| 28.1 Create sync queue in IndexedDB | Implemented | UUID-attributed queued creates retained until acknowledgement; conflicts preserved. |
| 28.2 Implement vector clock management | Partial | Vector comparison utility exists; protocol does not yet merge vector clocks. |
| 28.3 Implement sync protocol client-side | Partial | Authenticated batch upload, acknowledgements and conflict retention; entity merge UI remains. |
| 28.4 Implement sync protocol server-side | Partial | Idempotent attributed order creation and delta download; broader offline operations remain. |
| 28.5 Implement conflict resolution strategies | Partial | Stock versions and non-destructive conflict retention; full field-specific merge policies remain. |
| 28.6 Write property test for offline sync data preservation | Pending | Optional test not implemented. |
| 28.7 Write property test for sync conflict resolution | Pending | Optional test not implemented. |
| 28.8 Implement delta sync for reconnection | Partial | Timestamp delta for orders/tables/menu; deletion tombstones and pagination remain. |
| 28.9 Write property test for delta sync completeness | Pending | Optional test not implemented. |
| 29.1 Set up Socket.IO server with room-based broadcasting | Implemented | apps/api/src/index.ts and lib/socket.ts; full POS subscriptions and real concurrency/latency tests remain. |
| 29.2 Implement order broadcast to all devices | Partial | apps/api/src/index.ts and lib/socket.ts; full POS subscriptions and real concurrency/latency tests remain. |
| 29.3 Implement table status synchronization | Partial | apps/api/src/index.ts and lib/socket.ts; full POS subscriptions and real concurrency/latency tests remain. |
| 29.4 Implement optimistic locking for concurrent edits | Partial | apps/api/src/index.ts and lib/socket.ts; full POS subscriptions and real concurrency/latency tests remain. |
| 29.5 Write integration tests for Socket.IO synchronization | Pending | Optional test not implemented. |
| 30.1 Set up IndexedDB for Captain App | Partial | Captain reuses tenant/outlet/user-scoped Dexie cache; complete offline entities remain. |
| 30.2 Implement Captain App authentication with PIN | Implemented | PIN login with assigned outlet and current authorization checks. |
| 30.3 Implement Captain App order creation with offline support | Partial | Shared POS/table ordering and durable create replay; dedicated captain assignment and complete sync remain. |
| 32.1 Create POS UI components | Partial | Tables, modifiers, cart, payment/invoice and management screens; full operational UX remains. |
| 32.2 Integrate POS UI with backend APIs | Partial | API-connected workflows; browser end-to-end acceptance remains. |
| 32.3 Implement POS offline mode with IndexedDB | Partial | Cached menus/tables and offline order creation; full offline payment/edit scope remains. |
| 32.4 Integrate POS with Socket.IO for real-time updates | Implemented | Socket-driven query refresh and reconnect/polling fallback. |
| 32.5 Write UI component tests for POS | Pending | Optional test not implemented. |
| 33.1 Create KDS UI components | Partial | apps/kitchen/src; rush indicators and browser/component tests remain. |
| 33.2 Integrate KDS with backend APIs and Socket.IO | Implemented | apps/kitchen/src; rush indicators and browser/component tests remain. |
| 33.3 Write UI component tests for KDS | Pending | Optional test not implemented. |
| 34.1 Create Captain App UI components | Partial | Working PIN entry and shared POS UI; dedicated tablet/table assignment UX remains. |
| 34.2 Integrate Captain App with backend APIs | Partial | Captain uses live POS APIs; dedicated captain endpoints/source attribution remain. |
| 34.3 Implement Captain App offline capabilities | Partial | Durable order queue/cached reads; full offline requirements remain. |
| 34.4 Write UI component tests for Captain App | Pending | Optional test not implemented. |
| 35.1 Create QR Menu UI components | Partial | Public menu/cart/modifier ordering; full PWA/browser acceptance remains. |
| 35.2 Integrate QR Menu with payment gateway | Partial | Stripe/Razorpay checkout integration; configured provider acceptance remains. |
| 35.3 Implement QR Menu real-time order status | Partial | Private-token status polling every five seconds; customer WebSocket status remains. |
| 35.4 Write UI component tests for QR Menu | Pending | Optional test not implemented. |
| 36.1 Create Online Store UI components | Partial | Customer menu, cart, address and checkout UI; PWA/browser acceptance remains. |
| 36.2 Implement delivery address validation and fee calculation | Partial | Address structure validation; service zones, distance and fee calculation remain. |
| 36.3 Integrate Online Store with payment gateways | Partial | Provider checkout integration; configured provider acceptance remains. |
| 36.4 Implement Online Store order submission and confirmation | Partial | Private customer order creation/confirmation/status; complete delivery workflow remains. |
| 36.5 Write UI component tests for Online Store | Pending | Optional test not implemented. |
| 37.1 Create analytics dashboard UI | Implemented | Management dashboard and date/outlet sales chart. |
| 37.2 Integrate dashboard with analytics API | Implemented | Authenticated analytics queries with periodic refresh. |
| 37.3 Implement KPI visualizations | Partial | Revenue, order/AOV/ratios/turnover cards and sales visualization; complete KPI comparisons remain. |
| 37.4 Write UI component tests for dashboard | Pending | Optional test not implemented. |
| 38.1 Create delivery driver management API | Pending | No implementation found for this task. |
| 38.2 Implement delivery assignment and tracking | Pending | No implementation found for this task. |
| 38.3 Implement delivery tracking map view | Pending | No implementation found for this task. |
| 38.4 Write integration tests for delivery management | Pending | Optional test not implemented. |
| 39.1 Set up Sentry for error tracking | Pending | No implementation found for this task. |
| 39.2 Implement error response formatting | Implemented | Async request errors forwarded to consistent API/Zod formatting. |
| 39.3 Implement retry logic and graceful degradation | Pending | No implementation found for this task. |
| 39.4 Implement critical error handling | Partial | apps/api/src/lib/asyncHandler.ts and index.ts; complete domain error mapping, monitoring and resilience remain. |
| 39.5 Write tests for error handling | Pending | Optional test not implemented. |
| 40.1 Set up deployment configuration | Partial | Dockerfile/Compose and full-workspace CI; AWS ECS infrastructure remains. |
| 40.2 Set up environment configuration management | Partial | Documented env examples and production JWT validation; cloud secret-manager provisioning remains. |
| 40.3 Set up monitoring and alerting | Pending | No implementation found for this task. |
| 40.4 Implement database migration system | Implemented | Committed PostgreSQL migration applied successfully in CI; existing databases need drift review/baselining. |
| 40.5 Deploy to staging environment and perform smoke tests | Pending | No implementation found for this task. |
