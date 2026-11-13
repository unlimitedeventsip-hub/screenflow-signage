import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {isScheduled,localReservationDate} from '../../../src/experience-utils.js';
import {dispatchNotifications,deliveryConfig} from '../_shared/reservation-delivery.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origin='https://screenflow-signagead.unlimited-events-ip.workers.dev';
const baseHeaders={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};

const clean=(value:unknown,max:number)=>String(value||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max);
async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
Deno.serve(async req=>{
 const requestOrigin=req.headers.get('origin')||'';
 const headers={...baseHeaders,'Access-Control-Allow-Origin':/^http:\/\/(localhost|127\.0\.0\.1):4173$/.test(requestOrigin)?requestOrigin:baseHeaders['Access-Control-Allow-Origin']};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  const url=new URL(req.url),slug=url.searchParams.get('slug')||'';
  if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug))return reply({error:'Link invalid.'},400);
  const {data:hub,error}=await db.from('guest_hubs').select('*').eq('slug',slug).eq('enabled',true).maybeSingle();
  if(error)throw error;
  if(!hub)return reply({error:'Pagina locației nu este disponibilă.'},404);
  if(req.method==='GET'){
   const token=url.searchParams.get('reservation');
   if(token){
    if(!/^[0-9a-f-]{36}$/i.test(token))return reply({error:'Referință invalidă.'},400);
    const {data:r,error:e}=await db.from('guest_reservations').select('id,status,requested_at,guests,response_note').eq('hub_id',hub.id).eq('status_token',token).maybeSingle();
    if(e)throw e;if(!r)return reply({error:'Rezervare inexistentă.'},404);
    const config=await deliveryConfig(db);
    return reply({push_key:config.public_key,reservation:{reference:r.id.slice(0,8).toUpperCase(),status:r.status,requested_at:r.requested_at,guests:r.guests,response_note:r.response_note}});
   }

   const [loc,menu,events]=await Promise.all([
    db.from('locations').select('name').eq('id',hub.location_id).single(),
    db.from('smart_items').select('id,title,subtitle,body,asset_id,category,starts_at,ends_at,weekdays,daily_start,daily_end,sort_order').eq('location_id',hub.location_id).eq('mode','menu').eq('enabled',true).eq('guest_visible',true).order('sort_order').limit(200),
    db.from('interactive_events').select('id,title,kind,starts_at,ends_at').eq('location_id',hub.location_id).eq('active',true).order('created_at',{ascending:false}).limit(30)
   ]);
   if(loc.error||menu.error||events.error)throw Error('Guest data unavailable');
   const visible=(menu.data||[]).filter(x=>isScheduled(x));
   const assetIds=visible.map(x=>x.asset_id).filter(Boolean);
   const assets=assetIds.length?await db.from('assets').select('id,storage_path,kind').in('id',assetIds).eq('enabled',true):{data:[],error:null};
   if(assets.error)throw assets.error;
   const items=visible.map(x=>({id:x.id,title:x.title,subtitle:x.subtitle,body:x.body,category:x.category,image:(assets.data||[]).find(a=>a.id===x.asset_id&&a.kind==='image')?.storage_path||''}));
   const {data:locations}=await db.from('guest_hubs').select('slug,title,booking_enabled').eq('enabled',true).order('title');
   const {location_id,id,created_at,...publicHub}=hub;
   return reply({hub:{...publicHub,name:hub.title||loc.data?.name},locations:locations||[],menu:items,events:(events.data||[]).filter(x=>isScheduled(x)).map(({id,title,kind})=>({id,title,kind}))});
  }
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);

  // Check the actual body size too; Content-Length is optional for chunked requests.
  const raw=await req.text();if(raw.length>4000)return reply({error:'Date prea mari.'},413);
  const input=JSON.parse(raw);
  if(input.action==='subscribe-status'){
   const token=String(input.token||'');if(!/^[a-f0-9-]{36}$/i.test(token))return reply({error:'Link invalid.'},400);
   const {data:r}=await db.from('guest_reservations').select('id,status').eq('hub_id',hub.id).eq('status_token',token).maybeSingle();if(!r)return reply({error:'Rezervare inexistentă.'},404);
   const sub=input.subscription;let pushUrl;try{pushUrl=new URL(sub?.endpoint);}catch{return reply({error:'Abonament invalid.'},400);}
   if(pushUrl.protocol!=='https:'||pushUrl.port||pushUrl.username||pushUrl.password||!(/(^|\.)(push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(pushUrl.hostname)||pushUrl.hostname==='fcm.googleapis.com')||typeof sub.keys?.p256dh!=='string'||typeof sub.keys?.auth!=='string'||JSON.stringify(sub).length>3500)return reply({error:'Serviciu de notificări incompatibil.'},400);
   const {count}=await db.from('reservation_guest_push').select('id',{head:true,count:'exact'}).eq('reservation_id',r.id);
   if((count||0)>=5)return reply({error:'Sunt deja prea multe telefoane asociate.'},429);
   const {error:e}=await db.from('reservation_guest_push').upsert({reservation_id:r.id,endpoint:sub.endpoint,subscription:sub},{onConflict:'reservation_id,endpoint'});if(e)throw e;
   await db.from('reservation_notifications').update({status:'pending',attempts:0,updated_at:new Date().toISOString()}).eq('reservation_id',r.id).eq('channel','push').eq('recipient','guest').in('status',['blocked','failed']);
   EdgeRuntime.waitUntil(dispatchNotifications(db));return reply({ok:true});
  }
  if(!hub.booking_enabled)return reply({error:'Rezervările online nu sunt active.'},409);
  const email=clean(input.email,254).toLowerCase(),name=clean(input.name,70),phone=clean(input.phone,25),note=clean(input.note,350),date=localReservationDate(String(input.date||'')),guests=Number(input.guests);
  if(input.website)return reply({error:'Cerere invalidă.'},400);
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(String(input.request_id||''))||name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+?[\d ()-]{7,25}$/.test(phone)||!date||!Number.isInteger(guests)||guests<1||guests>30||input.consent!==true)return reply({error:'Verifică numele, emailul, telefonul, data și numărul de persoane.'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('cf-connecting-ip')||'unknown';
  // Keyed hash: never persist a raw IP. Rate limit and idempotency are enforced
  // inside a single transaction with an advisory lock (migration function).
  const rateHash=await digest(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')+':'+ip+':'+phone+':'+hub.id);
  const {data:result,error:bookingError}=await db.rpc('create_guest_reservation',{p_hub_id:hub.id,p_request_id:String(input.request_id),p_rate_hash:rateHash,p_name:name,p_phone:phone,p_local_time:date,p_guests:guests,p_note:note,p_email:email});
  if(bookingError)throw bookingError;
  if(result?.error)return reply({error:result.error},result.status||400);
  EdgeRuntime.waitUntil(dispatchNotifications(db));
  return reply({ok:true,reference:result.reference,token:result.token,message:'Cererea a fost trimisă. Urmărește starea din linkul privat. Masa este rezervată numai după confirmarea echipei locației.'},201);
 }catch(e){console.warn('Guest request failed',String(e).slice(0,100));return reply({error:'Nu am putut procesa cererea. Încearcă din nou.'},500);}
});
