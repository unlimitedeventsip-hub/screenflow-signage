// AI output is data only: never evaluate HTML, JavaScript or arbitrary code.
const text=(v,max,field)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Verifică ${field} (maximum ${max} caractere).`);return v.trim();};
export function parseAIImport(raw,mode='quiz'){
 if(raw.length>100000)throw Error('Import prea mare. Maximum 100 KB.');
 let data;try{data=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw Error('Lipește doar codul JSON primit de la AI.');}
 if(!data||data.version!==1)throw Error('Format necunoscut. Folosește promptul Screenflow.');
 if(mode==='quiz'){
  if(data.type!=='quiz'||!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>40)throw Error('Quizul trebuie să aibă între 1 și 40 de întrebări.');
  return {version:1,type:'quiz',title:text(data.title,150,'titlul'),questions:data.questions.map((q,i)=>{
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length)throw Error(`Verifică variantele și răspunsul corect la întrebarea ${i+1}.`);
   const options=q.options.map(x=>text(x,100,'variantele'));
   if(new Set(options).size!==options.length)throw Error(`Variante duplicate la întrebarea ${i+1}.`);
   const seconds=q.seconds??25;if(!Number.isInteger(seconds)||seconds<10||seconds>120)throw Error('Timpul trebuie să fie între 10 și 120 de secunde.');
   return {text:text(q.text,240,'întrebarea'),options,correct:q.correct,seconds,explanation:typeof q.explanation==='string'?q.explanation.slice(0,600):''};
  })};
 }
 if(data.type!=='content'||!Array.isArray(data.items)||!data.items.length||data.items.length>100)throw Error('Importul trebuie să conțină între 1 și 100 de materiale.');
 return {version:1,type:'content',items:data.items.map(x=>({title:text(x.title,150,'titlul'),subtitle:String(x.subtitle||'').slice(0,150),body:String(x.body||'').slice(0,1200),category:String(x.category||'').slice(0,60),duration_seconds:Math.max(5,Math.min(300,Number(x.duration_seconds)||15))}))};
}
export function aiPrompt(topic,mode='quiz'){
 const subject=String(topic||'cultură generală').slice(0,400);
 return mode==='quiz'?`Creează un quiz în limba română pentru o seară la #altfel. Tema: ${subject}. 10 întrebări clare, distractive, cu dificultate progresivă, fapte verificabile și un singur răspuns corect. Nu inventa răspunsuri sau statistici. Returnează EXCLUSIV JSON valid, fără Markdown, HTML sau JavaScript, după acest format exact: {"version":1,"type":"quiz","title":"Titlu","questions":[{"text":"Întrebare?","options":["A","B","C","D"],"correct":0,"seconds":25,"explanation":"Explicație scurtă"}]}. correct este indexul răspunsului corect începând de la 0. Maximum 40 întrebări; text maximum 240 caractere, fiecare opțiune maximum 100 caractere. Evită ambiguitățile.`:
 `Pregătește conținut în română pentru #altfel, modul ${mode}. Cerință/date reale: ${subject}. Returnează EXCLUSIV JSON valid: {"version":1,"type":"content","items":[{"title":"Nume","subtitle":"Preț sau subtitlu","body":"Descriere","category":"Categorie","duration_seconds":15}]}. Nu inventa prețuri, ingrediente, alergeni, reduceri, date sau promisiuni; folosește numai informațiile furnizate, lasă câmpurile necunoscute goale. Maximum 100 intrări; title max 150 caractere, subtitle max 150, body max 1200. Fără HTML sau JavaScript.`;
}
export function renderAIImport(mode){return `<section class="panel ai-studio" data-ai-studio="${mode}"><div class="panel-head"><h2>${mode==='quiz'?'Quiz gata în trei pași':'Adaugă mai multe cu AI'}</h2><span>1 · TEMĂ → 2 · AI → 3 · IMPORT</span></div><p class="smart-hint">Scrii tema, copiezi promptul în AI, apoi lipești răspunsul aici. Verifici previzualizarea înainte de publicare.</p><label>Tema sau informațiile tale<textarea data-ai-topic rows="2" placeholder="Ex.: filme, muzică românească, cultura anilor 2000…"></textarea></label><button type="button" class="btn subtle" data-action="ai-prompt">Copiază promptul</button><label>Răspunsul primit de la AI<textarea data-ai-json rows="6" placeholder='{"version":1,…}'></textarea></label><div class="ai-actions"><button type="button" class="btn subtle" data-action="ai-preview">Verifică & previzualizează</button><button type="button" class="btn primary" data-action="ai-publish" disabled>Publică ${mode==='quiz'?'quizul':'materialele'}</button></div><div data-ai-preview aria-live="polite"></div></section>`;}
