// Screenflow Instagram sync using official Instagram Login and the Instagram Graph API.
// Required production secrets (Supabase Edge Functions Secrets):
// IG_APP_ID, IG_APP_SECRET, IG_TOKEN_KEY (32 bytes encoded as 64 hex),
// IG_CRON_SECRET (at least 24 random chars), optional IG_API_VERSION (e.g. v25.0).
// OAuth grant: instagram_business_basic. Never store tokens in the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const projectUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const appId=Deno.env.get('IG_APP_ID')||'';
const appSecret=Deno.env.get('IG_APP_SECRET')||'';
const keyHex=Deno.env.get('IG_TOKEN_KEY')||'';
const graphVersion=(Deno.env.get('IG_API_VERSION')||'v25.0').replace(/[^v0-9.]/g,'');
const adminOrigin='https://screenflow-signagead.unlimited-events-ip.workers.dev';
const functionUrl=projectUrl+'/functions/v1/screenflow-instagram';
const api=createClient(projectUrl,serviceKey,{auth:{persistSession:false}});
const cors={
  'Access-Control-Allow-Origin':adminOrigin,
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-screenflow-sync-secret',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
};
function respond(payload:unknown,status=200){return new Response(JSON.stringify(payload),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function html(ok:boolean){
 return new Response('<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Screenflow Instagram</title><body style="background:#121b27;color:white;font:17px Arial;display:grid;place-items:center;min-height:80vh;text-align:center"><main><h1>'+(ok?'Instagram conectat':'Conectarea nu a reușit')+'</h1><p>'+(ok?'Revino în Screenflow Admin. Importul va porni automat după configurarea programării.':'Verifică setările Meta și încearcă din nou din Admin.')+'</p><a style="color:#eac77f" href="'+adminOrigin+'/admin">Deschide Screenflow</a></main></body></html>',{status:ok?200:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
function secretsReady(){return Boolean(appId&&appSecret&&/^[a-f0-9]{64}$/i.test(keyHex));}
function randomHex(n:number){return Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');}
async function sha(s:string){const v=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(v),x=>x.toString(16).padStart(2,'0')).join('');}
let encryptionKey:CryptoKey|null=null;
async function cipherKey(){
 if(encryptionKey)return encryptionKey;
 if(!/^[a-f0-9]{64}$/i.test(keyHex))throw Error('Missing IG_TOKEN_KEY');
 const bytes=new Uint8Array((keyHex.match(/../g)||[]).map(x=>parseInt(x,16)));
 encryptionKey=await crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
 return encryptionKey;
}
function toBase64(bytes:Uint8Array){let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw);}
function fromBase64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function encrypt(token:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(),new TextEncoder().encode(token));
 return 'v1:'+toBase64(iv)+':'+toBase64(new Uint8Array(bytes));
}
async function decrypt(cipher:string){
 const fields=cipher.split(':');
 if(fields.length!==3||fields[0]!=='v1')throw Error('Unknown encryption format');
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(fields[1])},
   await cipherKey(),fromBase64(fields[2]));
 return new TextDecoder().decode(raw);
}
function errorMessage(e:unknown){return (e instanceof Error?e.message:String(e)).replace(/[A-Za-z0-9_-]{35,}/g,'[redacted]').slice(0,180);}
async function asAdmin(req:Request){
 const auth=req.headers.get('authorization')||'';
 const jwt=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!jwt)return null;
 const {data,error}=await api.auth.getUser(jwt);
 if(error||!data.user)return null;
 const {data:admin,error:adminError}=await api.from('admin_users')
 .select('user_id').eq('user_id',data.user.id).maybeSingle();
 return !adminError&&admin?data.user.id:null;
}
function formBody(params:Record<string,string>){return new URLSearchParams(params);}
async function instagramJson(url:URL,token?:string,method='GET',body?:URLSearchParams){
 if(token)url.searchParams.set('access_token',token);
 const options:RequestInit={method,signal:AbortSignal.timeout(20000)};
 if(body){options.body=body;options.headers={'Content-Type':'application/x-www-form-urlencoded'};}
 const response=await fetch(url,options);
 const json=await response.json().catch(()=>null);
 if(!response.ok||!json||json.error)throw Error('Instagram API: '+(json?.error?.message||json?.error_message||response.status));
 return json;
}
async function callback(req:Request){
 if(!secretsReady())return html(false);
 const url=new URL(req.url),code=url.searchParams.get('code')?.replace(/#_$/,'')||'';
 const state=url.searchParams.get('state')||'';
 if(!code||!state||state.length<40)return html(false);
 try{
  const digest=await sha(state);
  const {data:r}=await api.from('instagram_oauth_states')
   .select('state_hash,location_id,expires_at,consumed_at')
   .eq('state_hash',digest).maybeSingle();
  if(!r||r.consumed_at||new Date(r.expires_at).getTime()<Date.now())return html(false);
  const {data:consumed}=await api.from('instagram_oauth_states').update({consumed_at:new Date().toISOString()})
   .eq('state_hash',digest).is('consumed_at',null).select('state_hash').maybeSingle();
  if(!consumed)return html(false);
  const short=await instagramJson(new URL('https://api.instagram.com/oauth/access_token'),undefined,'POST',
    formBody({client_id:appId,client_secret:appSecret,grant_type:'authorization_code',redirect_uri:functionUrl,code}));
  if(!short.access_token)throw Error('Instagram did not return token');
  const exchangeUrl=new URL('https://graph.instagram.com/access_token');
  exchangeUrl.searchParams.set('grant_type','ig_exchange_token');
  exchangeUrl.searchParams.set('client_secret',appSecret);
  const long=await instagramJson(exchangeUrl,String(short.access_token));
  const longToken=String(long.access_token||short.access_token);
  const expires=Number(long.expires_in||5184000);
  const profileUrl=new URL('https://graph.instagram.com/'+graphVersion+'/me');
  profileUrl.searchParams.set('fields','user_id,username');
  const me=await instagramJson(profileUrl,longToken);
  const id=String(me.user_id||me.id||short.user_id||'');
  const username=String(me.username||'');
  if(!id||!username)throw Error('Instagram profile missing');
  const {error:saveError}=await api.from('instagram_connections').upsert({
   location_id:r.location_id,ig_user_id:id,username,token_ciphertext:await encrypt(longToken),
   token_expires_at:new Date(Date.now()+Math.max(3600,expires||5184000)*1000).toISOString(),
   last_error:null,enabled:true,auto_publish:true,updated_at:new Date().toISOString()
  },{onConflict:'location_id'});
  if(saveError)throw saveError;
  await api.from('locations').update({instagram_handle:username}).eq('id',r.location_id);
  // One initial import now; afterward cron can keep the feed current.
  try{await syncOne(r.location_id);}catch(e){
    await api.from('instagram_connections').update({last_error:errorMessage(e)}).eq('location_id',r.location_id);
  }
  return html(true);
 }catch(e){console.error('Instagram OAuth callback failed:',errorMessage(e));return html(false);}
}
function isSafeCdn(u:URL){
 const h=u.hostname.toLowerCase();
 return u.protocol==='https:' && (h==='cdninstagram.com'||h.endsWith('.cdninstagram.com')
   ||h==='fbcdn.net'||h.endsWith('.fbcdn.net'));
}
async function downloadMedia(source:string,maxBytes:number){
 const u=new URL(source);if(!isSafeCdn(u))throw Error('Unsupported Instagram CDN');
 // Disable redirects: never make arbitrary network requests from an imported media URL.
 const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(35000)});
 if(!response.ok||!response.body)throw Error('Instagram media download: HTTP '+response.status);
 if(!isSafeCdn(new URL(response.url)))throw Error('Unexpected media redirect');
 const expected=Number(response.headers.get('content-length')||0);
 if(expected>maxBytes)throw Error('Instagram media exceeds TV size limit');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];
 let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>maxBytes)throw Error('Instagram media too large');
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 if(!size)throw Error('Empty media');
 return new Blob(parts);
}
type MediaItem={
 id:string;caption?:string;media_type?:string;media_url?:string;thumbnail_url?:string;permalink?:string;
 timestamp?:string;children?:{data?:Array<{media_type?:string;media_url?:string;thumbnail_url?:string}>};
};
async function syncOne(locationId:string){
 const {data:c,error}=await api.from('instagram_connections').select('*')
   .eq('location_id',locationId).eq('enabled',true).maybeSingle();
 if(error||!c)return {status:'not-connected',count:0};
 let token=await decrypt(c.token_ciphertext);
 // Long-lived token refresh only when it is due; do not reveal token to client.
 const remaining=new Date(c.token_expires_at).getTime()-Date.now();
 if(remaining<12*24*3600*1000&&remaining>0){
  try{
   const renewed=await instagramJson(new URL('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token'),token);
   if(renewed.access_token&&renewed.expires_in){
    token=String(renewed.access_token);
    await api.from('instagram_connections').update({
     token_ciphertext:await encrypt(token),
     token_expires_at:new Date(Date.now()+Number(renewed.expires_in)*1000).toISOString(),
     updated_at:new Date().toISOString()
    }).eq('location_id',locationId);
   }
  }catch(e){console.warn('Instagram refresh issue:',errorMessage(e));}
 }
 if(new Date(c.token_expires_at).getTime()<Date.now())throw Error('Instagram token expired; reconnect account');
 const url=new URL('https://graph.instagram.com/'+graphVersion+'/me/media');
 url.searchParams.set('fields','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}');
 url.searchParams.set('limit','18');
 const page=await instagramJson(url,token);
 const posts:MediaItem[]=Array.isArray(page.data)?page.data:[];
 let imported=0,skipped=0;
 for(let i=0;i<posts.length&&imported<3;i++){
  const post=posts[i];if(!post.id||!post.permalink)continue;
  const {data:existing}=await api.from('instagram_media_imports').select('id')
   .eq('location_id',locationId).eq('instagram_media_id',post.id).maybeSingle();
  if(existing)continue;
  const children=post.children?.data||[];
  const chosen=post.media_type==='CAROUSEL_ALBUM'?(children.find(m=>m.media_type==='IMAGE')||children[0]):post;
  const kind=chosen.media_type==='VIDEO'||post.media_type==='VIDEO'?'video':'image';
  const source=kind==='video'?chosen.media_url:chosen.media_url;
  if(!source){skipped++;continue;}
  let assetId:string|undefined;
  try{
   const blob=await downloadMedia(source,kind==='video'?45*1024*1024:15*1024*1024);
   const mime=kind==='video'?'video/mp4':'image/jpeg';
   const path='instagram/'+locationId+'/'+post.id+'.'+(kind==='video'?'mp4':'jpg');
   const up=await api.storage.from('ads').upload(path,blob,{contentType:mime,cacheControl:'86400',upsert:false});
   if(up.error && !String(up.error.message).toLowerCase().includes('already exists'))throw up.error;
   const caption=String(post.caption||'Instagram @'+c.username).slice(0,140);
   const {data:asset,error:assetError}=await api.from('assets').upsert({
    title:caption||'Instagram',storage_path:path,kind,duration_seconds:kind==='video'?30:15,enabled:true
   },{onConflict:'storage_path'}).select('id').single();
   if(assetError||!asset)throw (assetError||Error('Asset not created'));
   assetId=asset.id;
   const {data:card,error:cardError}=await api.from('smart_items').insert({
     location_id:locationId,mode:'instagram',
     title:caption||'Instagram @'+c.username,
     subtitle:'@'+c.username,
     body:'',author_handle:c.username,post_url:post.permalink,
     asset_id:assetId,duration_seconds:kind==='video'?30:15,sort_order:i,
     enabled:c.auto_publish
   }).select('id').single();
   if(cardError||!card)throw (cardError||Error('Card insert failed'));
   const {error:importError}=await api.from('instagram_media_imports').insert({
     location_id:locationId,instagram_media_id:post.id,permalink:post.permalink,
     smart_item_id:card.id,asset_id:assetId,source_timestamp:post.timestamp||null
   });
   if(importError)throw importError;
   imported++;
  }catch(e){skipped++;console.warn('Instagram media skipped',post.id,errorMessage(e));}
 }
 await api.from('instagram_connections').update({
  last_synced_at:new Date().toISOString(),
  last_error:skipped?String(skipped)+' materiale omise (dimensiune/format/API)':'',
  updated_at:new Date().toISOString()
 }).eq('location_id',locationId);
 return {status:'ok',imported,skipped,available:posts.length};
}
async function settings(req:Request,body:Record<string,unknown>){
 const admin=await asAdmin(req);
 if(!admin)return respond({error:'Unauthorized'},401);
 const locationId=String(body.location_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(locationId))return respond({error:'Invalid location'},400);
 if(body.disconnect===true){
  const {error}=await api.from('instagram_connections').delete().eq('location_id',locationId);
  if(error)return respond({error:'Could not disconnect Instagram'},500);
  return respond({disconnected:true});
 }
 const changes:Record<string,boolean>={};
 if(typeof body.auto_publish==='boolean')changes.auto_publish=body.auto_publish;
 if(typeof body.enabled==='boolean')changes.enabled=body.enabled;
 if(!Object.keys(changes).length)return respond({error:'No changes'},400);
 const {data,error}=await api.from('instagram_connections').update({...changes,updated_at:new Date().toISOString()})
  .eq('location_id',locationId).select('location_id').maybeSingle();
 if(error||!data)return respond({error:'Connection not found'},404);
 return respond({saved:true});
}
async function start(req:Request,body:Record<string,unknown>){
 const admin=await asAdmin(req);if(!admin)return respond({error:'Unauthorized'},401);
 if(!secretsReady())return respond({error:'Meta not configured: IG_APP_ID, IG_APP_SECRET and IG_TOKEN_KEY are required in Supabase Secrets'},503);
 const locationId=String(body.location_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(locationId))return respond({error:'Invalid location'},400);
 const {data:loc}=await api.from('locations').select('id').eq('id',locationId).maybeSingle();
 if(!loc)return respond({error:'Unknown location'},404);
 const state=randomHex(32),hash=await sha(state);
 const {error}=await api.from('instagram_oauth_states').insert({
  state_hash:hash,location_id:locationId,admin_user_id:admin,
  expires_at:new Date(Date.now()+10*60000).toISOString()
 });
 if(error)return respond({error:'Could not start authorization'},500);
 const authorize=new URL('https://www.instagram.com/oauth/authorize');
 authorize.searchParams.set('client_id',appId);
 authorize.searchParams.set('redirect_uri',functionUrl);
 authorize.searchParams.set('scope','instagram_business_basic');
 authorize.searchParams.set('response_type','code');
 authorize.searchParams.set('state',state);
 return respond({authorize_url:authorize.href});
}
async function sync(req:Request,body:Record<string,unknown>){
 const manual=await asAdmin(req);
 const cronHeader=req.headers.get('x-screenflow-sync-secret')||'';
 let automated=false;
 if(cronHeader.length>=24){
   const verified=await api.rpc('screenflow_cron_auth',{p_secret:cronHeader});
   automated=verified.data===true && !verified.error;
 }
 if(!manual&&!automated)return respond({error:'Unauthorized'},401);
 if(!secretsReady())return respond({error:'Instagram integration not configured'},503);
 let ids:string[]=[];
 const locationId=String(body.location_id||'');
 if(locationId){ids=[locationId];}
 else {
  const {data,error}=await api.from('instagram_connections').select('location_id').eq('enabled',true);
  if(error)return respond({error:'Could not list connections'},500);
  ids=(data||[]).map(r=>r.location_id);
 }
 const results=[];
 for(const id of ids.slice(0,20)){
  try{results.push({location_id:id,...await syncOne(id)});}
  catch(e){
   const msg=errorMessage(e);
   await api.from('instagram_connections').update({last_error:msg}).eq('location_id',id);
   results.push({location_id:id,status:'error',error:msg});
  }
 }
 return respond({results,processed:results.length});
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors,status:204});
 try{
  const url=new URL(req.url);
  if(req.method==='GET'&&(url.searchParams.has('code')||url.searchParams.has('error')))return await callback(req);
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||'');
  if(action==='start')return await start(req,body);
  if(action==='sync')return await sync(req,body);
  if(action==='settings')return await settings(req,body);
  return respond({error:'Unknown action'},400);
 }catch(e){console.error('screenflow-instagram:',errorMessage(e));return respond({error:'Request failed'},500);}
});
