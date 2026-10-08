import { OfflineStore, syncPending } from '@dinely/utils';
import { useAuthStore } from '../store/authStore';
let current: { key: string; store: OfflineStore } | undefined;
export function offlineStore() {
  const { user, outletId } = useAuthStore.getState();
  if (!user || !outletId) throw new Error('Sign in to use offline storage');
  const key = user.tenantId + '-' + outletId + '-' + user.id;
  if (current?.key !== key) {
    current?.store.close();
    current = { key, store: new OfflineStore(key) };
  }
  return current.store;
}
export async function flushOffline() {
  const { token, outletId } = useAuthStore.getState();
  if (!token || !outletId || !navigator.onLine) return;
  await syncPending(offlineStore(), async (body) => {
    const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        'x-outlet-id': outletId,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Sync failed');
    return data;
  });
}
