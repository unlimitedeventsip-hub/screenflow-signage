import QRCode from 'qrcode';
import {escapeHTML as safe,fetchWithTimeout} from './experience-utils.js';

export async function gatherIce(pc,timeout=12000){
 if(pc.iceGatheringState==='complete')return;
 await new Promise(resolve=>{const timer=setTimeout(done,timeout);function done(){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();}function check(){if(pc.iceGatheringState==='complete')done();}pc.addEventListener('icegatheringstatechange',check);});
}
const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
const labels={waiting:'Se așteaptă televizorul…',connecting:'Se stabilește conexiunea…',playing:'TV-ul redă ecranul tău',failed:'Conexiunea nu a reușit',unsupported:'Playerul TV nu acceptă WebRTC',ended:'Partajarea s-a încheiat'};
export function renderMirrorAdmin({state,heading}){
 const supported=!!navigator.mediaDevices?.getDisplayMedia&&!!window.RTCPeerConnection;
 return heading('PREZENTĂRI & EVENIMENTE','Ecranul tău, pe TV-ul ales.','Partajează o filă, o fereastră sau întregul ecran. La oprire, TV-ul revine la conținutul obișnuit.')+
 `<section class="mirror-workspace"><div class="mirror-preview"><video data-mirror-preview autoplay muted playsinline></video><div class="mirror-placeholder"><span><svg class=ui-arrow width=18 height=18 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 aria-hidden=true><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span><strong>Aici apare previzualizarea ta.</strong><small>Tu alegi ce se vede pe televizor.</small></div><span class="mirror-live" hidden>PARTAJARE ACTIVĂ</span></div><section class="panel mirror-controls"><span class="kicker">SCREEN MIRROR</span><h2>Alege destinația.</h2><label>Televizor<select data-mirror-target ${state.mirrorActive?'disabled':''}><option value="">Selectează un TV…</option>${state.screens.map(s=>{const loc=state.locations.find(l=>l.id===s.location_id);return `<option value="${safe(s.id)}" ${s.id===state.mirrorTarget?'selected':''}>${safe(loc?.name||'Fără locație')} · ${safe(s.name)}</option>`;}).join('')}</select></label><p data-mirror-status class="mirror-status" role="status">${safe(state.mirrorStatus||'Pregătit pentru partajare.')}</p><button class="btn primary full" data-action="mirror-start" ${!supported||state.mirrorActive?'disabled':''}>Alege ecranul & partajează <svg class=ui-arrow width=18 height=18 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.7 aria-hidden=true><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button><button class="btn subtle full" data-action="mirror-stop" ${!state.mirrorActive?'disabled':''}>Oprește partajarea</button><p class="hub-note">${supported?'Screenflow trebuie să fie deschis pe televizor. Browserul îți cere să alegi sursa de fiecare dată. Sunetul depinde de sursă și de browser.':'Deschide Admin într-un browser desktop compatibil, precum Chrome sau Edge, pentru a partaja ecranul.'}</p><details><summary>Despre conexiune</summary><p class="hub-note">În aceeași rețea, conexiunea se face direct. Între locații sau în rețele restrictive poate fi necesar un server TURN configurat de administrator. Compatibilitatea TCL / Samsung trebuie testată pe fiecare model. După închiderea filei sursă, partajarea se oprește automat.</p></details></section></section>`;
}

export function createMirrorSender({supabase,displayEndpoint,onChange}){
 let stream=null,pc=null,id=null,pollTimer=null,leaseTimer=null,busy=false,started=0,generation=0,lastStatus='';
 const update=(status,active=!!stream)=>{lastStatus=status;onChange({active,status,stream});};
 async function stop(message='Partajarea s-a oprit. TV-ul revine la playlist.'){
  generation++;const oldId=id;id=null;clearInterval(pollTimer);clearInterval(leaseTimer);pollTimer=null;leaseTimer=null;
  if(pc){pc.onconnectionstatechange=null;pc.close();pc=null;}
  const oldStream=stream;stream=null;oldStream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  busy=false;update(message,false);
  if(oldId)supabase.from('screen_mirror_sessions').update({status:'ended',expires_at:new Date().toISOString()}).eq('id',oldId).then(()=>{}).catch(()=>{});
 }
 async function start(screen){
  if(busy||stream)throw Error('Oprește partajarea curentă înainte de alta.');
  busy=true;const mine=++generation;
  try{
   // Keep capture in this direct user-gesture call, before any network await.
   stream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:24,max:30}},audio:true});
   if(mine!==generation){stream.getTracks().forEach(t=>t.stop());stream=null;return;}
   stream.getVideoTracks()[0].onended=()=>stop();
   update('Pregătim transmisia către '+screen.name+'…');
   // Use the same configured TURN/STUN list on both peers.
   const config=await fetchWithTimeout(displayEndpoint+'?screen='+encodeURIComponent(screen.public_id)).then(r=>r.json());
   if(mine!==generation)return;
   pc=new RTCPeerConnection({iceServers:config.iceServers||config.session?.iceServers||iceServers});
   stream.getTracks().forEach(track=>pc.addTrack(track,stream));
   pc.onconnectionstatechange=()=>{
    if(mine!==generation)return;
    if(pc.connectionState==='failed')stop('Conexiunea WebRTC a eșuat. Verifică rețeaua sau configurarea TURN.');
    else if(pc.connectionState==='connected')update('Conectat. Așteptăm confirmarea redării pe TV.');
   };
   await pc.setLocalDescription(await pc.createOffer());await gatherIce(pc);
   if(mine!==generation)return;
   const previous=await supabase.from('screen_mirror_sessions').update({status:'ended'}).eq('screen_id',screen.id).in('status',['waiting','connecting','playing']);if(previous.error)throw previous.error;
   const {data,error}=await supabase.from('screen_mirror_sessions').insert({screen_id:screen.id,offer:pc.localDescription.toJSON(),expires_at:new Date(Date.now()+45000).toISOString()}).select('id').single();
   if(error)throw error;id=data.id;started=Date.now();busy=false;update(labels.waiting);
   let polling=false;
   async function poll(){
    if(polling||!id)return;polling=true;const sessionId=id;
    try{
     const {data:row,error}=await supabase.from('screen_mirror_sessions').select('status,answer,error_message').eq('id',sessionId).maybeSingle();
     if(mine!==generation)return;if(error)throw error;
     if(!row||['ended','failed','unsupported'].includes(row.status)){await stop(row?.error_message||labels[row?.status]||'Sesiune închisă.');return;}
     if(row.answer&&!pc.currentRemoteDescription)await pc.setRemoteDescription(row.answer);
     if(mine!==generation)return;
     update(labels[row.status]||lastStatus);
     if(Date.now()-started>60000&&row.status!=='playing')await stop('TV-ul nu a început redarea. Verifică aplicația TV și conexiunea; în alte rețele poate fi necesar TURN.');
    }catch(e){if(mine===generation)update('Așteptăm conexiunea cu serverul…');}
    finally{polling=false;}
   }
   pollTimer=setInterval(poll,2000);poll();
   leaseTimer=setInterval(async()=>{
    if(!id)return;
    if(Date.now()-started>4*3600000-60000){stop('Sesiunea de 4 ore s-a încheiat. Poți porni una nouă.');return;}
    const {error}=await supabase.from('screen_mirror_sessions').update({expires_at:new Date(Date.now()+45000).toISOString()}).eq('id',id);
    if(error)update('Nu putem reînnoi sesiunea. Verifică internetul.');
   },10000);
  }catch(e){await stop();throw e;}
 }
 return {start,stop,stream:()=>stream};
}

export function createDisplayExperience({supabaseUrl,publicId,isAllowed=()=>true,onActiveChange=()=>{}}){
 const endpoint=supabaseUrl+'/functions/v1/screenflow-display?screen='+encodeURIComponent(publicId);
 let pc=null,id=null,layer=null,qr=null,alive=true,polling=false,connecting=false,generation=0,seenUntil=0,qrSlug='';
 function clearMirror(){const wasActive=!!layer;generation++;pc?.close();pc=null;layer?.remove();layer=null;id=null;connecting=false;if(wasActive)onActiveChange(false);}
 async function signal(sessionId,status,answer=null,error=''){
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,status,answer,error})});
  if(!r.ok)throw Error('Signaling failed');
 }
 function paintQR(hub){
  const slug=hub?.slug||'';if(slug===qrSlug)return;qrSlug=slug;qr?.remove();qr=null;
  if(!slug)return;
  qr=document.createElement('aside');qr.className='tv-guest-qr';qr.innerHTML='<img alt="Meniu, rezervări și evenimente"><span>Scanează & descoperă<small>Meniu · Rezervări · Party</small></span>';
  document.body.appendChild(qr);const image=qr.querySelector('img');
  QRCode.toDataURL(location.origin+'/g/'+slug,{width:210,margin:3,errorCorrectionLevel:'M'}).then(src=>{if(image.isConnected)image.src=src;});
 }
 async function accept(session){
  clearMirror();id=session.id;const mine=generation;connecting=true;
  if(!window.RTCPeerConnection){await signal(id,'unsupported',null,'Acest player nu oferă WebRTC.');connecting=false;return;}
  try{
   layer=document.createElement('div');layer.className='tv-mirror-layer';layer.innerHTML='<video autoplay playsinline></video><div>Se conectează ecranul partajat…</div>';document.body.appendChild(layer);onActiveChange(true);
   const video=layer.querySelector('video');
   // Pause local videos/music while the mirrored source takes the screen.
   document.querySelectorAll('#tv-stage video,#tv-stage audio').forEach(v=>v.pause());
   pc=new RTCPeerConnection({iceServers:session.iceServers||iceServers});
   pc.ontrack=e=>{
    if(mine!==generation)return;
    video.srcObject=e.streams[0]||new MediaStream([e.track]);
    video.onplaying=()=>{if(mine!==generation)return;layer.classList.add('playing');signal(session.id,'playing').catch(()=>{});};
    video.play().catch(()=>{video.muted=true;video.play().catch(()=>signal(session.id,'failed',null,'Redarea video a fost blocată.').catch(()=>{}));});
   };
   pc.onconnectionstatechange=()=>{if(mine===generation&&pc.connectionState==='failed'){signal(session.id,'failed',null,'Conexiune media eșuată. Poate fi necesar TURN.').catch(()=>{});clearMirror();}};
   await pc.setRemoteDescription(session.offer);await pc.setLocalDescription(await pc.createAnswer());await gatherIce(pc);
   if(mine!==generation)return;await signal(session.id,'connecting',pc.localDescription.toJSON());connecting=false;
  }catch(e){if(mine===generation){signal(session.id,'failed',null,'Conectarea la sursă nu a reușit.').catch(()=>{});clearMirror();}}
 }
 async function poll(){
  if(!alive||polling)return;polling=true;
  try{
   const res=await fetchWithTimeout(endpoint,{cache:'no-store'});if(!res.ok)throw Error('Unavailable');const data=await res.json();if(!alive)return;
   paintQR(data.hub);const session=isAllowed()?data.session:null;
   if(session){seenUntil=Date.parse(session.expires_at);if(session.id!==id&&!connecting)await accept(session);}
   else if(id)clearMirror();
   if(qr)qr.style.display=isAllowed()&&!layer&&!document.querySelector('#tv-stage .smart-qr')?'flex':'none';
  }catch{if(id&&Date.now()>seenUntil)clearMirror();}
  finally{polling=false;}
 }
 // A separate layer keeps normal playlist timers intact; the player resumes its
 // current schedule when the source stops or its lease expires.
 const interval=setInterval(()=>{if(id&&Date.now()>seenUntil)clearMirror();poll();},3000);
 poll();
 return {isActive:()=>!!layer,stop:()=>{alive=false;clearInterval(interval);clearMirror();qr?.remove();}};
}
