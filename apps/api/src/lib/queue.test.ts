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

  describe('Queue Job Processors (Stubs)', () => {
    it('processes WhatsApp jobs successfully', async () => {
      const processor = mockProcessors['whatsapp-queue'];
      expect(processor).toBeDefined();

      const result = await processor({
        id: 'wa-job-1',
        attemptsMade: 0,
        data: { recipient: '+919999999999' },
      });

      expect(result).toEqual({ success: true, recipient: '+919999999999' });
    });

    it('processes WhatsApp job failures and triggers retry', async () => {
      const processor = mockProcessors['whatsapp-queue'];
      
      await expect(
        processor({
          id: 'wa-job-fail',
          attemptsMade: 0,
          data: { shouldFail: true },
        })
      ).rejects.toThrow('Simulated WhatsApp service connection failure');
    });

    it('processes inventory deduction jobs successfully', async () => {
      const processor = mockProcessors['inventory-deduction-queue'];
      expect(processor).toBeDefined();

      const result = await processor({
        id: 'inv-job-1',
        attemptsMade: 0,
        data: { orderId: 'order-123', items: [{ id: 'item-1', qty: 2 }] },
      });

      expect(result).toEqual({ success: true, orderId: 'order-123', itemsCount: 1 });
    });

    it('processes inventory deduction job failures and triggers retry', async () => {
      const processor = mockProcessors['inventory-deduction-queue'];
      
      await expect(
        processor({
          id: 'inv-job-fail',
          attemptsMade: 0,
          data: { shouldFail: true },
        })
      ).rejects.toThrow('Simulated database lock during inventory adjustment');
    });

    it('processes payment reconciliation jobs successfully', async () => {
      const processor = mockProcessors['payment-reconciliation-queue'];
      expect(processor).toBeDefined();

      const result = await processor({
        id: 'pay-job-1',
        attemptsMade: 0,
        data: { transactionId: 'txn_abc123' },
      });

      expect(result).toEqual({ success: true, transactionId: 'txn_abc123' });
    });

    it('processes payment reconciliation job failures and triggers retry', async () => {
      const processor = mockProcessors['payment-reconciliation-queue'];
      
      await expect(
        processor({
          id: 'pay-job-fail',
          attemptsMade: 0,
          data: { shouldFail: true },
        })
      ).rejects.toThrow('Simulated gateway timeout during reconciliation');
    });

    it('processes backup jobs successfully', async () => {
      const processor = mockProcessors['backup-queue'];
      expect(processor).toBeDefined();

      const result = await processor({
        id: 'bkp-job-1',
        attemptsMade: 0,
        data: { backupPath: 's3://my-backups/daily.sql' },
      });

      expect(result).toEqual({ success: true, backupPath: 's3://my-backups/daily.sql' });
    });

    it('processes backup job failures and triggers retry', async () => {
      const processor = mockProcessors['backup-queue'];
      
      await expect(
        processor({
          id: 'bkp-job-fail',
          attemptsMade: 0,
          data: { shouldFail: true },
        })
      ).rejects.toThrow('Simulated disk full / S3 write failure');
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
