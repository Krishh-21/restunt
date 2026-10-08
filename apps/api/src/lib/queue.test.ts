jest.mock('../services/notificationService',()=>({deliverNotification:jest.fn()}));
jest.mock('./prisma',()=>({prisma:{}}));
jest.mock('../services/backupService',()=>({createDatabaseBackup:jest.fn().mockRejectedValue(new Error('Backup adapter not configured'))}));
jest.mock('../services/jobProcessors', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue({ queued: true }),
  verifyInventoryDeduction: jest.fn().mockResolvedValue({ verified: true }),
  reconcilePayment: jest.fn().mockRejectedValue(new Error('Provider unavailable')),
  backupUnavailable: jest.fn().mockRejectedValue(new Error('Backup adapter not configured')),
}));
import { describe, it, expect, jest, beforeAll } from '@jest/globals';

// Shared dictionary to capture registered processors
const mockProcessors: Record<string, Function> = {};
const mockQueueInstances: any[] = [];

// Mock Bull queue library
jest.mock('bull', () => {
  return jest.fn().mockImplementation((name: string, options: any) => {
    const instance = {
      name,
      options,
      process: jest.fn().mockImplementation((fn: Function) => {
        mockProcessors[name] = fn;
      }),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockQueueInstances.push(instance);
    return instance;
  });
});

// Mock ioredis library
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue(undefined),
      };
    }),
    Cluster: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

describe('Bull Queue Infrastructure', () => {
  let queueModule: any;

  beforeAll(async () => {
    // Import the module under test once
    queueModule = await import('./queue');
  });

  it('initializes all four required queues with correct names and custom Redis options', () => {
    expect(queueModule.whatsappQueue).toBeDefined();
    expect(queueModule.inventoryQueue).toBeDefined();
    expect(queueModule.paymentQueue).toBeDefined();
    expect(queueModule.backupQueue).toBeDefined();

    const expectedQueueNames = [
      'whatsapp-queue',
      'inventory-deduction-queue',
      'payment-reconciliation-queue',
      'backup-queue',
      'notification-queue',
    ];

    mockQueueInstances.forEach((queue) => {
      expect(expectedQueueNames).toContain(queue.name);
      expect(queue.options.createClient).toBeDefined();
    });
  });

  it('enforces exponential backoff and retry policy in default job options', () => {
    expect(queueModule.defaultJobOptions).toEqual({
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  });

  describe('Queue processors', () => {
    it('delegates WhatsApp and inventory jobs to real services', async () => {
      expect(await mockProcessors['whatsapp-queue']({ data: {} })).toEqual({ queued: true });
      expect(await mockProcessors['inventory-deduction-queue']({ data: {} })).toEqual({
        verified: true,
      });
    });
    it('preserves provider failures rather than reporting simulated success', async () => {
      await expect(mockProcessors['payment-reconciliation-queue']({ data: {} })).rejects.toThrow(
        'Provider unavailable'
      );
      await expect(mockProcessors['backup-queue']({ data: {} })).rejects.toThrow(
        'Backup adapter not configured'
      );
    });
  });

  describe('Graceful Shutdown', () => {
    it('attempts to close all queue instances and quit the shared subscriber', async () => {
      // Execute shutdown
      await queueModule.shutdownQueues();

      // Verify close was called on all instances
      mockQueueInstances.forEach((queue) => {
        expect(queue.close).toHaveBeenCalled();
      });
    });
  });
});
