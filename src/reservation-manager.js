import {escapeHTML as safe} from './experience-utils.js';
import {installCard,enableVenuePush,venueManifest} from './pwa.js';
import './reservation-manager.css';
const dayNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=v=>new Date(v).toLocaleTimeString('ro-RO',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit'});
const statusName={pending:'De confirmat',confirmed:'Confirmată',cancelled:'Anulată'};
export async function renderReservationManager({root,supabase,supabaseUrl,slug}){
 document.body.classList.add('reservations-body');
 if(!slug){const last=localStorage.getItem('screenflow:venue:last');if(last){location.replace('/manage/'+encodeURIComponent(last));return;}root.innerHTML='<main class="ops-shell"><h1>Rezervările locației</h1><p>Deschide linkul individual al locației din Admin → Clienți & QR.</p><a href="/admin">Deschide Admin</a></main>';return;}
 localStorage.setItem('screenflow:venue:last',slug);
 const store='screenflow:venue:key:'+slug,fragment=new URLSearchParams(location.hash.slice(1)),incoming=fragment.get('key');
 if(incoming&&/^[a-f0-9]{64}$/.test(incoming)){localStorage.setItem(store,incoming);history.replaceState(null,'',location.pathname);}
 // Installations keep this venue as their home screen destination.
 venueManifest('venue',slug);
 const requestedDay=new URLSearchParams(location.search).get('day')||'';
 let day=/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)?requestedDay:dayNow(),data=null,filter='all',view='list',selected=null,busy=false,message='',lastPending=new Set(),loaded=false;
 async function api(action,values={}){
  const {data:{session}}=await supabase.auth.getSession();
  const headers={'Content-Type':'application/json'};if(session)headers.Authorization='Bearer '+session.access_token;
  const key=localStorage.getItem(store);if(key)headers['x-venue-key']=key;
  const res=await fetch(supabaseUrl+'/functions/v1/screenflow-reservations',{method:'POST',headers,body:JSON.stringify({action,slug,...values})});
  const result=await res.json();if(!res.ok)throw Error(result.error||'Operațiunea nu a reușit.');return result;
 }
 async function load(silent=false){
  try{const next=await api('state',{day});const pending=new Set(next.bookings.filter(x=>x.status==='pending').map(x=>x.id));
   if(loaded&&[...pending].some(id=>!lastPending.has(id)))message='Ai cereri noi de verificat.';
   lastPending=pending;loaded=true;data=next;document.title='Rezervări · '+data.hub.title;
   if(!silent||!root.contains(document.activeElement)||!document.activeElement.matches('input,textarea,select'))paint();
  }catch(e){message=e.message;if(!data)root.innerHTML=`<main class="ops-shell ops-access"><span class="ops-brand">#altfel.</span><h1>Rezervările locației</h1><p>${safe(message)}</p><a class="ops-button" href="/admin">Intră ca administrator</a><p>Responsabilii folosesc linkul privat al locației, cu acces doar la rezervări.</p></main>`;else paint();}
 }
 const tables=()=>data.tables.filter(x=>x.enabled);
 function bookingCard(b){
  const note=data.notifications.find(x=>x.reservation_id===b.id&&x.kind===b.status&&x.channel==='email');
  const table=tables().find(t=>t.id===b.table_id);
  return `<article class="ops-booking ${b.status}" data-booking="${safe(b.id)}"><div class="ops-booking-top"><div><span class="ops-time">${time(b.requested_at)}</span><span class="ops-status">${statusName[b.status]}</span></div><b>${b.guests} persoane</b></div><h3>${safe(b.guest_name)}</h3><div class="ops-contact"><a href="tel:${safe(b.phone)}">${safe(b.phone)}</a>${b.email?`<a href="mailto:${safe(b.email)}">${safe(b.email)}</a>`:''}</div>${b.note?`<p class="ops-note">${safe(b.note)}</p>`:''}<small>${table?safe(table.label)+' · ':''}${b.attendance==='arrived'?'✓ Au venit':b.attendance==='no_show'?'Nu s-au prezentat':'Prezență nebifată'}${note?' · Email '+({sent:'trimis',blocked:'neconfigurat',failed:'nereușit',pending:'în așteptare',processing:'în curs'}[note.status]||note.status):''}</small><button class="ops-button secondary" data-edit="${safe(b.id)}">Gestionează rezervarea</button></article>`;
 }
 function dialog(){
  const b=data.bookings.find(x=>x.id===selected);if(!b)return '';
  return `<div class="ops-dialog-backdrop"><section class="ops-dialog" role="dialog" aria-modal="true" aria-labelledby="ops-dialog-title"><button class="ops-close" data-close aria-label="Închide">×</button><p class="ops-kicker">${time(b.requested_at)} · ${b.guests} PERSOANE</p><h2 id="ops-dialog-title">${safe(b.guest_name)}</h2><form data-ops-form="decision"><input type="hidden" name="id" value="${b.id}"><input type="hidden" name="version" value="${b.version}"><label>Starea rezervării<select name="status">${Object.entries(statusName).map(([k,v])=>`<option value="${k}" ${b.status===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Masa<select name="table_id"><option value="">Nealocată</option>${tables().filter(t=>t.seats>=b.guests).map(t=>`<option value="${t.id}" ${b.table_id===t.id?'selected':''}>${safe(t.label)} · ${t.seats} locuri ${safe(t.zone)}</option>`).join('')}</select></label><label>Prezență<select name="attendance">${[['unknown','Încă nu știm'],['arrived','Au venit'],['no_show','Nu s-au prezentat']].map(([k,v])=>`<option value="${k}" ${b.attendance===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Mesaj pentru client<textarea name="response_note" maxlength="350" rows="3" placeholder="Ex.: Vă așteptăm! Masa este păstrată 15 minute.">${safe(b.response_note)}</textarea></label><p class="ops-muted">Confirmările și anulările sunt trimise prin email când serviciul este activ. Numărul de locuri și suprapunerile la masă sunt verificate la salvare.</p><button class="ops-button" ${busy?'disabled':''}>Salvează</button></form><a class="ops-text-link" target="_blank" rel="noopener" href="https://wa.me/${safe(b.phone.replace(/[^0-9]/g,'').replace(/^0/,'40'))}?text=${encodeURIComponent('Bună, '+b.guest_name+'! '+data.hub.title+': rezervarea ta din '+new Date(b.requested_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})+' este '+statusName[b.status].toLowerCase()+'. '+b.response_note)}">Pregătește mesaj WhatsApp</a></section></div>`;
 }
 function floor(){
  const at=root.querySelector('[data-floor-time]')?.value||'19:00';
  return `<section class="ops-panel"><div class="ops-section-head"><div><h2>Planul meselor</h2><p>Alege ora și vezi rezervările care se suprapun.</p></div><label>La ora<input data-floor-time type="time" value="${at}"></label></div><div class="ops-floor">${tables().map(t=>{
   const when=new Date(day+'T'+at+':00');
   // compare wall clock minutes (all reservations on the selected local day)
   const [hh,mm]=at.split(':').map(Number),minute=hh*60+mm;
   const assigned=data.bookings.filter(b=>b.table_id===t.id&&b.status==='confirmed'&&(()=>{const [bh,bm]=time(b.requested_at).split(':').map(Number);return minute>=bh*60+bm&&minute<bh*60+bm+b.duration_minutes;})());
   return `<button class="ops-table ${assigned.length?'occupied':'free'}" style="left:${t.x}%;top:${t.y}%" data-floor-table="${t.id}"><b>${safe(t.label)}</b><span>${t.seats} locuri</span><small>${assigned.length?assigned.map(b=>safe(b.guest_name)).join(', '):'Liberă'}</small></button>`;
  }).join('')||'<p class="ops-empty">Adaugă mesele și pozițiile lor mai jos.</p>'}</div><p class="ops-muted">Verde = liberă la ora aleasă · Auriu = rezervată. Atinge o masă pentru rezervările ei. Pozițiile se editează prin X/Y.</p></section>`;
 }
 function settings(){const h=data.hub;return `<details class="ops-panel"><summary>Capacitate & programul rezervărilor</summary><form class="ops-grid-form" data-ops-form="settings"><label class="ops-check"><input type="checkbox" name="booking_enabled" ${h.booking_enabled?'checked':''}> Primește cereri online</label>${[['max_daily_requests','Cereri primite / zi',1,500],['max_slot_reservations','Rezervări simultane',1,200],['max_slot_guests','Persoane simultane',1,1000],['booking_duration_minutes','Durata unei rezervări · minute',30,480]].map(([k,label,min,max])=>`<label>${label}<input type="number" name="${k}" value="${h[k]}" min="${min}" max="${max}" required></label>`).join('')}<button class="ops-button">Salvează limitele</button></form><p class="ops-muted">Cererile în așteptare ocupă provizoriu capacitatea. Rezervările anulate o eliberează.</p></details><details class="ops-panel"><summary>Aranjează mesele</summary><form class="ops-grid-form" data-ops-form="table"><label>Masa<select name="id"><option value="">Adaugă masă nouă</option>${data.tables.map(t=>`<option value="${t.id}">${safe(t.label)}${t.enabled?'':' · inactivă'}</option>`).join('')}</select></label><label>Numele mesei<input name="label" maxlength="30" required placeholder="Masa 1"></label><label>Locuri<input type="number" name="seats" min="1" max="50" value="4" required></label><label>Zonă<input name="zone" maxlength="40" placeholder="Terasă / interior"></label><label>Poziție X · %<input type="number" name="x" min="0" max="90" value="10" required></label><label>Poziție Y · %<input type="number" name="y" min="0" max="90" value="10" required></label><label class="ops-check"><input type="checkbox" name="enabled" checked> Masă disponibilă</label><button class="ops-button">Salvează masa</button></form></details>`;}
 function access(){return !data.is_admin?'':`<details class="ops-panel"><summary>Acces individual pentru responsabili</summary><p>Generează un link privat, valabil 90 de zile, cu acces numai la rezervările acestei locații. Îl poți revoca oricând.</p><form class="ops-grid-form" data-ops-form="manager"><label>Responsabil<input name="label" required minlength="2" maxlength="70"></label><label>Email pentru notificări<input name="email" type="email" maxlength="254"></label><button class="ops-button">Generează link privat</button></form><div data-manager-link></div>${data.managers.map(m=>`<div class="ops-access-row"><span>${safe(m.label)}<small>${safe(m.email)} · ${m.enabled?'activ până la '+new Date(m.expires_at).toLocaleDateString('ro-RO'):'revocat'}</small></span>${m.enabled?`<button class="ops-button secondary" data-revoke="${m.id}">Revocă</button>`:''}</div>`).join('')}</details>`;}
 function paint(){
  if(!data)return;
  const bookings=data.bookings.filter(b=>filter==='all'||filter==='pending'&&b.status==='pending'||filter==='confirmed'&&b.status==='confirmed'||filter==='arrived'&&b.attendance==='arrived'||filter==='no_show'&&b.attendance==='no_show');
  root.innerHTML=`<main class="ops-shell"><header class="ops-header"><a href="/g/${safe(slug)}" class="ops-brand">#altfel<span>.</span></a><span>REZERVĂRI · ${safe(data.hub.title)}</span><button class="ops-text-link" data-logout>Ieși</button></header><section class="ops-hero"><p class="ops-kicker">ECHIPA LOCAȚIEI</p><h1>Oaspeții voștri.</h1><p>Confirmă mesele, pregătește seara, întâmpină oamenii.</p></section>${installCard()}<div class="ops-toolbar"><label>Ziua · București<input data-day type="date" value="${day}" required></label><button class="ops-button secondary" data-refresh>Actualizează</button><button class="ops-button secondary" data-notify>Activează notificările</button></div><div role="status" aria-live="polite" class="ops-message">${safe(message)}</div><div class="ops-stats"><div><strong>${data.bookings.filter(b=>b.status==='pending').length}</strong><span>de confirmat</span></div><div><strong>${data.bookings.filter(b=>b.status==='confirmed').reduce((n,b)=>n+b.guests,0)}</strong><span>oaspeți confirmați</span></div><div><strong>${data.bookings.filter(b=>b.attendance==='arrived').length}</strong><span>grupuri sosite</span></div></div>${data.upcoming?.some(b=>!data.bookings.some(x=>x.id===b.id))?`<details class="ops-panel"><summary>Cereri de confirmat în alte zile · ${data.upcoming.filter(b=>!data.bookings.some(x=>x.id===b.id)).length}</summary>${data.upcoming.filter(b=>!data.bookings.some(x=>x.id===b.id)).map(b=>`<button type="button" class="ops-button secondary" data-open-day="${new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b.requested_at))}" data-open-booking="${b.id}">${safe(b.guest_name)} · ${new Date(b.requested_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'short',timeStyle:'short'})} · ${b.guests} persoane</button>`).join('')}</details>`:''}<nav class="ops-tabs">${[['list','Rezervări'],['floor','Planul meselor']].map(([k,label])=>`<button data-view="${k}" class="${view===k?'active':''}">${label}</button>`).join('')}</nav>${view==='floor'?floor():`<div class="ops-filters">${[['all','Toate'],['pending','De confirmat'],['confirmed','Confirmate'],['arrived','Au venit'],['no_show','Nu au venit']].map(([k,label])=>`<button class="${filter===k?'active':''}" data-filter="${k}">${label}</button>`).join('')}</div><section class="ops-bookings">${bookings.map(bookingCard).join('')||'<div class="ops-empty">Nicio rezervare în această selecție.</div>'}</section>`}${settings()}${access()}<details class="ops-panel"><summary>Notificări & trimitere email</summary><p>${data.email_ready?'Serviciul de email este configurat.':'Emailurile automate așteaptă configurarea expeditorului și a cheii Resend în server.'}</p><p class="ops-muted">Notificările push necesită activarea pe fiecare telefon. Pe iPhone, deschide pagina adăugată pe ecranul principal.</p><button class="ops-button secondary" data-retry>Reîncearcă notificările netrimise</button>${data.notifications.filter(n=>['blocked','failed'].includes(n.status)).slice(0,8).map(n=>`<p class="ops-muted">${safe(n.channel)} · ${safe(n.error)}</p>`).join('')}</details><footer class="ops-footer">Screenflow · Acces limitat la această locație.</footer></main>${dialog()}`;
 }
 root.addEventListener('click',async e=>{
  const el=e.target.closest('button,a');if(!el)return;
  if(el.matches('[data-open-day]')){day=el.dataset.openDay;selected=el.dataset.openBooking;await load();return;}
  if(el.matches('[data-filter]')){filter=el.dataset.filter;paint();return;}
  if(el.matches('[data-view]')){view=el.dataset.view;paint();return;}
  if(el.matches('[data-edit]')){selected=el.dataset.edit;paint();root.querySelector('.ops-dialog select')?.focus();return;}
  if(el.matches('[data-close]')){selected=null;paint();return;}
  if(el.matches('[data-refresh]')){await load();return;}
  if(el.matches('[data-logout]')){localStorage.removeItem(store);if(data?.is_admin)await supabase.auth.signOut();location.reload();return;}
  try{
   if(el.matches('[data-notify]')){await enableVenuePush(api,data.push_key);message='Notificările sunt active pe acest telefon.';paint();}
   if(el.matches('[data-retry]')){await api('retry-notifications');message='Notificările au fost puse din nou la trimitere.';await load();}
   if(el.matches('[data-revoke]')){await api('manager-revoke',{id:el.dataset.revoke});message='Accesul a fost revocat.';await load();}
   if(el.matches('[data-floor-table]')){view='list';filter='all';paint();for(const card of root.querySelectorAll('[data-booking]')){const b=data.bookings.find(x=>x.id===card.dataset.booking);card.hidden=b.table_id!==el.dataset.floorTable;}message='Rezervările mesei selectate.';}
  }catch(err){message=err.message;paint();}
 });
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){selected=null;paint();}});
 root.addEventListener('change',async e=>{
  if(e.target.matches('[data-day]')){day=e.target.value;selected=null;await load();}
  if(e.target.matches('[data-floor-time]')){const markup=floor();root.querySelector('.ops-panel').outerHTML=markup;}
  if(e.target.name==='id'&&e.target.closest('[data-ops-form="table"]')){const t=data.tables.find(x=>x.id===e.target.value),f=e.target.form;for(const k of ['label','seats','zone','x','y'])f.elements[k].value=t?.[k]??({seats:4,x:10,y:10}[k]||'');f.elements.enabled.checked=t?.enabled??true;}
  if(e.target.name==='status'&&e.target.value!=='confirmed')e.target.form.elements.attendance.value='unknown';
 });
 root.addEventListener('submit',async e=>{
  const f=e.target.closest('[data-ops-form]');if(!f)return;e.preventDefault();if(busy)return;
  const values=Object.fromEntries(new FormData(f)),kind=f.dataset.opsForm;
  for(const k of ['seats','x','y','version','max_daily_requests','max_slot_reservations','max_slot_guests','booking_duration_minutes'])if(k in values)values[k]=Number(values[k]);
  if(kind==='settings')values.booking_enabled=f.elements.booking_enabled.checked;
  if(kind==='table')values.enabled=f.elements.enabled.checked;
  busy=true;f.querySelector('button').disabled=true;
  try{const result=await api(kind==='manager'?'manager-create':kind,values);
   if(kind==='manager'){const target=root.querySelector('[data-manager-link]');target.innerHTML=`<p>Acesta este linkul privat. Copiază-l acum și păstrează-l doar pentru responsabil.</p><input readonly aria-label="Link privat" value="${safe(result.url)}"><button type="button" class="ops-button secondary" data-copy-private>Copiază linkul</button>`;target.querySelector('button').onclick=()=>navigator.clipboard.writeText(result.url);}
   else{selected=null;message='Modificările au fost salvate.';await load();}
  }catch(err){message=err.message;const n=root.querySelector('.ops-dialog form')||root.querySelector('.ops-message');if(n.tagName==='FORM'){let error=n.querySelector('[role=alert]');if(!error){error=document.createElement('p');error.setAttribute('role','alert');n.append(error);}error.textContent=message;}else n.textContent=message;}
  finally{busy=false;if(f.isConnected)f.querySelector('button').disabled=false;}
 });
 await load();setInterval(()=>{if(!document.hidden&&!busy&&!selected)load(true);},15000);
}
