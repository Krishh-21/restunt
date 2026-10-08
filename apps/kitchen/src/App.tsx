import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
const base = (globalThis as {__DINELY_CONFIG__?:{apiUrl:string}}).__DINELY_CONFIG__?.apiUrl ?? import.meta.env.VITE_API_URL ?? '';
interface Item {
  id: string;
  menuItemName: string;
  quantity: number;
  status: string;
  specialInstructions?: string;
}
interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  notes?: string;
  items: Item[];
}
interface Session {
  token: string;
  outletId: string;
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [station, setStation] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const request = useCallback(
    async (path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(session
            ? { Authorization: `Bearer ${session.token}`, 'x-outlet-id': session.outletId }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setSession(null);
        throw new Error(data.error?.message || 'Request failed');
      }
      return data;
    },
    [session]
  );
  const refresh = useCallback(async () => {
    try {
      setOrders(
        await request(
          '/api/kds/orders' + (station ? '?stationId=' + encodeURIComponent(station) : '')
        )
      );
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request, station]);
  useEffect(() => {
    if (!session) return;
    void refresh();
    void request('/api/kds/stations')
      .then(setStations)
      .catch((e) => setError(e.message));
    const socket = io(base || window.location.origin, {
      auth: { token: session.token, outletId: session.outletId },
    });
    socket.on('connect', () => {
      setConnected(true);
      void refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    for (const event of ['order:created', 'order:updated', 'order:update', 'order:priority'])
      socket.on(event, () => void refresh());
    socket.on('order:new', () => {
      void refresh();
      const context = audio.current;
      if (context && context.state === 'running') {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        gain.gain.value = 0.1;
        oscillator.frequency.value = 880;
        oscillator.start();
        oscillator.stop(context.currentTime + 0.3);
      }
    });
    const poll = window.setInterval(() => void refresh(), 15000);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.disconnect();
      window.clearInterval(poll);
      window.clearInterval(timer);
    };
  }, [session, request, refresh]);
  async function mutate(path: string, method: string) {
    setBusy(true);
    try {
      await request(path, method);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <main>
        <h1>Dinely Kitchen</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              const data = await request('/api/auth/login', 'POST', {
                username: form.get('username'),
                password: form.get('password'),
              });
              setSession(data);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Username
            <input name="username" required autoComplete="username" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button disabled={busy}>Sign in</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  return (
    <main>
      <header>
        <h1>Dinely Kitchen</h1>
        <span>{connected ? 'Live' : 'Reconnecting � refreshing every 15 seconds'}</span>
        <select
          aria-label="Kitchen station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
        >
          <option value="">All stations</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            audio.current ??= new AudioContext();
            await audio.current.resume();
          }}
        >
          Enable sound
        </button>
        <button onClick={() => setSession(null)}>Sign out</button>
      </header>
      {error && <p role="alert">{error}</p>}
      <section>
        {orders.length === 0 && <p>No active kitchen orders</p>}
        {orders.map((order) => {
          const minutes = Math.max(
            0,
            Math.floor((now - new Date(order.createdAt).getTime()) / 60000)
          );
          return (
            <article
              key={order.id}
              className={minutes < 5 ? 'green' : minutes <= 10 ? 'yellow' : 'red'}
            >
              <h2>{order.orderNumber}</h2>
              <p>
                {minutes} min � {order.status}
              </p>
              {order.notes && <p>{order.notes}</p>}
              {order.items.map((item) => (
                <label key={item.id} className="item">
                  <input
                    type="checkbox"
                    checked={item.status === 'READY' || item.status === 'SERVED'}
                    disabled={busy || item.status === 'READY' || item.status === 'SERVED'}
                    onChange={() =>
                      void mutate(`/api/kds/orders/${order.id}/items/${item.id}`, 'PATCH')
                    }
                  />
                  <span>
                    {item.quantity} � {item.menuItemName}
                    {item.specialInstructions && <small>{item.specialInstructions}</small>}
                  </span>
                </label>
              ))}
              <button
                disabled={busy || order.status === 'READY' || !!station}
                onClick={() => void mutate(`/api/kds/orders/${order.id}/ready`, 'POST')}
              >
                {order.status === 'READY'
                  ? 'Ready for service'
                  : station
                    ? 'Complete station items above'
                    : 'Mark order ready'}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}
