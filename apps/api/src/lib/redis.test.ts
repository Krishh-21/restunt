jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));
import Redis from 'ioredis';
import { createRedisInstance } from './redis';
it('disables ready checks and request retries for Bull subscriber/blocking connections', () => {
  createRedisInstance({ enableReadyCheck: false, maxRetriesPerRequest: null });
  expect(Redis).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ enableReadyCheck: false, maxRetriesPerRequest: null })
  );
});
