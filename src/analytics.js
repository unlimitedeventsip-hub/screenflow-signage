// Optional first-party analytics for #altfel visitor pages.
// The anonymous per-tab UUID is created only after consent. Never collect
// names, emails, phone numbers, IPs, UA strings, search text or URL tokens.
export const ANALYTICS_CONSENT_KEY='screenflow:analytics:consent:v1';
const SESSION_KEY='screenflow:analytics:session:v1';
const TYPES=new Set(['hub_view','menu_open','menu_search','menu_item_view',
  'booking_open','booking_sent','external_booking_click','tickets_click',
  'social_click','event_open','quiz_view','pwa_prompt','pwa_install','pwa_standalone']);

function storageGet(storage,key){try{return storage.getItem(key);}catch{return null;}}
function storageSet(storage,key,value){try{storage.setItem(key,value);}catch{}}
export function attributionSource(search=''){
  const raw=new URLSearchParams(search).get('src');
  return ({tvqr:'tv_qr',printqr:'print_qr',shared:'shared'})[raw]||'direct';
}
const getSource=()=>attributionSource(location.search);
export function createGuestAnalytics({supabase,slug='',eventId=null,root,initialEvent='hub_view'}){
 let choice=storageGet(localStorage,ANALYTICS_CONSENT_KEY);
 const dnt=navigator.doNotTrack==='1'||window.doNotTrack==='1';
 let banner=null,settings=null;
 const session=()=>{
   let id=storageGet(sessionStorage,SESSION_KEY);
   if(!id||!/^[-a-f0-9]{36}$/i.test(id)){
     id=crypto.randomUUID();
     storageSet(sessionStorage,SESSION_KEY,id);
   }
   return id;
 };
 const track=(eventName,details={})=>{
   if(choice!=='yes'||dnt||!TYPES.has(eventName)||!supabase)return;
   const payload={p_slug:slug||null,p_event_name:eventName,p_session_id:session(),
     p_source:getSource(),p_item_id:details.itemId||null,p_event_id:details.eventId||eventId||null};
   // Analytics is best effort. It never blocks reservations, menus or voting.
   Promise.resolve().then(()=>supabase.rpc('log_screenflow_guest_event',payload))
     .catch(()=>{});
 };
 function setChoice(value){
   choice=value;storageSet(localStorage,ANALYTICS_CONSENT_KEY,value);
   banner?.remove();banner=null;
   if(value==='yes'&&!dnt){
     track(initialEvent);
     if(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)track('pwa_standalone');
   }
 }
 function showBanner(){
   banner?.remove();
   banner=document.createElement('aside');
   banner.className='analytics-consent';
   banner.setAttribute('role','region');
   banner.setAttribute('aria-label','Preferințe statistici');
   banner.innerHTML='<strong>Statistici #altfel</strong>'+
     '<p>Cu acordul tău măsurăm deschideri de meniu, interacțiuni și instalarea aplicației. '+
     'Pentru statistici folosim un identificator temporar al filei, fără nume, email, telefon sau căutările efectuate. '+
     'Poți refuza fără să pierzi nicio funcție.</p>'+
     '<div><button type="button" data-analytics-choice="no">Refuz</button>'+
     '<button type="button" data-analytics-choice="yes">Accept statisticile</button></div>';
   banner.addEventListener('click',e=>{
     const next=e.target.closest('[data-analytics-choice]')?.dataset.analyticsChoice;
     if(next)setChoice(next);
   });
   root.appendChild(banner);
 }
 function init(){
   if(!root||settings)return;
   settings=document.createElement('button');
   settings.type='button';
   settings.className='analytics-settings';
   settings.textContent='Preferințe statistici';
   settings.addEventListener('click',showBanner);
   root.appendChild(settings);
   if(dnt){choice='no';return;}
   if(choice===null)showBanner();
   else if(choice==='yes'){
     track(initialEvent);
     if(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)track('pwa_standalone');
   }
   window.addEventListener('appinstalled',()=>track('pwa_install'));
   root.addEventListener('click',e=>{
     if(e.target.closest('[data-install-app]'))track('pwa_prompt');
   });
 }
 return {init,track,hasConsent:()=>choice==='yes'&&!dnt};
}
