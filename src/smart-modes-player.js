import QRCode from 'qrcode';
import './smart-modes-player.css';

const label={
  ads:'RECLAME',menu:'MENIU DIGITAL',happy_hour:'HAPPY HOUR',event:'PARTY MODE',
  vote:'VOTURI & QUIZ',karaoke:'KARAOKE',welcome:'WELCOME',live:'LIVE & SPORTS',
  instagram:'INSTAGRAM WALL',photo_wall:'PHOTO WALL',social_wall:'SOCIAL WALL',
  loyalty:'QR LOYALTY',information:'INFORMAȚII'
};
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const duration=v=>Math.max(3000,Math.min(3600000,(Number(v?.duration_seconds)||15)*1000));
function validLink(value,mode){
  try{
    const u=new URL(String(value||''));
    if(u.protocol!=='https:')return '';
    if(mode==='instagram' &&
      !/^(?:www\.)?instagram\.com$/i.test(u.hostname))return '';
    if(mode==='instagram' && !/^\/(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))return '';
    return u.href;
  }catch{return '';}
}

function localClock(){
 try{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',
    weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const value=type=>parts.find(p=>p.type===type)?.value||'';
  return {day:({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7})[value('weekday')]||1,
    time:value('hour')+':'+value('minute')};
 }catch{
  const d=new Date();
  return {day:d.getDay()||7,time:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
 }
}
function scheduled(item){
 const now=Date.now();
 const since=item.starts_at?Date.parse(item.starts_at):NaN;
 const until=item.ends_at?Date.parse(item.ends_at):NaN;
 if(Number.isFinite(since)&&now<since)return false;
 if(Number.isFinite(until)&&now>=until)return false;
 const {day,time}=localClock();
 const days=Array.isArray(item.weekdays)?item.weekdays.map(Number):[1,2,3,4,5,6,7];
 const start=String(item.daily_start||'').slice(0,5);
 const end=String(item.daily_end||'').slice(0,5);
 if(!start||!end||start===end)return days.includes(day);
 if(start<end)return days.includes(day)&&time>=start&&time<end;
 // Overnight campaigns inherit the previous day's start time after midnight.
 const yesterday=day===1?7:day-1;
 return (time>=start&&days.includes(day))||(time<end&&days.includes(yesterday));
}

export function createSmartModePlayer({stage,indicator,getUrl,audio}){
  let active=false, mode='', items=[], signature='', startAt=0, serverOffset=0,
    synchronized=false, timer=null, sequenceToken=0, currentIndex=-1;

  const stop=()=>{
    if(timer)clearTimeout(timer);
    timer=null;
    sequenceToken++;
    const video=stage.querySelector('video.smart-media-video');
    if(video)video.pause();
    if(active)audio.mediaChanged('none');
    active=false;mode='';items=[];signature='';currentIndex=-1;
  };

  function chooseIndex(){
    let total=items.reduce((sum,item)=>sum+duration(item),0);
    if(!total)return {index:0,offset:0,remaining:15000};
    let elapsed=((Date.now()+serverOffset-startAt)%total+total)%total;
    let index=0;
    while(index<items.length-1 && elapsed>=duration(items[index])){
      elapsed-=duration(items[index++]);
    }
    return {index,offset:elapsed,remaining:Math.max(250,duration(items[index])-elapsed)};
  }
  function buildCard(item,offset,remaining){
    const thisToken=++sequenceToken,postUrl=validLink(item.post_url,mode);
    const handle=String(item.author_handle||'').trim().replace(/^@/,'') ||
      String(item.instagram_handle||'').trim().replace(/^@/,'');
    const imageUrl=item.storage_path?getUrl(item.storage_path):'';
    const qrLink=postUrl || (mode==='instagram'&&handle
      ?'https://www.instagram.com/'+encodeURIComponent(handle)+'/':'');
    const textContent=item.body?'<p class="smart-slide-body">'+clean(item.body)+'</p>':'';
    const inter=item.interactive_state||null;
    const liveResults=inter && (mode==='vote'||mode==='karaoke')?(
      mode==='karaoke'
      ?'<div class="smart-live-board"><strong>URMEAZĂ LA MICROFON</strong>'+
        (Array.isArray(inter.karaoke)&&inter.karaoke.length
          ?inter.karaoke.slice(0,6).map((q,i)=>'<div class="smart-live-row"><span>'+String(i+1)+'. '+clean(q.name)+'</span><small>'+clean(q.song)+'</small></div>').join('')
          :'<div class="smart-live-row">Scanează pentru înscriere!</div>')+'</div>'
      :'<div class="smart-live-board"><strong>VOTURI LIVE</strong>'+
        (Array.isArray(inter.options)?inter.options.slice(0,8).map((opt,i)=>{
          const count=Number((inter.results||[]).find(r=>Number(r.index)===i)?.votes||0);
          const sum=(inter.results||[]).reduce((n,r)=>n+Number(r.votes||0),0);
          const pct=sum?Math.round(count/sum*100):0;
          return '<div class="smart-live-row"><span>'+clean(opt)+'</span><b>'+pct+'%</b><div class="smart-live-progress"><i style="width:'+pct+'%"></i></div></div>';
        }).join(''):'')+'</div>'
    ):'';
    const externalLabel=mode==='instagram'?'VEZI POSTAREA':mode==='vote'?'VOTEAZĂ AICI':
      mode==='loyalty'?'SCANEAZĂ OFERTA':'DESCHIDE LINKUL';
    const photo=imageUrl&&item.kind==='image'
      ?'<img class="smart-photo" src="'+clean(imageUrl)+'" alt="">':'';
    const movie=imageUrl&&item.kind==='video'
      ?'<video class="smart-media-video" playsinline preload="auto"></video>':'';
    stage.innerHTML='<section class="smart-stage smart-stage-'+clean(mode)+'">'+
      '<div class="smart-background"></div>'+
      '<div class="smart-media-panel">'+(photo||movie||'<div class="smart-art">screenflow<span>.</span></div>')+'</div>'+
      '<div class="smart-copy"><div class="smart-eyebrow">'+clean(label[mode]||'SCREENFLOW')+'</div>'+
      '<h1 class="smart-headline">'+clean(item.title)+'</h1>'+
      (item.subtitle?'<p class="smart-subtitle">'+clean(item.subtitle)+'</p>':'')+
      textContent+liveResults+
      (handle?'<div class="smart-handle">@'+clean(handle)+'</div>':'')+
      '<div class="smart-brand">screenflow<span>.</span></div></div>'+
      (qrLink?'<div class="smart-qr"><img alt="Cod QR" class="smart-qr-image"/><small>'+
      clean(externalLabel)+'</small></div>':'')+
      '</section>';
    audio.mediaChanged(item.kind==='video'?'video':'image');
    if(movie){
      const video=stage.querySelector('video.smart-media-video');
      video.src=imageUrl;
      video.onloadedmetadata=()=>{
        if(thisToken!==sequenceToken)return;
        try{
          const clock=chooseIndex();
          video.currentTime=Math.min((synchronized?clock.offset:offset)/1000,Math.max(0,video.duration-.1));
        }catch{}
      };
      video.onerror=()=>{if(thisToken===sequenceToken)indicator.textContent='Smart Mode: video indisponibil';};
      audio.prepareVideo(video).catch(()=>{
        if(thisToken===sequenceToken)indicator.textContent='Smart Mode: redarea video a fost blocată';
      });
    }
    if(qrLink){
      QRCode.toDataURL(qrLink,{margin:1,width:210,errorCorrectionLevel:'M',
        color:{dark:'#112332',light:'#ffffff'}}).then(dataUrl=>{
        const img=stage.querySelector('.smart-qr-image');
        if(thisToken===sequenceToken&&img)img.src=dataUrl;
      }).catch(()=>{});
    }
    timer=setTimeout(()=>showSlide(true),remaining);
  }
  function showSlide(force=false){
    if(!active||!items.length)return;
    const target=chooseIndex();
    if(!force && target.index===currentIndex)return;
    if(timer)clearTimeout(timer);
    currentIndex=target.index;
    buildCard(items[target.index],target.offset,target.remaining);
  }
  function show(data,offset=0){
    const chosen=String(data?.display_mode||'ads');
    const visible=(Array.isArray(data?.smart_items)?data.smart_items:[])
      .filter(x=>x.mode===chosen&&scheduled(x))
      .map(x=>({...x,instagram_handle:String(data.instagram_handle||'')}));
    if(chosen==='ads'||!visible.length){if(active)stop();return false;}
    const nextSig=JSON.stringify({mode:chosen,items:visible,
      synchronized:data.synchronized,anchor:data.sync_anchor});
    serverOffset=Number(offset)||0;
    if(!active||nextSig!==signature){
      stop();
      active=true;mode=chosen;items=visible;signature=nextSig;
      synchronized=Boolean(data.synchronized);
      const anchor=Date.parse(data.sync_anchor||'');
      startAt=synchronized&&Number.isFinite(anchor)?anchor:Date.now()+serverOffset;
      showSlide(true);
    }else if(synchronized){
      const target=chooseIndex();
      if(target.index!==currentIndex)showSlide(true);
      // No destructive reload of a video on every 15-second manifest poll.
    }
    return true;
  }
  return {show,stop,isActive:()=>active};
}
