const CACHE_VERSION='79274b7f1ca32630';
const APP_BASE=new URL(self.registration.scope);
const CACHE_PREFIX='zhixu-private-'+encodeURIComponent(APP_BASE.href)+'-';
const OLD_PREFIX='zhixu-offline-'+encodeURIComponent(APP_BASE.href)+'-';
const CACHE_NAME=CACHE_PREFIX+CACHE_VERSION;
const ASSETS=['index.html','favicon.svg','desk.svg','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'].map(path=>new URL(path,APP_BASE).href);
const PATHS=new Set(ASSETS.map(path=>new URL(path).pathname));
const OLD_FILES=new Set(['app.js','style.css','daily-quotes.js','life-features.js','memo-images.js','plan-content.js','plan-view.js','offline-ui.js','build-offline-cache.cjs']);
async function prepareCache(){const cache=await caches.open(CACHE_NAME);await cache.addAll(ASSETS.map(path=>new Request(path,{cache:'reload'})));}
self.addEventListener('install',event=>event.waitUntil(prepareCache().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys(),migrating=names.some(name=>name.startsWith(OLD_PREFIX)||name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME);
 await Promise.all(names.filter(name=>name.startsWith(OLD_PREFIX)||name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
 await self.clients.claim();
 if(migrating){const windows=await self.clients.matchAll({type:'window'});for(const client of windows)if(client.url.startsWith(APP_BASE.href))client.navigate(client.url).catch(()=>{});}
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==APP_BASE.origin||!url.pathname.startsWith(APP_BASE.pathname))return;
 const relative=url.pathname.slice(APP_BASE.pathname.length);
 // Never serve the old plaintext entry points, including through a stale browser cache.
 if(OLD_FILES.has(relative)){event.respondWith(Promise.resolve(new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})));return;}
 const navigation=request.mode==='navigate'&&['', 'index.html'].includes(relative);
 if(!navigation&&!PATHS.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME),key=navigation?new URL('index.html',APP_BASE).href:new URL(url.pathname,APP_BASE.origin).href;
  // Only the password page, ciphertext and generic branding are cached.
  return await cache.match(key)||fetch(request);
 })());
});
self.addEventListener('message',event=>{
 if(!event.ports[0]||!['OFFLINE_STATUS','PREPARE_OFFLINE'].includes(event.data?.type))return;
 event.waitUntil((async()=>{
  try{if(event.data.type==='PREPARE_OFFLINE')await prepareCache();const cache=await caches.open(CACHE_NAME);const found=await Promise.all(ASSETS.map(path=>cache.match(path)));event.ports[0].postMessage({ready:found.every(Boolean),version:CACHE_NAME});}
  catch{event.ports[0].postMessage({ready:false,error:'联网后重试，私密离线内容尚未准备完整。'});}
 })());
});
