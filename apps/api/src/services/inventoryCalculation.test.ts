import fc from 'fast-check';
import { receiveStock } from './inventoryCalculation';
it('preserves quantity and purchase value across goods receipts', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 100000 }),
      fc.integer({ min: 0, max: 100000 }),
      fc.integer({ min: 1, max: 100000 }),
      fc.integer({ min: 0, max: 100000 }),
      (q, c, received, cost) => {
        const result = receiveStock(q, c, received, cost);
        expect(result.quantity).toBe(q + received);
        expect(result.weightedAverageCost * result.quantity).toBeCloseTo(
          q * c + received * cost,
          2
        );
        expect(result.weightedAverageCost).toBeGreaterThanOrEqual(Math.min(c, cost));
        expect(result.weightedAverageCost).toBeLessThanOrEqual(Math.max(c, cost));
      }
    )
  );
});
it('uses receipt cost when opening stock is empty', () => {
  expect(receiveStock(0, 999, 10, 25)).toEqual({ quantity: 10, weightedAverageCost: 25 });
});
it.each([NaN, Infinity, -1, 0])('rejects invalid received quantity %s', (quantity) => {
  expect(() => receiveStock(1, 10, quantity, 20)).toThrow();
});
