import type { Plugin } from 'vite';
import { createHash } from 'crypto';
export function offlineShell(app: string): Plugin {
  return {
    name: 'dinely-offline-shell',
    configureServer(server) {
      server.middlewares.use('/runtime-config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end('globalThis.__DINELY_CONFIG__={apiUrl:""};');
      });
    },
    generateBundle(_options, bundle) {
      const files = ['index.html', ...Object.keys(bundle).filter((name) => !name.endsWith('.map'))];
      const version = createHash('sha256')
        .update(JSON.stringify(bundle))
        .digest('hex')
        .slice(0, 12);
      const source = `const PREFIX='dinely-shell-${app}-',CACHE=PREFIX+'${version}',FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new URL(file,self.registration.scope).href)).then(()=>fetch('/runtime-config.js').then(response=>response.ok?cache.put('/runtime-config.js',response):undefined).catch(()=>undefined))));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io'))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('index.html',self.registration.scope).href)));return;}
if(url.pathname==='/runtime-config.js'){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||new Response('globalThis.__DINELY_CONFIG__={apiUrl:""};',{headers:{'Content-Type':'application/javascript'}}))));return;}
if(url.href.startsWith(self.registration.scope)&&FILES.some(file=>url.href===new URL(file,self.registration.scope).href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify({
          name: 'Dinely ' + app,
          short_name: 'Dinely',
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#fff7ed',
          theme_color: '#ea580c',
        }),
      });
    },
  };
}
