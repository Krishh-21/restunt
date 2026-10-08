import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../store/authStore';
import Layout from '../components/Layout';
interface Row {
  [key: string]: unknown;
}
type Field = { name: string; label: string; type?: string; options?: string[]; optional?: boolean };
const sections: Record<string, { path: string; columns: string[]; fields?: Field[] }> = {
  Inventory: {
    path: '/api/inventory/items',
    columns: [
      'name',
      'category',
      'currentQuantity',
      'unitOfMeasure',
      'weightedAverageCost',
      'lowStock',
    ],
    fields: [
      { name: 'name', label: 'Item name' },
      {
        name: 'category',
        label: 'Category',
        options: ['vegetables', 'meats', 'dairy', 'dry-goods'],
      },
      { name: 'unitOfMeasure', label: 'Unit', options: ['kg', 'liter', 'piece'] },
      { name: 'currentQuantity', label: 'Opening stock', type: 'number' },
      { name: 'minimumThreshold', label: 'Low-stock threshold', type: 'number' },
      { name: 'reorderQuantity', label: 'Reorder quantity', type: 'number' },
      { name: 'weightedAverageCost', label: 'Cost per unit', type: 'number' },
    ],
  },
  Customers: {
    path: '/api/crm/customers',
    columns: ['name', 'phone', 'loyaltyTier', 'loyaltyPoints', 'lifetimeValue', 'orderCount'],
    fields: [
      { name: 'name', label: 'Name' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email', optional: true },
    ],
  },
  Vendors: {
    path: '/api/inventory/vendors',
    columns: ['name', 'contactPerson', 'phone', 'email', 'paymentTerms'],
    fields: [
      { name: 'name', label: 'Vendor name' },
      { name: 'contactPerson', label: 'Contact person' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email', optional: true },
      { name: 'paymentTerms', label: 'Payment terms', optional: true },
      { name: 'gstin', label: 'GSTIN', optional: true },
    ],
  },
  Purchases: {
    path: '/api/inventory/purchase-orders',
    columns: ['poNumber', 'vendorName', 'status', 'total', 'createdAt'],
  },
  Expenses: {
    path: '/api/accounting/expenses',
    columns: ['category', 'amount', 'vendorName', 'description', 'expenseDate'],
    fields: [
      {
        name: 'category',
        label: 'Category',
        options: ['FOOD_COST', 'LABOR', 'RENT', 'UTILITIES', 'MARKETING', 'OTHER'],
      },
      { name: 'amount', label: 'Amount', type: 'number' },
      {
        name: 'paymentMethod',
        label: 'Paid by',
        options: ['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE'],
      },
      { name: 'vendorName', label: 'Vendor' },
      { name: 'description', label: 'Description' },
      { name: 'expenseDate', label: 'Expense date', type: 'date' },
    ],
  },
  Staff: {
    path: '/api/users',
    columns: ['fullName', 'username', 'email', 'role', 'isActive'],
    fields: [
      { name: 'username', label: 'Username' },
      { name: 'fullName', label: 'Full name' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Initial password', type: 'password' },
      { name: 'pin', label: 'Tablet PIN', optional: true },
      {
        name: 'role',
        label: 'Role',
        options: ['MANAGER', 'CASHIER', 'SERVER', 'KITCHEN', 'RIDER'],
      },
    ],
  },
  Feedback: {
    path: '/api/crm/feedback',
    columns: [
      'overallRating',
      'foodQualityRating',
      'serviceSpeedRating',
      'comments',
      'response',
      'status',
    ],
  },
  Audit: { path: '/api/audit', columns: ['action', 'entityType', 'timestamp', 'reason'] },
};
const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const display = (value: unknown) =>
  value === null || value === undefined
    ? '—'
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : String(value);
export default function ManagementPage() {
  const { token, outletId, user } = useAuthStore();
  const client = useQueryClient();
  const [section, setSection] = useState('Dashboard');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [all, setAll] = useState(false);
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(((globalThis as {__DINELY_CONFIG__?:{apiUrl:string}}).__DINELY_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? '') + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        'x-outlet-id': outletId!,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Request failed');
    return data;
  };
  const filters = `?startDate=${start}&endDate=${end}T23:59:59.999Z&outlets=${all ? 'all' : outletId}`;
  const dashboard = useQuery({
    queryKey: ['dashboard', outletId, all],
    queryFn: () => request('/api/analytics/dashboard?outlets=' + (all ? 'all' : outletId)),
    refetchInterval: 60000,
    enabled: section === 'Dashboard',
  });
  const sales = useQuery({
    queryKey: ['sales', outletId, start, end, all],
    queryFn: () => request('/api/analytics/reports/sales' + filters),
    enabled: section === 'Dashboard',
  });
  const resource = sections[section];
  const records = useQuery<Row[]>({
    queryKey: ['manage', section, outletId],
    queryFn: () => request(resource.path),
    enabled: !!resource,
  });
  const drawer = useQuery<Row | null>({
    queryKey: ['drawer', outletId],
    queryFn: () => request('/api/pos/cash-drawer'),
    refetchInterval: 15000,
  });
  const inventory = useQuery<Row[]>({
    queryKey: ['purchase-items', outletId],
    queryFn: () => request('/api/inventory/items'),
    enabled: section === 'Purchases',
  });
  const vendors = useQuery<Row[]>({
    queryKey: ['purchase-vendors', outletId],
    queryFn: () => request('/api/inventory/vendors'),
    enabled: section === 'Purchases',
  });
  async function mutate(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      await client.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportData(){setBusy(true);setError('');try{const response=await fetch(((globalThis as {__DINELY_CONFIG__?:{apiUrl:string}}).__DINELY_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? '')+'/api/export',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({startDate:start,endDate:end+'T23:59:59.999Z'})});if(!response.ok)throw new Error((await response.json()).error?.message||'Export failed');const blob=await response.blob();JSON.parse(await blob.text());const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='dinely-export-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function drawerAction() {
    const amount = window.prompt(drawer.data ? 'Counted cash at closing' : 'Opening cash amount');
    if (amount === null) return;
    await mutate(
      '/api/pos/cash-drawer/' + (drawer.data ? 'close' : 'open'),
      drawer.data ? { actualClosingAmount: Number(amount) } : { openingAmount: Number(amount) }
    );
  }
  return (
    <Layout title="Restaurant management" showBack onBack={() => window.history.back()}>
      <div className="space-y-6">
        {user?.role==='ADMIN'&&<button disabled={busy} onClick={()=>void exportData()} className="border rounded p-3">Export restaurant data (selected date range)</button>}
        <div className="flex flex-wrap gap-2">
          {['Dashboard', ...Object.keys(sections)].map((name) => (
            <button
              key={name}
              onClick={() => {
                setSection(name);
                setError('');
              }}
              className={
                'rounded-lg px-4 py-2 ' +
                (section === name ? 'bg-orange-600 text-white' : 'bg-white border')
              }
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span>
            Cash drawer:{' '}
            {drawer.data
              ? 'Open / expected ' + display(drawer.data.expectedClosingAmount)
              : 'Closed'}
          </span>
          <button
            disabled={busy}
            onClick={() => void drawerAction()}
            className="border rounded px-3 py-2"
          >
            {drawer.data ? 'Close drawer' : 'Open drawer'}
          </button>
        </div>
        {Boolean(error || records.error || dashboard.error) && (
          <p role="alert" className="text-red-700">
            {error || (records.error as Error)?.message || (dashboard.error as Error)?.message}
          </p>
        )}
        {section === 'Dashboard' ? (
          <>
            <div className="flex flex-wrap gap-4">
              <label>
                From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label>
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />{' '}
                All assigned outlets
              </label>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                'revenue',
                'orderCount',
                'averageOrderValue',
                'foodCostPercent',
                'laborCostPercent',
                'tableTurnover',
              ].map((key) => (
                <div key={key} className="bg-white border rounded-xl p-5">
                  <p className="text-gray-500 text-sm">{label(key)}</p>
                  <p className="text-2xl font-semibold">{display(dashboard.data?.[key])}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-5 rounded-xl border">
              <h2 className="font-semibold mb-4">Sales by order channel</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={(sales.data ?? []).map((row: Row) => ({
                    name: display(row.source) + ' / ' + display(row.type),
                    revenue: Number((row._sum as Row)?.total ?? 0),
                  }))}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#ea580c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <>
            {resource.fields && (
              <form
                className="bg-white border rounded-xl p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  const body: Row = {};
                  for (const field of resource.fields!) {
                    const value = values.get(field.name);
                    if (value !== '' && value !== null)
                      body[field.name] = field.type === 'number' ? Number(value) : value;
                  }
                  if (section === 'Staff') body.outletAssignments = [outletId];
                  await mutate(resource.path, body);
                  form.reset();
                }}
              >
                {resource.fields.map((field) => (
                  <label key={field.name} className="text-sm">
                    {field.label}
                    {field.options ? (
                      <select name={field.name} className="block w-full border rounded p-2">
                        {field.options.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={field.name}
                        type={field.type ?? 'text'}
                        step="any"
                        required={!field.optional}
                        className="block w-full border rounded p-2"
                      />
                    )}
                  </label>
                ))}
                <button disabled={busy} className="self-end bg-orange-600 text-white rounded p-2">
                  Add{' '}
                  {section === 'Staff' ? 'staff member' : section.toLowerCase().replace(/s$/, '')}
                </button>
              </form>
            )}
            {section === 'Purchases' && (
              <form
                className="bg-white p-5 border rounded flex flex-wrap gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  void mutate('/api/inventory/purchase-orders', {
                    vendorId: values.get('vendor'),
                    lineItems: [
                      {
                        inventoryItemId: values.get('item'),
                        quantity: Number(values.get('quantity')),
                        costPerUnit: Number(values.get('cost')),
                      },
                    ],
                  });
                }}
              >
                <label>
                  Vendor
                  <select name="vendor" required className="block border p-2">
                    {vendors.data?.map((v) => (
                      <option key={String(v.id)} value={String(v.id)}>
                        {display(v.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Item
                  <select name="item" required className="block border p-2">
                    {inventory.data?.map((v) => (
                      <option key={String(v.id)} value={String(v.id)}>
                        {display(v.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    name="quantity"
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    className="block border p-2"
                  />
                </label>
                <label>
                  Unit cost
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="block border p-2"
                  />
                </label>
                <button disabled={busy} className="border px-3">
                  Create purchase order
                </button>
              </form>
            )}
            <div className="bg-white border rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {resource.columns.map((column) => (
                      <th key={column} className="p-3 border-b">
                        {label(column)}
                      </th>
                    ))}
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.data?.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      {resource.columns.map((column) => (
                        <td key={column} className="p-3 border-b">
                          {display(row[column])}
                        </td>
                      ))}
                      <td className="p-3 border-b">
                        {section === 'Inventory' &&
                          ['ADMIN', 'MANAGER'].includes(user?.role ?? '') && (
                            <button
                              onClick={() => {
                                const change = window.prompt(
                                  'Stock adjustment (negative to reduce)'
                                );
                                if (change === null) return;
                                const reason = window.prompt('Reason for adjustment');
                                if (reason)
                                  void mutate(
                                    '/api/inventory/items/' + row.id + '/adjust',
                                    {
                                      version: row.version,
                                      quantityChange: Number(change),
                                      reason,
                                    },
                                    'PATCH'
                                  );
                              }}
                            >
                              Adjust stock
                            </button>
                          )}
                        {section === 'Purchases' &&
                          ['DRAFT', 'SENT'].includes(String(row.status)) && (
                            <button
                              onClick={() =>
                                void mutate(
                                  '/api/inventory/purchase-orders/' + row.id + '/receive',
                                  {}
                                )
                              }
                            >
                              Receive goods
                            </button>
                          )}
                        {section === 'Feedback' && (
                          <button
                            onClick={() => {
                              const response = window.prompt('Response to customer');
                              if (response)
                                void mutate('/api/crm/feedback/' + row.id + '/respond', {
                                  response,
                                });
                            }}
                          >
                            Respond
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.isLoading && <p className="p-4">Loading…</p>}
              {records.data?.length === 0 && <p className="p-4">No records yet</p>}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
