# @dinely/types

Comprehensive TypeScript types, interfaces, and validation schemas for the Dinely Restaurant Operating System.

## Overview

This package provides type-safe interfaces for all domain entities, API contracts, validation schemas, and utility types used across the Dinely ecosystem. It ensures consistency and type safety across all applications including POS, Kitchen Display System, Manager Dashboard, QR Menu, and Online Store.

## Features

- 🔷 **Complete Database Types** - All Prisma schema entities with TypeScript types
- 🔶 **API Request/Response Types** - Comprehensive API contracts for all endpoints
- 🔸 **Zod Validation Schemas** - Runtime validation with type inference
- 🔹 **Enum Definitions** - All status types and constants
- 🔺 **Utility Types** - Pagination, filtering, search, and data transformation helpers
- ⚡ **Real-time Event Types** - WebSocket event definitions
- 🎯 **Type Guards** - Runtime type checking utilities
- 📝 **JSDoc Documentation** - Comprehensive inline documentation

## Installation

```bash
npm install @dinely/types
```

## Usage

### Database Types

```typescript
import type { Order, OrderItem, MenuItem, Customer } from '@dinely/types/database';

const order: Order = {
  id: '123',
  orderNumber: 'OUT1-2024-000123',
  status: OrderStatus.SUBMITTED,
  total: 1299.50,
  // ... other properties
};
```

### API Types

```typescript
import type { 
  CreateOrderRequest, 
  OrdersFilter,
  ApiResponse 
} from '@dinely/types/api';

const createOrderPayload: CreateOrderRequest = {
  tableId: 'table-123',
  type: OrderType.DINE_IN,
  items: [
    {
      menuItemId: 'item-456',
      quantity: 2,
      modifiers: []
    }
  ]
};
```

### Validation Schemas

```typescript
import { 
  CreateOrderRequestSchema,
  validateOrThrow,
  LoginRequestSchema 
} from '@dinely/types/validation';

// Runtime validation
const validatedOrder = validateOrThrow(CreateOrderRequestSchema, orderData);

// Safe parsing
const loginResult = LoginRequestSchema.safeParse(loginData);
if (loginResult.success) {
  // loginResult.data is typed
  console.log(loginResult.data.username);
}
```

### Enums

```typescript
import { 
  OrderStatus, 
  PaymentMethod, 
  UserRole,
  isValidOrderStatus 
} from '@dinely/types/enums';

if (isValidOrderStatus(status)) {
  // TypeScript knows status is OrderStatus
  console.log(`Order status: ${status}`);
}

// Use in components
const paymentMethods = Object.values(PaymentMethod);
```

### Utilities

```typescript
import { 
  formatCurrency,
  calculateTax,
  createPaginationMeta,
  Utils 
} from '@dinely/types/utils';

const formatted = formatCurrency(1299.50, 'INR'); // ₹1,299.50
const { taxAmount, totalAmount } = calculateTax(1000, 18); // GST calculation

const pagination = createPaginationMeta(1, 20, 150);
```

### Constants

```typescript
import { 
  BUSINESS_RULES,
  ERROR_CODES,
  PERMISSIONS,
  UserRole 
} from '@dinely/types/constants';

// Check business rules
if (orderValue > BUSINESS_RULES.MAX_ORDER_VALUE) {
  throw new Error(ERROR_CODES.VALUE_OUT_OF_RANGE);
}

// Check permissions
const managerPermissions = PERMISSIONS[UserRole.MANAGER];
```

## Package Exports

The package provides multiple entry points for different concerns:

```typescript
// Main entry point - exports everything
import { Order, CreateOrderRequest } from '@dinely/types';

// Specific modules
import { Order } from '@dinely/types/database';
import { CreateOrderRequest } from '@dinely/types/api';
import { OrderStatus } from '@dinely/types/enums';
import { CreateOrderRequestSchema } from '@dinely/types/validation';
import { formatCurrency } from '@dinely/types/utils';
import { OrderUpdatedEvent } from '@dinely/types/realtime';
import { BUSINESS_RULES } from '@dinely/types/constants';
```

## Domain Coverage

### Core Domains

- **Tenants & Outlets** - Multi-tenant architecture support
- **Users & Authentication** - Staff management and permissions
- **Menu Management** - Categories, items, modifiers, pricing
- **Order Management** - Complete order lifecycle
- **Table Management** - Floor plans, reservations, status
- **Customer Management** - CRM and loyalty programs
- **Payment Processing** - Multiple payment methods and gateways
- **Kitchen Operations** - KDS integration and recipe management
- **Inventory Management** - Stock tracking and purchasing
- **Analytics & Reporting** - Business intelligence types
- **Real-time Features** - WebSocket events and notifications

### Integration Support

- **Payment Gateways** - Razorpay, Stripe integration types
- **Aggregators** - Zomato, Swiggy, food delivery platforms
- **WhatsApp Business** - Messaging and campaign types
- **Cloud Storage** - File upload and management types

## Type Safety Features

### Strict TypeScript Configuration

- `strict: true` - Maximum type safety
- `exactOptionalPropertyTypes: true` - Exact optional property handling
- `noUncheckedIndexedAccess: true` - Safe array/object access
- `noImplicitReturns: true` - Explicit return statements

### Runtime Validation

All API schemas include Zod validation for runtime type checking:

```typescript
// Compile-time safety
const order: CreateOrderRequest = { /* ... */ };

// Runtime validation
const validOrder = CreateOrderRequestSchema.parse(orderData);
```

### Branded Types

```typescript
// ID types are branded for additional safety
type UserID = string & { __brand: 'UserID' };
type OrderID = string & { __brand: 'OrderID' };

// Prevents accidentally mixing different ID types
function getUser(userId: UserID): User { /* ... */ }
function getOrder(orderId: OrderID): Order { /* ... */ }
```

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev  # Watch mode
```

### Linting and Formatting

```bash
npm run lint
npm run format
npm run validate  # Run all checks
```

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Best Practices

### Using Database Types

```typescript
// ✅ Good: Use specific entity types
import type { Order, OrderItem } from '@dinely/types/database';

// ✅ Good: Use create/update input types
import type { CreateOrderInput, UpdateOrderInput } from '@dinely/types/database';

// ❌ Avoid: Using 'any' or generic objects
const order: any = { /* ... */ };
```

### API Type Usage

```typescript
// ✅ Good: Use specific request/response types
const handleCreateOrder = (req: CreateOrderRequest): ApiResponse<Order> => {
  // Implementation
};

// ✅ Good: Use filtered responses
const getOrders = (filter: OrdersFilter): PaginatedResponse<OrderSummary> => {
  // Implementation  
};
```

### Validation Schema Usage

```typescript
// ✅ Good: Validate at boundaries
export const createOrder = async (data: unknown) => {
  const validated = validateOrThrow(CreateOrderRequestSchema, data);
  return orderService.create(validated);
};

// ✅ Good: Use type inference
const OrderSchema = z.object({
  id: z.string().uuid(),
  total: z.number().positive(),
});

type Order = z.infer<typeof OrderSchema>;
```

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## License

MIT - see [LICENSE](../../LICENSE) file for details.

## Contributing

Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on contributing to this package.