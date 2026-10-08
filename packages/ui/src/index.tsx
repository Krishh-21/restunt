import type { ReactNode } from 'react';
export function StatusMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return <p role={error ? 'alert' : 'status'}>{children}</p>;
}
export function Money({ amount, currency = 'INR' }: { amount: number; currency?: string }) {
  return (
    <span>{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)}</span>
  );
}

export { Storefront } from './Storefront';
