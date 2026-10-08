import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = 'http://localhost:5000';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);
try {
  await page.goto(base + '/pos/login');
  await page.getByLabel('Restaurant subdomain').fill('demo');
  await page.locator('input[type=text]').fill('admin');
  await page.locator('input[type=password]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/tables');
  const table = page.getByRole('button', { name: /^T1 available/ });
  await table.click();
  await page.getByRole('button', { name: /Start Order/ }).click();
  await page.getByRole('button', { name: /Paneer Tikka/ }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Send to Kitchen & Pay', exact: true }).click();
  await page.waitForURL('**/payment');
  await page.getByRole('button', { name: /Card/ }).click();
  await page.getByRole('button', { name: /^Collect/ }).click();
  await page.getByRole('heading', { name: 'Payment recorded on this device' }).waitFor();
  const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('dinely-auth')).state);
  const dbName = 'dinely-' + auth.user.tenantId + '-' + auth.outletId + '-' + auth.user.id;
  async function records(store) {
    return page.evaluate(
      ({ name, store }) =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open(name);
          open.onerror = () => reject(new Error('IndexedDB failed'));
          open.onsuccess = () => {
            const db = open.result;
            const read = db.transaction(store).objectStore(store).getAll();
            read.onsuccess = () => {
              db.close();
              resolve(read.result);
            };
            read.onerror = () => reject(new Error('Read failed'));
          };
        }),
      { name: dbName, store }
    );
  }
  assert.equal((await records('operations')).length, 2);
  const local = (await records('cache')).find((row) =>
    row.key.startsWith('/api/pos/orders/offline:')
  );
  assert(local);
  assert.equal(local.value.invoiceNumber, null);
  await page.reload();
  await page.waitForURL('**/tables');
  await page.getByRole('button', { name: /^T1 occupied/ }).waitFor();
  assert.equal((await records('operations')).length, 2);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  for (let n = 0; n < 60 && (await records('operations')).length; n++)
    await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal((await records('operations')).length, 0, 'Offline operations did not acknowledge');
  const synced = (await records('cache')).find((row) => row.key === local.key);
  assert.equal(synced.value.status, 'SETTLED');
  assert(synced.value.invoiceNumber);
  const response = await fetch(base + '/api/pos/orders/' + synced.value.id + '/invoice', {
    headers: { Authorization: 'Bearer ' + auth.token, 'x-outlet-id': auth.outletId },
  });
  assert(response.ok);
  const invoice = await response.json();
  assert.equal(invoice.invoiceNumber, synced.value.invoiceNumber);
  console.log(
    'Browser offline shell reload, durable order/payment queue, reconnect and server invoice passed'
  );
} finally {
  await browser.close();
}
