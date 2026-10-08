const origin = 'http://localhost:5000';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch(origin + '/ready');
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await pause(1500);
}
if (!ready) throw new Error('Container never became ready');
for (const app of ['pos', 'captain', 'kitchen', 'qr', 'store']) {
  const response = await fetch(origin + '/' + app + '/');
  if (!response.ok) throw new Error('App failed ' + app);
  const html = await response.text();
  const asset = html.match(/src="(\.\/assets\/[^"]+)"/);
  if (!asset) throw new Error('Missing application bundle ' + app);
  if (!(await fetch(new URL(asset[1], origin + '/' + app + '/'))).ok)
    throw new Error('Bundle not served ' + app);
  if (!(await fetch(origin + '/' + app + '/sw.js')).ok)
    throw new Error('Offline shell missing ' + app);
}
const config = await (await fetch(origin + '/runtime-config.js')).text();
if (/JWT_SECRET|DATABASE_URL|password|secret/i.test(config))
  throw new Error('Private configuration leaked');
console.log(
  'All five apps, bundles, service workers, runtime configuration and database/Redis readiness passed.'
);
