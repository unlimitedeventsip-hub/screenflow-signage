/* Screenflow offline-first service worker. The TV caches the app shell and the
 * EXACT media URLs fetched by the paired player. No admin session or secrets.
 * Media must be available as a full HTTP 200 response before going offline. */
const SHELL = 'screenflow-shell-v26-venue-quiz-1';
const MEDIA = 'screenflow-media-v24';
const PREFIX = 'screenflow-shell-';
const ROOT = '/';
const MEDIA_PATH = '/storage/v1/object/public/ads/';

async function shellInstall() {
  const response = await fetch(ROOT, {cache:'no-store'});
  if (!response.ok) throw new Error('Screenflow shell unavailable');
  const cache = await caches.open(SHELL);
  await cache.put(ROOT, response.clone());
  const html = await response.text();
  // Vite injects fingerprinted assets into dist/index.html.
  const assets = Array.from(html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g), m => m[1]);
  await Promise.all([...new Set(assets)].map(async path => {
    const part = await fetch(path, {cache:'no-store'});
    if (!part.ok) throw new Error('Cannot cache '+path);
    await cache.put(path, part);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(shellInstall().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key!==SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isPublicMedia(url) {
  return url.protocol==='https:' && url.hostname.endsWith('.supabase.co')
    && url.pathname.includes(MEDIA_PATH);
}

async function rangeFromCached(request, cached) {
  const range = request.headers.get('range') || '';
  if (!/^bytes=\d*-\d*$/.test(range)) return cached;
  if (cached.status!==200) return cached;
  const blob = await cached.blob();
  const size = blob.size;
  const parts = /bytes=(\d*)-(\d*)/.exec(range);
  if (!parts || !size) return cached;
  let start = parts[1] ? Number(parts[1]) : null;
  let end = parts[2] ? Number(parts[2]) : size-1;
  if (start===null) {const suffix=Math.min(end,size);start=size-suffix;end=size-1;}
  if (start>=size || end<start) {
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  }
  end=Math.min(end,size-1);
  const headers=new Headers();
  headers.set('Content-Type',cached.headers.get('content-type')||'video/mp4');
  headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
  headers.set('Content-Length',String(end-start+1));
  headers.set('Accept-Ranges','bytes');
  headers.set('Cache-Control','private, max-age=3600');
  return new Response(blob.slice(start,end+1),{status:206,headers});
}


self.addEventListener('push',event=>{
 event.waitUntil((async()=>{let data={};try{data=(event.data?event.data.json():{});}catch{}
  const url=typeof data.url==='string'&&(data.url.startsWith('/manage/')||data.url.startsWith('/g/'))?data.url:'/manage';
  await self.registration.showNotification(data.title||'Rezervare nouă',{body:data.body||'Deschide pagina locației pentru detalii.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'screenflow-reservation',data:{url}});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const url=new URL((event.notification.data&&event.notification.data.url)||'/manage',self.location.origin).href;
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){if(client.url===url&&'focus' in client)return client.focus();}
  return self.clients.openWindow(url);
 })());
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if (req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin&&url.pathname==='/manifest.webmanifest'){
    const venue=url.searchParams.get('venue'),guest=url.searchParams.get('guest');
    const slug=venue||guest;
    if(slug&&/^[a-z0-9-]{2,80}$/.test(slug)){
      const reservation=url.searchParams.get('reservation')||'';
      const base=(venue?'/manage/':'/g/')+slug;
      const start=base+(!venue&&/^[a-f0-9-]{36}$/i.test(reservation)?'?reservation='+reservation:'');
      event.respondWith(new Response(JSON.stringify({id:base,name:(venue?'Rezervări ':'#altfel ')+slug.replace(/^altfel-/,''),short_name:venue?'Rezervări':'#altfel',start_url:start,scope:'/',display:'standalone',background_color:'#f7f5ee',theme_color:'#234d3e',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]}),{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-cache'}}));return;
    }
  }

  if (req.mode==='navigate' && url.origin===self.location.origin
      && (url.pathname.startsWith('/play/') || url.pathname==='/connect' || url.pathname.startsWith('/manage') || url.pathname.startsWith('/g/') || url.pathname.startsWith('/join/'))) {
    event.respondWith((async () => {
      try {
        const ctl=new AbortController();
        const timer=setTimeout(()=>ctl.abort(),4500);
        try {
          const live=await fetch(req,{signal:ctl.signal});
          if (live.ok) return live;
        } finally {clearTimeout(timer);}
      } catch (_) {}
      return (await caches.open(SHELL)).match(ROOT) || Response.error();
    })());
    return;
  }
  if (url.origin===self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () =>
      (await (await caches.open(SHELL)).match(url.pathname))
      || fetch(req))());
    return;
  }
  if (url.origin===self.location.origin && url.pathname==='/offline-media') {
    event.respondWith((async () => {
      const source=url.searchParams.get('src')||'';
      let sourceUrl;
      try {sourceUrl=new URL(source);} catch {return new Response('Invalid source',{status:400});}
      if(!isPublicMedia(sourceUrl))return new Response('Invalid media host',{status:403});
      const cached=await (await caches.open(MEDIA)).match(source);
      if(cached)return rangeFromCached(req,cached);
      // An uncached item is never presented as stored offline.
      // Fail explicitly so the player can fall back to online URL.
      return new Response('Not cached on this TV',{status:404});
    })());
    return;
  }
  if (isPublicMedia(url)) {
    // All cached media requests from Screenflow use CORS mode. In no-cors
    // mode we must pass through, as a synthetic 206 would be rejected.
    if(req.mode==='no-cors')return;
    event.respondWith((async () => {
      const cache=await caches.open(MEDIA);
      const saved=await cache.match(req.url);
      if (saved) return rangeFromCached(req,saved);
      return fetch(req);
    })());
  }
});
