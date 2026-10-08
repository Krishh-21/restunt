import type { TaxBreakdownLine, TaxRate } from './index';

export interface CalcLineItem {
  unitPrice: number;
  quantity: number;
  modifiers: Array<{ priceAdjustment: number }>;
  taxCategory?: string;
}

export interface OrderCalcInput {
  items: CalcLineItem[];
  serviceChargePercent: number;
  discountAmount: number;
  taxRates: TaxRate[];
}

export interface OrderCalcResult {
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  taxBreakdown: TaxBreakdownLine[];
  discountAmount: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateOrderTotals(input: OrderCalcInput): OrderCalcResult {
  const subtotal = round2(
    input.items.reduce((sum, item) => {
      const modTotal = item.modifiers.reduce((m, mod) => m + mod.priceAdjustment, 0);
      return sum + (item.unitPrice + modTotal) * item.quantity;
    }, 0)
  );

  const serviceCharge = round2(subtotal * (input.serviceChargePercent / 100));
  const taxableBase = subtotal + serviceCharge;

  const defaultRate = input.taxRates[0] ?? { category: 'food', cgst: 2.5, sgst: 2.5 };
  const taxBreakdown: TaxBreakdownLine[] = [];

  let taxAmount = 0;

  interface GroupedTax {
    category: string;
    cgst: number;
    sgst: number;
    taxableAmount: number;
    taxAmount: number;
  }
  const grouped: Record<string, GroupedTax> = {};

  for (const item of input.items) {
    const modTotal = item.modifiers.reduce((m, mod) => m + mod.priceAdjustment, 0);
    const lineTotal = (item.unitPrice + modTotal) * item.quantity;
    const share = subtotal > 0 ? lineTotal / subtotal : 0;
    const lineTaxable = taxableBase * share;
    const rate =
      input.taxRates.find((r) => r.category === (item.taxCategory ?? 'food')) ?? defaultRate;
    const lineTax = lineTaxable * ((rate.cgst + rate.sgst) / 100);

    const key = `${rate.category}_${rate.cgst}_${rate.sgst}`;
    if (!grouped[key]) {
      grouped[key] = {
        category: rate.category,
        cgst: rate.cgst,
        sgst: rate.sgst,
        taxableAmount: 0,
        taxAmount: 0,
      };
    }
    grouped[key].taxableAmount += lineTaxable;
    grouped[key].taxAmount += lineTax;
  }

  for (const val of Object.values(grouped)) {
    const { cgst, sgst } = val;
    const label = `CGST ${cgst}% + SGST ${sgst}%`;
    const roundedAmount = round2(val.taxAmount);

    taxBreakdown.push({
      label,
      rate: cgst + sgst,
      taxableAmount: round2(val.taxableAmount),
      amount: roundedAmount,
    });
    taxAmount += roundedAmount;
  }
  taxAmount = round2(taxAmount);

  const discountAmount = round2(
    Math.min(input.discountAmount, subtotal + serviceCharge + taxAmount)
  );
  const total = round2(subtotal + serviceCharge + taxAmount - discountAmount);

  return { subtotal, serviceCharge, taxAmount, taxBreakdown, discountAmount, total };
}
