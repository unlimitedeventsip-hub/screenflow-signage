// Screenflow public votes and karaoke. No admin credentials required;
// responses are deliberately limited to a single public event.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {parseAIImport} from '../../../src/ai-import.js';
const projectUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(projectUrl,serviceKey,{auth:{persistSession:false}});
const baseHeaders={
 'Access-Control-Allow-Origin':'https://screenflow-signagead.unlimited-events-ip.workers.dev',
 'Access-Control-Allow-Headers':'content-type,apikey,authorization,x-client-info',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hash(s:string){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');}
async function eventState(id:string){
 const {data,error}=await db.rpc('interactive_event_state',{p_event_id:id});
 if(error)throw Error('Event state unavailable');
 return data;
}
Deno.serve(async req=>{
 const requestOrigin=req.headers.get('origin')||'';
 const headers={...baseHeaders,'Access-Control-Allow-Origin':/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(requestOrigin)?requestOrigin:baseHeaders['Access-Control-Allow-Origin']};
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(req.method==='GET'){
   const id=new URL(req.url).searchParams.get('id')||'';
   if(!uuid.test(id))return json({error:'Invalid event'},400);
   const data=await eventState(id);
   return data?json(data):json({error:'Evenimentul nu este disponibil.'},404);
  }
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(Number(req.headers.get('content-length')||0)>100000)return json({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>100000)return json({error:'Date prea mari.'},413);
  const input=JSON.parse(raw);
  if(['import-quiz','quiz-control'].includes(input.action)){
   const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
   const {data:{user}}=await db.auth.getUser(token);
   if(!user)return json({error:'Autentificare necesară.'},401);
   const {data:admin}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(!admin)return json({error:'Acces interzis.'},403);
   if(input.action==='import-quiz'){
    const quiz=parseAIImport(JSON.stringify(input.quiz));
    const {data,error}=await db.rpc('create_quiz_game',{p_location_id:input.location_id,p_title:quiz.title,p_questions:quiz.questions,p_origin:'https://screenflow-signagead.unlimited-events-ip.workers.dev'});
    if(error)throw error;return json({ok:true,id:data});
   }
   const {data,error}=await db.rpc('quiz_control',{p_event_id:input.id,p_command:input.command,p_version:input.version});
   if(error)throw error;return data.error?json({error:data.error},data.status||400):json(data);
  }

  const id=String(input.id||''),action=String(input.action||''),
   participant=String(input.participant||'');
  if(!uuid.test(id)||!/^[a-f0-9]{40,80}$/i.test(participant))
   return json({error:'Date invalide.'},400);
  const state=await eventState(id);
  if(!state)return json({error:'Evenimentul nu mai este activ.'},404);
  const voterHash=await hash(id+':'+participant);
  if(['quiz-join','quiz-answer'].includes(action)&&state.kind==='quiz'&&state.stage){
   const name=String(input.name||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,35);
   if(action==='quiz-answer'&&(!Number.isInteger(input.question_index)||!Number.isInteger(input.choice)))return json({error:'Răspuns invalid.'},400);
   const {data,error}=await db.rpc('quiz_participate',{p_event_id:id,p_hash:voterHash,p_action:action==='quiz-join'?'join':'answer',p_name:name,p_index:input.question_index??0,p_choice:input.choice??0});
   if(error)throw error;if(data.error)return json({error:data.error},data.status||400);return json({ok:true,state:await eventState(id)});
  }
  if(action==='vote' && (state.kind==='vote'||state.kind==='quiz'&&!state.stage)){
   const choice=Number(input.choice);
   if(!Number.isInteger(choice)||choice<0||choice>=state.options.length)return json({error:'Răspuns invalid.'},400);
   const {error}=await db.from('interactive_votes').insert({event_id:id,voter_hash:voterHash,option_index:choice});
   if(error){
    if(error.code==='23505')return json({error:'Ai votat deja de pe acest dispozitiv.'},409);
    return json({error:'Votul nu a putut fi salvat.'},500);
   }
   return json({ok:true,state:await eventState(id)});
  }
  if(action==='karaoke'&&state.kind==='karaoke'){
   const name=String(input.name||'').trim().replace(/[\u0000-\u001f<>]/g,'').slice(0,35),
         song=String(input.song||'').trim().replace(/[\u0000-\u001f<>]/g,'').slice(0,100);
   if(name.length<2||song.length<2)return json({error:'Introdu numele și melodia.'},400);
   if(state.karaoke.length>=60)return json({error:'Lista este plină.'},409);
   const {error}=await db.from('karaoke_queue').insert({
      event_id:id,participant_hash:voterHash,display_name:name,song_title:song
   });
   if(error){
    if(error.code==='23505')return json({error:'Ești deja înscris de pe acest dispozitiv.'},409);
    return json({error:'Nu s-a putut salva înscrierea.'},500);
   }
   return json({ok:true,state:await eventState(id)});
  }
  return json({error:'Acțiune nepermisă.'},400);
 }catch(e){console.warn('Interactive event error',String(e).slice(0,140));return json({error:'Server temporar indisponibil.'},500);}
});
