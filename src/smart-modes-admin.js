import {renderAIImport} from './ai-import.js';
import { renderInteractiveAdmin } from './interactive-admin.js';
export const SMART_MODES = [
  ['ads','Reclame','Playlist obișnuit'],
  ['menu','Meniu digital','Cocktailuri, cafea, preparate'],
  ['happy_hour','Happy Hour','Oferte programate'],
  ['event','Party Mode','Petreceri și anunțuri'],
  ['vote','Voturi / Quiz','Întrebări și link QR pentru vot'],
  ['karaoke','Karaoke','Participanți și ecrane karaoke'],
  ['welcome','Aniversări','Felicitări și mesaje'],
  ['live','Sports / Live','Program și anunțuri transmisiuni'],
  ['instagram','Instagram Wall','Postări și Reels aprobate'],
  ['photo_wall','Photo Wall','Fotografii aprobate'],
  ['social_wall','Social Wall','Comunitate și hashtag-uri'],
  ['loyalty','QR Loyalty','Oferte și coduri QR'],
  ['information','Informativ','Program, rezervări, comunicări']
];

const MODE_GROUP = SMART_MODES.filter(x=>x[0]!=='ads');
const safe=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,selected)=>'<option value="'+safe(value)+'"'+(selected===value?' selected':'')+'>'+safe(label)+'</option>';

export function renderSmartModesAdmin({state,heading,pubUrl}) {
  const loc=state.locations.find(x=>x.id===state.smartLocation)||state.locations[0];
  if(!loc) return heading('SMART MODES','Experiențe pe televizoare','Adaugă întâi o locație.')+
    '<p class="tv-empty">Nu există locații configurate.</p>';
  const selectedMode=state.smartMode||'menu';
  const items=state.smartItems.filter(i=>i.location_id===loc.id&&i.mode===selectedMode)
    .sort((a,b)=>a.sort_order-b.sort_order||a.created_at.localeCompare(b.created_at));
  const assetOptions=state.assets.filter(a=>a.enabled).map(a=>
    option(a.id,(a.kind==='video'?'▶ ':'▧ ')+a.title,'')).join('');
  const rows=items.map(item=>{
    const asset=state.assets.find(a=>a.id===item.asset_id);
    return '<article class="smart-item"><div class="smart-thumb">'+
      (asset?.kind==='image'?'<img src="'+safe(pubUrl(asset.storage_path))+'" alt="">':
      asset?.kind==='video'?'▶':'✦')+
      '</div><div class="smart-item-info"><strong>'+safe(item.title)+'</strong><small>'+
      safe(item.subtitle||item.author_handle||'Fără subtitlu')+' · '+(asset?'Cu media locală':'Fără media')+
      ' · '+item.duration_seconds+' sec'+(item.post_url?' · Cu link':'')+
      '</small></div><span class="pill '+(item.enabled?'green':'gray')+'">'+(item.enabled?'Activ':'Inactiv')+'</span>'+
      '<button type="button" class="btn small subtle" data-action="smart-toggle" data-id="'+safe(item.id)+'">'+(item.enabled?'Ascunde':'Activează')+'</button>'+
      '<button type="button" class="btn small subtle" data-action="smart-edit" data-id="'+safe(item.id)+'">Editează</button>'+
      '<button type="button" class="icon-button danger" title="Șterge" data-action="smart-delete" data-id="'+safe(item.id)+'">✕</button></article>';
  }).join('');
  const instagram=state.instagramConnections?.find(x=>x.location_id===loc.id);
  const igPanel='<section class="panel instagram-connect-panel">'+
    '<div class="panel-head"><h2>Instagram · Sincronizare automată</h2>'+
    '<span>'+(instagram?(instagram.enabled?'CONT CONECTAT':'PAUZĂ'):'NECONECTAT')+'</span></div>'+
    '<p class="smart-hint">Conectează oficial contul Business/Creator pentru import automat al postărilor și Reel-urilor în Screenflow. Nu trebuie să mai încarci manual fișierele.</p>'+
    '<div class="instagram-connect-status">'+(instagram?
      '<strong>@'+safe(instagram.username)+'</strong>'+
      '<small>Importate: '+Number(instagram.imported_count||0)+
      ' · Ultima verificare: '+(instagram.last_synced_at?new Date(instagram.last_synced_at).toLocaleString('ro-RO'):'niciodată')+'</small>'+
      (instagram.last_error?'<small class="instagram-error">'+safe(instagram.last_error)+'</small>':'')+
      '<small>Import automat: '+(instagram.auto_publish?'Activ':'Doar pregătire, fără afișare')+'</small>':
      '<strong>Fără cont Instagram conectat</strong><small>Este necesară autorizarea titularului o singură dată, apoi tokenul se reînnoiește automat cât timp este valid.</small>')+
    '</div><div class="instagram-connect-actions">'+
      '<button type="button" class="btn primary small" data-action="instagram-connect" data-id="'+safe(loc.id)+'">'+(instagram?'Reconectează Instagram':'Conectează Instagram')+'</button>'+
      (instagram?'<button type="button" class="btn subtle small" data-action="instagram-sync" data-id="'+safe(loc.id)+'">Importă acum</button>'+
        '<button type="button" class="btn subtle small" data-action="instagram-autopublish" data-id="'+safe(loc.id)+'">'+(instagram.auto_publish?'Oprește publicarea automată':'Activează publicarea automată')+'</button>'+
        '<button type="button" class="btn subtle small" data-action="instagram-disconnect" data-id="'+safe(loc.id)+'">Deconectează</button>':'')+
      '</div></section>';
  const current=SMART_MODES.find(x=>x[0]===loc.display_mode)||SMART_MODES[0];
  return heading('SMART MODES','Experiențe pe TV',
    'Reclame, meniuri, petreceri, Instagram, karaoke și mesaje. Fiecare locație poate avea propriul mod de afișare.')+
    '<section class="panel smart-configuration">'+
      '<div class="panel-head"><h2>Alege locația și modul activ</h2><span>CONTROL LIVE</span></div>'+
      '<form class="smart-location-form" data-form="smart-location">'+
        '<label>Locație<select name="location_id" required>'+
        state.locations.map(l=>option(l.id,l.name,loc.id)).join('')+'</select></label>'+
        '<label>Mod activ pe televizoare<select name="display_mode">'+
        SMART_MODES.map(m=>option(m[0],m[1],loc.display_mode)).join('')+'</select></label>'+
        '<label>Instagram @utilizator<input name="instagram_handle" placeholder="@altfel" maxlength="60" value="'+safe(loc.instagram_handle||'')+'"></label>'+
        '<button class="btn primary" type="submit">Aplică modul</button>'+
      '</form><p class="smart-hint">Mod activ: <strong>'+safe(current[1])+
      '</strong>. Comenzile ajung pe TV-ul online la următoarea actualizare (circa 15 secunde). Dacă modul nu are materiale aprobate, rulează playlistul obișnuit.</p></section>'+
    (selectedMode==='instagram'?igPanel:'')+
    renderInteractiveAdmin(state,loc,selectedMode)+
    '<section class="panel smart-library"><div class="panel-head"><h2>Conținut pentru moduri</h2><span>POSTĂRI APROBATE</span></div>'+
      '<div class="smart-mode-grid">'+MODE_GROUP.map(m=>
        '<button type="button" data-action="smart-select" data-id="'+safe(m[0])+
        '" class="smart-mode-button '+(m[0]===selectedMode?'selected':'')+'"><strong>'+safe(m[1])+'</strong><small>'+safe(m[2])+'</small><span>'+state.smartItems.filter(x=>x.location_id===loc.id&&x.mode===m[0]&&x.enabled).length+' materiale</span></button>').join('')+'</div>'+
      '<div class="smart-current"><h3>'+safe((SMART_MODES.find(m=>m[0]===selectedMode)||['','Conținut'])[1])+
      '</h3><button type="button" class="btn primary small" data-action="smart-activate" data-id="'+safe(selectedMode)+'">Afișează acest mod pe TV</button><p>'+safe((SMART_MODES.find(m=>m[0]===selectedMode)||['','',''])[2])+'</p></div>'+
      (selectedMode==='instagram'?'<p class="smart-hint"><strong>Instagram:</strong> poți adăuga acum postări/Reels aprobate și materialele originale din bibliotecă pentru redare rapidă și offline. Sincronizarea AUTOMATĂ a contului Instagram necesită conectare oficială Meta OAuth; simplul link nu descarcă videoclipul.</p>':'')+
      (!['vote','karaoke'].includes(selectedMode)?'<form class="smart-item-form" data-form="smart-item">'+
        '<input type="hidden" name="location_id" value="'+safe(loc.id)+'">'+
        '<input type="hidden" name="mode" value="'+safe(selectedMode)+'">'+
        (selectedMode==='menu'?'<label>Categorie<input name="category" maxlength="60" placeholder="Cocktailuri / Cafea / Desert"></label>':'')+
        '<label>Titlu<input name="title" required maxlength="150" placeholder="Ex.: Nou pe Instagram / Gingerbread Martini"></label>'+
        '<label>Subtitlu / Preț / Anunț<input name="subtitle" maxlength="200" placeholder="Ex.: 27 lei · Disponibil azi"></label>'+
        (selectedMode==='menu'?'<label class="hub-checkbox"><input type="checkbox" name="guest_visible" checked> Publică și pe pagina QR a clienților</label>':'')+
        '<label>Text afișat<textarea name="body" maxlength="1200" rows="2" placeholder="Descriere, mesaj sau informații"></textarea></label>'+
        '<label>Media din bibliotecă<select name="asset_id">'+
          '<option value="">Fără imagine/video</option>'+assetOptions+'</select></label>'+
        '<label>Link public / Instagram Post / Reel<input name="post_url" type="url" maxlength="700" placeholder="https://www.instagram.com/reel/..."></label>'+
        '<label>Instagram / autor<input name="author_handle" maxlength="60" placeholder="@cont"></label>'+
        '<label>Durată (secunde)<input name="duration_seconds" type="number" min="3" max="3600" value="15" required></label>'+
        '<label>Poziția<input name="sort_order" type="number" min="0" max="99999" value="'+(items.length+1)+'" required></label>'+
        '<label>Începe la<input name="starts_at" type="datetime-local"></label>'+
        '<label>Se încheie la<input name="ends_at" type="datetime-local"></label>'+
        '<label>Oră zilnică de început<input name="daily_start" type="time" title="Pentru Happy Hour, meniuri și alte afișări recurente"></label>'+
        '<label>Oră zilnică de sfârșit<input name="daily_end" type="time" title="Permite și interval după miezul nopții"></label>'+
        '<div class="smart-weekdays"><strong>Zile de afișare (program recurent)</strong><div>'+
        [['1','Lun'],['2','Mar'],['3','Mie'],['4','Joi'],['5','Vin'],['6','Sâm'],['7','Dum']].map(d=>
          '<label><input type="checkbox" name="weekday" value="'+d[0]+'" checked>'+d[1]+'</label>').join('')+
        '</div></div>'+

        '<button class="btn primary" type="submit">Adaugă și aprobă pentru TV</button>'+
      '</form>':'')+
      '<div class="smart-items">'+(rows||'<p class="tv-empty">Niciun material încă. Adaugă primul conținut pentru acest mod.</p>')+'</div>'+
      '</section>'+
      (!['vote','karaoke','instagram','photo_wall','social_wall'].includes(selectedMode)?renderAIImport(selectedMode):'')+
      '<p class="smart-hint">După autorizarea contului Instagram Professional și configurarea Meta, postările se importă automat la fiecare 10 minute. Până atunci, poți adăuga manual conținut. Materialele pregătite pentru offline rămân disponibile fără internet.</p>';
}
