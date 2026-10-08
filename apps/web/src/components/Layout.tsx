import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { offlineStore, flushOffline } from '../lib/offline';
import { useAuthStore } from '../store/authStore';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Layout({ title, children, showBack, onBack }: LayoutProps) {
  const { user, logout, token, outletId } = useAuthStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [conflicts,setConflicts]=useState<{id:string;error?:string;type:string}[]>([]);
  const [syncError, setSyncError] = useState('');
  const client = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      if (user) void offlineStore().operations.toArray().then(rows=>{setPending(rows.length);setConflicts(rows.filter(row=>row.error));}).catch(e=>setSyncError(e.message));
    };
    const sync = () => {
      refresh();
      void flushOffline()
        .then(() => {
          setSyncError('');refresh();
          void client.invalidateQueries();
        })
        .catch((e) => setSyncError(e.message));
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', refresh);
    const timer = window.setInterval(refresh, 3000);
    const syncTimer=window.setInterval(sync,30000);
    sync();
    const socket = io((globalThis as {__DINELY_CONFIG__?:{apiUrl:string}}).__DINELY_CONFIG__?.apiUrl || import.meta.env.VITE_API_URL || window.location.origin, {
      auth: { token, outletId },
    });
    for (const event of [
      'table:status:updated',
      'table:occupied',
      'table:available',
      'order:updated',
      'menu:item:updated',
      'menu:item:availability',
    ])
      socket.on(event, () => void client.invalidateQueries());
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', refresh);
      window.clearInterval(timer);
      window.clearInterval(syncTimer);
      socket.disconnect();
    };
  }, [token, outletId, user, client]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && onBack && (
              <button onClick={onBack} className="text-gray-500 hover:text-gray-800 text-xl">
                ←
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              {user && <p className="text-xs text-gray-500">{user.fullName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/notifications" className="text-sm">Notifications</Link>
            <Link to="/manage" className="text-sm">
              Management
            </Link>
            <span role="status" className="text-xs px-2 py-1">
              {online ? 'Online' : 'Offline'} / {pending} pending
            </span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600">
              Logout
            </button>
          </div>
        </div>
      </header>
      {!!pending&&<div className="p-3 bg-amber-50"><button onClick={()=>void flushOffline().then(()=>client.invalidateQueries()).catch(e=>setSyncError(e.message))} className="border rounded px-3 py-1">Retry synchronization</button>{conflicts.map(row=><p role="alert" key={row.id}>{row.type}: {row.error} — operation {row.id}. Your recorded action is retained for review.</p>)}</div>}
      {syncError && (
        <p role="alert" className="p-4 text-red-700">
          Sync needs attention: {syncError}
        </p>
      )}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
