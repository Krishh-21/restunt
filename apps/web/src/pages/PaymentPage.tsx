import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import Layout from '../components/Layout';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'upi', label: 'UPI', icon: '📱' },
  { id: 'online', label: 'Verified online', icon: '✓' },
  { id: 'wallet', label: 'Wallet', icon: '👛' },
] as const;

export default function PaymentPage() {
  const { token, outletId } = useAuthStore();
  const { orderId, tableNumber, clear } = useCartStore();
  const navigate = useNavigate();
  const [method, setMethod] = useState<string>('cash');
  const [settling, setSettling] = useState(false);
  const [invoice, setInvoice] = useState<Awaited<ReturnType<typeof api.settleOrder>> | null>(null);

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrder(token!, outletId!, orderId!),
    enabled: !!token && !!outletId && !!orderId,
  });

  useEffect(() => {
    if (!token) navigate('/login');
    if (!orderId) navigate('/tables');
  }, [token, orderId, navigate]);

  useEffect(() => {
    if (order?.paymentStatus === 'PAID') setMethod('online');
  }, [order?.paymentStatus]);

  useEffect(()=>{if(order?.status==='SETTLED'&&token&&outletId)void api.getInvoice(token,outletId,order.id).then(setInvoice).catch(()=>undefined);},[order?.status,token,outletId]);

  async function handleSettle() {
    if (!orderId) return;
    setSettling(true);
    try {
      const result = await api.settleOrder(token!, outletId!, orderId, method);
      setInvoice(await api.getInvoice(token!, outletId!, result.id).catch(() => result));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSettling(false);
    }
  }

  function handleDone() {
    clear();
    navigate('/tables');
  }

  if (invoice) {
    return (
      <Layout title="Invoice">
        <div className="max-w-md mx-auto bg-white rounded-xl border p-6 text-center">
          <h1 className="text-xl font-bold">{invoice.restaurantName}</h1>
          {invoice.gstin && <p>GSTIN: {invoice.gstin}</p>}
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">{invoice.pendingSync?'Payment recorded on this device':'Payment Successful'}</h2>{invoice.pendingSync&&<p role="status">Provisional receipt. Server settlement and invoice number are pending synchronization.</p>}
          <button onClick={() => window.print()} className="border rounded p-2 my-3 print:hidden">
            Print invoice
          </button>
          <p className="text-gray-500 mb-6">Table {tableNumber}</p>
          <div className="text-left space-y-2 border-t border-b py-4 mb-6">
            {invoice.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.menuItemName} × {item.quantity}
                </span>
                <span>{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Service charge</span>
              <span>{formatCurrency(invoice.serviceCharge)}</span>
            </div>
            {invoice.taxBreakdown?.map((line) => (
              <div key={line.label} className="flex justify-between">
                <span>{line.label}</span>
                <span>{formatCurrency(line.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{formatCurrency(invoice.discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice</span>
              <span className="font-mono">{invoice.invoiceNumber??'Pending server allocation'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span>{invoice.orderNumber}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total Paid</span>
              <span className="text-orange-600">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
          <button
            onClick={handleDone}
            className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700"
          >
            Back to Tables
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Payment — Table ${tableNumber}`} showBack onBack={() => navigate('/order')}>
      <div className="max-w-lg mx-auto">
        {order && (
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h3 className="font-semibold mb-4">Bill Summary</h3>
            <ul className="space-y-2 mb-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.menuItemName} × {item.quantity}
                  </span>
                  <span>{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge</span>
                <span>{formatCurrency(order.serviceCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2">
                <span>Total</span>
                <span className="text-orange-600">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  method === m.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="mt-1 font-medium">{m.label}</p>
              </button>
            ))}
          </div>
          <button
            onClick={handleSettle}
            disabled={settling}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {settling ? 'Processing...' : `Collect ${order ? formatCurrency(order.total) : ''}`}
          </button>
        </div>
      </div>
    </Layout>
  );
}
