import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type TableResponse } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import Layout from '../components/Layout';

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 border-green-400 text-green-800',
  OCCUPIED: 'bg-red-100 border-red-400 text-red-800',
  RESERVED: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  CLEANING: 'bg-gray-100 border-gray-400 text-gray-600',
};

export default function TablesPage() {
  const { token, outletId } = useAuthStore();
  const setTable = useCartStore((s) => s.setTable);
  const setOrderId = useCartStore((s) => s.setOrderId);
  const clear = useCartStore((s) => s.clear);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables', outletId],
    queryFn: () => api.getTables(token!, outletId!),
    enabled: !!token && !!outletId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  function handleSelectTable(table: TableResponse) {
    if (table.currentOrderId) {
      clear();
      setTable(table.id, table.number);
      setOrderId(table.currentOrderId);
      navigate('/payment');
      return;
    }
    if (table.status !== 'AVAILABLE') return;
    setSelected(table.id);
  }

  function startOrder() {
    const table = tables.find((t) => t.id === selected);
    if (!table) return;
    clear();
    setTable(table.id, table.number);
    navigate('/order');
  }

  return (
    <Layout title="Select Table">
      {isLoading ? (
        <p className="text-gray-500">Loading tables...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => handleSelectTable(table)}
                disabled={table.status !== 'AVAILABLE' && !table.currentOrderId}
                className={`p-6 rounded-xl border-2 text-center transition transform hover:scale-105 ${
                  statusColors[table.status] ?? 'bg-white border-gray-200'
                } ${selected === table.id ? 'ring-4 ring-orange-400' : ''} ${
                  table.status !== 'AVAILABLE' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="text-2xl font-bold">{table.number}</div>
                <div className="text-sm mt-1 capitalize">{table.status.toLowerCase()}</div>
                <div className="text-xs text-gray-500 mt-1">{table.capacity} seats</div>
              </button>
            ))}
          </div>
          {selected && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
              <button
                onClick={startOrder}
                className="w-full max-w-md mx-auto block bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700"
              >
                Start Order — Table {tables.find((t) => t.id === selected)?.number}
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
