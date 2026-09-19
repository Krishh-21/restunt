import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import Layout from '../components/Layout';

export default function OrderPage() {
  const { token, outletId } = useAuthStore();
  const { tableId, tableNumber, items, addItem, updateQuantity, subtotal, setOrderId } =
    useCartStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: menuData } = useQuery({
    queryKey: ['menu', outletId],
    queryFn: () => api.getMenu(token!, outletId!),
    enabled: !!token && !!outletId,
  });

  useEffect(() => {
    if (!token) navigate('/login');
    if (!tableId) navigate('/tables');
  }, [token, tableId, navigate]);

  async function handleSendToKitchen() {
    if (items.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api.createOrder(token!, outletId!, {
        tableId: tableId!,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions,
        })),
      });
      await api.generateKOT(token!, outletId!, order.id);
      setOrderId(order.id);
      navigate('/payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  const categories = menuData?.categories ?? [];

  return (
    <Layout title={`Table ${tableNumber}`} showBack onBack={() => navigate('/tables')}>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="text-left p-4 bg-white rounded-lg border hover:border-orange-400 hover:shadow transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        {item.tags.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-orange-600 ml-2">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:w-80 shrink-0">
          <div className="bg-white rounded-xl border p-4 sticky top-4">
            <h3 className="font-semibold text-lg mb-4">Cart ({items.length})</h3>
            {items.length === 0 ? (
              <p className="text-gray-400 text-sm">Tap items to add</p>
            ) : (
              <ul className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.menuItem.id} className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.menuItem.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.menuItem.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                        className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                        className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t pt-3 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal())}</span>
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              onClick={handleSendToKitchen}
              disabled={items.length === 0 || submitting}
              className="w-full mt-4 bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send to Kitchen & Pay'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
