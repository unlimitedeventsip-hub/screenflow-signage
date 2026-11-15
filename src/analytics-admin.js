import './analytics-admin.css';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const int=v=>Math.max(0,Number(v)||0).toLocaleString('ro-RO');
const sum=(list,key='count')=>list.reduce((n,item)=>n+(Number(item[key])||0),0);
const eventTotal=(rows,eventName,source=null)=>sum(rows.filter(row=>row.event_name===eventName && (!source||row.source===source)),'events');
const card=(caption,value,note)=>`<article class="analytics-kpi"><span>${safe(caption)}</span><strong>${int(value)}</strong><small>${safe(note)}</small></article>`;

function dailyChart(rows){
 const days=new Map();
 for(const row of rows){
   if(!['hub_view','menu_open','booking_sent'].includes(row.event_name))continue;
   const day=String(row.report_date||'').slice(0,10);
   const curr=days.get(day)||{hub_view:0,menu_open:0,booking_sent:0};
   curr[row.event_name]+=Number(row.events)||0;
   days.set(day,curr);
 }
 const entries=[...days].sort((a,b)=>a[0].localeCompare(b[0]));
 const max=Math.max(1,...entries.map(([,v])=>v.hub_view+v.menu_open+v.booking_sent));
 if(!entries.length)return '<div class="analytics-empty">Nu există încă evenimente cu consimțământ în acest interval.</div>';
 return '<div class="analytics-chart">'+entries.map(([day,v])=>
   '<div class="analytics-chart-row"><span>'+safe(day.slice(5))+'</span>'+
   '<div class="analytics-bars"><i class="analytics-bar-view" style="width:'+(v.hub_view/max*100).toFixed(1)+'%" title="'+v.hub_view+' accesări"></i>'+
   '<i class="analytics-bar-menu" style="width:'+(v.menu_open/max*100).toFixed(1)+'%" title="'+v.menu_open+' deschideri meniu"></i>'+
   '<i class="analytics-bar-booking" style="width:'+(v.booking_sent/max*100).toFixed(1)+'%" title="'+v.booking_sent+' cereri trimise"></i></div>'+
   '<b>'+int(v.hub_view)+'</b></div>').join('')+'</div>';
}

export function renderAnalyticsAdmin({state,heading}){
 const data=state.analytics;
 const tools=`<div class="analytics-filters"><label>Perioada
   <select data-analytics-days><option value="7" ${state.analyticsDays===7?'selected':''}>7 zile</option>
   <option value="30" ${state.analyticsDays===30?'selected':''}>30 zile</option>
   <option value="90" ${state.analyticsDays===90?'selected':''}>90 zile</option></select></label>
   <label>Locația<select data-analytics-location><option value="">Toate locațiile</option>
   ${state.locations.map(l=>'<option value="'+safe(l.id)+'" '+(state.analyticsLocation===l.id?'selected':'')+'>'+safe(l.name)+'</option>').join('')}</select></label>
   <button class="btn subtle" data-action="analytics-refresh">Actualizează</button>
   <button class="btn subtle" data-action="analytics-export" ${!data?'disabled':''}>Export CSV</button></div>`;
 const top=heading('DATE & REZULTATE','Statistici #altfel',
   'Date reale agregate din TV-uri și rezervări, plus interacțiuni web colectate doar cu acordul vizitatorilor.');
 if(state.analyticsLoading && !data)return top+tools+'<section class="panel analytics-loading">Se încarcă datele…</section>';
 if(state.analyticsError)return top+tools+'<section class="panel"><p class="alert">'+safe(state.analyticsError)+'</p></section>';
 if(!data)return top+tools+'<section class="panel"><p>Apasă Actualizează pentru a încărca statisticile.</p></section>';
 const events=data.web_events||[],transitions=data.tv_transitions||[],tvMedia=data.tv_media||[],installations=data.tv_installations||[],
  bookings=data.bookings||[],participation=data.participation||[],items=data.popular_items||[];
 const views=eventTotal(events,'hub_view'),menu=eventTotal(events,'menu_open');
 const qr=events.filter(e=>e.event_name==='hub_view'&&['print_qr','tv_qr'].includes(e.source));
 const tvStarted=sum(tvMedia.filter(e=>e.event_name==='started'));
 const tvFinished=sum(tvMedia.filter(e=>e.event_name==='completed'));
 const tvMinutes=Math.round(sum(tvMedia.filter(e=>e.event_name==='completed'),'seconds')/60);
 const confirmed=sum(bookings.filter(e=>e.status==='confirmed'));
 const pending=sum(bookings.filter(e=>e.status==='pending'));
 const tvRegistered=sum(installations,'installations');
 const accountList=state.accessRequests||[];
 const metrics='<section class="analytics-kpis">'+
  card('Deschideri pagini',views,'Doar sesiuni cu accept pentru statistici')+
  card('Vizite atribuite QR',sum(qr,'events'),'Linkuri cu etichetă TV sau print')+
  card('Deschideri meniu',menu,'Secțiunea de meniu afișată / accesată')+
  card('Instalări PWA semnalate',eventTotal(events,'pwa_install'),'Browsere compatibile; nu toate instalările iOS')+
  card('Rezervări confirmate',confirmed,'Din baza de rezervări; rezultat verificat')+
  card('Porniri media TV',tvStarted,'Evenimente de pornire raportate de player')+
  card('Materiale finalizate',tvFinished,'Finalizări raportate de player')+
  card('Minute TV raportate',tvMinutes,'Aproximare din timpul activ al playerului')+
  card('Tranziții istorice TV',sum(transitions),'Schimbări detectate; nu este audiență')+
  card('Player-e înregistrate',tvRegistered,'Include browsere, APK și TV; nu doar instalări')+
  card('Autentificări personal',data.staff_logins||0,'Numărate de la activarea modulului')+
  card('Cereri de cont',data.account_requests_new||0,'Solicitări create în intervalul selectat')+
 '</section>';
 const sourceRows=[['QR televizoare',eventTotal(events,'hub_view','tv_qr')],
   ['QR printat',eventTotal(events,'hub_view','print_qr')],
   ['Acces direct / vechi QR',eventTotal(events,'hub_view','direct')],
   ['Link distribuit',eventTotal(events,'hub_view','shared')]];
 const interactions=[['Vizualizări produse din meniu',eventTotal(events,'menu_item_view')],
  ['Căutări în meniu',eventTotal(events,'menu_search')],
  ['Deschideri rezervări',eventTotal(events,'booking_open')],
  ['Cererile trimise din pagină',eventTotal(events,'booking_sent')],
  ['Bilete / linkuri externe',eventTotal(events,'tickets_click')+eventTotal(events,'external_booking_click')],
  ['Rețele sociale',eventTotal(events,'social_click')],
  ['Vizite pagini quiz',eventTotal(events,'quiz_view')],
  ['Lansări din PWA instalată',eventTotal(events,'pwa_standalone')]];
 const rank=arr=>arr.map(([label,value])=>'<div class="analytics-rank"><span>'+safe(label)+'</span><strong>'+int(value)+'</strong></div>').join('');
 const tvRank=transitions.slice(0,8).map(x=>[x.title,x.count]);
 const tvStartedRank=tvMedia.filter(x=>x.event_name==='started').slice(0,8).map(x=>[x.title,x.count]);
 const itemRank=items.slice(0,8).map(x=>[x.title,x.opens]);
 const participationRows=participation.map(x=>[x.activity,x.count]);
 const installRows=installations.map(x=>[x.platform+' · '+x.client_type,x.installations]);
 return top+tools+metrics+
 '<div class="analytics-columns"><section class="panel"><div class="panel-head"><h2>Evoluția vizitelor</h2><span>Pe zi · ora București</span></div>'+
 '<div class="analytics-legend"><span>● Pagini</span><span>● Meniu</span><span>● Cereri</span></div>'+dailyChart(events)+'</section>'+
 '<section class="panel"><div class="panel-head"><h2>De unde vin vizitele</h2><span>Accesări cu acord</span></div>'+
 rank(sourceRows)+'<p class="hub-note">Un QR scanat nu poate fi confirmat tehnic doar din deschiderea paginii. Sunt numărate accesările etichetate; QR-urile vechi apar ca acces direct.</p></section></div>'+
 '<div class="analytics-columns"><section class="panel"><h2>Ce fac vizitatorii</h2>'+rank(interactions)+'</section>'+
 '<section class="panel"><h2>Rezervări & participare</h2>'+
 rank([['Cereri în așteptare',pending],['Rezervări confirmate',confirmed],
  ['Rezervări anulate',sum(bookings.filter(e=>e.status==='cancelled'))],...participationRows])+
 '<p class="hub-note">Voturile, răspunsurile la quiz și înscrierile la karaoke sunt preluate din înregistrările confirmate în baza de date.</p></section></div>'+
 '<div class="analytics-columns"><section class="panel"><h2>Porniri de materiale raportate · TV</h2>'+ 
 (tvStartedRank.length?rank(tvStartedRank):'<p class="hub-note">Noile evenimente vor apărea după ce player-ele TV încep să trimită date.</p>')+
 '<h3 class="analytics-subhead">Tranziții TV din istoricul existent</h3>'+ 
 (tvRank.length?rank(tvRank):'<p class="hub-note">Încă nu există tranziții TV în acest interval.</p>')+
 '<p class="hub-note">O tranziție detectată nu garantează că cineva a privit ecranul și nu reprezintă durata reală de vizionare.</p></section>'+
 '<section class="panel"><h2>Produse din meniu & aplicații</h2>'+
 (itemRank.length?rank(itemRank):'<p class="hub-note">Nu avem încă vizualizări de produse cu acord.</p>')+
 '<h3 class="analytics-subhead">Player-e conectate</h3>'+rank(installRows)+
 '<p class="hub-note">Instanțe noi în interval: '+int(sum(installations,'new_installations'))+'. Aceste înregistrări nu dovedesc instalarea aplicației.</p></section></div>'+
 '<section class="panel analytics-accounts"><div class="panel-head"><h2>Cereri noi de cont</h2><span>'+int(data.pending_accounts)+' în așteptare</span></div>'+
 '<p class="hub-note"><strong>Atenție:</strong> aprobarea acordă acces complet de administrator la toate locațiile și la informațiile private. Aprobă doar persoane de încredere.</p>'+
 (data.latest_staff_logins?.length?'<h3 class="analytics-subhead">Ultimele autentificări reușite</h3>'+data.latest_staff_logins.slice(0,10).map(e=>'<div class="analytics-rank"><span>'+safe(e.email||'Administrator')+'</span><strong>'+safe(new Date(e.occurred_at).toLocaleString('ro-RO'))+'</strong></div>').join(''):'')+
 (accountList.length?accountList.map(u=>'<div class="analytics-access-row"><div><strong>'+safe(u.email||'Cont nou')+'</strong><small>Solicitat: '+safe(new Date(u.requested_at).toLocaleString('ro-RO'))+'</small></div>'+
 '<button type="button" class="btn primary small" data-action="analytics-approve-access" data-id="'+safe(u.user_id)+'">Aprobă administrator</button></div>').join(''):
 '<p class="hub-note">Nu există solicitări de acces în așteptare.</p>')+'</section>'+
 '<p class="analytics-footnote">Statisticile web pornesc doar după consimțământ, pot fi incomplete și nu identifică persoane. '+
 'Înregistrările existente anterior activării nu sunt reconstruite. Raport generat la '+safe(new Date(data.generated_at).toLocaleString('ro-RO'))+'.</p>';
}

function escapeCsv(value){
 let s=String(value??'');
 if(/^[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
export function exportAnalyticsCsv(data){
 const rows=[['categorie','zi','locatie','indicator','sursa','valoare']];
 for(const x of data.web_events||[])rows.push(['web',x.report_date,x.location_id,x.event_name,x.source,x.events]);
 for(const x of data.tv_transitions||[])rows.push(['tv','',x.location_id,x.title,'schimbari_material',x.count]);
 for(const x of data.bookings||[])rows.push(['rezervari','',x.location_id,x.status,'baza_de_date',x.count]);
 for(const x of data.participation||[])rows.push(['participare','',x.location_id,x.activity,'baza_de_date',x.count]);
 const csv='\ufeff'+rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='screenflow-statistici-'+new Date().toISOString().slice(0,10)+'.csv';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
