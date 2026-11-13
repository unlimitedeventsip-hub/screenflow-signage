import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':'https://screenflow-signagead.unlimited-events-ip.workers.dev','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  const id=new URL(req.url).searchParams.get('screen')||'';
  if(!uuid.test(id))return reply({error:'Invalid screen'},400);
  // The existing paired screen public_id is a bearer capability. Never accept
  // internal screen IDs supplied by a guest or reveal a list of screens.
  const {data:screen,error}=await db.from('screens').select('id,location_id').eq('public_id',id).maybeSingle();
  if(error)throw error;if(!screen)return reply({error:'Unknown screen'},404);
  const {data:session,error:sessionError}=await db.from('screen_mirror_sessions').select('id,offer,status,expires_at').eq('screen_id',screen.id).in('status',['waiting','connecting','playing']).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(sessionError)throw sessionError;
  if(req.method==='GET'){
   const {data:hub,error:hubError}=await db.from('guest_hubs').select('slug,title,qr_on_tv').eq('location_id',screen.location_id).eq('enabled',true).maybeSingle();
   if(hubError)throw hubError;
   let iceServers=[];
   try{iceServers=JSON.parse(Deno.env.get('SCREENFLOW_ICE_SERVERS')||'[{"urls":"stun:stun.l.google.com:19302"}]');}catch{}
   return reply({hub:hub?.qr_on_tv?hub:null,iceServers,session:session?{...session,iceServers}:null});
  }
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const raw=await req.text();if(raw.length>100000)return reply({error:'Too large'},413);
  const input=JSON.parse(raw);
  if(!session||session.id!==input.session_id)return reply({error:'Session expired'},409);
  const status=String(input.status||'');
  if(!['connecting','playing','failed','unsupported'].includes(status))return reply({error:'Invalid status'},400);
  const patch:Record<string,unknown>={status,receiver_seen_at:new Date().toISOString(),error_message:String(input.error||'').slice(0,250)};
  if(input.answer){
   if(input.answer.type!=='answer'||typeof input.answer.sdp!=='string'||input.answer.sdp.length>90000)return reply({error:'Invalid answer'},400);
   // Only allow one answer. Another receiver tab must never overwrite the SDP.
   const {error:updateError}=await db.from('screen_mirror_sessions').update({...patch,answer:input.answer}).eq('id',session.id).in('status',['waiting','connecting','playing']).is('answer',null);
   if(updateError)throw updateError;
  }else{
   const {error:updateError}=await db.from('screen_mirror_sessions').update(patch).eq('id',session.id).in('status',['waiting','connecting','playing']);if(updateError)throw updateError;
  }
  return reply({ok:true});
 }catch(e){console.warn('Display request failed',String(e).slice(0,100));return reply({error:'Display unavailable'},500);}
});
