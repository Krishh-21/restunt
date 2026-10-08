import { randomUUID } from 'node:crypto';
import { EmailSchema, PhoneSchema } from '../validation';
/**
 * Test setup file for @dinely/types package
 * Global test configuration and utilities
 */

// Extend expect matchers if needed
declare global {
  var generateTestId: () => string;
  var createMockOrder: () => Record<string, unknown>;
  var createMockMenuItem: () => Record<string, unknown>;
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidPhone(): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const pass = EmailSchema.safeParse(received).success;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidPhone(received: string) {
    const pass = PhoneSchema.safeParse(received).success;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid phone number`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid phone number`,
        pass: false,
      };
    }
  },
});

// Global test utilities
global.generateTestId = () => randomUUID();

global.createMockOrder = () => ({
  id: generateTestId(),
  tenantId: generateTestId(),
  outletId: generateTestId(),
  orderNumber: 'OUT1-2024-000001',
  type: 'DINE_IN' as const,
  source: 'POS' as const,
  status: 'DRAFT' as const,
  items: [],
  subtotal: 0,
  taxAmount: 0,
  serviceCharge: 0,
  discountAmount: 0,
  total: 0,
  paymentStatus: 'PENDING' as const,
  createdByUserId: generateTestId(),
  createdAt: new Date().toISOString(),
});

global.createMockMenuItem = () => ({
  id: generateTestId(),
  tenantId: generateTestId(),
  categoryId: generateTestId(),
  name: 'Test Menu Item',
  price: 299.99,
  isAvailable: true,
  tags: ['vegetarian'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Console override for cleaner test output
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:') &&
      args[0].includes('componentWillReceiveProps')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
