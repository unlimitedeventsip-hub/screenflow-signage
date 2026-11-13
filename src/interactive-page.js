import './interactive-page.css';

const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const endpoint=url=>url+'/functions/v1/screenflow-interactive';
function visitorId(){
 const key='screenflow:interactive:device';
 let token=localStorage.getItem(key);
 if(!token||!/^[0-9a-f]{64}$/i.test(token)){
  token=Array.from(crypto.getRandomValues(new Uint8Array(32)),
      b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem(key,token);
 }
 return token;
}
export async function renderInteractivePage({root,supabaseUrl,eventId}){
 document.title='Screenflow · Participă';
 document.body.classList.add('interactive-body');
 const endpointUrl=endpoint(supabaseUrl);
 root.innerHTML='<main class="join-page"><div class="join-shell"><div class="join-brand">screenflow<span>.</span></div><p class="join-info">Se deschide evenimentul...</p></div></main>';
 let state=null,submitted=false,quizName='',draftChoice=null;
 const joinedKey='screenflow:quiz:joined:'+eventId;
 const answerKey=()=> 'screenflow:quiz:answer:'+eventId+':'+state.question_index;
 const content=()=>root.querySelector('.join-shell');
 const error=(message)=>{const node=root.querySelector('.join-error');if(node)node.textContent=message;};
 function paint(){
  if(!state)return;
  if(state.kind==='quiz'&&state.stage){paintQuiz();return;}
  const tally=Array.isArray(state.results)?state.results:[];
  const sum=tally.reduce((n,x)=>n+Number(x.votes||0),0);
  const isKaraoke=state.kind==='karaoke';
  const options=Array.isArray(state.options)?state.options:[];
  const queue=Array.isArray(state.karaoke)?state.karaoke:[];
  content().innerHTML='<div class="join-brand">screenflow<span>.</span></div>'+
   '<p class="join-eyebrow">'+(isKaraoke?'KARAOKE · ÎNSCRIERE':'VOT LIVE')+'</p>'+
   '<h1>'+safe(state.title)+'</h1>'+
   '<p class="join-description">'+(isKaraoke?'Alege o melodie și intră în lista de karaoke.':'Alege o singură variantă. Rezultatele apar pe TV.')+'</p>'+
   (submitted?'<div class="join-success">✓ '+(isKaraoke?'Înscrierea a fost înregistrată.':'Votul tău a fost înregistrat.')+'</div>':
   isKaraoke?'<form class="join-form" data-join="karaoke">'+
     '<label>Nume<input name="name" maxlength="35" minlength="2" required placeholder="Cum te strigăm?"></label>'+
     '<label>Melodie<input name="song" maxlength="100" minlength="2" required placeholder="Artist – titlu"></label>'+
     '<button type="submit">Intră în lista de karaoke</button></form>':
   '<form class="join-form" data-join="vote">'+options.map((option,index)=>
     '<label class="join-option"><input type="radio" name="choice" value="'+index+'" required><span>'+safe(option)+'</span></label>').join('')+
     '<button type="submit">Trimite votul</button></form>')+
   '<div class="join-error" role="alert"></div>'+
   (isKaraoke?
      '<section class="join-results"><strong>Urmează pe scenă</strong>'+
      (queue.length?'<ol>'+queue.slice(0,20).map(q=>'<li>'+safe(q.name)+' — '+safe(q.song)+'</li>').join('')+'</ol>':
      '<p>Lista este goală. Fii primul!</p>')+'</section>':
      '<section class="join-results"><strong>Rezultate · '+sum+' voturi</strong>'+
      options.map((option,index)=>{
       const count=Number(tally.find(t=>Number(t.index)===index)?.votes||0);
       const pct=sum?Math.round(count/sum*100):0;
       return '<div class="join-result"><div><span>'+safe(option)+'</span><b>'+pct+'%</b></div>'+
         '<div class="join-bar"><i style="width:'+pct+'%"></i></div></div>';
      }).join('')+'</section>')+
   '<p class="join-footer">Un vot / o înscriere per dispozitiv. Nu introdu date sensibile.</p>';
 }
 function remaining(){return state?.deadline?Math.max(0,Math.ceil((Date.parse(state.deadline)-Date.now()-(state.clockOffset||0))/1000)):0;}
 function paintQuiz(){
  const joined=localStorage.getItem(joinedKey)==='1',answered=localStorage.getItem(answerKey())==='1',q=state.question;
  const board=(state.leaderboard||[]).map((p,i)=>'<li><span>'+String(i+1)+'. '+safe(p.name)+'</span><b>'+Number(p.points)+' p</b></li>').join('');
  content().innerHTML='<div class="join-brand">#altfel<span>.</span></div><p class="join-eyebrow">QUIZ LIVE · '+Number(state.players)+' PARTICIPANȚI</p><h1>'+safe(state.title)+'</h1>'+
   (!joined?'<form class="join-form" data-join="quiz-join"><label>Cum te strigăm?<input name="name" minlength="2" maxlength="35" value="'+safe(quizName)+'" required placeholder="Numele sau porecla ta"></label><button type="submit">Intră în quiz</button></form>':
   state.stage==='waiting'?'<div class="quiz-lobby"><strong>Ești în joc.</strong><p>Gazda va porni prima întrebare. Lasă pagina deschisă.</p></div>':
   state.stage==='finished'?'<div class="join-success">Quiz încheiat. Mulțumim că ai jucat!</div>':
   '<p class="join-description">Întrebarea '+(state.question_index+1)+' / '+state.total+(state.stage==='question'?' · <b data-quiz-countdown>'+remaining()+' sec</b>':' · Răspunsul corect')+'</p><h2>'+safe(q?.text)+'</h2>'+
   (state.stage==='question'?(answered?'<div class="join-success">Răspuns salvat. Așteptăm dezvăluirea.</div>':'<form class="join-form" data-join="quiz-answer">'+(q?.options||[]).map((v,i)=>'<label class="join-option"><input type="radio" name="choice" value="'+i+'" '+(draftChoice===i?'checked':'')+' required><span>'+safe(v)+'</span></label>').join('')+'<button type="submit" '+(remaining()<=0?'disabled':'')+'>'+(remaining()<=0?'Timpul s-a încheiat':'Trimite răspunsul')+'</button></form>'):
    '<div class="quiz-reveal">'+(q?.options||[]).map((v,i)=>'<p class="'+(i===Number(state.correct)?'correct':'')+'">'+(i===Number(state.correct)?'✓ ':'')+safe(v)+'</p>').join('')+'<p>'+safe(state.explanation)+'</p></div>'))+
   '<div class="join-error" role="alert"></div>'+
   (joined&&board?'<section class="join-results quiz-ranking"><strong>Clasament'+(state.stage==='question'?' · runde încheiate':'')+'</strong><ol>'+board+'</ol></section>':'')+
   '<p class="join-footer">Un răspuns per întrebare și dispozitiv. Corect + rapid = mai multe puncte.</p>';
 }
 root.addEventListener('input',e=>{if(e.target.name==='name'&&e.target.closest('[data-join="quiz-join"]'))quizName=e.target.value;});
 root.addEventListener('change',e=>{if(e.target.name==='choice')draftChoice=Number(e.target.value);});
 setInterval(()=>{if(state?.stage==='question'){const n=root.querySelector('[data-quiz-countdown]');if(n)n.textContent=remaining()+' sec';if(remaining()<=0){const b=root.querySelector('[data-join="quiz-answer"] button');if(b){b.disabled=true;b.textContent='Timpul s-a încheiat';}}}},1000);
 async function refresh(){
  try{
   const res=await fetch(endpointUrl+'?id='+encodeURIComponent(eventId),{cache:'no-store'});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Eveniment indisponibil');
   const old=state?.question_index;data.clockOffset=data.server_time?Date.parse(data.server_time)-Date.now():0;state=data;if(old!==state.question_index)draftChoice=null;paint();
  }catch(e){content().innerHTML='<h1>Eveniment indisponibil</h1><p>'+safe(e.message||'Încearcă din nou')+'</p>';}
 }
 root.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-join]');
  if(!form)return;
  event.preventDefault();
  if(!state)return;
  if(form.dataset.join.startsWith('quiz-')){
    const kind=form.dataset.join,values=new FormData(form),button=form.querySelector('button');button.disabled=true;
    try{const response=await fetch(endpointUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:eventId,action:kind,participant:visitorId(),name:String(values.get('name')||''),question_index:state.question_index,choice:Number(values.get('choice'))})});const result=await response.json();if(!response.ok)throw Error(result.error);if(kind==='quiz-join')localStorage.setItem(joinedKey,'1');else localStorage.setItem(answerKey(),'1');await refresh();}catch(e){button.disabled=false;error(e.message);}return;
  }
  if(submitted)return;
  const data=new FormData(form);
  const payload=form.dataset.join==='karaoke'
   ?{id:eventId,action:'karaoke',participant:visitorId(),
       name:String(data.get('name')||''),song:String(data.get('song')||'')}
   :{id:eventId,action:'vote',participant:visitorId(),choice:Number(data.get('choice'))};
  const button=form.querySelector('button[type=submit]');
  button.disabled=true;
  try{
   const response=await fetch(endpointUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)});
   const result=await response.json();
   if(!response.ok){
    if(response.status===409)submitted=true;
    else throw Error(result.error||'Eroare la trimitere');
   }else submitted=true;
   if(result.state)state=result.state;
   paint();
  }catch(e){button.disabled=false;error(e.message||'Nu s-a putut trimite.');}
 });
 await refresh();
 // Keep public vote counts and karaoke status current while the page is open.
 setInterval(()=>{if(!document.hidden&&(submitted||state?.stage))refresh();},2500);
}
