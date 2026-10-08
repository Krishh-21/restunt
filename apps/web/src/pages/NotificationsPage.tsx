import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/authStore';
const base =
  (globalThis as { __DINELY_CONFIG__?: { apiUrl: string } }).__DINELY_CONFIG__?.apiUrl ??
  import.meta.env.VITE_API_URL ??
  '';
export default function NotificationsPage() {
  const { token, outletId } = useAuthStore();
  const client = useQueryClient();
  const [error, setError] = useState('');
  async function request(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(base + '/api/notifications' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        'x-outlet-id': outletId!,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Request failed');
    return data;
  }
  const prefs = useQuery({
    queryKey: ['notification-preferences', outletId],
    queryFn: () => request('/preferences'),
  });
  const alerts = useQuery<
    { id: string; title: string; body: string; readAt: string | null; createdAt: string }[]
  >({ queryKey: ['notifications', outletId], queryFn: () => request(''), refetchInterval: 30000 });
  async function save(body: unknown) {
    try {
      setError('');
      await request('/preferences', 'PUT', body);
      await client.invalidateQueries({ queryKey: ['notification-preferences'] });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Layout title="Notifications" showBack onBack={() => window.history.back()}>
      <div className="space-y-4">
        {error && <p role="alert">{error}</p>}
        {prefs.data && (
          <section className="bg-white rounded p-4 space-y-3">
            <h2 className="font-bold">Delivery preferences</h2>
            <label className="block">
              <input
                type="checkbox"
                checked={prefs.data.preference.email}
                disabled={!prefs.data.providers.email}
                onChange={(e) => void save({ ...prefs.data.preference, email: e.target.checked })}
              />{' '}
              Email alerts {prefs.data.providers.email ? '' : '(SMTP is not configured)'}
            </label>
            {['stock:low', 'feedback:negative', 'order:voided', 'cash:variance'].map((event) => (
              <label className="block" key={event}>
                <input
                  type="checkbox"
                  checked={prefs.data.preference.events.includes(event)}
                  onChange={(e) =>
                    void save({
                      ...prefs.data.preference,
                      events: e.target.checked
                        ? [...prefs.data.preference.events, event]
                        : prefs.data.preference.events.filter((x: string) => x !== event),
                    })
                  }
                />{' '}
                {event}
              </label>
            ))}
          </section>
        )}
        {alerts.error && <p role="alert">{(alerts.error as Error).message}</p>}
        {alerts.data?.length === 0 && <p>No notifications yet.</p>}
        {alerts.data?.map((alert) => (
          <article key={alert.id} className="bg-white border rounded p-4">
            <h2 className="font-bold">{alert.title}</h2>
            <p>{alert.body}</p>
            <time>{new Date(alert.createdAt).toLocaleString()}</time>
            {!alert.readAt && (
              <button
                className="ml-4 border rounded px-2"
                onClick={() =>
                  void request('/' + alert.id + '/read', 'POST')
                    .then(() => client.invalidateQueries({ queryKey: ['notifications'] }))
                    .catch((e) => setError(e.message))
                }
              >
                Mark read
              </button>
            )}
          </article>
        ))}
      </div>
    </Layout>
  );
}
