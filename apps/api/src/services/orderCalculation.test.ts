import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { calculateOrderTotals } from '../services/orderCalculation';

describe('Order Calculation Property Tests', () => {
  it('Property 2: Order Calculation Correctness (subtotal + serviceCharge + tax - discount = total)', () => {
    fc.assert(
      fc.property(
        fc.record({
          items: fc.array(
            fc.record({
              unitPrice: fc.double({ min: 10, max: 1000, noNaN: true, noInfinity: true }),
              quantity: fc.integer({ min: 1, max: 10 }),
              modifiers: fc.array(
                fc.record({
                  priceAdjustment: fc.double({ min: 0, max: 100, noNaN: true, noInfinity: true }),
                }),
                { maxLength: 3 }
              ),
              taxCategory: fc.constantFrom('food', 'beverage'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          serviceChargePercent: fc.double({ min: 0, max: 20, noNaN: true, noInfinity: true }),
          discountAmount: fc.double({ min: 0, max: 500, noNaN: true, noInfinity: true }),
          taxRates: fc.array(
            fc.record({
              category: fc.constantFrom('food', 'beverage'),
              cgst: fc.double({ min: 0, max: 10, noNaN: true, noInfinity: true }),
              sgst: fc.double({ min: 0, max: 10, noNaN: true, noInfinity: true }),
            })
          ),
        }),
        (input) => {
          const result = calculateOrderTotals({
            items: input.items,
            serviceChargePercent: input.serviceChargePercent,
            discountAmount: input.discountAmount,
            taxRates: input.taxRates,
          });

          // Check basic properties
          expect(result.subtotal).toBeGreaterThanOrEqual(0);
          expect(result.serviceCharge).toBeGreaterThanOrEqual(0);
          expect(result.taxAmount).toBeGreaterThanOrEqual(0);
          expect(result.discountAmount).toBeGreaterThanOrEqual(0);

          // Correct total formula
          const expectedTotal = Math.max(
            0,
            Math.round(
              (result.subtotal + result.serviceCharge + result.taxAmount - result.discountAmount) *
                100
            ) / 100
          );
          expect(result.total).toBeCloseTo(expectedTotal, 2);
        }
      )
    );
  });

  it('Property 4: GST Compliance (CGST = SGST)', () => {
    fc.assert(
      fc.property(
        fc.record({
          items: fc.array(
            fc.record({
              unitPrice: fc.double({ min: 10, max: 500, noNaN: true, noInfinity: true }),
              quantity: fc.integer({ min: 1, max: 5 }),
              modifiers: fc.constant([]),
              taxCategory: fc.constant('food'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          serviceChargePercent: fc.double({ min: 0, max: 15, noNaN: true, noInfinity: true }),
          taxRateVal: fc.double({ min: 1, max: 10, noNaN: true, noInfinity: true }),
        }),
        (input) => {
          const result = calculateOrderTotals({
            items: input.items,
            serviceChargePercent: input.serviceChargePercent,
            discountAmount: 0,
            taxRates: [
              {
                category: 'food',
                cgst: input.taxRateVal,
                sgst: input.taxRateVal,
              },
            ],
          });

          // Verify CGST and SGST breakdown lines are identical or CGST rate = SGST rate matches
          for (const line of result.taxBreakdown) {
            expect(line.label).toContain(`CGST ${input.taxRateVal}% + SGST ${input.taxRateVal}%`);
            expect(line.amount).toBeGreaterThanOrEqual(0);
          }
        }
      )
    );
  });
});

it('supports tax category names containing underscores', () => {
  const result = calculateOrderTotals({
    items: [{ unitPrice: 100, quantity: 1, modifiers: [], taxCategory: 'hot_food' }],
    serviceChargePercent: 0,
    discountAmount: 0,
    taxRates: [{ category: 'hot_food', cgst: 2.5, sgst: 2.5 }],
  });
  expect(result.taxAmount).toBe(5);
  expect(result.taxBreakdown[0].rate).toBe(5);
  expect(result.total).toBe(105);
});
