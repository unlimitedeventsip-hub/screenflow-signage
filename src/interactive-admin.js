import {renderAIImport} from './ai-import.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderInteractiveAdmin(state,location,mode){
  if(!['vote','karaoke'].includes(mode))return '';
  const events=(state.interactiveEvents||[]).filter(e=>e.location_id===location.id
    &&(mode==='karaoke'?e.kind==='karaoke':e.kind==='vote'||e.kind==='quiz'));
  return '<section class="panel interactive-admin">'+
    '<div class="panel-head"><h2>'+ (mode==='karaoke'?'Karaoke cu înscrieri':'Voturi și Quiz LIVE')+
    '</h2><span>INTERACTIV · QR</span></div>'+
    '<p class="smart-hint">Evenimentul creat apare pe TV prin QR. Clienții intră de pe telefon fără să instaleze nimic. Rezultatele și înscrierile se actualizează în Screenflow.</p>'+
    '<form data-form="interactive-new" class="smart-item-form">'+
    '<input type="hidden" name="location_id" value="'+esc(location.id)+'">'+
    '<label>Tip eveniment<select name="kind">'+(mode==='karaoke'?
        '<option value="karaoke">Karaoke</option>':
        '<option value="vote">Vot public</option>')+
    '</select></label>'+
    '<label>Întrebare sau titlu<input required maxlength="150" name="title" placeholder="'+
      (mode==='karaoke'?'Karaoke Night #altfel':'Cine câștigă diseară?')+'"></label>'+
    (mode==='vote'?'<label style="grid-column:1/-1">Variante de răspuns (una pe linie)<textarea name="options" required rows="5" placeholder="Varianta A&#10;Varianta B"></textarea></label>':'')+
    '<button class="btn primary" type="submit">Creează și afișează pe TV</button></form>'+
    (mode==='vote'?renderAIImport('quiz'):'')+
    '<div class="smart-items">'+(events.length?events.map(e=>{
      const game=(state.quizGames||[]).find(g=>g.event_id===e.id);
      const qs=(state.karaokeQueue||[]).filter(x=>x.event_id===e.id&&['waiting','called'].includes(x.status));
      return '<article class="interactive-admin-event"><div class="interactive-admin-event-head"><div><strong>'+esc(e.title)+'</strong>'+
        '<small>'+esc(e.kind.toUpperCase())+' · '+(e.active?'ACTIV':'OPRIT')+'</small></div>'+
        '<button type="button" class="btn small subtle" data-action="interactive-stop" data-id="'+esc(e.id)+'">'+
        (e.active?'Oprește evenimentul':'Reactivează')+'</button></div>'+
        '<a target="_blank" rel="noopener" href="/join/'+esc(e.id)+'">Deschide linkul QR pentru clienți</a>'+
        (game?'<div class="quiz-controls"><span>'+({waiting:'Participanții intră',question:'Întrebarea '+(game.question_index+1),reveal:'Răspunsul corect',finished:'Quiz încheiat'}[game.stage])+' · '+game.questions.length+' întrebări</span>'+[['start','Pornește prima întrebare','waiting'],['reveal','Arată răspunsul','question'],['next','Următoarea / clasament','reveal']].filter(x=>x[2]===game.stage).map(([cmd,label])=>'<button type="button" class="btn primary small" data-action="quiz-control" data-id="'+e.id+'" data-command="'+cmd+'">'+label+'</button>').join('')+'</div>':'')+
        (e.kind==='karaoke'?'<div class="interactive-karaoke-queue">'+(qs.length?
          qs.slice(0,20).map(q=>'<div class="interactive-karaoke-row"><div><strong>'+esc(q.display_name)+
             '</strong><small>'+esc(q.song_title)+(q.status==='called'?' · PE SCENĂ':'')+'</small></div>'+
             '<button type="button" class="btn small subtle" data-action="karaoke-call" data-id="'+esc(q.id)+'">Cheamă</button>'+
             '<button type="button" class="btn small subtle" data-action="karaoke-skip" data-id="'+esc(q.id)+'">Sari</button></div>').join(''):
             '<small>Nicio înscriere încă.</small>')+'</div>':'')+
      '</article>';
    }).join(''):'<p class="tv-empty">Niciun eveniment încă.</p>')+'</div></section>';
}
