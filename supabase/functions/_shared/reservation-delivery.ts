import webpush from 'npm:web-push@3.6.7';
import {escapeHTML as safe} from '../../../src/experience-utils.js';
export const appOrigin='https://screenflow-signagead.unlimited-events-ip.workers.dev';
export async function deliveryConfig(db:any){
 let {data,error}=await db.from('reservation_delivery_config').select('*').eq('id',true).maybeSingle();if(error)throw error;
 if(!data){const keys=webpush.generateVAPIDKeys();await db.from('reservation_delivery_config').upsert({id:true,public_key:keys.publicKey,private_key:keys.privateKey,worker_key:crypto.randomUUID()+crypto.randomUUID()},{onConflict:'id',ignoreDuplicates:true});({data,error}=await db.from('reservation_delivery_config').select('*').eq('id',true).single());if(error)throw error;}
 return data;
}
export async function dispatchNotifications(db:any){
 const config=await deliveryConfig(db),{data:jobs,error}=await db.rpc('claim_reservation_notifications');if(error)throw error;
 const emailReady=Boolean(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('RESERVATIONS_EMAIL_FROM'));
 for(const job of jobs||[]){
  try{
   const {data:r,error:rError}=await db.from('guest_reservations').select('*').eq('id',job.reservation_id).single();if(rError)throw rError;
   const {data:hub,error:hError}=await db.from('guest_hubs').select('title,slug').eq('id',job.hub_id).single();if(hError)throw hError;
   // A superseded decision must never send a misleading confirmation.
   if(job.kind!=='new'&&(r.status!==job.kind)){
    await db.from('reservation_notifications').update({status:'sent',error:'Decizie înlocuită; notificare omisă.',updated_at:new Date().toISOString()}).eq('id',job.id);continue;
   }
   const when=new Date(r.requested_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'});
   const bookingDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.requested_at));
   const title=job.kind==='new'?'Cerere nouă de rezervare':job.kind==='confirmed'?'Rezervarea ta a fost confirmată':'Cererea de rezervare a fost anulată';
   if(job.channel==='push'){
    const guest=job.kind!=='new';
    const query=guest?db.from('reservation_guest_push').select('id,subscription').eq('reservation_id',r.id):db.from('reservation_push').select('id,subscription,manager_id').eq('hub_id',job.hub_id);
    const {data:subscriptions,error:subError}=await query;if(subError)throw subError;
    const {data:managers}=await db.from('reservation_managers').select('id').eq('hub_id',job.hub_id).eq('enabled',true).gt('expires_at',new Date().toISOString());
    const active=new Set((managers||[]).map((m:any)=>m.id));
    let delivered=0;
    for(const sub of subscriptions||[]){
     if(!guest&&sub.manager_id&&!active.has(sub.manager_id))continue;
     try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:hub.title+' · '+title,body:`${r.guests} persoane · ${when}`,url:guest?'/g/'+hub.slug+'?reservation='+r.status_token:'/manage/'+hub.slug+'?day='+bookingDay,tag:'reservation-'+r.id}),{vapidDetails:{subject:appOrigin,publicKey:config.public_key,privateKey:config.private_key},TTL:3600,timeout:10000});delivered++;}
     catch(e){if([404,410].includes((e as any).statusCode))await db.from(guest?'reservation_guest_push':'reservation_push').delete().eq('id',sub.id);else throw e;}
    }
    if(!delivered)throw Error('Niciun telefon cu notificări active pentru acest destinatar.');
   }else{
    if(!emailReady){await db.from('reservation_notifications').update({status:'blocked',error:'Serviciul de email nu este configurat.',attempts:0,updated_at:new Date().toISOString()}).eq('id',job.id);continue;}
    if(job.kind==='new'){
     const {data:allowed}=await db.from('reservation_managers').select('id').eq('hub_id',job.hub_id).eq('email',job.recipient).eq('enabled',true).gt('expires_at',new Date().toISOString()).limit(1);
     if(!allowed?.length){await db.from('reservation_notifications').update({status:'sent',error:'Acces revocat; trimitere omisă.'}).eq('id',job.id);continue;}
    }
    const url=job.kind==='new'?appOrigin+'/manage/'+hub.slug+'?day='+bookingDay:appOrigin+'/g/'+hub.slug+'?reservation='+r.status_token;
    const html=`<div style="font-family:Arial;max-width:580px;margin:auto;color:#153e32"><h1>${safe(hub.title)}</h1><h2>${safe(title)}</h2><p>${safe(r.guest_name)} · ${r.guests} persoane</p><p>${safe(when)} · ora Bucureștiului</p>${job.kind==='new'?'<p>Cererea așteaptă confirmarea echipei.</p>':''}${job.kind!=='new'&&r.response_note?'<p>'+safe(r.response_note)+'</p>':''}<p><a href="${safe(url)}">${job.kind==='new'?'Deschide rezervările':'Vezi starea rezervării'}</a></p><small>Referință ${r.id.slice(0,8).toUpperCase()} · #altfel</small></div>`;
    const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:Deno.env.get('RESERVATIONS_EMAIL_FROM'),to:[job.recipient],subject:hub.title+' · '+title,html}),signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error('Furnizorul de email a răspuns '+res.status);
   }
   await db.from('reservation_notifications').update({status:'sent',error:'',updated_at:new Date().toISOString()}).eq('id',job.id);
  }catch(e){await db.from('reservation_notifications').update({status:'failed',error:String(e).slice(0,200),updated_at:new Date().toISOString()}).eq('id',job.id);}
 }
 return {processed:jobs?.length||0,email_ready:emailReady};
}
