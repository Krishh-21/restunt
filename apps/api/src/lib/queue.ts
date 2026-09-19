import Queue from 'bull';
import Redis, { Cluster } from 'ioredis';
import { redisClient, createRedisInstance } from './redis';

// Dedicated subscriber connection to be shared among queues
let sharedSubscriber: Redis | Cluster | null = null;

const getSharedSubscriber = (): Redis | Cluster => {
  if (!sharedSubscriber) {
    sharedSubscriber = createRedisInstance();
    sharedSubscriber.on('error', (err) => {
      console.error('[Redis Subscriber] Connection Error:', err);
    });
  }
  return sharedSubscriber;
};

// Default Job options: retry 3 times with exponential backoff
export const defaultJobOptions: Queue.JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Starts at 1000ms delay, doubling every attempt
  },
  removeOnComplete: true, // Clean up completed jobs to save space
  removeOnFail: false,   // Keep failed jobs for manual auditing or retries
};

const createQueue = (name: string): Queue.Queue => {
  return new Queue(name, {
    defaultJobOptions,
    createClient: (type) => {
      switch (type) {
        case 'client':
          // Reuse main client
          return redisClient;
        case 'subscriber':
          // Reuse shared subscriber
          return getSharedSubscriber();
        case 'bclient':
          // Bull needs a unique blocking connection (bclient) per queue
          const bclient = createRedisInstance();
          bclient.on('error', (err) => {
            console.error(`[Redis bclient - ${name}] Connection Error:`, err);
          });
          return bclient;
        default:
          throw new Error(`Unexpected connection type: ${type}`);
      }
    },
  });
};

// Define Queue Instances
export const whatsappQueue = createQueue('whatsapp-queue');
export const inventoryQueue = createQueue('inventory-deduction-queue');
export const paymentQueue = createQueue('payment-reconciliation-queue');
export const backupQueue = createQueue('backup-queue');

// Log helper
const setupQueueListeners = (queue: Queue.Queue, name: string) => {
  queue.on('completed', (job, result) => {
    console.log(`[Queue - ${name}] Job ${job.id} completed. Result:`, result);
  });
  queue.on('failed', (job, err) => {
    console.error(`[Queue - ${name}] Job ${job.id} failed (Attempt ${job.attemptsMade}/${job.opts.attempts}). Error:`, err.message);
  });
};

setupQueueListeners(whatsappQueue, 'WhatsApp');
setupQueueListeners(inventoryQueue, 'Inventory Deduction');
setupQueueListeners(paymentQueue, 'Payment Reconciliation');
setupQueueListeners(backupQueue, 'Backup');

// Define processors with simulated delays and error triggers for testing retry/backoff logic
whatsappQueue.process(async (job) => {
  console.log(`[Queue - WhatsApp] Processing job ${job.id} (Attempt ${job.attemptsMade + 1})`, job.data);
  if (job.data.shouldFail) {
    throw new Error('Simulated WhatsApp service connection failure');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, recipient: job.data.recipient };
});

inventoryQueue.process(async (job) => {
  console.log(`[Queue - Inventory] Processing job ${job.id} (Attempt ${job.attemptsMade + 1})`, job.data);
  if (job.data.shouldFail) {
    throw new Error('Simulated database lock during inventory adjustment');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, orderId: job.data.orderId, itemsCount: job.data.items?.length ?? 0 };
});

paymentQueue.process(async (job) => {
  console.log(`[Queue - Payment] Processing job ${job.id} (Attempt ${job.attemptsMade + 1})`, job.data);
  if (job.data.shouldFail) {
    throw new Error('Simulated gateway timeout during reconciliation');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, transactionId: job.data.transactionId };
});

backupQueue.process(async (job) => {
  console.log(`[Queue - Backup] Processing job ${job.id} (Attempt ${job.attemptsMade + 1})`, job.data);
  if (job.data.shouldFail) {
    throw new Error('Simulated disk full / S3 write failure');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, backupPath: job.data.backupPath || 's3://dinely-backups/default.sql' };
});

// Graceful close of all queues
export const shutdownQueues = async (): Promise<void> => {
  console.log('[Queue] Shutting down queues gracefully...');
  try {
    await Promise.all([
      whatsappQueue.close(),
      inventoryQueue.close(),
      paymentQueue.close(),
      backupQueue.close(),
    ]);
    console.log('[Queue] All queues closed successfully.');

    if (sharedSubscriber) {
      console.log('[Queue] Closing shared subscriber...');
      await sharedSubscriber.quit();
      console.log('[Queue] Shared subscriber connection closed.');
    }
  } catch (error) {
    console.error('[Queue] Error during graceful shutdown of queues:', error);
  }
};
