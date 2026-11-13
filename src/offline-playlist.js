// Screenflow offline-first cache. Keeps last COMPLETE playlist, not a half-
// downloaded update. Persistent cache is subject to the TV WebView's disk quota.
const MEDIA_CACHE='screenflow-media-v24';
const MAX_BYTES=300*1024*1024;
const RETRY_MS=45000;
const MAX_AGE_MS=30*24*3600*1000;

export function createOfflinePlaylist({publicId,getUrl,onStatus=()=>{}}) {
  const key='screenflow:offline:'+publicId;
  let lastKey='',lastAttempt=0,pending=null;
  let status='Pregătire offline…';
  const setStatus=s=>{if(s!==status){status=s;onStatus(s);}};
  const supported=typeof caches!=='undefined'&&typeof fetch==='function'&&'serviceWorker' in navigator;
  const mediaPaths=manifest=>{
    const paths=[];
    for(const item of (Array.isArray(manifest?.items)?manifest.items:[])) {
      if(item?.storage_path)paths.push(item.storage_path);
      if(item?.blur_background_path)paths.push(item.blur_background_path);
    }
    if(manifest?.background_audio_enabled) {
      const audio=Array.isArray(manifest.background_track_parts)?manifest.background_track_parts:[];
      if(audio.length)paths.push(...audio);
      else if(manifest.background_track_path)paths.push(manifest.background_track_path);
    }
    return [...new Set(paths.filter(path=>typeof path==='string'))];
  };
  function saved() {
    try {
      const data=JSON.parse(localStorage.getItem(key)||'null');
      if(data?.manifest && Date.now()-data.savedAt<MAX_AGE_MS
         && Array.isArray(data.manifest.items))return data;
    }catch{}
    return null;
  }
  // Service worker caches HTML and versioned JS/CSS, so the player itself
  // can restart after a network outage, not only continue an open page.
  async function register(){
    if(!('serviceWorker' in navigator)) {
      setStatus('Offline: browserul nu acceptă service worker');
      return false;
    }
    try{
      await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      return true;
    }catch(e){
      setStatus('Offline: nu pot salva aplicația ('+String(e?.message||'eroare').slice(0,40)+')');
      return false;
    }
  }
  const swReady=register();
  let readyPaths=new Set();
  function validUrl(path){
    const url=getUrl(path),parsed=new URL(url);
    if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')
      ||!parsed.pathname.includes('/storage/v1/object/public/ads/')) {
      throw new Error('URL media neacceptat pentru stocare offline');
    }
    return url;
  }
  // Only media belonging to a fully-downloaded manifest can use local URLs.
  const previous=saved();
  if(previous)readyPaths=new Set(mediaPaths(previous.manifest).map(path=>{
    try{return validUrl(path);}catch{return '';}
  }).filter(Boolean));

  function mediaUrl(path) {
    const upstream=validUrl(path);
    if(supported&&navigator.serviceWorker.controller&&readyPaths.has(upstream)){
      return '/offline-media?src='+encodeURIComponent(upstream);
    }
    return upstream;
  }
  async function warm(manifest, serverOffset=0) {
    if(!supported) {setStatus('Offline indisponibil pe acest TV');return false;}
    const paths=mediaPaths(manifest),fingerprint=JSON.stringify(paths);
    if(pending)return pending;
    if(fingerprint===lastKey && Date.now()-lastAttempt<RETRY_MS)return false;
    lastKey=fingerprint;lastAttempt=Date.now();
    pending=(async()=>{
      const cache=await caches.open(MEDIA_CACHE);
      let total=0,count=0;
      const needed=new Set();
      try{
        for(const path of paths){
          const url=validUrl(path);
          needed.add(url);
          let hit=await cache.match(url);
          if(hit?.status===200){count++;setStatus('Salvare offline: '+count+'/'+paths.length);continue;}
          const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store'});
          if(!response.ok||response.status!==200||response.type==='opaque') {
            throw new Error('Nu pot descărca '+path.split('/').pop());
          }
          const expected=Number(response.headers.get('content-length')||0);
          if(expected>MAX_BYTES || total+expected>MAX_BYTES)throw new Error('Playlist prea mare pentru cache (300 MB)');
          await cache.put(url,response);
          hit=await cache.match(url);
          if(!hit || hit.status!==200)throw new Error('Fișierul nu a fost salvat');
          // WebView may report quota via cache.put; only count validated assets.
          total+=expected;
          count++;
          setStatus('Salvare offline: '+count+'/'+paths.length);
        }
        // Save the manifest last: a failed/incomplete update must never replace
        // the previous fully downloaded offline playlist.
        localStorage.setItem(key,JSON.stringify({
          manifest,savedAt:Date.now(),serverOffset:Number(serverOffset)||0,
          files:paths.length
        }));
        readyPaths=new Set(needed);
        // Remove obsolete assets only AFTER the complete new playlist is safe.
        for(const request of await cache.keys()) {
          if(!needed.has(request.url))await cache.delete(request);
        }
        const bytes=total?Math.round(total/1048576)+' MB':'fișiere verificate';
        setStatus('Offline pregătit: '+count+'/'+paths.length+' · '+bytes);
        return true;
      } catch(e){
        const previous=saved();
        setStatus('Offline incomplet: '+count+'/'+paths.length+
          (previous?' · versiunea anterioară păstrată':'')+
          ' ('+String(e?.message||'eroare').slice(0,45)+')');
        return false;
      }
    })();
    try{return await pending;}finally{pending=null;}
  }
  async function localBlob(path) {
    if(!supported)return null;
    try{
      const hit=await (await caches.open(MEDIA_CACHE)).match(validUrl(path));
      if(hit?.status===200){
        const blob=await hit.blob();
        if(blob.size)return URL.createObjectURL(blob);
      }
    }catch{}
    return null;
  }
  function currentStatus(){return status;}
  return {swReady,warm,saved,localBlob,mediaUrl,currentStatus};
}
