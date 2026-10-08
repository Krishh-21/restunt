import Dexie, { type Table } from 'dexie';
export interface PendingOperation { id: string; userId: string; createdAt: string; type: 'order:create'; payload: unknown; error?: string; }
export class OfflineStore extends Dexie {
  operations!: Table<PendingOperation, string>;
  cache!: Table<{ key: string; value: unknown },string>;
  constructor(scope: string) { super('dinely-'+scope); this.version(1).stores({ operations:'id,createdAt,userId',cache:'key' }); }
}
export async function syncPending(store: OfflineStore, send: (body: unknown) => Promise<{ accepted: string[]; conflicts: { id: string; message: string }[] }>) {
  const pending=await store.operations.orderBy('createdAt').toArray(); if(!pending.length)return;
  const response=await send({operations:pending});
  await store.transaction('rw',store.operations,async()=>{for(const id of response.accepted)await store.operations.delete(id);for(const conflict of response.conflicts)await store.operations.update(conflict.id,{error:conflict.message});});
}
export function compareVectorClocks(a: Record<string,number>, b: Record<string,number>): 'before'|'after'|'equal'|'concurrent' {
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);let less=false,greater=false;
  for(const key of keys){const left=a[key]??0,right=b[key]??0;if(left<right)less=true;if(left>right)greater=true;}
  return less&&greater?'concurrent':less?'before':greater?'after':'equal';
}
