import { discountAmount } from './discountService';
const base: any = {
  isActive: true,
  validFrom: new Date('2020-01-01'),
  validUntil: new Date('2099-01-01'),
  outletIds: [],
  applicableItems: [],
  minOrderValue: null,
  maxDiscount: null,
  usageLimit: null,
  usageCount: 0,
  type: 'PERCENTAGE',
  value: 10,
};
test('percentage cap and eligible items', () => {
  expect(discountAmount({ ...base, maxDiscount: 15 }, 'o', 200, [])).toBe(15);
  expect(
    discountAmount({ ...base, applicableItems: ['a'] }, 'o', 200, [
      { menuItemId: 'a', quantity: 2, unitPrice: 50 },
    ])
  ).toBe(10);
});
test.each([
  { isActive: false },
  { validUntil: new Date(0) },
  { outletIds: ['other'] },
  { minOrderValue: 500 },
  { usageLimit: 1, usageCount: 1 },
  { applicableItems: ['missing'] },
])('rejects ineligible discount %j', (changes) => {
  expect(() => discountAmount({ ...base, ...changes }, 'o', 100, [])).toThrow();
});
test('fixed discount never exceeds eligible subtotal', () =>
  expect(discountAmount({ ...base, type: 'FIXED', value: 500 }, 'o', 100, [])).toBe(100));
