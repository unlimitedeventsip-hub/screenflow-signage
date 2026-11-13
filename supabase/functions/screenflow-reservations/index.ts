import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {deliveryConfig,dispatchNotifications,appOrigin} from '../_shared/reservation-delivery.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const baseHeaders={'Access-Control-Allow-Origin':appOrigin,'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info,x-venue-key,x-worker-key','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
const clean=(v:unknown,n:number)=>String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const fail=(msg:string,status=400)=>{throw Object.assign(Error(msg),{status});};
async function checked(q:any){const {data,error}=await q;if(error)throw error;return data;}
Deno.serve(async req=>{
 const requestOrigin=req.headers.get('origin')||'';
 const headers={...baseHeaders,'Access-Control-Allow-Origin':/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(requestOrigin)?requestOrigin:baseHeaders['Access-Control-Allow-Origin']};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(req.method==='GET'){await deliveryConfig(db);return reply({ok:true});}
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const raw=await req.text();if(raw.length>12000)return reply({error:'Date prea mari.'},413);
  const input=JSON.parse(raw),action=input.action;
  if(action==='dispatch'){
   const key=req.headers.get('x-worker-key')||'',config=await deliveryConfig(db);
   if(key!==config.worker_key)return reply({error:'Unauthorized'},401);
   return reply(await dispatchNotifications(db));
  }
  const slug=String(input.slug||'');
  const hub=await checked(db.from('guest_hubs').select('*').eq('slug',slug).maybeSingle());if(!hub)return reply({error:'Locație indisponibilă.'},404);
  let admin=false,manager:any=null;
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(bearer){const {data}=await db.auth.getUser(bearer);if(data.user){const found=await checked(db.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle());admin=Boolean(found);}}
  if(!admin){const key=req.headers.get('x-venue-key')||'';if(key.length<40||key.length>100)return reply({error:'Deschide linkul privat primit de la administrator.'},401);manager=await checked(db.from('reservation_managers').select('id').eq('hub_id',hub.id).eq('secret_hash',await hash(key)).eq('enabled',true).gt('expires_at',new Date().toISOString()).maybeSingle());if(!manager)return reply({error:'Acces expirat sau revocat. Solicită un link nou.'},403);}
  if(action==='state'){
   const day=String(input.day||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return reply({error:'Alege ziua.'},400);
   // UTC-wide window followed by Bucharest-date filtering; correct across DST changes.
   const since=new Date(day+'T00:00:00Z');since.setUTCDate(since.getUTCDate()-1);const until=new Date(since);until.setUTCDate(until.getUTCDate()+3);
   const rows=await checked(db.from('guest_reservations').select('id,hub_id,guest_name,phone,email,requested_at,guests,note,status,attendance,table_id,response_note,version,duration_minutes,created_at').eq('hub_id',hub.id).gte('requested_at',since.toISOString()).lt('requested_at',until.toISOString()).order('requested_at').limit(1500));
   const localDay=(v:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
   const upcoming=await checked(db.from('guest_reservations').select('id,guest_name,requested_at,guests').eq('hub_id',hub.id).eq('status','pending').gte('requested_at',new Date().toISOString()).order('requested_at').limit(50));
   const config=await deliveryConfig(db);
   const tables=await checked(db.from('reservation_tables').select('*').eq('hub_id',hub.id).order('label'));
   const notifications=await checked(db.from('reservation_notifications').select('id,reservation_id,channel,status,error,kind,created_at').eq('hub_id',hub.id).order('created_at',{ascending:false}).limit(100));
   const managers=admin?await checked(db.from('reservation_managers').select('id,label,email,enabled,expires_at').eq('hub_id',hub.id).order('created_at')):[];
   return reply({hub,upcoming,bookings:rows.filter((r:any)=>localDay(r.requested_at)===day),tables,notifications,managers,is_admin:admin,push_key:config.public_key,email_ready:Boolean(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('RESERVATIONS_EMAIL_FROM'))});
  }
  if(action==='decision'){
   const result=await checked(db.rpc('decide_guest_reservation',{p_hub_id:hub.id,p_id:input.id,p_version:input.version,p_status:input.status,p_attendance:input.attendance||'unknown',p_table:input.table_id||null,p_note:clean(input.response_note,350)}));
   if(result.error)return reply({error:result.error},result.status||400);
   EdgeRuntime.waitUntil(dispatchNotifications(db));return reply(result);
  }
  if(action==='settings'){
   const patch:any={booking_enabled:input.booking_enabled===true};
   for(const [field,min,max] of [['max_daily_requests',1,500],['max_slot_reservations',1,200],['max_slot_guests',1,1000],['booking_duration_minutes',30,480]] as const){const value=Number(input[field]);if(!Number.isInteger(value)||value<min||value>max)fail('Verifică limitele rezervărilor.');patch[field]=value;}
   await checked(db.from('guest_hubs').update(patch).eq('id',hub.id));return reply({ok:true});
  }
  if(action==='table'){
   const seats=Number(input.seats),x=Number(input.x),y=Number(input.y),label=clean(input.label,30);if(!label||!Number.isInteger(seats)||seats<1||seats>50||![x,y].every(v=>Number.isInteger(v)&&v>=0&&v<=90))fail('Verifică numele, locurile și poziția mesei.');
   const row={hub_id:hub.id,label,seats,x,y,zone:clean(input.zone,40),enabled:input.enabled!==false};
   if(input.id)await checked(db.from('reservation_tables').update(row).eq('id',input.id).eq('hub_id',hub.id));else await checked(db.from('reservation_tables').insert(row));return reply({ok:true});
  }
  if(action==='subscribe'){
   const sub=input.subscription;let u;try{u=new URL(sub?.endpoint);}catch{fail('Abonament invalid.');}
   // Only browser push services; never make server requests to arbitrary submitted URLs.
   if(u.protocol!=='https:'||u.port||u.username||u.password||!(/(^|\.)(push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(u.hostname)||u.hostname==='fcm.googleapis.com')||typeof sub.keys?.p256dh!=='string'||typeof sub.keys?.auth!=='string'||JSON.stringify(sub).length>4000)fail('Serviciu de notificări incompatibil.');
   await checked(db.from('reservation_push').upsert({hub_id:hub.id,manager_id:manager?.id||null,endpoint:sub.endpoint,subscription:sub},{onConflict:'endpoint'}));return reply({ok:true});
  }
  if(action==='unsubscribe'){await checked(db.from('reservation_push').delete().eq('hub_id',hub.id).eq('endpoint',String(input.endpoint||'')));return reply({ok:true});}
  if(action==='manager-create'&&admin){
   const label=clean(input.label,70),email=clean(input.email,254).toLowerCase();if(label.length<2||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))fail('Completează numele responsabilului și un email valid.');
   const key=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
   await checked(db.from('reservation_managers').insert({hub_id:hub.id,label,email,secret_hash:await hash(key)}));return reply({ok:true,url:appOrigin+'/manage/'+hub.slug+'#key='+key});
  }
  if(action==='manager-revoke'&&admin){await checked(db.from('reservation_managers').update({enabled:false}).eq('id',input.id).eq('hub_id',hub.id));return reply({ok:true});}
  if(action==='retry-notifications'){
   await checked(db.from('reservation_notifications').update({status:'pending',attempts:0,updated_at:new Date().toISOString()}).eq('hub_id',hub.id).in('status',['failed','blocked']));EdgeRuntime.waitUntil(dispatchNotifications(db));return reply({ok:true});
  }
  return reply({error:'Acțiune nepermisă.'},403);
 }catch(e){console.warn('Reservations',String((e as any).message).slice(0,100));return reply({error:(e as any).status?(e as any).message:'Operațiunea nu a putut fi salvată. Verifică datele și reîncearcă.'},(e as any).status||500);}
});
