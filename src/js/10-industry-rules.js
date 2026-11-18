/* ---------------- Industry rules: a plan shaped for each kind of export ---------------- */
function cloneSeg(s){ return {_endInfo:s._endInfo,_rev:s._rev,_manualRev:s._manualRev,_cam:s._cam,_camA:s._camA,_endShot:s._endShot,_entry:s._entry,_refK:s._refK,_freeze:s._freeze,_chorusLead:s._chorusLead,_seenLoud:s._seenLoud,_ramp:s._ramp,_manual:s._manual,_lock:s._lock,_accent:s._accent,_amp:s._amp,_rate:s._rate,start:s.start,end:s.end,e:s.e,c:s.c,down:s.down,drop:s.drop,build:s.build,buildK:s.buildK,_beat:s._beat,clip:s.clip,src:s.src,tr:s.tr?{...s.tr}:null,_pattern:s._pattern,_take:s._take,_vocal:s._vocal,_sync:s._sync,_breath:s._breath,_motifSlot:s._motifSlot}; }
function heroPick(D,needLead,ep){
  const cands=[]; const sh=[]; S.clips.forEach(c=>{ if(c.samples) c.samples.forEach(s=>{ if(s.sharp>0) sh.push(s.sharp); }); }); sh.sort((a,b)=>a-b); const shMed=sh.length?sh[sh.length>>1]:0;
  const resK=c=>{ if(!ep||!c.w||!c.h) return 0; const ar=ep.w/ep.h, cropW=Math.min(c.w,c.h*ar), up=ep.w/Math.max(1,cropW); return up<=1.6?0.3:up<=2.4?0:up<=3.2?-0.4:-1; }; // a blurry, blown-up first frame gets swiped
  const shK=s=>shMed&&s.sharp>0?0.25*Math.max(-1,Math.min(1,s.sharp/shMed-1)):0;
  S.clips.forEach((c,ci)=>{ if(!c.samples||c.off||isExcluded(ci)) return;
    for(const s of c.samples){
      let start=s.t;
      if(c.kind!=="image"){ if(c.dur<D+0.1) continue; start=Math.min(s.t,c.dur-D-0.05); if(needLead){ if(c.dur>=needLead+D+0.05) start=Math.max(start,needLead); else continue; } }
      const tg=tagAt(c,s.t); const sc=(c.kind==="image"?0.2:(s.mN||0))*0.5+Math.min(1,(c.kind==="image"?0:s.motion||0)/4)*0.5+(s.bN||0)*0.25+(tg&&tg.faces&&tg.scale>=3?0.3:0); // moving, bright, and a face if we know of one
      cands.push({clip:ci,src:start,sc:sc+resK(c)+shK(s)-0.5*Math.min(2,fatigue().open.get(clipKey(ci))||0)-0.25*Math.min(2,fatigue().clip.get(clipKey(ci))||0)}); } });
  cands.sort((a,b)=>b.sc-a.sc); const top=[]; for(const c of cands){ if(!top.some(t=>t.clip===c.clip)) top.push(c); if(top.length>=3) break; }
  return top.length?top[Math.floor(rng(S.seed*7+3)()*top.length)]:null;
}
function splitSeg(seg,maxLen){
  const B=S.an.beats, out=[]; let st=seg.start;
  while(seg.end-st>maxLen+0.05){
    let cut=st+maxLen; for(let i=B.length-1;i>=0;i--){ if(B[i]<=st+maxLen+0.01 && B[i]>st+0.3){ cut=B[i]; break; } }
    out.push({...cloneSeg(seg),start:st,end:cut,_split:true}); st=cut;
  }
  out.push({...cloneSeg(seg),start:st,end:seg.end,_split:out.length>0}); return out;
}
const CALM_DIRECTORS=["Playful one-take","Dreamlike calm","Stark monochrome"];
/* seamless loop for short-form: the last shot is the moment just before the opening frame, so the replay runs straight on */
function loopTail(segs){ if(segs.length<2) return; const f=segs[0], l=segs[segs.length-1], Dl=l.end-l.start, fc=S.clips[f.clip], D0=f.end-f.start; if(!fc||l._lock||l._manual) return;
  if(fc.kind!=="image" && f.src<Dl-0.01 && fc.dur>=Dl+D0+0.1 && !f._lock && !f._manual) f.src=Dl; // start the opener a little later in its clip so the last shot can be the moment just before it
  if(fc.kind==="image" || f.src>=Dl-0.01){ l.clip=f.clip; l.src=fc.kind==="image"?0:Math.max(0,f.src-Dl); l._rev=false; l._loop=true; } }
function makeExportPlan(ep,win){
  if(!S.plan) return null;
  const base=S.plan.filter(s=>s.end>win[0]+0.01 && s.start<win[1]-0.01).map(cloneSeg);
  if(!base.length) return S.plan;
  if(!PRO()){ if(!ep.short) return S.plan; // industry rules off: still loop short-form cleanly, nothing else changes
    base[0].src+=Math.max(0,win[0]-base[0].start); base[0].start=win[0]; base[base.length-1].end=win[1]; base[0].tr={type:"cut",dur:0}; loopTail(base); return base; }
  base[0].src+=Math.max(0,win[0]-base[0].start); base[0].start=win[0]; base[base.length-1].end=win[1];
  const len=win[1]-win[0], short=!!ep.short, calm=CALM_DIRECTORS.includes(S.direct);
  const fast=["Frantic strobe","Glitch nightmare","Doodle pop"].includes(S.direct);
  // short-form: a cut inside the first 1.5 s and a fresh shot at least every 3 s; music videos: quick cuts early, about 2 s on average, nothing static too long
  const dc=dcut();
  const maxLenAt=(rel,t)=> short ? (rel<3?1.5:3)
    : (len>=25 && t>=win[1]-20 ? 99 : rel<5?(calm?5:2.5) : dc ? Math.min(12,Math.max(3.5,dc.q*1.4)) : rel<30?3.5 : (calm?10:6));
  const minLenAt=(rel,e)=> dc ? (short ? (rel<3?0:Math.min(0.9,dc[secOf(e)]*0.6)) : Math.max(0.25,dc[secOf(e)]*0.5))
    : short ? (rel<3?0:(fast?0.6:1.2)) : (fast?0.6:calm?2:(e>0.75?0.75:e>0.5?1.1:1.8));
  let segs=[];
  for(const s of base) segs.push(...splitSeg(s,maxLenAt(s.start-win[0],s.start)));
  { const m=[]; // merge shots that are too short to register, as long as the result still respects the maximum
    for(const s of segs){ const last=m[m.length-1];
      if(last){ const rel=last.start-win[0], dl=last.end-last.start;
        if(!last.build && !s.drop && dl<minLenAt(rel,last.e) && dl+(s.end-s.start)<=maxLenAt(rel,last.start)+0.05){ last.end=s.end; last._split=true; continue; } }
      m.push(s); }
    segs=m; }
  S._endAtFull=false;
  if(!short && len>=25){ // last 20 s: longer, calmer shots so YouTube end-screen buttons and the closing logo read clearly
    const tailE=segs.filter(s=>s.end>win[1]-20).reduce((a,s,_,arr)=>a+s.e/arr.length,0), atFull=tailE>0.55; // a song that ends at full tilt keeps its pace
    S._endAtFull=atFull;
    const z=win[1]-(atFull?6:20), keep=segs.filter(s=>s.end<=z+0.01), tail=segs.filter(s=>s.end>z+0.01), merged=[];
    for(const s of tail){ const last=merged[merged.length-1]; if(last && last.end-last.start<4) last.end=s.end; else merged.push(s); }
    segs=[...keep,...merged];
  }
  { const EN=!short?endingFor(win):null; if(EN&&segs.length>3){
      const maxClip=Math.max(3,...S.clips.filter((c,i)=>c.samples&&!c.off&&c.kind!=="image").map(c=>c.dur)), B=S.an.beats;
      let at=EN.type==="stop"?EN.hit:EN.shotFrom; if(EN.type!=="stop"){ let bd=null; B.forEach((b,i)=>{ if(b<=at+1e-3&&isDownAt(S.an,i)) bd=b; }); if(bd!=null&&at-bd<2.5) at=bd; }
      at=Math.max(at,win[1]-(maxClip-0.15),win[0]+1); const minLen=EN.type==="stop"?0.6:3; if(win[1]-at<minLen) at=Math.max(win[0]+1,win[1]-minLen);
      const near=segs.find(s=>Math.abs(s.start-at)<0.12); if(near) at=near.start;
      const i=segs.findIndex(s=>at>=s.start-1e-6&&at<s.end); if(i>=1){ const s=segs[i];
        if(at-s.start<0.4){ s.end=win[1]; segs.length=i+1; s._endShot=true; s._split=true; }
        else { s.end=at; segs.length=i+1; segs.push({...cloneSeg(s),start:at,end:win[1],_split:true,_endShot:true,tr:EN.type==="stop"?{type:"cut",dur:0}:{type:"crossfade",dur:Math.min(0.9,(win[1]-at)*0.25)}}); }
        segs[segs.length-1]._endInfo=EN; } } }
  const ctx={recent:[],usage:new Map(),rand:rng(S.seed+Math.round(win[0]*100)+(short?1:0)),order:filmOrder(),short,win,acts:actsFor(win)}, lastSeen=new Map();
  annotateStory(segs);
  for(let i=0;i<segs.length;i++){
    const s=segs[i], rel=s.start-win[0];
    if(i===0){ if(storyOn() && hasTags() && !short){ const pick=chooseClip(s,ctx,-1); if(pick){ s.clip=pick.clip; s.src=pick.src; } }
      else { const hp=heroPick(s.end-s.start, short?Math.min(3,len*0.2):0, ep); if(hp){ s.clip=hp.clip; s.src=hp.src; } } }
    else {
      const repeatWindow=short?len:(rel<30?30:20), prevT=lastSeen.get(s.clip);
      const nC=Math.max(1,S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)).length), over=((ctx.count&&ctx.count.get(s.clip))||0)+1>((ctx.total||0)+1)/nC*1.6+1;
      if(!s._pattern && !s._manual && (short || s._split || over || s.clip===segs[i-1].clip || (prevT!=null && s.start-prevT<repeatWindow))){ const pick=chooseClip(s,ctx,segs[i-1].clip); if(pick){ s.clip=pick.clip; s.src=pick.src; } }
      if(s.tr && s.tr.type==="match"){ const pt=tagAt(S.clips[segs[i-1].clip],segs[i-1].src); if(pt&&pt.box){ ctx.matchTo={box:pt.box}; const pick=chooseClip(s,ctx,segs[i-1].clip); ctx.matchTo=null; if(pick){ s.clip=pick.clip; s.src=pick.src; } } }
    }
    lastSeen.set(s.clip,s.end);
    noteUse(ctx,s,s.clip,s.src);
  }
  // tighten the rhythm in a few places: a quick half-beat cut where the music hits on the "and", and a stutter into each drop
  if(!(S.an.feel&&S.an.feel.free) && (short||!dcut()||!["Playful one-take","Dreamlike calm","Stark monochrome","Symmetry"].includes(S.direct))){ // short-form always gets its half-beat lift; free time never does
    const B=S.an.beats, beatLen=60/S.an.bpm, hh=S.an.halfHit||[], bi=t=>{ let k=0; while(k<B.length-1&&B[k+1]<=t+1e-3) k++; return k; };
    const out=[]; let lastAccent=-99, made=0;
    for(let n=0;n<segs.length;n++){ const s=segs[n], D=s.end-s.start, nx=segs[n+1];
      const k=bi(s.end-beatLen*0.5), sw=S.an.swing||0.5, mid=B[k]+sw*((B[k+1]||B[k]+beatLen)-B[k]);
      const intoDrop=nx&&nx.drop&&D>=beatLen*0.9;
      const hitAnd=s.e>0.6 && (hh[k]||0)>=0.8 && s.start-lastAccent>=beatLen*5 && D>=beatLen*1.9 && !s._loop && !s._pattern && (s.start-win[0])>(short?2.5:4);
      if((hitAnd||intoDrop) && mid>s.start+0.2 && mid<s.end-0.15){
        const a={...s,end:mid}, b2={...s,start:mid,_accent:true,tr:{type:"cut",dur:0}};
        const pick=chooseClip(b2,ctx,s.clip); if(pick){ b2.clip=pick.clip; b2.src=pick.src; noteUse(ctx,b2,pick.clip,pick.src); }
        out.push(a,b2); lastAccent=s.start; made++; }
      else out.push(s); }
    segs=out; S._accents=made;
  }
  if(short) loopTail(segs);
  annotateStory(segs);
  { const out=[]; for(const s of segs){ const c=S.clips[s.clip]; if(c&&c.kind==="image"&&s.end-s.start>(short?1.15:3.05)&&!s._loop&&!s._bookend){ const B=S.an.beats; let cut=s.start+(s.end-s.start)/2; for(const b of B){ if(b>s.start+0.6&&b<s.end-0.6){ cut=b; if(b>=s.start+(s.end-s.start)/2) break; } }
        const a={...s,end:cut}, b={...s,start:cut,_split:true,tr:{type:"cut",dur:0}}; const pick=chooseClip(b,ctx,s.clip); if(pick){ b.clip=pick.clip; b.src=pick.src; } out.push(a,b); } else out.push(s); } segs=out; }
  if(short && PRO() && $("slowmo").value==="all") segs.forEach(s=>{ s._rate=s.e<0.4?0.5:1; });
  // speed ramps: into drops and build landings, and now and then in driving passages; only on moving footage with room to run
  if($("fxRamp").checked && typeof VideoDecoder!=="undefined" && !$("clipSound").checked && !(S.an.feel&&S.an.feel.free)){
    let last=-99; const gap=short?10:22;
    segs.forEach((s,k)=>{ const D=s.end-s.start, c=S.clips[s.clip], nx=segs[k+1]; if(!c||c.kind==="image"||s._loop||s._bookend||s._pattern) return;
      const into=nx&&(nx.drop||(s.build&&!nx.build)), drive=s.e>0.72&&s.start-last>=gap;
      const sm=c.samples&&c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]);
      if((into||drive) && !s._freeze && D>=0.8 && D<=2.6 && sm && (sm.motion||0)>=1 && s.src+D*RAMP_SPAN<=c.dur-0.1 && s.start-last>=4){ s._ramp=true; s._rate=1; last=s.start; } }); }
  if(short) segs.forEach(s=>{ s._amp=2.4; });
  // bookend: a long-form story ends on the place it began
  if(storyOn() && !short && segs.length>6){ const l=segs[segs.length-1], need=l.end-l.start+0.3;
    const cand=segs.slice(0,Math.max(1,Math.floor(segs.length*0.15))).find(f=>{ const c=S.clips[f.clip]; return c && (c.kind==="image"||c.dur>=need); }); // the opening shot, or the first establishing shot that is long enough
    if(cand){ const c=S.clips[cand.clip]; l._pre={clip:l.clip,src:l.src}; l.clip=cand.clip; l.src=c.kind==="image"?0:Math.max(0,Math.min(c.dur-need+0.2,cand.src+(cand.end-cand.start)+0.04)); l._bookend=true; } } // the place it began, a moment on
  assignTransitions(segs);
  segs.forEach((s,i)=>{ if(i===0||s._loop) s.tr={type:"cut",dur:0}; else if(short && s.tr) s.tr.dur=Math.min(s.tr.dur,0.25); });
  { const l=segs[segs.length-1]; if(l&&l._endInfo){ const EN=l._endInfo; if(EN.freezeAt!=null&&l.end-EN.freezeAt>0.1) l._freeze=l.end-EN.freezeAt; l._ramp=false; l._rev=false; l._endShot=true; } }
  applyRefrain(segs); advanceClips(segs); assignFocus(segs); assignReverse(segs,typeof short!=="undefined"?short:false); restrainMoves(segs); actionAlign(segs); assignCamera(segs,typeof short!=="undefined"?short:false);
  segs.forEach((s,i)=>{
    const c=S.clips[s.clip], smp=c&&c.samples?c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]):null;
    s._mN=c&&c.kind==="image"?0.35:smp?smp.mN||0:0.5; s._bN=smp?smp.bN||0.5:0.5;
    const raw=c&&c.kind!=="image"&&smp?smp.motion||0:null;
    /* only genuinely frozen video gets a virtual move; real footage is left to move by itself */
    if(raw!=null && raw<0.4 && s.end-s.start>0.5 && s._beat!=="reflect"){ const moves=["pan","tilt","pull","drift","push","handheld"]; s._move=moves[(i*5+Math.floor(s.start))%moves.length]; s._dir=i%2?1:-1; }
    if(i>0 && s.e<0.55 && s.tr && s.tr.type==="cut" && !s.drop && Math.abs(s._bN-segs[i-1]._bN)>0.55) s.tr={type:"crossfade",dur:Math.min(0.18,(s.end-s.start)*0.3)};
  });
  advanceClips(segs); // a last check once every shot is final: no stretch of footage is shown twice
  fitFootage(segs); // and no shot runs past the end of its clip
  return segs;
}

