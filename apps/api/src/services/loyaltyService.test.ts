import { earnedPoints, loyaltyTier } from './loyaltyService';
jest.mock('../lib/prisma', () => ({ prisma: {} }));
test.each([
  [0, 'BRONZE'],
  [999, 'BRONZE'],
  [1000, 'SILVER'],
  [5000, 'GOLD'],
  [10000, 'PLATINUM'],
])('tier at %s points', (points, tier) => expect(loyaltyTier(points as number)).toBe(tier));
test('points round down and reject invalid inputs', () => {
  expect(earnedPoints(199.99, 0.01)).toBe(1);
  expect(() => earnedPoints(-1, 1)).toThrow();
  expect(() => earnedPoints(10, NaN)).toThrow();
});
