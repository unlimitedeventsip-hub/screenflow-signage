const ID_KEY='screenflow:install:id', SECRET_KEY='screenflow:install:secret';
function randomHex(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
function uuid(){const s=randomHex(16).split('');s[12]='4';s[16]='89ab'[parseInt(s[16],16)%4];const t=s.join('');return t.slice(0,8)+'-'+t.slice(8,12)+'-'+t.slice(12,16)+'-'+t.slice(16,20)+'-'+t.slice(20);}
export function installation(create=false){
 let id=localStorage.getItem(ID_KEY),secret=localStorage.getItem(SECRET_KEY);
 if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !secret || !/^[0-9a-f]{64}$/.test(secret)){
  if(!create)return null;
  id=uuid();secret=randomHex(32);localStorage.setItem(ID_KEY,id);localStorage.setItem(SECRET_KEY,secret);
 }
 return {id,secret};
}
export function deviceInfo(){
 const ua=navigator.userAgent||'',m=/ScreenflowTV\/([\w.]+)/i.exec(ua);
 return {
  p_platform:/Android/i.test(ua)?'Android TV / TCL':/Tizen/i.test(ua)?'Samsung Tizen':/WebOS|Web0S/i.test(ua)?'LG webOS':'Smart TV / Browser',
  p_client_type:m?'Screenflow APK':'Browser / PWA',
  p_resolution:(screen.width||innerWidth)+'×'+(screen.height||innerHeight),
  p_app_version:m?m[1]:'web-2'
 };
}
export async function tvPing(supabase,extras={},create=false){
 const key=installation(create);if(!key)return null;
 const {data,error}=await supabase.rpc('tv_register',{
  p_installation_id:key.id,p_secret:key.secret,...deviceInfo(),
  p_current_asset_id:extras.asset||null,
  p_playback_state:extras.state||'waiting',
  p_error_message:extras.error||''
 });
 if(error)throw error;
 return data;
}
export function startConnect(supabase,root){
 document.body.classList.add('tv-body');
 document.title='Screenflow · Asociere TV';
 root.innerHTML=`<div class="tv-connect">
 <div class="connect-brand">screenflow<span>.</span></div>
 <div class="connect-label">DISPOZITIV NOU</div>
 <h1>Conectează televizorul</h1>
 <p>Televizorul este detectat automat. În panoul Screenflow, deschide secțiunea Televizoare, confirmă codul și alege playlistul.</p>
 <div class="connect-code" id="connect-code">••••••</div>
 <div class="connect-status" id="connect-status">Înregistrăm dispozitivul…</div>
 <small>Nu trebuie să introduci niciun link cu telecomanda.</small>
 </div>`;
 const code=document.getElementById('connect-code'),status=document.getElementById('connect-status');
 let running=false,done=false;
 async function refresh(){
  if(running||done)return;running=true;
  try{
   const response=await tvPing(supabase,{},true);
   if(response?.status==='approved' && /^[0-9a-f-]{36}$/i.test(response.screen_public_id||'')){
    done=true;status.textContent='Aprobat. Pornim reclamele…';
    location.replace('/play/'+response.screen_public_id);return;
   }
   if(response?.status==='pending'){
    code.textContent=response.pair_code||'••••••';
    status.textContent='Așteptăm aprobarea din panoul de administrare';
   }else status.textContent='Nu putem asocia încă TV-ul; reîncercăm.';
  }catch(e){status.textContent='Conexiune indisponibilă. Reîncercăm automat.';console.warn(e?.message);}
  finally{running=false;}
 }
 refresh();const interval=setInterval(()=>{if(done)clearInterval(interval);else refresh();},10000);
}
