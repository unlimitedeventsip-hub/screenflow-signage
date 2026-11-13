let installEvent=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;document.querySelectorAll('[data-install-app]').forEach(x=>x.hidden=false);});
export async function setupPWA(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});}catch{}
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-install-app]');if(!button)return;
  if(installEvent){const prompt=installEvent;installEvent=null;await prompt.prompt();return;}
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(standalone){button.textContent='Pagina este deja instalată';return;}
  button.closest('.pwa-card').querySelector('[data-install-help]').hidden=false;
 });
}
export function installCard(){
 if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)return '';
 return `<aside class="pwa-card"><div><strong>La o atingere distanță.</strong><p>Adaugă pagina pe ecranul principal al telefonului.</p></div><button type="button" data-install-app>Adaugă pe telefon</button><p data-install-help hidden>Pe iPhone: Safari → Partajează → Adaugă pe ecranul principal. Pe Android: meniul browserului → Instalează aplicația / Adaugă pe ecranul principal.</p></aside>`;
}
export async function enableVenuePush(api,publicKey){
 if(!('PushManager' in window)||!('Notification' in window))throw Error('Pentru notificări pe iPhone, adaugă pagina pe ecranul principal și deschide-o de acolo.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Activează notificările din setările telefonului pentru această pagină.');
 const registration=await navigator.serviceWorker.ready;
 const raw=publicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));
 const sub=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 await api('subscribe',{subscription:sub.toJSON()});return sub;
}

export function venueManifest(kind,slug,reservation=''){
 const link=document.querySelector('link[rel="manifest"]');if(!link)return;
 const update=()=>{link.href='/manifest.webmanifest?'+kind+'='+encodeURIComponent(slug)+(reservation?'&reservation='+encodeURIComponent(reservation):'')+'&v=26';};
 update();navigator.serviceWorker?.addEventListener('controllerchange',update);navigator.serviceWorker?.ready.then(update).catch(()=>{});
}
