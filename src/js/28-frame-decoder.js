/* ---------------- Frame decoder ----------------
   Reads an MP4/MOV clip's own frame index and decodes frames in order with the browser's video decoder (WebCodecs).
   Each shot plays its footage frame by frame from its in-point: no hidden players, no seeking, no waiting on a clock. */
const MP4BOX_URL="https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js";
/* Chrome slows timers in background tabs to once a second, then once a minute. The export never paces itself with timers:
   it waits on the decoder's and encoder's own events, and yields with message events, which aren't throttled. */
const _mc=new MessageChannel(), _mq=[]; _mc.port1.onmessage=()=>{ const r=_mq.shift(); if(r) r(); };
const yieldNow=()=>new Promise(r=>{ _mq.push(r); _mc.port2.postMessage(0); });
// in view: short timer naps (cheap, unthrottled while visible); in a background tab: message-event yields, which Chrome doesn't throttle
const nap=()=>document.hidden?yieldNow():new Promise(r=>setTimeout(r,2));
async function waitUntil(cond,maxMs){ const t0=performance.now(); while(!cond()){ if(performance.now()-t0>maxMs) return false; await nap(); } return true; }
/* A clip's frame index (where each frame sits in the file) is read once and kept: it's tiny. */
S.decIdx=new Map();
async function clipIndex(clip){
  if(S.decIdx.has(clip)) return S.decIdx.get(clip);
  await loadScript(MP4BOX_URL);
  const file=clip.file; let mp4=MP4Box.createFile(), info=null, err=null;
  mp4.onReady=i=>{ info=i; }; mp4.onError=x=>{ err=x; };
  let pos=0;
  while(!info && !err && pos<file.size){ const end=Math.min(file.size,pos+(2<<20)); const ab=await file.slice(pos,end).arrayBuffer(); ab.fileStart=pos;
    const next=mp4.appendBuffer(ab); pos=(typeof next==="number" && next>end)?next:end; }
  if(!info){ S.decIdx.set(clip,null); throw new Error("not an MP4/MOV file"); }
  const vt=info.videoTracks&&info.videoTracks[0]; if(!vt){ S.decIdx.set(clip,null); throw new Error("no video track"); }
  const trak=mp4.getTrackById(vt.id); let desc;
  for(const en of trak.mdia.minf.stbl.stsd.entries){ const box=en.avcC||en.hvcC||en.vpcC||en.av1C; if(box){ const st=new DataStream(undefined,0,DataStream.BIG_ENDIAN); box.write(st); desc=new Uint8Array(st.buffer.slice(8)); break; } }
  const config={codec:vt.codec.startsWith("vp08")?"vp8":vt.codec, codedWidth:vt.video.width, codedHeight:vt.video.height, ...(desc?{description:desc}:{})};
  const sup=await VideoDecoder.isConfigSupported(config).catch(()=>({supported:false}));
  let configSW=null; try{ const sw={...config,hardwareAcceleration:"prefer-software"}; if((await VideoDecoder.isConfigSupported(sw)).supported) configSW=sw; }catch(e){}
  const idx=sup.supported?{config, configSW, samples:trak.samples.map(x=>({off:x.offset,size:x.size,cts:x.cts/x.timescale,sync:!!x.is_sync})), fps:vt.nb_samples/Math.max(0.1,vt.duration/vt.timescale)||30}:null;
  mp4.onReady=null; mp4.onError=null; mp4=null; // let the parser and its buffers go straight away
  S.decIdx.set(clip,idx); if(!idx) throw new Error("this browser can’t decode "+vt.codec);
  return idx;
}
/* One decoder slot: a single VideoDecoder reused for every clip it shows (reset, never recreated), so memory stays flat. */
class DecodeSlot{
  constructor(){ this.dec=null; this.frames=[]; this.clip=null; this.idx=null; this.lastT=-1; this.cache=null; this.feed=0; this.eof=false; this.err=null; }
  ensure(){ if(!this.dec || this.dec.state==="closed"){ this.dec=new VideoDecoder({output:f=>{ this.lastOut=performance.now(); this.frames.push(f); if(this.frames.length>1) this.frames.sort((a,b)=>a.timestamp-b.timestamp);
      // hardware decoders have only a few frame buffers: release anything superseded the moment a newer frame arrives
      while(this.frames.length>1 && this.frames[1].timestamp<=this.wantUs){ this.frames.shift().close(); }
      if(this.wake) this.wake(); }, error:e=>{ this.err=e; if(this.wake) this.wake(); }}); } }
  dropFrames(){ for(const f of this.frames) f.close(); this.frames=[]; }
  async load(clip){ if(this.clip===clip) return; this.dropRev(); this.idx=await clipIndex(clip); this.clip=clip; this.cache=null; this.lastT=-1; this.dropFrames(); this.sw=false; }
  dropRev(){ if(this.rc){ this.rc.frames.forEach(e=>{ try{ e.bm.close(); }catch(x){} }); this.rc=null; } }
  async frameAtRev(t){
    const fd=1/this.idx.fps, half=fd/2, pick=()=>{ let b=null; for(const e of this.rc.frames){ if(e.t<=t+half) b=e; } return b?b.bm:(this.rc.frames[0]&&this.rc.frames[0].bm); };
    if(this.rc && t>=this.rc.lo-half && t<=this.rc.hi+half) return pick();
    this.dropRev(); const lo=Math.max(0,t-0.5), frames=[]; this.lastT=-1;
    for(let x=lo;x<=t+1e-6;x+=fd){ const f=await this.frameAt(x); if(!f) continue; const ts=f.timestamp/1e6; if(!frames.length||ts>frames[frames.length-1].t+1e-4) { const bm=await createImageBitmap(f); bm._t=ts; frames.push({t:ts,bm}); } }
    this.rc={lo,hi:t,frames}; return pick();
  }
  async bytes(s){
    if(!this.cache || s.off<this.cache.a || s.off+s.size>this.cache.b){ const a=s.off, b=Math.min(this.clip.file.size,Math.max(s.off+s.size,s.off+(2<<20))); this.cache={a,b,u8:new Uint8Array(await this.clip.file.slice(a,b).arrayBuffer())}; }
    return this.cache.u8.subarray(s.off-this.cache.a,s.off-this.cache.a+s.size);
  }
  seek(t){
    let k=0; const sm=this.idx.samples; for(let i=0;i<sm.length;i++){ if(sm[i].sync && sm[i].cts<=t+1e-3) k=i; }
    this.dropFrames(); this.ensure(); this.err=null;
    if(this.dec.state!=="unconfigured"){ try{ this.dec.reset(); }catch(e){} }
    if(S._exact&&S._exact.sw&&this.idx.configSW) this.sw=true;
    this.dec.configure(this.sw&&this.idx.configSW?this.idx.configSW:this.idx.config); this.feed=k; this.eof=false;
  }
  async frameAt(t){
    const half=0.5/this.idx.fps, us=x=>Math.round(x*1e6), sm=this.idx.samples;
    if(!this.dec || this.dec.state!=="configured" || this.err || t<this.lastT-1e-3 || t>this.lastT+2.5 || this.lastT<0) this.seek(t);
    this.lastT=t; this.wantUs=us(t+half); this.lastOut=performance.now();
    const waitOut=ms=>new Promise(r=>{ let done=false; const fin=()=>{ if(!done){ done=true; this.wake=null; r(); } }; this.wake=fin; waitUntil(()=>done||this.err,ms).then(fin); });
    while(!this.frames.some(f=>f.timestamp>us(t+half)) && !this.eof && !this.err){
      // watchdog: a decoder that has gone quiet for 4 s is reset; a second stall on the same clip hands it to the fallback player
      if(performance.now()-this.lastOut>4000){ this.stalls=(this.stalls||0)+1; S._exact.stalls=(S._exact.stalls||0)+1;
        if(S._exact.stalls>=3&&this.idx.configSW&&!S._exact.sw){ S._exact.sw=true; crumb("export: switching to software decoding"); } // the phone's hardware decoders are struggling: stop asking them
        const clip=this.clip, idx=this.idx; this.close(); this.clip=clip; this.idx=idx; this.sw=!!(S._exact.sw&&idx.configSW); // free the stuck decoder's buffers completely
        if(this.stalls>=2) throw new Error("decoder stalled"); this.seek(t); this.lastOut=performance.now(); continue; }
      if(this.dec.decodeQueueSize>4){ await waitOut(50); continue; } // don't overfill the decoder
      if(this.feed<sm.length){ const n=Math.min(sm.length,this.feed+2);
        for(;this.feed<n;this.feed++){ const s=sm[this.feed]; this.dec.decode(new EncodedVideoChunk({type:s.sync?"key":"delta",timestamp:us(s.cts),data:await this.bytes(s)})); }
        await waitOut(this.dec.decodeQueueSize>0?60:2); }
      else { const fl=await Promise.race([this.dec.flush().then(()=>1,()=>1), new Promise(r=>setTimeout(()=>r(0),4000))]); // a hung flush counts as a stall
        if(fl){ this.eof=true; } else { this.lastOut=0; } }
    }
    if(this.err){ if(!this.sw && this.idx.configSW){ this.sw=true; this.err=null; this.lastT=-1; return this.frameAt(t); } throw this.err; } // hardware refused: try the software decoder once
    let pick=null; for(const f of this.frames){ if(f.timestamp<=us(t+half)) pick=f; else break; }
    pick=pick||this.frames[0]||null;
    const keep=[]; for(const f of this.frames){ if(f===pick||(pick&&f.timestamp>pick.timestamp)) keep.push(f); else f.close(); } this.frames=keep;
    return pick;
  }
  close(){ this.dropRev(); this.dropFrames(); try{ this.dec&&this.dec.state!=="closed"&&this.dec.close(); }catch(e){} this.dec=null; this.cache=null; this.clip=null; }
}
/* fallback slot for files the decoder can't read: one reusable player, stepped to each frame */
class ElemSlot{
  constructor(){ this.v=null; this.clip=null; }
  async load(clip){ if(this.clip===clip) return;
    if(!this.v){ this.v=document.createElement("video"); this.v.muted=true; this.v.playsInline=true; this.v.preload="auto"; this.v.style.cssText="position:absolute;right:4px;bottom:4px;width:64px;height:36px;pointer-events:none;z-index:0"; $("stageBox").appendChild(this.v); }
    this.v.src=clip.url; this.clip=clip;
    try{ await waitEvent(this.v,"loadeddata",15000); }catch(e){ this.v.removeAttribute("src"); this.v.load(); this.clip=null; throw e; } }
  async frameAt(t){ const v=this.v; if(Math.abs(v.currentTime-t)>0.01) await seekTo(v,t+0.008,800); return v; }
  close(){ if(this.v){ this.v.pause(); this.v.removeAttribute("src"); this.v.load(); this.v.remove(); this.v=null; } this.clip=null; }
}
let _wake=null;
async function stayAwake(on){ try{ if(on && navigator.wakeLock && !_wake){ _wake=await navigator.wakeLock.request("screen"); _wake.addEventListener("release",()=>{ _wake=null; }); } else if(!on && _wake){ await _wake.release(); _wake=null; } }catch(e){} }
document.addEventListener("visibilitychange",()=>{ if(!document.hidden && S.running && S.running.record) stayAwake(true); }); // the lock drops when the tab is hidden; take it back
function exportLog(x){ try{ localStorage.setItem("beatsplicerExportLog",JSON.stringify({...x,at:Date.now(),song:S.audioName,clips:S.clips.length,mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null,ua:navigator.userAgent.slice(0,120)})); }catch(e){} }
function lastExportNotice(){ try{ const l=JSON.parse(localStorage.getItem("beatsplicerExportLog")||"null"); if(!l||l.stage==="done") return;
    const ago=Math.round((Date.now()-l.at)/60000);
    S.lastError=`Last export stopped during ${l.stage} at ${l.pct??"?"}% (${ago} min ago). Build ${BUILD}. Formats: ${(l.formats||[]).join(", ")}. Decoder stalls: ${l.stalls||0}, clips on fallback: ${l.fallback||0}, software decoding: ${l.sw?"yes":"no"}${l.safe?" (safe mode)":""}. Memory: ${l.mem??"?"} MB, peak ${l.peak??"?"} MB. Shot ${l.shot!=null?l.shot+1:"?"} of ${l.of??"?"}${l.clip?` (${l.clip}, ${l.res})`:""}. Tab hidden at last check: ${l.hidden?"yes":"no"}. Song: ${l.song}, ${l.clips} clips. Browser: ${l.ua}`;
    S._retrySafe=!l.safe;
    status(`Your last export didn’t finish: it stopped at ${l.pct??"?"}%${l.hidden?" while the tab was in the background":""}. ${l.safe?"It was already in safe mode, so":"Next time, Make video runs in safe mode (slower, easier on the phone). If it still stops,"} tap “Copy error details” and send them to me.`,true); $("errBtn").hidden=false; }catch(e){} }
async function runPassDecode(outs,win,plan,eng){
  await ensureFonts(); await stayAwake(true); exportLog({stage:"start",pct:0,formats:outs.map(o=>o.ep.id)});
  const [ws,we]=win, len=we-ws, F=readFx(); S.activePlan=plan;
  const state={record:true,stopped:false,stop:()=>{ state.stopped=true; }}; S.running=state; updateButtons();
  const elFor=[]; S.elFor=elFor; const stage=$("stage"), sg=stage.getContext("2d");
  const slots=[[new DecodeSlot(),new ElemSlot()],[new DecodeSlot(),new ElemSlot()]]; // two of each for the whole export: memory stays flat
  const segAt=t=>{ let i=plan.findIndex(s=>t>=s.start-1e-6 && t<s.end); return i<0?plan.length-1:i; };
  const srcT=(i,tk)=>{ const s=plan[i]; return Math.max(0,Math.min(S.clips[s.clip].dur-0.04,srcTimeAt(s,tk,F))); };
  const src=async(i)=>{ const clip=S.clips[plan[i].clip], [dec,el]=slots[i%2];
    if(typeof VideoDecoder!=="undefined" && S.decIdx.get(clip)!==null && !(S._noDecode&&S._noDecode.has(clip))){ try{ await dec.load(clip); return dec; }catch(e){ S._decodeFallback=S._decodeFallback||[]; S._decodeFallback.push(clip.name+": "+(e.message||e)); } }
    dec.close(); // phones have only a few hardware decoders: free this slot's before the backup player asks for one
    await el.load(clip); return el; };
  const badClips=new Set(), swapped=[];
  const swapClip=j=>{ const s=plan[j], bad=S.clips[s.clip]; badClips.add(s.clip);
    const pool=S.clips.map((c,k)=>k).filter(k=>{ const c=S.clips[k]; return c.samples&&!c.off&&!badClips.has(k)&&k!==s.clip&&(c.kind==="image"||c.dur>=0.5); });
    if(!pool.length) return false;
    const k=pool[(j*7)%pool.length], c=S.clips[k]; s.clip=k; s.src=c.kind==="image"?0:Math.min(Math.max(0,c.dur-(s.end-s.start)-0.1),s.src%Math.max(0.5,c.dur-0.5));
    if(!swapped.includes(bad.name)) swapped.push(bad.name); return true; };
  const steps=[...new Set(outs.flatMap(o=>{ const a=[]; for(let k=0;k<o.N;k++) a.push(+(ws+k/o.ep.fps).toFixed(6)); return a; }))].sort((x,y)=>x-y);
  const t0=performance.now(); S._exact={ticks:0,mode:"decode",sw:!!S._safeExport}; let memPeak=0; // safe mode: software decoding from the start
  try{
    for(let n=0;n<steps.length;n++){
      if(state.stopped) break;
      const tk=steps[n], i=segAt(tk), s=plan[i];
      const grab=async j=>{ for(let attempt=0;attempt<4;attempt++){
          try{ if(isImgSeg(j)) return null; const sl=await src(j); return plan[j]._rev&&sl.frameAtRev?await sl.frameAtRev(srcT(j,tk)):await sl.frameAt(srcT(j,tk)); }
          catch(e){ if(String(e&&e.message).includes("stalled") && !(S._noDecode&&S._noDecode.has(S.clips[plan[j].clip]))){ S._noDecode=S._noDecode||new Set(); S._noDecode.add(S.clips[plan[j].clip]); slots[j%2][0].close(); continue; }
            if(!swapClip(j)) throw e; } } // this clip won't play on this device: its shots switch to another clip and the export carries on
        return null; };
      if(!isImgSeg(i)){ const f=await grab(i); if(f) elFor[i]=f; }
      if(i>0 && s.tr && s.tr.dur>0 && tk<s.start+s.tr.dur && !isImgSeg(i-1)){ const f=await grab(i-1); if(f) elFor[i-1]=f; }
      const Fs=fxFor(F,s,i);
      for(const o of outs){ const bi=drawPicture(o,plan,i,tk,[],Fs); if(bi!==false) postFx(o,tk,win,Fs,bi,{}); }
      for(const o of outs){ while(o.k<o.N && ws+o.k/o.ep.fps<=tk+1e-6){ o.emit(); S._exact.ticks++; } }
      if(outs.some(o=>o.venc.encodeQueueSize>4)) await waitUntil(()=>state.stopped||outs.every(o=>o.venc.encodeQueueSize<=2),60000); // never let frames pile up
      if(n%6===0){ if(outs[0].canvas!==stage && !document.hidden) sg.drawImage(outs[0].canvas,0,0,stage.width,stage.height); $("prog").value=Math.min(1,(S.passBase+(tk-ws))/Math.max(0.01,S.passCount));
        const el=(performance.now()-t0)/1000, done=(tk-ws)/len; if(done>0.05) status(`Making the video: ${Math.round(done*100)}%, about ${Math.max(1,Math.round(el/done*(1-done)))} s left.`);
        if(n%30===0){ const mm=performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):0; if(mm>memPeak) memPeak=mm;
          exportLog({stage:"video",pct:Math.round(done*100),formats:outs.map(o=>o.ep.id),stalls:S._exact.stalls||0,fallback:(S._noDecode&&S._noDecode.size)||0,hidden:document.hidden,sw:!!S._exact.sw,safe:!!S._safeExport,peak:memPeak,shot:i,of:plan.length,clip:S.clips[s.clip]?S.clips[s.clip].name:"",res:S.clips[s.clip]?`${S.clips[s.clip].w}x${S.clips[s.clip].h}`:""}); }
        if(document.hidden) await yieldNow(); else await new Promise(r=>setTimeout(r,0)); }
    }
  } finally { slots.flat().forEach(s=>s.close()); S.elFor=null; }
  S._exact.speed=+(len/((performance.now()-t0)/1000)).toFixed(2); // how many seconds of video per second of work
  exportLog({stage:"finishing",pct:100,formats:outs.map(o=>o.ep.id)});
  if(swapped.length){ S._swapped=[...new Set([...(S._swapped||[]),...swapped])]; }
  const results=[];
  for(const o of outs){
    if(!state.stopped){ while(o.k<o.N) o.emit(); }
    try{ await o.venc.flush(); }catch(e){ o.verr=o.verr||e; } try{ o.venc.close(); }catch(e){}
    if(!state.stopped && !o.verr){ const ac=o.aq?o.aq.length:null; o.flushAudio(Infinity); o.mux.finalize(); results.push({ep:o.ep, win, plan, blob:o.sink.blob(eng.kind==="mp4"?"video/mp4":"video/webm"), ext:eng.ext, engine:"exact", audioChunks:ac}); }
    else if(o.verr) status("The encoder stopped unexpectedly. Choose Most compatible under Recording and make it again.",true);
    o.sink=null; o.mux=null; o.aq=null;
  }
  S.running=null; S.activePlan=null; updateButtons(); drawTimeline(); stayAwake(false);
  exportLog({stage:state.stopped?"stopped":"done",pct:100});
  return state.stopped?null:results;
}
const MUXERS={mp4:"https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js", webm:"https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js"};
function loadScript(src){ return new Promise((res,rej)=>{ if(document.querySelector(`script[src="${src}"]`)) return res(); const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("load")); document.head.appendChild(s); }); }
S.wc=null;
async function detectEngine(){
  if(typeof VideoEncoder==="undefined"||typeof AudioEncoder==="undefined"||typeof VideoFrame==="undefined"||typeof AudioData==="undefined") return null;
  const vs=async(c,w,h)=>{ try{ return (await VideoEncoder.isConfigSupported({codec:c,width:w,height:h,bitrate:12e6,framerate:30,...(c.startsWith("avc")?{avc:{format:"avc"}}:{})})).supported; }catch(e){ return false; } };
  const as=async c=>{ try{ return (await AudioEncoder.isConfigSupported({codec:c,sampleRate:48000,numberOfChannels:2,bitrate:256000})).supported; }catch(e){ return false; } };
  const out={};
  if(await as("mp4a.40.2")) for(const v of ["avc1.640028","avc1.4d0028","avc1.42e028"]) if(await vs(v,1080,1920) && await vs(v,1920,1080)){ out.mp4={kind:"mp4",v,a:"mp4a.40.2",ext:"mp4"}; break; }
  if(await as("opus")) for(const v of ["vp09.00.40.08","vp8"]) if(await vs(v,1080,1920) && await vs(v,1920,1080)){ out.webm={kind:"webm",v,a:"opus",ext:"webm"}; break; }
  return out;
}
function chooseEngine(){
  const pref=$("engine").value, W=S.wc||{}, recMp4=pickMime().includes("mp4");
  if(pref==="compat") return null;
  if(W.mp4) return W.mp4;
  if(pref==="exact") return W.webm||null;
  return recMp4 ? null : (W.webm||null);
}
function engineNote(){
  const W=S.wc||{}, e=chooseEngine();
  $("engineNote").textContent = e&&e.kind==="mp4" ? "Frame-accurate MP4: every cut lands exactly on its beat, starting on the first frame."
    : e ? "Frame-accurate WebM: exact timing. YouTube accepts WebM; convert to MP4 for Instagram and TikTok, or choose Most compatible."
    : W.webm ? "Standard MP4 recording, self-calibrating on this computer. Frame-accurate WebM is available if you prefer exact timing."
    : "Standard recording, self-calibrating on this computer. For frame-accurate MP4, use Chrome or Edge on Windows or Mac.";
}
S.clipAudio={};
async function clipAudio(ci){
  if(ci in S.clipAudio) return S.clipAudio[ci];
  const c=S.clips[ci]; S.clipAudio[ci]=null;
  if(c && c.kind!=="image" && c.file){
    if(c.file.size>250e6){ S.clipAudioSkipped=S.clipAudioSkipped||new Set(); S.clipAudioSkipped.add(c.name); return null; } // decoding a huge file whole could exhaust memory
    try{ const ac=new OfflineAudioContext(2,48000,48000); S.clipAudio[ci]=await ac.decodeAudioData(await c.file.arrayBuffer()); }catch(e){} }
  return S.clipAudio[ci];
}
async function renderSound(ep,win,plan,F){
  const sr=48000, len=win[1]-win[0], oac=new OfflineAudioContext(2,Math.ceil(len*sr),sr);
  const prev=S.activePlan; S.activePlan=plan;
  try{
    const src=oac.createBufferSource(); src.buffer=S.audioBuf;
    const chain=buildChain(oac,{win,t0:0,ep,plan,src}); src.connect(chain.entry); fadeEnvelope(chain.master.gain,0,len,ep);
    src.start(0,win[0],len);
    if($("clipSound").checked){
      const bus=oac.createGain(); bus.gain.value=+$("clipVol").value; bus.connect(chain.master);
      for(let i=0;i<plan.length;i++){ const s=plan[i], c=S.clips[s.clip]; if(!c||c.kind==="image"||c.mute) continue;
        const nx=plan[i+1], tail=nx&&nx.tr?nx.tr.dur:0, a=Math.max(s.start,win[0]), b=Math.min(s.end+tail,win[1]); if(b<=a) continue;
        const buf=await clipAudio(s.clip); if(!buf) continue;
        const rate=rateFor(s,F), n=oac.createBufferSource(); n.buffer=buf; n.playbackRate.value=rate; n.connect(bus);
        const off=s.src+(a-s.start)*rate; if(off<buf.duration) n.start(a-win[0],off,(b-a)*rate); }
    }
    const lg=oac.createGain(); lg.gain.value=loudnessGain(ep); const lim=limiter(oac); chain.master.connect(lg); lg.connect(lim); lim.connect(oac.destination);
    for(let k=1;k<10;k++){ const at=Math.round(len*k/10*128)/128; oac.suspend(at).then(()=>{ status(`Preparing the soundtrack: mixing ${k*10}%…`); oac.resume(); }).catch(()=>{}); } // show progress on long songs
    const out=await oac.startRendering();
    status("Preparing the soundtrack: setting loudness…");
    { const n=out.length, L0=out.getChannelData(0), R0=out.numberOfChannels>1?out.getChannelData(1):L0, mono=new Float32Array(n); for(let i=0;i<n;i++) mono[i]=(L0[i]+R0[i])*0.5;
      const meas=measureLufs(mono,out.sampleRate,2); if(isFinite(meas) && meas>-60){ const g=Math.pow(10,Math.max(-12,Math.min(12,ep.lufs-meas))/20); for(let c=0;c<out.numberOfChannels;c++){ const d=out.getChannelData(c); for(let i=0;i<d.length;i++) d[i]*=g; } }
      peakLimit(out,0.841); }
    let pk=0; for(let c=0;c<out.numberOfChannels;c++){ const d=out.getChannelData(c); for(let i=0;i<d.length;i++){ const v=d[i]<0?-d[i]:d[i]; if(v>pk) pk=v; } }
    /* -1.5 dBFS leaves room for the encoder's small overshoot */ const ceil=0.841; if(pk>ceil){ const g=ceil/pk; for(let c=0;c<out.numberOfChannels;c++){ const d=out.getChannelData(c); for(let i=0;i<d.length;i++) d[i]*=g; } }
    return out;
  } finally { S.activePlan=prev; }
}
/* look-ahead peak limiter: holds peaks under the ceiling while keeping the overall loudness */
function peakLimit(buf,ceil){
  const n=buf.length, ch=[...Array(buf.numberOfChannels)].map((_,c)=>buf.getChannelData(c)), sr=buf.sampleRate, look=Math.round(sr*0.0015), rel=Math.exp(-1/(sr*0.06));
  const need=new Float32Array(n); for(let i=0;i<n;i++){ let m=0; for(const d of ch){ const v=d[i]<0?-d[i]:d[i]; if(v>m) m=v; } need[i]=m>ceil?ceil/m:1; }
  const mn=new Float32Array(n), q=[]; // minimum over the look-ahead window (monotonic queue)
  for(let i=0;i<n+look;i++){ if(i<n){ while(q.length&&need[q[q.length-1]]>=need[i]) q.pop(); q.push(i); } const j=i-look; if(j>=0){ while(q.length&&q[0]<j) q.shift(); mn[j]=q.length?need[q[0]]:1; } }
  let env=1; for(let i=0;i<n;i++){ env=mn[i]<env?mn[i]:mn[i]+(env-mn[i])*rel; for(const d of ch) d[i]*=env; }
  for(const d of ch) for(let i=0;i<n;i++){ if(d[i]>ceil) d[i]=ceil; else if(d[i]<-ceil) d[i]=-ceil; } // safety for anything the envelope missed
}
async function encodeSound(buf,eng){
  const chunks=[]; let err=null;
  const enc=new AudioEncoder({output:(c,m)=>chunks.push([c,m]), error:e=>{ err=e; }});
  enc.configure({codec:eng.a,sampleRate:buf.sampleRate,numberOfChannels:2,bitrate:256000});
  const L=buf.getChannelData(0), R=buf.numberOfChannels>1?buf.getChannelData(1):L, step=4800;
  let lastPct=-1;
  for(let i=0;i<buf.length;i+=step){ const pct=Math.floor(i/buf.length*10)*10; if(pct!==lastPct){ lastPct=pct; status(`Preparing the soundtrack: encoding ${pct}%…`); await new Promise(r=>setTimeout(r,0)); }
    const n=Math.min(step,buf.length-i), data=new Float32Array(n*2); data.set(L.subarray(i,i+n),0); data.set(R.subarray(i,i+n),n);
    const ad=new AudioData({format:"f32-planar",sampleRate:buf.sampleRate,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(i/buf.sampleRate*1e6),data}); enc.encode(ad); ad.close();
    if(enc.encodeQueueSize>50) await waitUntil(()=>enc.encodeQueueSize<=10,30000); }
  await enc.flush(); enc.close(); if(err) throw err;
  return chunks;
}
/* Collects the file in 16 MB pieces held as Blobs (which the browser can keep on disk) and applies the few
   header patches the muxer makes at the end, so a long export never needs one huge block of memory. */
function streamSink(){
  const parts=[], patches=[]; let size=0, pend=[], pendBytes=0;
  const flush=()=>{ if(pend.length){ parts.push(new Blob(pend)); pend=[]; pendBytes=0; } };
  return {
    onData(data,pos){
      if(pos>size){ pend.push(new Uint8Array(pos-size)); size=pos; }
      if(pos<size){ const inside=Math.min(data.byteLength,size-pos); patches.push({pos,data:data.slice(0,inside)}); if(inside<data.byteLength){ pend.push(data.slice(inside)); size+=data.byteLength-inside; } }
      else { pend.push(data.slice()); size+=data.byteLength; pendBytes+=data.byteLength; }
      if(pendBytes>=16<<20) flush();
    },
    blob(type){ flush(); let b=new Blob(parts); for(const p of patches) b=new Blob([b.slice(0,p.pos),p.data,b.slice(p.pos+p.data.byteLength)]); return new Blob([b],{type}); }
  };
}
function makeMuxer(eng,ep,sink){
  if(eng.kind==="mp4") return new Mp4Muxer.Muxer({target:new Mp4Muxer.StreamTarget({onData:(d,p)=>sink.onData(d,p),chunked:true,chunkSize:4<<20}), video:{codec:"avc",width:ep.w,height:ep.h,frameRate:ep.fps}, audio:{codec:"aac",numberOfChannels:2,sampleRate:48000}, fastStart:false, firstTimestampBehavior:"offset"});
  return new WebMMuxer.Muxer({target:new WebMMuxer.StreamTarget({onData:(d,p)=>sink.onData(d,p),chunked:true,chunkSize:4<<20}), video:{codec:eng.v==="vp8"?"V_VP8":"V_VP9",width:ep.w,height:ep.h,frameRate:ep.fps}, audio:{codec:"A_OPUS",numberOfChannels:2,sampleRate:48000}, firstTimestampBehavior:"offset"});
}

function pickMime(){
  const list=["video/mp4;codecs=avc1.640028,mp4a.40.2","video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
  for(const m of list) if(window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return "";
}
const FILTER_OK = typeof CanvasRenderingContext2D!=="undefined" && "filter" in CanvasRenderingContext2D.prototype;
const LOOKS={
  none:{f:"none"},
  tealorange:{f:"contrast(1.12) saturate(1.2)", over:[["soft-light","rgba(0,110,130,0.30)"],["overlay","rgba(255,140,60,0.10)"]]},
  warmfilm:{f:"sepia(0.28) saturate(1.1) contrast(1.06) brightness(1.03)", over:[["soft-light","rgba(255,170,90,0.18)"]]},
  vivid:{f:"saturate(1.55) contrast(1.15)"},
  moody:{f:"contrast(1.22) saturate(0.78) brightness(0.9)", over:[["multiply","rgba(40,50,80,0.18)"]]},
  bw:{f:"grayscale(1) contrast(1.25)"},
  vhs:{f:"saturate(1.35) contrast(1.08) hue-rotate(8deg)", scan:true, over:[["screen","rgba(255,0,120,0.05)"]]},
  neon:{f:"saturate(1.6) contrast(1.18)", grad:[["soft-light","rgba(255,30,60,0.55)",0.15,0.2],["soft-light","rgba(40,80,255,0.55)",0.85,0.8]]},
  glossy:{f:"saturate(1.4) contrast(1.08) brightness(1.06)", over:[["screen","rgba(255,255,255,0.04)"]]},
  painterly:{f:"saturate(1.25) contrast(1.12)", over:[["soft-light","rgba(30,120,120,0.28)"],["soft-light","rgba(220,200,160,0.18)"]]},
  fincher:{f:"contrast(1.25) saturate(0.55) brightness(0.86)", over:[["multiply","rgba(110,130,70,0.22)"]]},
  cold:{f:"contrast(1.3) saturate(0.5) brightness(0.92)", over:[["multiply","rgba(60,110,170,0.3)"]]}
};
function ready(v){ if(!v) return false; if(typeof VideoFrame!=="undefined" && v instanceof VideoFrame) return v.displayWidth>0; if(typeof ImageBitmap!=="undefined" && v instanceof ImageBitmap) return v.width>0; if(v.tagName==="IMG") return v.complete && v.naturalWidth>0; return v.readyState>=2 && v.videoWidth>0 && !v.seeking; }
const curPlan=()=>S.activePlan||S.plan;
const isImgSeg=i=>{ const s=curPlan()[i]; return !!(s && S.clips[s.clip] && S.clips[s.clip].kind==="image"); };
const srcOf=(pool,i)=> i<0 ? null : (isImgSeg(i) ? S.clips[curPlan()[i].clip].img : (S.elFor&&S.elFor[i]) || pool[i%pool.length]);
/* virtual camera moves for still footage; shared by the export and the output check so they always agree */
function moveOf(seg,t,W,H,bi){
  if(!seg||!seg._move) return {s:1,dx:0,dy:0};
  const p=Math.min(1,Math.max(0,(t-seg.start)/Math.max(0.3,seg.end-seg.start))), d=(seg._dir||1)*(seg._amp||1), bb=(bi?0.025*Math.exp(-bi.ph*9)*(bi.down?1:0.5):0)*(seg._amp||1);
  switch(seg._move){
    case "pan": return {s:1.1+bb, dx:d*(ease(p)-0.5)*W*0.08, dy:0};
    case "tilt": return {s:1.1+bb, dx:0, dy:d*(ease(p)-0.5)*H*0.06};
    case "pull": return {s:1.14-0.1*ease(p)+bb, dx:0, dy:0};
    case "drift": return {s:1.09+bb, dx:d*(p-0.5)*W*0.05, dy:(0.5-p)*H*0.03};
    case "push": return {s:1.03+0.08*ease(p)+bb, dx:0, dy:0};
    case "handheld": return {s:1.08, dx:Math.sin(t*2.1)*W*0.009+Math.sin(t*5.3)*W*0.003, dy:Math.cos(t*1.7)*H*0.008};
  }
  return {s:1,dx:0,dy:0};
}
/* Speed ramp: the shot plays at about half speed, then accelerates to roughly double into the cut (a "velocity edit").
   Source time follows the integral of that speed curve, so every frame lands exactly where the ramp puts it. */
const RAMP_SPAN=0.7125;
function rampG(u){ u=Math.max(0,Math.min(1,u)); const x=u>0.55?(u-0.55)/0.45:0; return 0.45*u+0.2625*x*x*x; }
function srcTimeAt(s,t,F){ const D=Math.max(0.05,s.end-s.start); if(s._freeze) t=Math.min(t,s.end-s._freeze);
  if(s._rev){ const r=rateFor(s,F); return s.src+D*r-Math.max(0,Math.min(D,t-s.start))*r; } /* played backwards: from the end of its span to the start */ if(s._ramp) return s.src+D*rampG((t-s.start)/D); return s.src+(t-s.start)*rateFor(s,F); }
function rateFor(seg,F){ if(seg&&seg._rate) return seg._rate; return F.slowmo==="all" ? 0.5 : (F.slowmo==="quiet" && seg.e<0.4 ? 0.5 : 1); }
function srcRect(v,clip,cr){ const vw=v.videoWidth||v.naturalWidth||v.displayWidth||v.width, vh=v.videoHeight||v.naturalHeight||v.displayHeight||v.height, c=cr||clip.crop||{t:0,b:0,l:0,r:0};
  return [vw*c.l, vh*c.t, Math.max(8,vw*(1-c.l-c.r)), Math.max(8,vh*(1-c.t-c.b))]; }
const tiny=document.createElement("canvas"), tinyG=tiny.getContext("2d");
function drawClip(o,v,clip,F,scale=1,dx=0,dy=0,ex=null){
  if(!ready(v)) return;
  const st=v&&v.timestamp!=null?v.timestamp/1e6:(v&&v.tagName==="VIDEO"?v.currentTime:(v&&v._t!=null?v._t:null)), ecr=viewCrop(clip,o.W,o.H,F,st);
  const {g,W,H}=o, [sx,sy,sw,sh]=srcRect(v,clip,ecr);
  if(FILTER_OK) g.filter=matchFilter(o,clip,F.gpu?"none":F.filter); // with the GPU pass the look is applied once, to the whole frame
  if(ex && ex.rot){ g.save(); g.translate(W/2,H/2); g.rotate(ex.rot); g.translate(-W/2,-H/2); }
  if(ex && ex.parallax){
    const tw=48, th=Math.max(8,Math.round(48*H/W)); if(tiny.width!==tw||tiny.height!==th){ tiny.width=tw; tiny.height=th; }
    const kk=Math.max(tw/sw,th/sh); tinyG.drawImage(v,sx,sy,sw,sh,(tw-sw*kk)/2,(th-sh*kk)/2,sw*kk,sh*kk);
    g.drawImage(tiny,-W*0.08-dx*0.6,-H*0.08,W*1.16,H*1.16); g.fillStyle="rgba(0,0,0,0.3)"; g.fillRect(0,0,W,H);
    const k2=Math.min(W/sw,H/sh)*0.9*scale, dw=sw*k2, dh=sh*k2;
    g.shadowColor="rgba(0,0,0,0.5)"; g.shadowBlur=Math.min(W,H)*0.04;
    g.drawImage(v,sx,sy,sw,sh,(W-dw)/2+dx,(H-dh)/2+dy,dw,dh); g.shadowBlur=0;
    if(ex.rot) g.restore(); if(FILTER_OK) g.filter="none"; return;
  }
  if(F.fit==="blur"){
    const tw=48, th=Math.max(8,Math.round(48*H/W)); if(tiny.width!==tw||tiny.height!==th){ tiny.width=tw; tiny.height=th; }
    const k=Math.max(tw/sw,th/sh); tinyG.drawImage(v,sx,sy,sw,sh,(tw-sw*k)/2,(th-sh*k)/2,sw*k,sh*k);
    g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high";
    g.drawImage(tiny,dx,dy,W,H); g.fillStyle="rgba(0,0,0,0.35)"; g.fillRect(dx,dy,W,H);
  }
  let k=(F.fit==="fill"?Math.max(W/sw,H/sh):Math.min(W/sw,H/sh))*F.zoom*scale;
  let px=(W-sw*k)/2, py=(H-sh*k)/2;
  if(ex && ex.focus && F.fit==="fill"){ // follow the face: zoom toward it (within what the source resolution allows) and keep it framed
    const f=ex.focus, cr=ecr, prog=Math.max(0,Math.min(1,ex.prog||0));
    const outH=(o.ep&&o.ep.id&&EP(o.ep.id))?EP(o.ep.id).h:H; // judge sharpness at the export's real size, not the preview's
    const cap=Math.max(1.15,Math.min(3,sh*1.3/outH)), z=Math.min(cap,f.z0+(f.z1-f.z0)*ease(prog));
    k*=z; const fx=(f.cx-cr.l)/Math.max(0.05,1-cr.l-cr.r)*sw, fy=(f.cy-cr.t)/Math.max(0.05,1-cr.t-cr.b)*sh;
    px=Math.min(0,Math.max(W-sw*k,W/2-fx*k)); py=Math.min(0,Math.max(H-sh*k,H*0.42-fy*k)); // face centred, eyes near the upper third
  }
  const dw=sw*k, dh=sh*k; g.drawImage(v,sx,sy,sw,sh,px+dx,py+dy,dw,dh);
  if(ex && ex.rot) g.restore();
  if(FILTER_OK) g.filter="none";
}
/* photo motion: keeps still images alive, chosen per shot from the music when set to automatic */
function stillMotion(F,seg,idx,t,W,H){
  const r=stillMotionBase(F,seg,idx,t,W,H), amp=seg&&seg._amp||1; if(amp===1) return r;
  const bi=beatInfo(t), kick=0.07*Math.exp(-bi.ph*9)*(bi.down?1.4:0.8); // short-form: bigger moves and a punch on every beat
  return {...r, s:1+(r.s-1)*amp+kick, dx:(r.dx||0)*amp, dy:(r.dy||0)*amp, rot:(r.rot||0)*amp};
}
function stillMotionBase(F,seg,idx,t,W,H){
  let m=F.still;
  if(m==="auto"){ const r=rng(idx*2654435761>>>0)();
    m = seg.e>0.65 ? (r<0.5?"bounce":"zoomin") : seg.e>0.35 ? (r<0.4?"pan":r<0.75?"zoomin":"parallax") : (r<0.4?"drift":r<0.7?"zoomout":"parallax"); }
  const p=Math.min(1.2,Math.max(0,(t-seg.start)/Math.max(0.3,seg.end-seg.start))), dir=idx%2?1:-1, bi=beatInfo(t);
  switch(m){
    case "zoomin": return {s:1.04+0.16*p};
    case "zoomout": return {s:1.2-0.16*p};
    case "pan": return {s:1.18, dx:dir*(p-0.5)*W*0.12};
    case "drift": return {s:1.12+0.05*p, dx:dir*(p-0.5)*W*0.05, dy:(0.5-p)*H*0.03, rot:dir*(p-0.5)*0.035};
    case "bounce": return {s:1.06+0.07*Math.exp(-bi.ph*8)*(bi.down?1.4:1), rot:(bi.i%2?1:-1)*0.012*Math.exp(-bi.ph*8)};
    case "parallax": return {s:1+0.06*p, dx:dir*(p-0.5)*W*0.06, parallax:true};
  }
  return {s:1};
}
const ease=p=>p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
function kbScale(F,seg,t){
  if(seg&&seg._cam){ const p=ease(Math.max(0,Math.min(1,(t-seg.start)/Math.max(0.3,seg.end-seg.start)))), a=seg._camA||0.07; return seg._cam==="in"?1+a*p:1+a*(1-p); }
  return F.kb ? 1+0.07*Math.min(1.2,Math.max(0,(t-seg.start)/(seg.end-seg.start))) : 1; }
/* Camera moves: push in through builds (tension), pull out on drops and section openings (the reveal), pull back on the
   final shot; other longer shots alternate. Moving footage gets a gentle move; still footage a stronger one. */
function assignCamera(segs,short){
  const mode=$("camMoves")?$("camMoves").value:"off", r=rng((S.seed||1)*17+3), n=segs.length; let last=null;
  if(mode==="director"){ segs.forEach(s=>{ s._cam=null; s._camA=0; }); assignDirector(segs,short); return; }
  segs.forEach((s,i)=>{ s._cam=null; s._camA=0; const D=s.end-s.start, c=S.clips[s.clip]; if(mode==="off"||!c||c.kind==="image"||s._freeze&&D<1) return;
    if(s._focus&&s._focus.z1>s._focus.z0+0.02) return; // already pushing in on a face
    const sm=c.samples&&c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]), mov=sm?(sm.motion||0):2;
    let dir=null;
    if(mode==="in"){ if(D>=0.9) dir="in"; }
    else { if(D<0.9&&!s.drop) return;
      if(s._endShot||(!short&&i===n-1)) dir="out"; else if(s.build) dir="in"; else if(s.drop||s._entry) dir="out"; else if(!short&&i===0) dir="out";
      else if(D>=1.4){ const x=r(); dir=x<0.5?(last==="in"?"out":"in"):x<0.8?(last==="out"?"in":"out"):null; } }
    if(!dir) return; s._cam=dir; s._camA=(mov<1?0.11:0.065)*(s._endShot?1.5:1); last=dir; });
}

