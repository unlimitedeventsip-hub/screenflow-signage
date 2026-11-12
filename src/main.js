import { createClient } from '@supabase/supabase-js';
import './styles.css';
import { startConnect, tvPing } from './tv-connect.js';
import './tv-fleet.css';
import { createAudioPlayback } from './audio-playback.js';
import { renderAudioView } from './audio-admin.js';
import { attachPortraitBackdrop } from './video-portrait.js';
import { createPortraitVideoPoster } from './video-poster.js';
import './video-portrait.css';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(URL && KEY && !URL.includes('YOUR_PROJECT'));
const supabase = configured ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
const root = document.getElementById('app');
const isPlayer = window.location.pathname.startsWith('/play/');
const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, size=19) => {
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    monitor:'<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="m5 12 14 0m-7-7 7 7-7 7"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    play:'<path d="m8 5 12 7-12 7z"/>',
    volume:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    external:'<path d="M15 3h6v6M10 14 21 3M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
    copy:'<rect width="13" height="13" x="8" y="8" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    trash:'<path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-6 4v6m4-6v6"/>',
    up:'<path d="m6 15 6-6 6 6"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    cloud:'<path d="M20 16.6A4.5 4.5 0 0 0 18.5 8a7 7 0 0 0-13.4 2A4 4 0 0 0 6 18h13"/><path d="m12 10 0 10m-4-4 4 4 4-4"/>',
    settings:'<path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 2-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21h-3v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2-2 .06-.06A1.7 1.7 0 0 0 7.32 15a1.7 1.7 0 0 0-1.56-1H5v-3h.76A1.7 1.7 0 0 0 7.32 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2-2 .06.06A1.7 1.7 0 0 0 10.86 6a1.7 1.7 0 0 0 1-1.56V4h3v.44a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2 2-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1H21v3h-.04A1.7 1.7 0 0 0 19.4 15Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
};

if (!configured) {
  root.innerHTML = `<main class="setup-page"><div class="setup-card"><span class="brand-icon">${icon('monitor',28)}</span><p class="eyebrow">SCREENFLOW / SETUP</p><h1>Platforma este pregătită pentru configurare.</h1><p>Înainte de publicare, conectează proiectul Supabase folosind variabilele <code>VITE_SUPABASE_URL</code> și <code>VITE_SUPABASE_ANON_KEY</code>. Instrucțiunile complete sunt în README.md.</p><div class="setup-note">GitHub → Netlify → Supabase → reclame pe TV</div></div></main>`;
} else if (location.pathname==='/connect') {
  startConnect(supabase,root);
} else if (isPlayer) {
  startPlayer();
} else {
  startAdmin();
}

async function startAdmin() {
  let state = { session:null, isAdmin:false, loading:true, busy:false, view:'overview',
    locations:[], playlists:[], assets:[], items:[], screens:[], installations:[], fleetReady:false, tracks:[], audioReady:false, audioError:'', selectedPlaylist:null, error:'', toast:'' };
  const NAV = [ ['overview','grid','Panou general'],['screens','monitor','Televizoare Live'],['assets','image','Bibliotecă media'],['playlists','list','Playlisturi'],['audio','volume','Sunet & muzică'],['locations','pin','Locații'] ];
  let toastTimeout;
  const pubUrl = path => supabase.storage.from('ads').getPublicUrl(path).data.publicUrl;
  const fmt = date => date ? new Date(date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const inputDate = date => { if(!date) return ''; const d=new Date(date); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,16); };
  const showError = msg => {state.error=String(msg || 'A apărut o eroare.'); render();};
  const toast = msg => {state.toast=msg; render(); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>{state.toast='';render();},3500);};
  const selectOptions = (rows, selected, optional='— Fără —') => `<option value="">${safe(optional)}</option>`+rows.map(x=>`<option value="${x.id}" ${selected===x.id?'selected':''}>${safe(x.name)}</option>`).join('');
  const empty = (i,head,description) => `<div class="empty">${icon(i,28)}<strong>${head}</strong><span>${description}</span></div>`;

  function tvOnline(t){return Date.now()-new Date(t.last_seen_at).getTime() < 45000 && t.playback_state!=='background';}
  async function refreshDevices(){
    const {data,error}=await supabase.from('tv_installations').select('installation_id,screen_id,pair_code,pair_expires_at,first_seen_at,last_seen_at,platform,client_type,resolution,app_version,playback_state,current_asset_id,error_message').order('last_seen_at',{ascending:false}).limit(500);
    state.fleetReady=!error;state.installations=data||[];
  }
  function pendingPanel(){
    if(!state.fleetReady)return '<section class="panel tv-notice"><strong>Asocierea TV nu este activată încă.</strong><p>Rulează fișierul supabase/upgrade_v2_auto_pair.sql în SQL Editor din Supabase.</p></section>';
    const pending=state.installations.filter(t=>!t.screen_id && tvOnline(t));
    const locOptions=state.locations.map(l=>'<option value="'+safe(l.id)+'">'+safe(l.name)+'</option>').join('');
    const playOptions=state.playlists.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name)+'</option>').join('');
    return '<section class="panel tv-discovery"><div class="panel-head"><h2>Aplicații TV detectate automat</h2><span>'+pending.length+' în așteptare</span></div>'
      +'<p>Deschide aplicația Screenflow TV pe fiecare televizor. Va apărea automat aici, fără să îl creezi manual.</p>'
      +(pending.length?pending.map((t,i)=>'<article class="tv-new"><div><strong>'+safe(t.platform||'Televizor nou')+'</strong><span class="tv-pair-code">'+safe(t.pair_code||'------')+'</span></div><small>'+safe(t.client_type||'Screenflow TV')+' · '+safe(t.resolution||'—')+' · '+safe(t.app_version||'')+'</small><form data-form="tv-approve" data-id="'+safe(t.installation_id)+'"><input name="name" maxlength="100" required placeholder="Nume TV" value="TV nou '+(i+1)+'"><select name="location_id"><option value="">Locație (opțional)</option>'+locOptions+'</select><select name="playlist_id"><option value="">Alege playlistul</option>'+playOptions+'</select><button type="submit" class="btn primary">Asociază</button></form><small>Verifică să fie afișat codul '+safe(t.pair_code)+' pe televizor înainte de aprobare.</small></article>').join(''):'<p class="tv-empty">Niciun TV nou. Când deschizi aplicația, apare aici în aproximativ 15 secunde.</p>')
      +'</section>';
  }
  function fleetSummary(){
    const installed=state.installations.filter(t=>!!t.screen_id),live=installed.filter(tvOnline).length,waiting=state.installations.filter(t=>!t.screen_id && tvOnline(t)).length;
    return '<section class="tv-summary"><div><small>Aplicații online</small><strong>'+live+'</strong></div><div><small>Aplicații înregistrate</small><strong>'+installed.length+'</strong></div><div><small>TV de asociat</small><strong>'+waiting+'</strong></div></section>';
  }
  function screenInfo(s){
    const list=state.installations.filter(t=>t.screen_id===s.id);
    const t=list[0];if(!t)return '<div class="tv-state">Nicio aplicație asociată încă</div>';
    const online=tvOnline(t),asset=state.assets.find(a=>a.id===t.current_asset_id);
    return '<div class="tv-state"><span class="'+(online?'tv-dot on':'tv-dot')+'"></span><strong>'+(online?'ONLINE':'OFFLINE')+'</strong><small>'+safe(t.platform)+' · '+safe(t.resolution)+' · '+safe(t.app_version)+'</small><small>'+(asset?'Acum: '+safe(asset.title):'Redare: '+safe(t.playback_state||'—'))+'</small><small>Ultima conexiune: '+safe(new Date(t.last_seen_at).toLocaleString('ro-RO'))+'</small></div>';
  }
  async function load() {
    const [locations,playlists,assets,items,screens] = await Promise.all([
      supabase.from('locations').select('*').order('name'),
      supabase.from('playlists').select('*').order('name'),
      supabase.from('assets').select('*').order('created_at',{ascending:false}),
      supabase.from('playlist_items').select('*').order('position').order('created_at'),
      supabase.from('screens').select('*').order('name')
    ]);
    for(const r of [locations,playlists,assets,items,screens]) if(r.error) throw r.error;
    Object.assign(state,{locations:locations.data,playlists:playlists.data,assets:assets.data,items:items.data,screens:screens.data});
    const music = await supabase.from('audio_tracks').select('*').order('created_at',{ascending:false});
    state.audioReady = !music.error;
    state.audioError = music.error?.message || '';
    state.tracks = music.data || [];
    if(!state.selectedPlaylist || !state.playlists.some(p=>p.id===state.selectedPlaylist)) state.selectedPlaylist=state.playlists[0]?.id||null;
    await refreshDevices();
  }
  async function validate() {
    const {data:{session}}=await supabase.auth.getSession(); state.session=session;
    if (!session) { state.isAdmin=false; state.loading=false; render(); return; }
    const {data,error}=await supabase.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();
    state.isAdmin=!error && !!data;
    if(state.isAdmin){try{await load();}catch(e){state.error=e.message;}}
    state.loading=false; render();
  }
  await validate();
  supabase.auth.onAuthStateChange((_event,session)=>{if(session?.access_token!==state.session?.access_token) setTimeout(validate,0);});
  setInterval(async()=>{if(!state.isAdmin||state.busy||document.hidden)return;
    try{await refreshDevices();if(!document.activeElement?.matches('input,textarea,select') && ['overview','screens'].includes(state.view))render();}catch{}
  },15000);

  function frame(content) {
    const title = NAV.find(n=>n[0]===state.view)?.[2] || 'Panou general';
    return `<div class="dashboard"><aside class="sidebar">
      <div class="brand"><div class="brand-symbol">${icon('play',23)}</div><div><strong>screenflow<span>.</span></strong><small>DIGITAL SIGNAGE</small></div></div>
      <div class="sidebar-label">WORKSPACE</div><nav class="nav">${NAV.map(n=>`<button class="nav-item ${state.view===n[0]?'active':''}" data-nav="${n[0]}">${icon(n[1])}<span>${n[2]}</span>${n[0]==='screens'?`<i>${state.screens.length}</i>`:''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="account"><div class="avatar">${safe((state.session?.user?.email||'A')[0].toUpperCase())}</div><div><strong>Administrator</strong><small title="${safe(state.session?.user?.email)}">${safe(state.session?.user?.email)}</small></div></div><button data-action="logout" class="icon-button" title="Deconectare">${icon('logout')}</button></div>
    </aside><main class="main"><header class="topbar"><div class="crumb"><span>WORKSPACE</span><span>/</span><strong>${title}</strong></div><div class="top-actions"><span class="status"><b></b> ${state.fleetReady?'Monitorizare TV activă':'Control reclame'}</span><button class="btn subtle small" data-nav="screens">${icon('monitor',16)} Ecranele mele</button></div></header>
    <div class="content">${state.error?`<div class="alert">${safe(state.error)} <button data-action="dismiss-error">×</button></div>`:''}${content}</div></main>
    ${state.toast?`<div class="toast">${icon('check',17)} ${safe(state.toast)}</div>`:''}
    ${state.busy?'<div class="busy"><div class="spinner"></div> Se procesează...</div>':''}</div>`;
  }
  function heading(kicker,title,description,action='') {return `<div class="page-head"><div><div class="kicker">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
  function overview(){
    const active=state.assets.filter(a=>a.enabled).length;
    const sCount=state.screens.filter(s=>s.playlist_id).length;
    return heading('BUN VENIT','Conținutul tău, pe toate ecranele.','Organizează campanii, creează playlisturi și controlează televizoarele dintr-un singur loc.',`<button class="btn primary" data-nav="assets">${icon('plus',17)} Adaugă reclamă</button>`)+
    `<div class="stats"><div class="stat"><div class="stat-icon">${icon('monitor')}</div><span>Televizoare configurate</span><strong>${state.screens.length}</strong><small>${sCount} cu playlist atribuit</small></div>
    <div class="stat"><div class="stat-icon">${icon('image')}</div><span>Reclame active</span><strong>${active}</strong><small>Imagini și videoclipuri</small></div>
    <div class="stat"><div class="stat-icon">${icon('list')}</div><span>Playlisturi</span><strong>${state.playlists.length}</strong><small>Actualizare automată pe TV</small></div>
    <div class="stat"><div class="stat-icon">${icon('pin')}</div><span>Locații</span><strong>${state.locations.length}</strong><small>Dintr-un singur dashboard</small></div></div>
    ${fleetSummary()}${pendingPanel()}<div class="two-col"><section class="panel"><div class="panel-head"><h2>Acces rapid</h2><span>CONTROL CENTER</span></div><div class="quick">${[['assets','cloud','Încarcă materiale','Poze și video în bibliotecă'],['playlists','list','Construiește un playlist','Alege ordinea și durata'],['screens','monitor','Conectează un televizor','Deschide linkul unic pe TV']].map(v=>`<button data-nav="${v[0]}" class="quick-item"><span class="quick-icon">${icon(v[1])}</span><span><strong>${v[2]}</strong><small>${v[3]}</small></span>${icon('arrow',17)}</button>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><h2>Ultimele materiale</h2><button data-nav="assets" class="text-link">Vezi toate ${icon('arrow',15)}</button></div>${state.assets.length?`<div class="recent">${state.assets.slice(0,4).map(a=>`<div class="recent-row"><span class="mini-preview">${a.kind==='image'?`<img src="${safe(pubUrl(a.storage_path))}" alt=""/>`:`${icon('play',18)}`}</span><div><strong>${safe(a.title)}</strong><small>${a.kind==='image'?'Imagine':'Video'} · ${fmt(a.created_at)}</small></div><span class="pill ${a.enabled?'green':'gray'}">${a.enabled?'Activ':'Oprit'}</span></div>`).join('')}</div>`:empty('image','Biblioteca este goală','Încarcă prima reclamă pentru a începe.')}</section></div>`;
  }
  function assetsView(){
    const cards=state.assets.map(a=>`<article class="asset-card"><div class="asset-cover">${a.kind==='image'?`<img src="${safe(pubUrl(a.storage_path))}" alt="${safe(a.title)}" loading="lazy">`:`<video src="${safe(pubUrl(a.storage_path))}#t=0.2" preload="metadata" muted playsinline></video><span class="video-badge">${icon('play',14)} VIDEO</span>`}</div><div class="asset-body"><div class="asset-title"><strong title="${safe(a.title)}">${safe(a.title)}</strong><span class="pill ${a.enabled?'green':'gray'}">${a.enabled?'Activ':'Oprit'}</span></div><small>${a.kind.toUpperCase()} · ${fmt(a.created_at)}</small><form data-form="asset-edit" data-id="${a.id}" class="asset-form"><label>Durată (sec.)<input name="duration" type="number" min="3" max="3600" value="${a.duration_seconds}" required></label><label>Începe la<input name="starts" type="datetime-local" value="${inputDate(a.starts_at)}"></label><label>Se încheie la<input name="ends" type="datetime-local" value="${inputDate(a.ends_at)}"></label><div class="asset-buttons"><button class="btn small subtle" type="submit">Salvează</button><button class="btn small subtle" type="button" data-action="toggle-asset" data-id="${a.id}">${a.enabled?'Dezactivează':'Activează'}</button>${a.kind==='video'?(a.blur_background_path?'<span class="pill green">Fundal blurat ✓</span>':`<button class="btn small subtle" type="button" data-action="generate-video-poster" data-id="${a.id}">Generează fundal</button>`):''}<button type="button" title="Șterge" class="icon-button danger" data-action="delete-asset" data-id="${a.id}">${icon('trash',17)}</button></div></form></div></article>`).join('');
    return heading('BIBLIOTECĂ MEDIA','Reclamele tale','Încarcă fotografii sau videoclipuri, apoi adaugă-le în playlisturi. Poți seta o perioadă de difuzare.')+`<section class="upload-panel"><div class="upload-visual">${icon('cloud',31)}</div><div><h2>Adaugă materiale noi</h2><p>JPEG, PNG, WebP sau MP4 (H.264 recomandat). Pentru început, folosește fișiere video sub 50 MB.</p><form data-form="upload" class="upload-form"><input type="text" name="title" placeholder="Numele reclamei" maxlength="150" required><input type="file" name="file" accept="image/jpeg,image/png,image/webp,video/mp4" required><button class="btn primary" type="submit">${icon('plus',17)} Încarcă</button></form></div></section><div class="section-heading"><h2>Toate materialele <span>${state.assets.length}</span></h2></div>${cards?`<div class="assets-grid">${cards}</div>`:empty('image','Nicio reclamă încă','Încarcă primul fișier ca să apară aici.')}`;
  }
  function playlistsView(){
    const playlist=state.playlists.find(p=>p.id===state.selectedPlaylist);
    const items=state.items.filter(i=>i.playlist_id===playlist?.id).sort((a,b)=>a.position-b.position || a.created_at.localeCompare(b.created_at));
    const addable=state.assets.filter(a=>!items.some(i=>i.asset_id===a.id));
    return heading('ORGANIZARE','Playlisturi','Fiecare televizor poate avea playlistul lui. Ordinea este modificabilă oricând.')+`<div class="playlist-layout"><section class="panel playlist-list"><div class="panel-head"><h2>Playlisturile mele</h2></div><form data-form="playlist-new" class="stack-form"><input name="name" placeholder="Ex.: Promo ParkLake" required maxlength="100"><button class="btn primary" type="submit">${icon('plus',16)} Creează</button></form><div class="playlist-menu">${state.playlists.map(p=>`<button class="playlist-option ${state.selectedPlaylist===p.id?'selected':''}" data-action="select-playlist" data-id="${p.id}"><span>${icon('list',18)}</span><div><strong>${safe(p.name)}</strong><small>${state.items.filter(i=>i.playlist_id===p.id).length} materiale</small></div>${icon('arrow',16)}</button>`).join('')}</div></section>
    <section class="panel playlist-editor">${playlist?`<div class="panel-head"><div><div class="kicker">EDITARE PLAYLIST</div><h2>${safe(playlist.name)}</h2><button type="button" class="btn small ${playlist.synchronized?'primary':'subtle'}" data-action="sync-toggle" data-id="${playlist.id}">${playlist.synchronized?'Sincronizare activă':'Sincronizează TV-urile'}</button></div><button class="icon-button danger" title="Șterge playlist" data-action="delete-playlist" data-id="${playlist.id}">${icon('trash',18)}</button></div><form data-form="playlist-add" class="add-form"><select name="asset_id" required><option value="">Alege reclamă...</option>${addable.map(a=>`<option value="${a.id}">${safe(a.title)} (${a.kind})</option>`).join('')}</select><button class="btn primary" type="submit" ${!addable.length?'disabled':''}>${icon('plus',17)} Adaugă</button></form><div class="sortable-list">${items.length?items.map((item,index)=>{const a=state.assets.find(a=>a.id===item.asset_id);return `<div class="sequence-item"><span class="sequence-no">${String(index+1).padStart(2,'0')}</span><span class="sequence-thumbnail">${a?.kind==='image'?`<img src="${safe(pubUrl(a.storage_path))}" alt="">`:icon('play',18)}</span><div class="sequence-info"><strong>${safe(a?.title||'Material șters')}</strong><small>${a?.kind==='video'?'Video · până la final':'Imagine · '+(item.duration_override||a?.duration_seconds||10)+' sec'}</small></div><div class="sequence-actions"><button type="button" class="icon-button" title="Mută sus" data-action="item-up" data-id="${item.id}" ${index===0?'disabled':''}>${icon('up',17)}</button><button type="button" class="icon-button" title="Mută jos" data-action="item-down" data-id="${item.id}" ${index===items.length-1?'disabled':''}>${icon('down',17)}</button><button type="button" class="icon-button danger" title="Elimină" data-action="item-remove" data-id="${item.id}">${icon('trash',17)}</button></div></div>`;}).join(''):empty('list','Playlist gol','Alege reclame din lista de mai sus.')}</div>`:empty('list','Selectează un playlist','Creează sau alege un playlist din stânga.')}</section></div>`;
  }
  function audioView(){return renderAudioView({state,heading,safe,pubUrl});}
  function screensView(){
    const rows=state.screens.map(s=>{const l=state.locations.find(l=>l.id===s.location_id);const p=state.playlists.find(p=>p.id===s.playlist_id);const link=`${location.origin}/play/${s.public_id}`;return `<article class="screen-card"><div class="screen-card-top"><span class="screen-symbol">${icon('monitor',26)}</span><span class="pill ${p?'green':'gray'}">${p?'Playlist activ':'Neconfigurat'}</span></div><h3>${safe(s.name)}</h3><p>${icon('pin',14)} ${safe(l?.name||'Fără locație')}</p><form data-form="screen-assign" data-id="${s.id}" class="screen-assign"><label>Playlist afișat</label><select name="playlist">${selectOptions(state.playlists,s.playlist_id,'Fără playlist')}</select><select name="location">${selectOptions(state.locations,s.location_id,'Fără locație')}</select><button type="submit" class="btn small subtle">Actualizează</button></form>${screenInfo(s)}<div class="screen-url"><span title="${safe(link)}">${safe(link)}</span><button type="button" data-action="copy-link" data-id="${s.id}" title="Copiază link">${icon('copy',16)}</button></div><div class="card-footer"><a href="${safe(link)}" target="_blank" rel="noopener noreferrer">${icon('external',15)} Deschide player</a><button data-action="delete-screen" data-id="${s.id}" class="link-danger">Șterge</button></div></article>`;}).join('');
    return heading('DISTRIBUȚIE','Televizoare','Aplicațiile TV apar automat. Confirmă codul de pe ecran, alege locația și playlistul.')+fleetSummary()+pendingPanel()+`<section class="panel tv-bulk"><h2>Playlist comun pentru locație</h2><form data-form="tv-bulk" class="tv-bulk-form"><select name="location_id" required>${selectOptions(state.locations,null,'Locația')}</select><select name="playlist_id" required>${selectOptions(state.playlists,null,'Playlistul')}</select><button class="btn primary" type="submit">Aplică la toate TV-urile</button></form><p>Exemplu: toate cele 5 TV de la #altfel Unirii vor primi același playlist.</p></section><details class="panel tv-legacy"><summary>Adăugare manuală (doar pentru browsere vechi)</summary><section class="create-screen"><div><h2>Conectează un televizor nou</h2><p>Adaugă-l, copiază linkul și deschide-l pe TV.</p></div><form data-form="screen-new" class="screen-form"><input name="name" placeholder="Ex.: TV Bar 1" required maxlength="100"><select name="location_id">${selectOptions(state.locations,null,'Alege locația')}</select><select name="playlist_id">${selectOptions(state.playlists,null,'Alege playlistul')}</select><button class="btn primary" type="submit">${icon('plus',16)} Adaugă ecran</button></form></section></details><div class="section-heading"><h2>Ecranele tale <span>${state.screens.length}</span></h2></div>${rows?`<div class="screens-grid">${rows}</div>`:empty('monitor','Niciun ecran adăugat','Configurează un televizor folosind formularul de mai sus.')}`;
  }
  function locationsView(){
    return heading('ORGANIZARE','Locații','Grupează televizoarele după restaurant, bar, terasă sau alte puncte de difuzare.')+`<section class="panel location-panel"><div class="panel-head"><h2>Adaugă locație</h2></div><form data-form="location-new" class="stack-form"><input name="name" placeholder="Ex.: #altfel ParkLake" maxlength="100" required><button class="btn primary" type="submit">${icon('plus',17)} Creează locație</button></form><div class="location-list">${state.locations.map(l=>`<div class="location-item"><span class="location-icon">${icon('pin')}</span><div><strong>${safe(l.name)}</strong><small>${state.screens.filter(s=>s.location_id===l.id).length} televizoare</small></div><button class="icon-button danger" data-action="delete-location" data-id="${l.id}">${icon('trash',17)}</button></div>`).join('')}</div></section>`;
  }
  function loginView(denied=false){ return `<main class="login-page"><div class="login-illustration"><div class="brand light"><div class="brand-symbol">${icon('play',23)}</div><div><strong>screenflow<span>.</span></strong><small>DIGITAL SIGNAGE</small></div></div><div class="hero-decor"><div class="preview-frame"><div class="preview-head"><b></b><span>LIVE PREVIEW</span></div><div class="preview-image"><div class="preview-bubble">ON AIR</div><strong>Conținut care<br>atrage privirile.</strong><span>Difuzat pe fiecare ecran.</span></div><div class="preview-controls"><span></span><span></span><span></span></div></div></div><div class="login-quote">Un singur loc pentru toate reclamele,<br>campaniile și televizoarele tale.</div></div><div class="login-content"><div class="login-box"><p class="kicker">ADMINISTRATOR</p><h1>Bine ai revenit.</h1><p>Intră în panoul de control pentru a gestiona conținutul difuzat în locațiile tale.</p>${state.error?`<div class="alert">${safe(state.error)}</div>`:''}${denied?`<div class="alert">Contul este autentificat, dar nu este autorizat ca administrator. Adaugă utilizatorul în tabelul admin_users, conform README.md.</div><button class="btn subtle" data-action="logout">Schimbă contul</button>`:`<form data-form="login" class="login-form"><label>Adresa de email<input type="email" name="email" placeholder="email@firma.ro" required autocomplete="username"></label><label>Parola<input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"></label><button class="btn primary full" type="submit">Autentificare ${icon('arrow',18)}</button></form>`}<div class="login-footer">Acces securizat · Administrare centralizată · Actualizare automată</div></div></div></main>`; }
  function render(){ if(state.loading){root.innerHTML='<div class="loading-screen"><span class="spinner"></span> Se conectează...</div>';return;} if(!state.session){root.innerHTML=loginView();return;} if(!state.isAdmin){root.innerHTML=loginView(true);return;} root.innerHTML=frame(({overview,assets:assetsView,playlists:playlistsView,audio:audioView,screens:screensView,locations:locationsView})[state.view]?.()||overview());}
  async function perform(op,success){state.busy=true;state.error='';render();try{await op();await load();state.busy=false;toast(success||'Modificările au fost salvate.');}catch(e){state.busy=false;showError(e.message);} }
  async function insert(table,record){const {error}=await supabase.from(table).insert(record);if(error)throw error;}
  async function patch(table,id,record){const {error}=await supabase.from(table).update(record).eq('id',id);if(error)throw error;}
  async function remove(table,id){const {error}=await supabase.from(table).delete().eq('id',id);if(error)throw error;}
  root.addEventListener('click',async e=>{
    const nav=e.target.closest('[data-nav]'); if(nav){state.view=nav.dataset.nav;render();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    const a=el.dataset.action,id=el.dataset.id;
    if(a==='dismiss-error'){state.error='';render();return;}
    if(a==='logout'){await supabase.auth.signOut();state.session=null;state.isAdmin=false;render();return;}
    if(a==='select-playlist'){state.selectedPlaylist=id;render();return;}
    if(a==='sync-toggle'){
      const p=state.playlists.find(x=>x.id===id);if(!p)return;
      perform(()=>patch('playlists',id,{synchronized:!p.synchronized,sync_anchor:new Date().toISOString()}),
        p.synchronized?'Sincronizare oprită.':'TV-urile cu acest playlist sunt sincronizate.');return;
    }
    if(a==='delete-audio'){
      if(!confirm('Ștergi această piesă din bibliotecă și din playlisturi?'))return;
      const track=state.tracks.find(t=>t.id===id);if(!track)return;
      perform(async()=>{
        await remove('audio_tracks',id);
        const {error}=await supabase.storage.from('ads').remove([track.storage_path]);
        if(error)throw error;
      },'Piesa a fost ștearsă.');return;
    }
    if(a==='generate-video-poster'){
      const asset=state.assets.find(x=>x.id===id && x.kind==='video');if(!asset)return;
      perform(async()=>{
        const {data,error}=await supabase.storage.from('ads').download(asset.storage_path);
        if(error)throw error;
        const poster=await createPortraitVideoPoster(data);
        if(!poster)throw new Error('Acest videoclip este orizontal, deci nu necesită fundal blurat.');
        const path='backgrounds/'+crypto.randomUUID()+'.jpg';
        const upload=await supabase.storage.from('ads').upload(path,poster,{
          contentType:'image/jpeg',cacheControl:'3600',upsert:false
        });
        if(upload.error)throw upload.error;
        try{await patch('assets',id,{blur_background_path:path});}
        catch(e){await supabase.storage.from('ads').remove([path]);throw e;}
      },'Fundalul blurat a fost generat pentru videoclip.');return;
    }
    if(a==='copy-link'){const s=state.screens.find(s=>s.id===id); if(!s)return;const value=`${location.origin}/play/${s.public_id}`;try{await navigator.clipboard.writeText(value);toast('Linkul TV a fost copiat.');}catch{window.prompt('Copiază linkul:',value);}return;}
    if(a==='toggle-asset'){const o=state.assets.find(x=>x.id===id);if(o)perform(()=>patch('assets',id,{enabled:!o.enabled}),'Starea reclamei a fost schimbată.');return;}
    if(['delete-asset','delete-playlist','delete-screen','delete-location'].includes(a)){
      if(!confirm('Sigur vrei să ștergi acest element?'))return;
      const tab={'delete-asset':'assets','delete-playlist':'playlists','delete-screen':'screens','delete-location':'locations'}[a];
      perform(async()=>{if(tab==='assets'){const asset=state.assets.find(x=>x.id===id);await remove('assets',id);if(asset)await supabase.storage.from('ads').remove([asset.storage_path,asset.blur_background_path].filter(Boolean));}else await remove(tab,id);},'Element șters.');return;
    }
    if(['item-up','item-down','item-remove'].includes(a)){
      if(a==='item-remove'){perform(()=>remove('playlist_items',id),'Material eliminat din playlist.');return;}
      const arr=state.items.filter(i=>i.playlist_id===state.selectedPlaylist).sort((a,b)=>a.position-b.position||a.created_at.localeCompare(b.created_at));
      const ix=arr.findIndex(i=>i.id===id), next=ix+(a==='item-up'?-1:1);if(ix<0||next<0||next>=arr.length)return;
      [arr[ix],arr[next]]=[arr[next],arr[ix]];
      perform(async()=>{for(let i=0;i<arr.length;i++)await patch('playlist_items',arr[i].id,{position:i+1});},'Ordinea a fost modificată.');
    }
  });
  root.addEventListener('submit',async e=>{
    const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
    const type=f.dataset.form, id=f.dataset.id, form=new FormData(f), val=k=>String(form.get(k)||'').trim();
    if(type==='login') {state.error='';state.busy=true;const {error}=await supabase.auth.signInWithPassword({email:val('email'),password:val('password')});state.busy=false;if(error)showError(error.message);else await validate();return;}
    if(type==='location-new'){if(val('name'))perform(()=>insert('locations',{name:val('name')}),'Locație adăugată.');return;}
    if(type==='playlist-new'){if(val('name'))perform(()=>insert('playlists',{name:val('name')}),'Playlist creat.');return;}
    if(type==='tv-approve'){
      const t=state.installations.find(x=>x.installation_id===id && !x.screen_id);
      if(!t||!t.pair_code){showError('Dispozitivul nu mai așteaptă asocierea.');return;}
      if(!confirm('Pe televizor apare codul '+t.pair_code+'? Confirmi asocierea?'))return;
      perform(async()=>{const {error}=await supabase.rpc('tv_approve',{
        p_installation_id:t.installation_id,p_pair_code:t.pair_code,
        p_name:val('name'),p_location_id:val('location_id')||null,
        p_playlist_id:val('playlist_id')||null
      });if(error)throw error;},'Televizor asociat. Va porni automat reclamele.');return;
    }
    if(type==='tv-bulk'){
      const loc=val('location_id'),play=val('playlist_id');
      const count=state.screens.filter(s=>s.location_id===loc).length;
      if(!count){showError('Nu există televizoare asociate la această locație.');return;}
      if(!confirm('Aplici playlistul la toate cele '+count+' televizoare?'))return;
      perform(async()=>{const {error}=await supabase.from('screens').update({playlist_id:play}).eq('location_id',loc);if(error)throw error;},'Playlist aplicat la '+count+' TV-uri.');return;
    }
    if(type==='screen-new'){perform(()=>insert('screens',{name:val('name'),location_id:val('location_id')||null,playlist_id:val('playlist_id')||null}),'Televizor adăugat.');return;}
    if(type==='screen-assign'){perform(()=>patch('screens',id,{playlist_id:val('playlist')||null,location_id:val('location')||null}),'Setările TV au fost actualizate.');return;}
    if(type==='asset-edit'){
      const starts=val('starts'),ends=val('ends');const sec=Number(val('duration'));
      if(sec<3||sec>3600){showError('Durata trebuie să fie între 3 și 3600 secunde.');return;}
      if(starts&&ends&&new Date(ends)<=new Date(starts)){showError('Data finală trebuie să fie după data de început.');return;}
      perform(()=>patch('assets',id,{duration_seconds:sec,starts_at:starts?new Date(starts).toISOString():null,ends_at:ends?new Date(ends).toISOString():null}),'Programul reclamei a fost salvat.');return;
    }
    if(type==='playlist-add'){
      const assetId=val('asset_id'), arr=state.items.filter(i=>i.playlist_id===state.selectedPlaylist);if(!assetId)return;
      perform(()=>insert('playlist_items',{playlist_id:state.selectedPlaylist,asset_id:assetId,position:Math.max(0,...arr.map(i=>i.position))+1}),'Material adăugat în playlist.');return;
    }
    if(type==='audio-settings'){
      const vv=Number(val('video_volume')),bv=Number(val('background_volume'));
      if(![vv,bv].every(x=>Number.isInteger(x)&&x>=0&&x<=100)){
        showError('Volumul trebuie să fie între 0 și 100%.');return;
      }
      if(form.has('background_audio_enabled')&&!val('background_track_id')){
        showError('Alege întâi o piesă pentru muzica de fundal.');return;
      }
      perform(()=>patch('playlists',id,{
        video_audio_enabled:form.has('video_audio_enabled'),video_volume:vv,
        background_audio_enabled:form.has('background_audio_enabled'),background_volume:bv,
        background_track_id:val('background_track_id')||null
      }),'Setările audio ale playlistului au fost salvate.');return;
    }
    if(type==='audio-upload'){
      const file=form.get('file'),name=val('title');
      if(!(file instanceof File)||!file.size||!name)return;
      if(!file.name.toLowerCase().endsWith('.mp3') ||
         !['audio/mpeg','audio/mp3','application/octet-stream',''].includes(file.type)){
        showError('Încarcă un fișier MP3 compatibil cu Samsung TV.');return;
      }
      if(file.size>20*1024*1024){
        showError('Piesa depășește 20 MB. Comprimă fișierul MP3.');return;
      }
      const path='audio/'+crypto.randomUUID()+'.mp3';
      perform(async()=>{
        const {error}=await supabase.storage.from('ads').upload(path,file,{
          contentType:'audio/mpeg',cacheControl:'3600',upsert:false
        });
        if(error)throw error;
        try{await insert('audio_tracks',{name,storage_path:path});}
        catch(e){await supabase.storage.from('ads').remove([path]);throw e;}
      },'Piesa a fost încărcată. Alege-o în setările playlistului.');return;
    }
    if(type==='upload'){
      const file=form.get('file'), name=val('title');if(!(file instanceof File)||!file.size||!name)return;
      if(!['image/png','image/jpeg','image/webp','video/mp4'].includes(file.type)){showError('Format incompatibil. Folosește JPEG, PNG, WebP sau MP4.');return;}
      if(file.size>50*1024*1024){showError('Fișierul depășește 50 MB. Comprimă video sau mărește limita din Supabase.');return;}
      const path=`${crypto.randomUUID()}.${file.type==='video/mp4'?'mp4':file.type.split('/')[1]==='jpeg'?'jpg':file.type.split('/')[1]}`;
      perform(async()=>{
        const poster=file.type==='video/mp4'?await createPortraitVideoPoster(file):null;
        const posterPath=poster?'backgrounds/'+crypto.randomUUID()+'.jpg':null;
        if(posterPath){
          const posterUpload=await supabase.storage.from('ads').upload(posterPath,poster,{
            contentType:'image/jpeg',cacheControl:'3600',upsert:false
          });
          if(posterUpload.error)throw posterUpload.error;
        }
        const {error}=await supabase.storage.from('ads').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
        if(error){
          if(posterPath)await supabase.storage.from('ads').remove([posterPath]);
          throw error;
        }
        try{await insert('assets',{
          title:name,storage_path:path,
          kind:file.type.startsWith('video/')?'video':'image',
          blur_background_path:posterPath,duration_seconds:10
        });}
        catch(e){await supabase.storage.from('ads').remove([path,posterPath].filter(Boolean));throw e;}
      },'Reclama a fost încărcată. Fundalul blurat se generează automat pentru video vertical.');
    }
  });
}

function startPlayer(){
  const publicId=decodeURIComponent(location.pathname.split('/')[2]||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicId)){
    root.innerHTML='<main class="player-empty"><h1>Linkul TV nu este valid.</h1><p>Generează un link nou din panoul de administrare.</p></main>';return;
  }
  document.body.classList.add('tv-body');
  document.title='Screenflow · TV Player';
  root.innerHTML=`<div class="tv-stage" id="tv-stage"><div class="tv-standby"><div class="tv-logo">screenflow<span>.</span></div><div class="tv-line"></div><p>Se pregătește conținutul...</p></div></div><div class="tv-indicator" id="tv-indicator"></div>`;
  const stage=document.getElementById('tv-stage'), indicator=document.getElementById('tv-indicator');
  let current=[], pending=null, index=0, first=true, timer=null, token=0, sync=false, syncAnchor=0, syncOffset=0, signature="";
  const cacheKey=`screenflow:manifest:${publicId}`;
  const getUrl=path=>supabase.storage.from('ads').getPublicUrl(path).data.publicUrl;
  const audio=createAudioPlayback({stage,indicator,getUrl});
  let clearPortraitBackdrop=()=>{};
  const standby=(msg='Conținutul va apărea în curând.')=>{clearPortraitBackdrop();clearPortraitBackdrop=()=>{};audio.mediaChanged('none');stage.innerHTML=`<div class="tv-standby"><div class="tv-logo">screenflow<span>.</span></div><div class="tv-line"></div><p>${safe(msg)}</p></div>`;};
  const duration=a=>Math.max(3000,Math.min(3600000,(Number(a?.duration_seconds)||10)*1000));
  const next=()=>{
    clearTimeout(timer);token++;
    if(sync){align();return;}
    if(pending){current=pending;pending=null;index=0;}
    else index=(index+1)%Math.max(current.length,1);
    play();
  };
  function align(force=false){
    if(!sync||!current.length)return;
    const length=current.reduce((sum,a)=>sum+duration(a),0);
    if(!length)return;
    let t=((Date.now()+syncOffset-syncAnchor)%length+length)%length;
    let wanted=0;
    while(wanted<current.length-1 && t>=duration(current[wanted])){t-=duration(current[wanted]);wanted++;}
    const remain=Math.max(300,duration(current[wanted])-t);
    if(force||index!==wanted||!stage.querySelector('.tv-media')){index=wanted;play(t,remain);return;}
    const v=stage.querySelector('video');
    if(v && v.readyState>=1 && Number.isFinite(v.duration) && Math.abs(v.currentTime-t/1000)>1.5){
      try{v.currentTime=Math.min(t/1000,Math.max(0,v.duration-0.1));}catch{}
    }
    clearTimeout(timer);timer=setTimeout(next,remain);
  }
  function play(offset=0,remaining=null){
    clearTimeout(timer);clearPortraitBackdrop();clearPortraitBackdrop=()=>{};const my=++token;
    if(!current.length){standby();return;}
    const a=current[index];if(!a){index=0;play();return;}
    const url=getUrl(a.storage_path);
    if(a.kind==='image'){
      stage.innerHTML='<img class="tv-media" alt="" />';
      audio.mediaChanged('image');
      const img=stage.querySelector('img');img.src=url;
      img.onerror=()=>{if(my===token)timer=setTimeout(next,1500);};
      timer=setTimeout(()=>{if(my===token)next();},remaining??duration(a));
    } else if(a.kind==='video'){
      stage.innerHTML='<video class="tv-media" playsinline preload="auto"></video>';
      const video=stage.querySelector('video');video.src=url;
       clearPortraitBackdrop=attachPortraitBackdrop(stage,video,a.blur_background_path?getUrl(a.blur_background_path):null);
      if(sync&&offset>0)video.onloadedmetadata=()=>{try{video.currentTime=Math.min(offset/1000,Math.max(0,video.duration-0.1));}catch{}};
      video.onended=()=>{if(my===token)next();};
      video.onerror=()=>{if(my===token)next();};
      audio.prepareVideo(video).catch(()=>{if(my===token){indicator.textContent='Redarea video a fost blocată; verifică playerul TV.';timer=setTimeout(next,3000);}});
      timer=setTimeout(()=>{if(my===token)next();},remaining??60*60*1000);
    } else next();
  }
  async function refresh(){
    try{
      const {data,error}=await supabase.rpc('get_screen_manifest',{screen_public_id:publicId});
      if(error)throw error;
      if(!data){standby('Televizorul nu există. Verifică linkul din panoul admin.');indicator.textContent='Ecran necunoscut';return;}
      audio.applySettings(data);
       const items=Array.isArray(data.items)?data.items:[];
      try{localStorage.setItem(cacheKey,JSON.stringify({items,updated:Date.now()}));}catch{}
      indicator.textContent='';
      const now=Date.now(),stamp=Date.parse(data.server_time);
      if(Number.isFinite(stamp))syncOffset=stamp-now;
      const newSync=Boolean(data.synchronized && data.sync_anchor),newAnchor=Date.parse(data.sync_anchor||'');
      const newSignature=JSON.stringify({items,newSync,anchor:data.sync_anchor});
      if(first||newSignature!==signature){
        const wasFirst=first;first=false;signature=newSignature;sync=newSync;syncAnchor=Number.isFinite(newAnchor)?newAnchor:0;
        if(sync){current=items;pending=null;align(true);}
        else if(wasFirst||!current.length){current=items;index=0;play();}
        else pending=items;
      }else if(sync)align();
    }catch(e){
      indicator.textContent='Conexiune indisponibilă · se reîncearcă';
      if(first){try{const saved=JSON.parse(localStorage.getItem(cacheKey));if(saved?.items?.length){current=saved.items;first=false;play();}else standby('Așteptăm conexiunea la internet...');}catch{standby('Așteptăm conexiunea la internet...');}}
    }
  }
  let reporting=false;
  async function heartbeat(){
    if(reporting)return;reporting=true;
    try{
      const r=await tvPing(supabase,{asset:current[index]?.id||null,state:document.hidden?'background':(current.length?'playing':'waiting')});
      if(r?.status==='pending')location.replace('/connect');
      if(r?.status==='approved' && r.screen_public_id && r.screen_public_id!==publicId)location.replace('/play/'+r.screen_public_id);
    }catch(e){console.warn('TV heartbeat',e?.message)}
    finally{reporting=false}
  }
  refresh();heartbeat();
  setInterval(refresh,15000);setInterval(heartbeat,15000);
  setInterval(()=>{if(sync)align();},3000);
  window.addEventListener('online',()=>{refresh();heartbeat();});
}
