import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency, type MenuItemResponse } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import Layout from '../components/Layout';

export default function OrderPage() {
  const { token, outletId } = useAuthStore();
  const { tableId, tableNumber, items, addItem, updateQuantity, subtotal, setOrderId, clear } =
    useCartStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MenuItemResponse | null>(null);

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
          modifiers: i.modifiers,
        })),
      });
      if (order.pendingSync) { clear(); navigate('/tables'); return; }
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
      {selected && <div role="dialog" aria-label="Customize item" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><form className="bg-white rounded-xl p-6 max-w-md w-full grid gap-4" onSubmit={event => {event.preventDefault();const values=new FormData(event.currentTarget);const modifiers:{name:string;option:string;priceAdjustment:number}[]=[];for(const group of selected.modifiers??[])for(const value of values.getAll(group.name)){if(!value)continue;const option=group.options.find(o=>o.name===value)!;modifiers.push({name:group.name,option:option.name,priceAdjustment:option.priceAdjustment});}addItem(selected,modifiers,String(values.get('instructions')??''));setSelected(null);}}><h2 className="text-xl font-semibold">{selected.name}</h2>{selected.modifiers?.map(group=><label key={group.name}>{group.name}{group.required?' *':''}<select name={group.name} multiple={group.type==='multiple'} required={group.required} className="block border rounded p-3 w-full"><option value="">Choose</option>{group.options.map(option=><option key={option.name} value={option.name}>{option.name} / {formatCurrency(option.priceAdjustment)}</option>)}</select></label>)}<label>Special instructions<input name="instructions" className="block border rounded p-3 w-full"/></label><div className="flex gap-3"><button type="button" onClick={()=>setSelected(null)} className="border rounded p-3">Cancel</button><button className="bg-orange-600 text-white rounded p-3">Add item</button></div></form></div>}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
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
                  <li key={item.cartId} className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.menuItem.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.menuItem.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                        className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
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
