export { calculateOrderTotals, type CalcLineItem, type OrderCalcInput, type OrderCalcResult } from '@dinely/types';

export function generateOrderNumber(outletPrefix: string, year: number, sequence: number): string {
  return `${outletPrefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

export function generateInvoiceNumber(
  outletPrefix: string,
  year: number,
  sequence: number
): string {
  return `INV-${outletPrefix}-${year}-${String(sequence).padStart(5, '0')}`;
}
