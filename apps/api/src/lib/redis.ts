import './loadEnv';
import Redis, { Cluster, type RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CLUSTER_MODE = process.env.REDIS_CLUSTER_MODE === 'true';
const REDIS_CLUSTER_NODES = process.env.REDIS_CLUSTER_NODES; // e.g. "localhost:6379,localhost:6380"

export const getRedisOptions = (): RedisOptions => {
  return {
    maxRetriesPerRequest: null, // Required by Bull queues
    enableReadyCheck: true,
    retryStrategy(times) {
      // Exponential backoff retry strategy for standalone connection
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  };
};

export const createRedisInstance = (overrides: RedisOptions = {}): Redis | Cluster => {
  if (REDIS_CLUSTER_MODE && REDIS_CLUSTER_NODES) {
    const nodes = REDIS_CLUSTER_NODES.split(',').map((node) => {
      const [host, port] = node.trim().split(':');
      return {
        host,
        port: parseInt(port || '6379', 10),
      };
    });
    console.log(`[Redis] Initializing in CLUSTER mode with nodes:`, nodes);
    return new Redis.Cluster(nodes, {
      enableReadyCheck: overrides.enableReadyCheck ?? true,
      redisOptions: { ...getRedisOptions(), ...overrides },
    });
  }

  console.log('[Redis] Initializing in STANDALONE mode');
  return new Redis(REDIS_URL, { ...getRedisOptions(), ...overrides });
};

// Main client instance for caching/session management
export const redisClient = createRedisInstance();

redisClient.on('error', (err) => {
  console.error('[Redis] Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('[Redis] Client connected');
});

redisClient.on('ready', () => {
  console.log('[Redis] Client ready');
});

export const closeRedisConnection = async (): Promise<void> => {
  console.log('[Redis] Closing connection...');
  try {
    await redisClient.quit();
  } catch (error) {
    console.error('[Redis] Error during shutdown:', error);
  }
};
