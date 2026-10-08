import { prisma } from './prisma';
import { deliverNotification } from '../services/notificationService';
import { createDatabaseBackup } from '../services/backupService';
import {
  sendWhatsApp,
  verifyInventoryDeduction,
  reconcilePayment,
} from '../services/jobProcessors';
import Queue from 'bull';
import Redis, { Cluster } from 'ioredis';
import { redisClient, createRedisInstance } from './redis';

// Dedicated subscriber connection to be shared among queues
let sharedSubscriber: Redis | Cluster | null = null;

const getSharedSubscriber = (): Redis | Cluster => {
  if (!sharedSubscriber) {
    sharedSubscriber = createRedisInstance({ enableReadyCheck: false, maxRetriesPerRequest: null });
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
  removeOnFail: false, // Keep failed jobs for manual auditing or retries
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
          const bclient = createRedisInstance({
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
          });
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
export const notificationQueue=createQueue('notification-queue');
notificationQueue.process(job=>deliverNotification(job.data.id));
export async function dispatchNotifications(){const pending=await prisma.notificationDelivery.findMany({where:{OR:[{channels:{has:'EMAIL'},emailSentAt:null},{channels:{has:'PUSH'},pushSentAt:null}],createdAt:{gte:new Date(Date.now()-7*86400000)}},take:100});for(const row of pending)await notificationQueue.add({id:row.id},{jobId:row.id});}

// Log helper
const setupQueueListeners = (queue: Queue.Queue, name: string) => {
  queue.on('completed', (job, result) => {
    console.log(`[Queue - ${name}] Job ${job.id} completed. Result:`, result);
  });
  queue.on('failed', (job, err) => {
    console.error(
      `[Queue - ${name}] Job ${job.id} failed (Attempt ${job.attemptsMade}/${job.opts.attempts}). Error:`,
      err.message
    );
  });
};

setupQueueListeners(whatsappQueue, 'WhatsApp');
setupQueueListeners(inventoryQueue, 'Inventory Deduction');
setupQueueListeners(paymentQueue, 'Payment Reconciliation');
setupQueueListeners(backupQueue, 'Backup');

// Provider errors remain failed jobs for the configured retry/backoff policy.
whatsappQueue.process((job) => sendWhatsApp(job.data));
inventoryQueue.process((job) => verifyInventoryDeduction(job.data));
paymentQueue.process((job) => reconcilePayment(job.data));
backupQueue.process(() => createDatabaseBackup());
export async function scheduleBackups(){if(process.env.BACKUP_ENABLED==='true')await backupQueue.add({}, {jobId:'scheduled-database-backup', repeat:{cron:process.env.BACKUP_CRON||'0 2 * * *'},removeOnComplete:20});}

// Graceful close of all queues
export const shutdownQueues = async (): Promise<void> => {
  console.log('[Queue] Shutting down queues gracefully...');
  try {
    await Promise.all([
      whatsappQueue.close(),
      inventoryQueue.close(),
      paymentQueue.close(),
      backupQueue.close(),
      notificationQueue.close(),
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
