/* ---------------- One rendering pass: many outputs, same window ---------------- */
function stopRun(){ if(S.running) S.running.stop(); }
function mkOut(ep,canvas){ const c=canvas||document.createElement("canvas"); c.width=ep.w; c.height=ep.h; if(!canvas) $("offscreen").appendChild(c); return {ep,canvas:c,g:c.getContext("2d"),W:ep.w,H:ep.h}; }

async function runPass(outs,win,record,planArg){
  const plan=planArg||S.plan, [ws,we]=win, len=we-ws, F=readFx();
  const eng=record?chooseEngine():null;
  if(eng){
    try{
      await loadScript(MUXERS[eng.kind]);
      status("Preparing the soundtrack…");
      for(const o of outs){
        o.sink=streamSink(); o.mux=makeMuxer(eng,o.ep,o.sink); o.aq=await encodeSound(await renderSound(o.ep,win,plan,F),eng); o.ai=0; o.k=0; o.N=Math.round(len*o.ep.fps); o.verr=null;
        const flushAudio=ts=>{ while(o.ai<o.aq.length && o.aq[o.ai][0].timestamp<=ts){ const [c,m]=o.aq[o.ai++]; o.mux.addAudioChunk(c,m); } };
        o.flushAudio=flushAudio;
        o.venc=new VideoEncoder({output:(c,m)=>{ flushAudio(c.timestamp); o.mux.addVideoChunk(c,m); }, error:e=>{ o.verr=e; }});
        o.venc.configure({codec:eng.v,width:o.ep.w,height:o.ep.h,bitrate:o.ep.br,framerate:o.ep.fps,latencyMode:"quality",...(eng.kind==="mp4"?{avc:{format:"avc"}}:{})});
        o.emit=()=>{ const f=new VideoFrame(o.canvas,{timestamp:Math.round(o.k*1e6/o.ep.fps),duration:Math.round(1e6/o.ep.fps)}); o.venc.encode(f,{keyFrame:o.k%(o.ep.fps*2)===0}); f.close(); o.k++; };
      }
    }catch(e){ status("Frame-accurate recording isn’t available right now, so standard recording is used.",true); return runPassRec(outs,win,record,plan,null); }
  }
  if(eng && record && typeof VideoDecoder!=="undefined") return runPassDecode(outs,win,plan,eng);
  return runPassRec(outs,win,record,plan,eng);
}
async function runPassRec(outs,win,record,plan,eng){
  await ensureFonts();
  const [ws,we]=win, len=we-ws, F=readFx();
  S.activePlan=plan;
  const actx=new (window.AudioContext||window.webkitAudioContext)(); await actx.resume();
  const src=actx.createBufferSource(); src.buffer=S.audioBuf;
  const useRec=record&&!eng;
  const t0=actx.currentTime+Math.max(0.3,(useRec?S.recLat:0)+0.2);
  const chain=buildChain(actx,{win,t0,ep:outs[0].ep,plan,src}); src.connect(chain.entry); fadeEnvelope(chain.master.gain,t0,len,outs[0].ep); LIVE=chain;
  const mime=pickMime();
  for(const o of outs){
    const lg=actx.createGain(); lg.gain.value=loudnessGain(o.ep); const lim=limiter(actx);
    chain.master.connect(lg); lg.connect(lim);
    if(record && eng){ const mute=actx.createGain(); mute.gain.value=0; lim.connect(mute); mute.connect(actx.destination); }
    else if(record){
      const dest=actx.createMediaStreamDestination(); lim.connect(dest);
      const stream=new MediaStream([...o.canvas.captureStream(o.ep.fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      o.rec=new MediaRecorder(stream,{mimeType:mime, videoBitsPerSecond:o.ep.br, audioBitsPerSecond:256000}); o.chunks=[];
      o.rec.ondataavailable=e=>{ if(e.data && e.data.size) o.chunks.push(e.data); };
    } else lim.connect(actx.destination);
  }
  const withSound=$("clipSound").checked;
  let clipBus=null;
  if(withSound){ clipBus=actx.createGain(); clipBus.gain.value=+$("clipVol").value; clipBus.connect(chain.master); }
  const nClips=new Set(plan.filter(s=>s.end>ws&&s.start<we&&S.clips[s.clip].kind!=="image").map(s=>s.clip)).size;
  const pool=Array.from({length:6},()=>0).map(()=>{ const v=document.createElement("video"); v.playsInline=true; v.preload="auto"; v.preservesPitch=true;
    if(withSound){ v.muted=false; try{ const src=actx.createMediaElementSource(v); v._g=actx.createGain(); src.connect(v._g); v._g.connect(clipBus); }catch(e){ v.muted=true; } }
    else v.muted=true;
    v.style.cssText="position:absolute;right:4px;bottom:4px;width:64px;height:36px;object-fit:cover;pointer-events:none;z-index:0"; $("stageBox").appendChild(v);
    return v; });
  const elFor=[], owner=new Map(); S.elFor=elFor;
  const pickEl=(i,url)=>{ const inUse=new Set(); for(const [el,si] of owner) if(si>=cur-1 && si<i) inUse.add(el);
    const free=pool.filter(e=>!inUse.has(e));
    const el=free.find(e=>e.dataset.u===url && !(owner.get(e)>=cur-1)) || free.find(e=>!e.dataset.u) || free.sort((a,b)=>(owner.get(a)??-9)-(owner.get(b)??-9))[0] || pool[i%pool.length];
    owner.set(el,i); elFor[i]=el; return el; };
  const prep=(i,off=0)=>{ if(i>=plan.length || isImgSeg(i) || elFor[i]) return Promise.resolve(); const seg=plan[i], clip=S.clips[seg.clip], el=pickEl(i,clip.url);
    el.pause(); if(el.dataset.u!==clip.url){ el.src=clip.url; el.dataset.u=clip.url; }
    if(el._g) el._g.gain.value=clip.mute?0:1;
    const rate=rateFor(seg,F); return seekTo(el,Math.min(clip.dur-0.1,seg.src+off*rate+0.035*rate)).then(()=>{ el.playbackRate=rate; }); }; // cue one frame ahead to cancel playback start-up delay
  let cur=plan.findIndex(s=>ws>=s.start && ws<s.end); if(cur<0) cur=0;
  const state={record, stopped:false, stop:()=>{ state.stopped=true; }};
  S.running=state; updateButtons();
  await prep(cur, Math.max(0,ws-plan[cur].start)); await Promise.race([Promise.all([prep(cur+1),prep(cur+2),prep(cur+3),prep(cur+4)]), new Promise(r=>setTimeout(r,8000))]);
  for(let k=0;k<40 && elFor[cur] && !isImgSeg(cur) && !ready(elFor[cur]);k++) await new Promise(r=>setTimeout(r,100));
  let recStarted=false;
  src.start(t0, ws, len);
  setTimeout(()=>{ if(!isImgSeg(cur)) elFor[cur].play().catch(()=>{}); }, Math.max(0,(t0-actx.currentTime)*1000));
  const stage=$("stage"), sg=stage.getContext("2d");
  let outEl=null, outUntil=0, lastTl=0;
  /* Frame-accurate loop: a clock that pauses while footage is getting ready, and renders any frames missed during a stall
     one by one at their exact moment (seeking each clip there) instead of repeating the last picture. */
  async function exactLoop(){
    const raf=()=>new Promise(r=>requestAnimationFrame(r)), now=()=>performance.now();
    // each player reports the source time of the frame it is actually showing
    pool.forEach(v=>{ if(v.requestVideoFrameCallback && !v._trk){ v._trk=true; const cb=(n,md)=>{ v._mt=md.mediaTime; v._mtAt=performance.now(); v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb); } });
    let sp=1, tv=ws, last=now(); const hist=[]; S._exact={ticks:0,late:0,fixed:0,minSpeed:1};
    const segAt=t=>{ let i=plan.findIndex(s=>t>=s.start-1e-6 && t<s.end); return i<0?plan.length-1:i; };
    const srcT=(i,tk)=>{ const s=plan[i]; return Math.min(S.clips[s.clip].dur-0.04,s.src+(tk-s.start)*rateFor(s,F)); };
    const ensure=async i=>{ if(i<0||i>=plan.length||isImgSeg(i)) return; if(!elFor[i]) await prep(i); for(let n=0;n<60 && !ready(elFor[i]);n++) await new Promise(r=>setTimeout(r,40)); };
    const seekEl=async(el,ts)=>{ el._mt=null; await seekTo(el,ts+0.008); for(let n=0;n<3 && !ready(el);n++) await raf(); }; // aim inside the frame; the seeked event means it's decoded
    const placeAt=async tk=>{ const i=segAt(tk), s=plan[i]; await ensure(i);
      if(!isImgSeg(i)){ const el=elFor[i]; el.pause(); await seekEl(el,srcT(i,tk)); }
      if(i>0 && s.tr && s.tr.dur>0 && tk<s.start+s.tr.dur && !isImgSeg(i-1)){ await ensure(i-1); const el=elFor[i-1]; if(el){ el.pause(); await seekEl(el,srcT(i-1,tk)); } }
      return i; };
    const drawAt=(i,tk)=>{ const Fs=fxFor(F,plan[i],i); for(const o of outs){ const bi=drawPicture(o,plan,i,tk,pool,Fs); if(bi!==false) postFx(o,tk,win,Fs,bi,{}); } };
    const playEl=(el,i)=>{ if(!el) return; el.playbackRate=rateFor(plan[i],F)*sp; el.play().catch(()=>{}); };
    const switchTo=i=>{ while(cur<i){ if(outEl) outEl.pause(); outEl=isImgSeg(cur)?null:elFor[cur]; cur++; outUntil=plan[cur].start+(plan[cur].tr?plan[cur].tr.dur:0); prep(cur+1); prep(cur+2); prep(cur+3); prep(cur+4); } };
    const resumeAt=async t=>{ const i=await placeAt(t); switchTo(i); if(!isImgSeg(cur)) playEl(elFor[cur],cur); if(outEl && t<outUntil) playEl(outEl,cur-1); tv=t; last=now(); };
    // on the right frame? judged from the player's real position: frame reports when they're live, its clock otherwise
    const fresh=(i,tk)=>{ if(isImgSeg(i)) return true; const el=elFor[i]; if(!el||!ready(el)) return false; const ts=srcT(i,tk);
      const live=el._mt!=null && el._mtAt && now()-el._mtAt<250 && !el.paused, pos=live?el._mt:el.currentTime;
      const half=0.45/Math.max(24,...outs.map(o=>o.ep.fps)); // under half a frame: a paused player must sit on exactly this frame
      if(el.paused || !live) return Math.abs(el.currentTime-ts)<=half+0.004;
      return pos>=ts-0.05 && pos<=ts+0.07; };
    await resumeAt(ws);
    for(;;){
      await raf();
      if(state.stopped) break;
      const n=now(); tv+=(n-last)/1000*sp; last=n; let t=Math.min(tv,we);
      if(cur<plan.length-1 && t>=plan[cur+1].start && !isImgSeg(cur+1) && !ready(elFor[cur+1]||{})){ pool.forEach(v=>v.pause()); await ensure(cur+1); await resumeAt(plan[cur+1].start); t=tv; }
      while(cur<plan.length-1 && t>=plan[cur+1].start){ if(outEl) outEl.pause(); outEl=isImgSeg(cur)?null:elFor[cur]; cur++; outUntil=plan[cur].start+(plan[cur].tr?plan[cur].tr.dur:0);
        if(!isImgSeg(cur)){ if(!elFor[cur]) prep(cur); playEl(elFor[cur],cur); } prep(cur+1); prep(cur+2); prep(cur+3); prep(cur+4); }
      if(outEl && t>=outUntil){ outEl.pause(); outEl=null; }
      const el=elFor[cur]||pool[0], seg=plan[cur], clip=S.clips[seg.clip];
      if(!isImgSeg(cur) && (el.ended || el.currentTime>=clip.dur-0.06)){ el.currentTime=seg.src; playEl(el,cur); }
      const owed=Math.max(...outs.map(o=>Math.min(o.N,Math.floor((t-ws)*o.ep.fps+1e-6)+1)-o.k));
      if(owed>0){
        let drawnFor=null;
        for(;;){ // emit every owed frame, each showing its own moment
          const pend=outs.filter(o=>o.k<o.N && o.k/o.ep.fps<=t-ws+1e-6); if(!pend.length) break;
          const tk=Math.min(...pend.map(o=>ws+o.k/o.ep.fps)), i=segAt(tk);
          const inTr=i>0&&plan[i].tr&&plan[i].tr.dur>0&&tk<plan[i].start+plan[i].tr.dur;
          const ok=i===cur && fresh(i,tk) && (!inTr||fresh(i-1,tk));
          S._exact.ticks++; hist.push(ok?0:1); if(hist.length>30) hist.shift();
          if(!ok){ S._exact.late++; if(elFor[i] && elFor[i].paused && !isImgSeg(i)) S._exact.pausedPlayers=(S._exact.pausedPlayers||0)+1; const p0=now(); pool.forEach(v=>v.pause()); const j=await placeAt(tk); drawAt(j,tk); drawnFor=null; S._exact.fixed++;
            for(const o of outs){ while(o.k<o.N && ws+o.k/o.ep.fps<=tk+1e-6) o.emit(); }
            while(!state.stopped && outs.some(o=>o.venc.encodeQueueSize>4)) await new Promise(r=>setTimeout(r,8));
            switchTo(j); if(!isImgSeg(cur)) playEl(elFor[cur],cur); if(outEl && tk<outUntil) playEl(outEl,cur-1); last=now(); }
          else { if(drawnFor!==tk){ drawAt(i,tk); drawnFor=tk; } for(const o of outs){ while(o.k<o.N && ws+o.k/o.ep.fps<=tk+1e-6) o.emit(); } }
        }
        // adapt the render speed to what this computer can decode smoothly
        const lateRate=hist.reduce((a,b)=>a+b,0)/(hist.length||1);
        if(hist.length>=10 && lateRate>0.2 && sp>0.25){ sp=Math.max(0.25,sp*0.7); hist.length=0; S._exact.minSpeed=Math.min(S._exact.minSpeed,sp); [elFor[cur],outEl].forEach(v=>{ if(v&&!v.paused) v.playbackRate=rateFor(plan[cur],F)*sp; }); }
        else if(hist.length>=30 && lateRate===0 && sp<1){ sp=Math.min(1,sp*1.15); hist.length=0; [elFor[cur],outEl].forEach(v=>{ if(v&&!v.paused) v.playbackRate=rateFor(plan[cur],F)*sp; }); }
      }
      // brake: if an encoder is falling behind, hold everything until it catches up (each waiting frame is megabytes)
      if(Math.max(...outs.map(o=>o.venc.encodeQueueSize))>4){ pool.forEach(v=>v.pause()); S._exact.braked=(S._exact.braked||0)+1;
        while(!state.stopped && outs.some(o=>o.venc.encodeQueueSize>1)) await new Promise(r=>setTimeout(r,8));
        await resumeAt(t); }
      S._exact.qmax=Math.max(S._exact.qmax||0,...outs.map(o=>o.venc.encodeQueueSize));
      if(outs[0].canvas!==stage) sg.drawImage(outs[0].canvas,0,0,stage.width,stage.height);
      $("prog").value=Math.min(1,(S.passBase+(t-ws))/Math.max(0.01,S.passCount));
      const nw=now(); if(nw-lastTl>120){ lastTl=nw; drawTimeline(t); }
      if(t>=we || outs.every(o=>o.k>=o.N)) break;
    }
  }

  if(eng) await exactLoop(); else await new Promise(resolve=>{
    function frame(){
      const t=ws+(actx.currentTime-t0);
      if(state.stopped || t>=we){ resolve(); return; }
      while(cur<plan.length-1 && t>=plan[cur+1].start){
        if(outEl) outEl.pause();
        outEl=isImgSeg(cur)?null:elFor[cur]; cur++;
        outUntil=plan[cur].start+(plan[cur].tr?plan[cur].tr.dur:0);
        if(!isImgSeg(cur)){ if(!elFor[cur]) prep(cur); elFor[cur].play().catch(()=>{}); } prep(cur+1); prep(cur+2); prep(cur+3); prep(cur+4);
      }
      if(outEl && t>=outUntil){ outEl.pause(); outEl=null; }
      if(useRec && !recStarted && actx.currentTime>=t0-S.recLat){ recStarted=true; outs.forEach(o=>o.rec.start(1000)); }
      if(t<ws && useRec){ const Fs=fxFor(F,plan[cur],cur); for(const o of outs){ const bi=drawPicture(o,plan,cur,ws,pool,Fs); if(bi!==false) postFx(o,ws,win,Fs,bi,{}); } }
      if(t>=ws){
        const el=elFor[cur]||pool[0], seg=plan[cur], clip=S.clips[seg.clip];
        if(!isImgSeg(cur) && (el.ended || el.currentTime>=clip.dur-0.06)){ el.currentTime=seg.src; el.play().catch(()=>{}); }
        const Fs=fxFor(F,seg,cur);
        for(const o of outs){ const bi=drawPicture(o,plan,cur,t,pool,Fs); if(bi!==false) postFx(o,t,win,Fs,bi,{guides:!record && $("showSafe").checked}); }
        if(record && outs[0].canvas!==stage) sg.drawImage(outs[0].canvas,0,0,stage.width,stage.height);
        if(record) $("prog").value=Math.min(1,(S.passBase+(t-ws))/Math.max(0.01,S.passCount));
        const now=performance.now(); if(now-lastTl>120){ lastTl=now; drawTimeline(t); }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  try{ src.stop(); }catch(e){}
  pool.forEach(v=>{ v.pause(); v.removeAttribute("src"); v.load(); });
  const results=[];
  if(record && eng){
    for(const o of outs){
      if(!state.stopped){ while(o.k<o.N) o.emit(); }
      try{ await o.venc.flush(); }catch(e){ o.verr=o.verr||e; }
      try{ o.venc.close(); }catch(e){}
      if(!state.stopped && !o.verr){ o.flushAudio(Infinity); o.mux.finalize();
        results.push({ep:o.ep, win, plan, blob:o.sink.blob(eng.kind==="mp4"?"video/mp4":"video/webm"), ext:eng.ext, engine:"exact"}); }
      else if(o.verr) status("The encoder stopped unexpectedly. Choose Most compatible under Recording and make it again.",true);
      o.sink=null; o.mux=null; o.aq=null;
    }
  } else if(record){
    if(!state.stopped){ const tEnd=performance.now()+S.recTail*1000+150*(outs.length-1); await new Promise(r=>{ (function hold(){ for(const o of outs){ const tr=o.canvas.captureStream&&null; } if(performance.now()>=tEnd) r(); else requestAnimationFrame(hold); })(); }); }
    for(const o of outs){ await new Promise(r=>{ o.rec.onstop=r; if(o.rec.state!=="inactive") o.rec.stop(); else r(); }); results.push({ep:o.ep, win, plan, blob:new Blob(o.chunks,{type:mime.split(";")[0]}), ext:mime.includes("mp4")?"mp4":"webm", engine:"rec"}); }
  }
  pool.forEach(v=>v.remove());
  LIVE=null; actx.close(); S.running=null; S.activePlan=null; S.elFor=null; updateButtons(); drawTimeline();
  return state.stopped ? null : results;
}

