/* ---------------- Planning ---------------- */
function directedSegments(an,pace,dc){
  const B=an.beats, grid=[];
  if(dc.unit==="half"){ for(let i=0;i<B.length;i++){ grid.push(B[i]); if(i<B.length-1) grid.push((B[i]+B[i+1])/2); } }
  else if(dc.unit==="beat") grid.push(...B);
  else { const step=dc.unit==="bar"?4:16; B.forEach((b,i)=>{ if(((i-an.down)%step+step)%step===0) grid.push(b); }); }
  if(grid[0]>0.05) grid.unshift(0);
  const r=rng(S.seed*31+7), beatAt=t=>{ let k=0; while(k<B.length-1 && B[k+1]<=t) k++; return k; }, segs=[];
  let idx=0;
  while(idx<grid.length-1){
    const st=grid[idx], bi=beatAt(st), e=an.E[bi];
    const target=dc[secOf(e)]*feelK(an)*drive(an,bi,e)*(1+(r()*2-1)*dc.v)/pace;
    let j=idx+1; while(j<grid.length-1 && grid[j+1]-st<=target) j++;
    if(j<grid.length-1 && Math.abs(grid[j+1]-st-target)<Math.abs(grid[j]-st-target)) j++;
    const en=grid[j], b2=Math.max(bi+1,beatAt(en)); let se=0,sc=0,n=0; for(let k=bi;k<b2&&k<an.E.length;k++){ se+=an.E[k]; sc+=an.C[k]; n++; }
    segs.push({start:st,end:en,e:n?se/n:e,c:n?sc/n:0.5,down:isDownAt(an,bi) && Math.abs(B[bi]-st)<0.02});
    idx=j;
  }
  return segs;
}
function isDownAt(an,i){ if(an.feel&&an.feel.free) return !!(an.freeEvents&&an.freeEvents.has(i)); const M=an.meter||4; return ((i-an.down)%M+M)%M===0; }
/* how long shots should run for this kind of music, relative to the standard targets */
function feelK(an){ const f=an&&an.feel; if(!f) return 1; let k=1;
  if(f.free==="beatless") k*=2; else if(f.free==="rubato") k*=1.5;
  if(f.halftime) k*=1.2; if(f.meter===3) k*=1.15; if(f.swing>0.5) k*=1.08; if(f.four) k*=0.92; return k; }
/* Momentum: the loudest passages cut markedly faster than the quiet ones (a wider spread than a straight line from
   energy would give), and when the music is climbing over the next few bars, shots shorten ahead of the peak so the edit
   accelerates with it instead of catching up afterwards. */
function drive(an,i,e){
  const contrast=Math.pow(2,(0.5-e)*1.3);
  const E=an.E, n=8; let a=0,b=0,na=0,nb=0; for(let k=1;k<=n;k++){ if(E[i+k]!=null){ a+=E[i+k]; na++; } if(E[i-k]!=null){ b+=E[i-k]; nb++; } }
  const rise=(na&&nb)?a/na-b/nb:0, climb=rise>0.08?Math.max(0.6,1-(rise-0.08)*2):1;
  return contrast*climb;
}
function makeSegments(an,pace){
  const dc=dcut();
  if(dc){ const segs=directedSegments(an,pace,dc); if(segs.length){ segs[0].start=0; segs[segs.length-1].end=an.duration; return segs; } }
  const B=an.beats, segs=[], period=60/an.bpm, E=an.E;
  // music videos average about 2 s a shot: longer when it's quiet, around a second at full energy
  const target=e=>{ const pts=[[0,4.2],[0.2,3.8],[0.45,2.4],[0.7,1.5],[0.9,1.0],[1,0.95]]; for(let k=1;k<pts.length;k++) if(e<=pts[k][0]){ const [x0,y0]=pts[k-1],[x1,y1]=pts[k]; return y0+(y1-y0)*(e-x0)/(x1-x0); } return 0.95; };
  // drops: a downbeat where the energy jumps; the 2 bars before it are the build-up
  const isDown=i=>isDownAt(an,i), drops=new Set(), build=new Map();
  const R=an.Eraw||E; let lastDrop=-99;
  for(let i=4;i<B.length;i++){ if(!isDown(i) || i-lastDrop<16) continue;
    const before=(R[i-4]+R[i-3]+R[i-2]+R[i-1])/4, after=(R[i]+(R[i+1]??R[i])+(R[i+2]??R[i])+(R[i+3]??R[i]))/4;
    if(after-before>0.15 && E[i]>0.6){ drops.add(i); lastDrop=i; for(let k=1;k<=8;k++) if(i-k>=0 && !drops.has(i-k)) build.set(i-k,k); } }
  let i=0;
  while(i<B.length-1){
    const e=E[i], Dd=directOn(), dp=Dd?Dd[secOf(e)].p:1;
    let L;
    if(build.has(i)){ const k=build.get(i); L=k>4?4:k>2?2:1; L=Math.min(L,k); }   // 2 bars out: a bar, then half bars, then beats
    else { const allowed=(an.meter===3)?[1,2,3,6,9,12]:[1,2,3,4,6,8,12,16]; const want=target(e)*feelK(an)*drive(an,i,e)/(pace*dp)/period; L=allowed.reduce((a,b)=>Math.abs(b-want)<Math.abs(a-want)?b:a); }
    if(L*period<0.3) L=Math.ceil(0.3/period);
    let end=i+L;
    const M=an.meter||4;
    if(!an.feel?.free && L>=M && !build.has(i)){ const r=((end-an.down)%M+M)%M; if(r) end+= r<=M/4 ? -r : M-r; }
    if(an.feel?.free && an.freeEvents && an.freeEvents.size){ for(let d=0;d<=2;d++){ if(an.freeEvents.has(end+d)){ end+=d; break; } if(end-d>i && an.freeEvents.has(end-d)){ end-=d; break; } } } // free time: land cuts on the music's events
    for(let k=i+1;k<end;k++) if(drops.has(k)){ end=k; break; }                     // always cut exactly on the drop
    end=Math.min(Math.max(end,i+1),B.length-1);
    let se=0,sc=0; for(let k=i;k<end;k++){ se+=an.E[k]; sc+=an.C[k]; }
    segs.push({start:B[i], end:B[end], e:se/(end-i), c:sc/(end-i), down:isDown(i), drop:drops.has(i), build:build.has(i)});
    i=end;
  }
  if(!segs.length) segs.push({start:0,end:an.duration,e:0.5,c:0.5});
  segs[0].start=0; segs[segs.length-1].end=an.duration;
  return segs;
}

function noteUse(ctx,seg,clip,src){
  const nC=nFamilies(), win=Math.max(1,Math.min(6,nC-1));
  ctx.recent.push(clip); while(ctx.recent.length>win) ctx.recent.shift();
  if(seg._manual) seg._manual=seg._manual; // (manual shots still count toward variety)
  if(!ctx.usage.has(clip)) ctx.usage.set(clip,[]); ctx.usage.get(clip).push([src,src+(seg.end-seg.start)]);
  ctx.count=ctx.count||new Map(); ctx.count.set(clip,(ctx.count.get(clip)||0)+1); ctx.total=(ctx.total||0)+1;
  ctx.lastAt=ctx.lastAt||new Map(); ctx.lastAt.set(clip,seg.end);
  const f=famOf(clip); ctx.famCount=ctx.famCount||new Map(); ctx.famCount.set(f,(ctx.famCount.get(f)||0)+1); ctx.famLast=ctx.famLast||new Map(); ctx.famLast.set(f,seg.end); ctx.recentF=ctx.recent.map(famOf);
  const cs=S.clips[clip], smp=cs&&cs.samples&&cs.samples.reduce((a,x)=>Math.abs(x.t-src)<Math.abs(a.t-src)?x:a,cs.samples[0]); if(smp&&smp.col) ctx.prevCol=smp.col; ctx.prevSm=smp||null;
  ctx.lastSrc=ctx.lastSrc||new Map(); ctx.lastSrc.set(clip,src+(seg.end-seg.start)*(seg._rate||1));
}
/* Recency memory: what recent versions and exports used, fading with age. Most recent counts fully, four back about a tenth.
   Clips, the exact moments within them, and the opening shot are all remembered. */
function usageMem(){ try{ return JSON.parse(localStorage.getItem("beatsplicerUsage")||"[]"); }catch(e){ return []; } }
function recordUsage(plan){ if(!plan||!plan.length) return; try{
  const sig=plan.slice(0,10).map(s=>clipKey(s.clip)+"@"+Math.round(s.src)).join(","); const last=usageMem().slice(-1)[0]; if(last&&last.sig===sig) return; // same edit, already remembered
  const run={sig:plan.slice(0,10).map(s=>clipKey(s.clip)+"@"+Math.round(s.src)).join(","), t:Date.now(), clips:[...new Set(plan.map(s=>clipKey(s.clip)))], moments:plan.filter(s=>S.clips[s.clip]&&S.clips[s.clip].kind!=="image").map(s=>clipKey(s.clip)+"@"+Math.round(s.src)), opener:clipKey(plan[0].clip)};
  const m=usageMem(); m.push(run); localStorage.setItem("beatsplicerUsage",JSON.stringify(m.slice(-8))); S._fatigue=null; }catch(e){} }
function fatigue(){ if(S._fatigue) return S._fatigue; const m=usageMem(), clip=new Map(), mom=new Map(), open=new Map();
  const famByKey=new Map(); S.clips.forEach((c,i)=>{ if(c.fam) famByKey.set(clipKey(i),c.fam); }); const fam=new Map();
  m.forEach((r,i)=>{ const w=Math.pow(0.55,m.length-1-i); r.clips.forEach(k=>{ clip.set(k,(clip.get(k)||0)+w); const f=famByKey.get(k); if(f) fam.set(f,Math.max(fam.get(f)||0,(clip.get(k)||0))); }); (r.moments||[]).forEach(k=>mom.set(k,(mom.get(k)||0)+w)); if(r.opener) open.set(r.opener,(open.get(r.opener)||0)+w); });
  S._fatigue={clip,mom,open,fam}; return S._fatigue; }
function recentClipKeys(){ const s=new Set(); const add=p=>{ if(p&&p.shots) p.shots.forEach(x=>s.add(x.split("@")[0])); };
  if(S.versions&&S.versions.length){ const v=S.versions[Math.max(0,S.verIdx-0)]; if(S.verIdx>0) add(S.versions[S.verIdx-1].print); } loadHistory().slice(-2).forEach(add); return s; }
/* Shot quality, weighted by how much the moment matters: soft, shaky, badly exposed or blown-up footage
   is kept out of the loud passages, the drops and the choruses first. */
function shotImportance(seg){ let k=0.4; if(seg.e>0.7) k+=0.6; if(seg.drop) k+=0.6; try{ const AS=S.an&&S.an.sections; if(AS&&AS.some(x=>x.chorus&&seg.start>=x.t0-0.05&&seg.start<x.t1)) k+=0.6; }catch(e){} return k; }
function upscaleCost(clip){ const ep=EP(S.eps[0])||EP("shorts"); if(!ep||!clip.w||!clip.h) return 0; const cropW=Math.min(clip.w,clip.h*ep.w/ep.h), up=ep.w/Math.max(1,cropW); return up<=1.6?0:up<=2.4?0.2:up<=3.2?0.5:0.9; }
function qualityCost(seg,clip,s,ctx){ if(clip.kind==="image") return 0.4*upscaleCost(clip); const med=S._sharpMed; let p=0;
  const sr=med&&s.sharp>0?s.sharp/med:1; p+=2.5*Math.max(0,0.85-sr);                       // softer than most of the library
  if(s.bright<30) p+=0.4; else if(s.bright>225) p+=0.3;                                    // murky or washed out
  if((s.motion||0)>14&&sr<0.75) p+=0.4;                                                    // lots of movement and soft: camera shake or motion blur
  p+=upscaleCost(clip);                                                                     // blown up to fill the frame
  return shotImportance(seg)*p; }
/* Continuity: a cut flows when movement carries on in the same direction and the eye lands where it already was.
   At a drop or a new section the change itself is the point, so continuity isn't asked for there. */
function continuityCost(seg,s,ctx){ const p=ctx.prevSm; if(!p||seg.drop||seg._newSection||!p.fl||!s.fl) return 0; let c=0;
  const ma=Math.hypot(p.dx,p.dy), mb=Math.hypot(s.dx,s.dy);
  if(ma>0.02&&mb>0.02){ const cos=(p.dx*s.dx+p.dy*s.dy)/(ma*mb); c+=cos<-0.3?0.45:cos>0.5?-0.25:0; }   // pans that fight each other jar; matching movement flows
  c+=0.3*Math.min(1,Math.hypot((s.fx||0.5)-(p.fx||0.5),(s.fy||0.5)-(p.fy||0.5))*1.6)-0.1;        // the eye stays near where it was looking
  return c; }
/* Why a shot was chosen: the strongest few reasons, in words. A lyric or story match can be vetoed. */
function shotReasons(seg,pick){ const W=pick.why, out=[], c=S.clips[pick.clip], ln=S.lyrics?lyricAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)):null;
  if(W.se<-0.12&&ln) out.push({k:-W.se*2,t:`Shows what's sung: “${ln.text}”`,veto:"line",line:ln.text});
  else if(W.ly<-0.2&&ln) out.push({k:-W.ly*1.5,t:`Matches the words: “${ln.text}”`,veto:"line",line:ln.text});
  if(W.ou<-0.3){ const a=(actsFor([0,S.an.duration])||[]).find(x=>seg.start>=x.t0&&seg.start<x.t1), nm=a?(ACTS.find(x=>x[0]===a.key)||[])[1]:null; out.push({k:-W.ou,t:`Fits the story${nm?`: ${String(nm).split(": ").pop()}`:""}`,veto:"story"}); }
  if(W.st<-0.25) out.push({k:-W.st,t:"Right kind of shot for this point in the song"});
  if(shotImportance(seg)>=1&&W.q<0.15) out.push({k:0.6,t:"Sharp, full-quality footage for a key moment"});
  if(W.cn<-0.15) out.push({k:-W.cn,t:"Movement carries on from the shot before"});
  if(W.dcol!=null&&W.dcol<0.06) out.push({k:0.3,t:"Colours sit with the shot before"});
  if(seg.e>0.7&&pick.sm&&(pick.sm.motion||0)>6) out.push({k:0.4,t:"Lots of movement for a loud passage"});
  if(seg.drop) out.push({k:0.5,t:"Lands on the drop"});
  if(W.share<0.2) out.push({k:0.2,t:"Footage you haven't seen much yet"});
  if(!out.length) out.push({k:0.1,t:"Keeps the edit varied: this footage isn't used nearby"});
  return out.sort((a,b)=>b.k-a.k).slice(0,3); }
S.vetoes=S.vetoes||new Set();
function vetoCost(seg,ci){ if(!S.vetoes.size||!S.lyrics) return 0; const ln=lyricAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)); return ln&&S.vetoes.has(lyKey(ln.text)+"|"+clipKey(ci))?3:0; }
function chooseClip(seg, ctx, exclude){
  if(S._dry){ ctx._dryI=(ctx._dryI||0)+1; const ok=S.clips.map((c,i)=>i).filter(i=>S.clips[i].samples&&!S.clips[i].off&&i!==exclude&&!isExcluded(i)); const ci=ok[ctx._dryI%Math.max(1,ok.length)]??0; return {clip:ci,src:0}; }
  if(ctx.fresh===undefined) ctx.fresh=recentClipKeys();
  const D=seg.end-seg.start, mode=$("mode").value, variety=+$("variety").value;
  const nC=nFamilies(), fair=((ctx.total||0)+1)/nC; // variety counts look-alike families, not files
  const minGap=Math.min(20,Math.max(3,(S.an?S.an.duration:60)/nC*0.5)), jit=new Map();
  let best=null, bestCost=Infinity;
  S.clips.forEach((clip,ci)=>{
    if(!clip.samples || clip.off || ci===exclude || isExcluded(ci)) return;
    jit.set(ci,ctx.rand()); // one random draw per clip, so long clips with many start points don't win more often
    const fm=famOf(ci), cnt=Math.max((ctx.count&&ctx.count.get(ci))||0,(ctx.famCount&&ctx.famCount.get(fm))||0), la=Math.max((ctx.lastAt&&ctx.lastAt.get(ci))??-1e9,(ctx.famLast&&ctx.famLast.get(fm))??-1e9);
    let share=ctx.short ? 0.9*cnt : (storyOn()&&hasTags()?0.3:0.55)*Math.max(0,cnt+1-fair); // short-form: a fresh clip for every shot while there are fresh ones to use
    { const fz=fatigue(), fc=Math.max(fz.clip.get(clipKey(ci))||0,fz.fam.get(fm)||0); share+=0.55*Math.min(2,fc); }  // favour footage (and look-alikes) recent versions and exports didn't use                                  // keep every clip near its fair share
    if(la>-1e8){ const gap=seg.start-la; if(gap<minGap) share+=1.4*(1-Math.max(0,gap)/minGap); } // and spread its uses through the song
    const fits=clip.dur>=D+0.05;
    const nS=clip.samples.length, smp=S.clips.length>250&&nS>3?[clip.samples[0],clip.samples[nS>>1],clip.samples[nS-1]]:nS>6&&S.clips.length>120?clip.samples.filter((_,k)=>k%2===0||k===nS-1):clip.samples; // big libraries: a few well-spread moments per clip are plenty
    for(const s of smp){
      const start=fits?Math.min(Math.max(s.t,clip.kind==="image"?0:Math.min(0.25,clip.dur-D-0.05)),Math.max(0,clip.dur-D-0.35)):0;
      let cost=0;
      if(s.cut||s.dark) cost+=2.5;
      if(s.sharp!=null && S._sharpP20 && s.sharp<S._sharpP20*0.8) cost+=0.5;          // soft or blurred moments lose
      if(s.bright>235) cost+=0.3;                                                         // blown-out frames lose
      let dcol=null; if(s.col && ctx.prevCol && !seg.drop && !seg._newSection){ const dc=(Math.abs(s.col[0]-ctx.prevCol[0])+Math.abs(s.col[1]-ctx.prevCol[1])+Math.abs(s.col[2]-ctx.prevCol[2]))/765; dcol=dc; cost+=0.6*dc; } // neighbouring shots sit together in colour
      { const fz=fatigue(), mk=clipKey(ci)+"@"+Math.round(start); const fm=(fz.mom.get(mk)||0)+0.5*((fz.mom.get(clipKey(ci)+"@"+(Math.round(start)-1))||0)+(fz.mom.get(clipKey(ci)+"@"+(Math.round(start)+1))||0)); cost+=0.7*Math.min(2,fm); } // and a different moment of any clip that did feature
      if(clip.kind!=="image" && ctx.lastSrc && ctx.lastSrc.has(ci)){ // the next use of a clip carries on from where the last one ended
        const ls=ctx.lastSrc.get(ci), room=clip.dur-ls-0.3>=D;
        if(room){ if(start<ls-0.05) cost+=2.2; else if(start-ls<1.5) cost-=0.35; } else if(start<ls-0.05) cost+=0.6; }                                   // don't start on a source cut, flash or black frame
      if(clip.kind!=="image"){ for(const x of clip.samples) if((x.cut||x.dark) && x.t>start+0.1 && x.t<start+D-0.1){ cost+=1.5; break; } } // or run through one
      if(clip.wm&&clip.wm.length&&wmBlocked(clip,start,D)) cost+=6; // a watermark that can't be framed out: use other footage
      if(seg.e>0.7 && (clip.kind==="image" || s.mN<0.2)) cost+=0.35;  // loud moments want movement
      const W={q:qualityCost(seg,clip,s,ctx), cn:continuityCost(seg,s,ctx), se:seeCost(seg,s,ci), st:storyCost(seg,clip,ci,s,ctx), mo:motifCost(seg,clip,ci,s), ou:outlineCost(seg,clip,ci,s,ctx), ly:lyricCost(seg,clip,ci,s)+vetoCost(seg,ci), share, dcol};
      cost+=W.q+W.cn+W.se+W.share+W.st+W.mo+W.ou+W.ly;
      { const raw=clip.kind==="image"?0:(s.motion||0), still=Math.max(0,1-raw/1.2); // only genuinely still footage is penalised; any real motion is welcome
        if(ctx.short) cost+=1.6*still+(clip.kind==="image"?0.6+Math.max(0,D-1)*0.8:0);  // short-form lives on movement; a still never holds long
        else if(seg.e>0.6) cost+=0.5*still; }
      if(mode!=="beat") cost+=0.8*Math.abs(s.mN-seg.e);
      if(mode==="mood") cost+=0.7*Math.abs(s.bN-seg.c);
      if(!fits) cost+=2;
      const ri=Math.max(ctx.recent.lastIndexOf(ci),(ctx.recentF||[]).lastIndexOf(fm)); if(ri>=0){ const ago=ctx.recent.length-ri; cost+= ago<=1?3:1.8/ago; } // a look-alike of a recent shot counts as a repeat
      const used=ctx.usage.get(ci)||[];
      for(const [a,b] of used) if(start<b && start+D>a) cost+=0.8;
      cost+=jit.get(ci)*(mode==="beat"?1:Math.max(0.15,variety));
      if(!Number.isFinite(cost)) cost=50; // a broken score must never decide a shot (or knock every clip out)
      if(cost<bestCost){ bestCost=cost; best={clip:ci, src:start, why:W, sm:s}; }
    }
  });
  return best;
}

function buildPlan(){ refreshExclusion(); refreshFilter(); motifSetup(); setTimeout(wmCatchUp,0);
  if(!S.an || !S.clips.some(c=>c.samples)) { S.plan=null; drawTimeline(); renderStats(); updateButtons(); return; }
  normaliseClips();
  const segs=makeSegments(S.an,+$("pace").value); applyTrims(segs);
  const ctx={ recent:[], usage:new Map(), rand:rng(S.seed), order:filmOrder(), acts:actsFor([0,S.an.duration]) };
  annotateStory(segs);
  for(const seg of segs){
    const pick=chooseClip(seg,ctx,-1) || {clip:S.clips.findIndex(c=>c.samples), src:0};
    seg.clip=pick.clip; seg.src=pick.src; seg.why=pick.why?shotReasons(seg,pick):null;
    noteUse(ctx,seg,pick.clip,pick.src);
  }
  const dc=dcut();
  if(dc && dc.pattern) for(let i=2;i<segs.length;i++){ if(i%4<2) continue; const p=segs[i-2], c=S.clips[p.clip], D=segs[i].end-segs[i].start, next=p.src+(p.end-p.start);
    if(c && (c.kind==="image" || next+D<c.dur-0.05)){ segs[i].clip=p.clip; segs[i].src=c.kind==="image"?0:next; segs[i]._pattern=true; } }
  applyRefrain(segs); advanceClips(segs); assignFocus(segs); assignReverse(segs,typeof short!=="undefined"?short:false); actionAlign(segs); assignCamera(segs,typeof short!=="undefined"?short:false);
  applyLocks(segs); if(S.sel!=null && !segs[S.sel]) S.sel=null;
  S.plan=segs; assignTransitions(); clearTimeout(S._actT); S._actT=setTimeout(()=>measureAction().catch(()=>{}),3000); drawTimeline(); renderStats(); updateButtons(); saveProjectSoon(); if(S.sel!=null) showShot(S.sel);
}
/* A clip that comes back never shows the same frames twice: each return carries on forward from its last use, or,
   when the clip has no room left ahead, steps back before its first. Refrains and bookends return to the same clip and
   move on with it; only the Short's loop shot is meant to sit just before the opening. */
function advanceClips(plan){
  const used=new Map();
  for(const s of plan){ const c=S.clips[s.clip]; if(!c||c.kind==="image") continue; const D=(s.end-s.start)*(s._ramp?RAMP_SPAN:(s._rate||1)), room=Math.max(0,c.dur-0.15);
    const U=used.get(s.clip)||[]; const hit=(a)=>U.some(([x,y])=>Math.min(y,a+D)-Math.max(x,a)>0.04);
    if(U.length&&!s._loop&&!s._lock&&!s._manual&&hit(s.src)){
      const lastEnd=U[U.length-1][1], hi=Math.max(...U.map(u=>u[1])), lo=Math.min(...U.map(u=>u[0])); let pick=null;
      for(const a of [lastEnd+0.04, hi+0.04]) if(pick==null&&a+D<=room&&!hit(a)) pick=a;              // forward from where it was last seen
      if(pick==null&&lo-0.04-D>=0&&!hit(lo-0.04-D)) pick=lo-0.04-D;                                      // or back before where it was first seen
      if(pick==null){ const gaps=[]; let prev=0; [...U].sort((a,b)=>a[0]-b[0]).forEach(([x,y])=>{ if(x-prev>=D+0.08) gaps.push(prev+0.04); prev=Math.max(prev,y); }); if(room-prev>=D+0.04) gaps.push(prev+0.04); if(gaps.length) pick=gaps.reduce((a,g)=>Math.abs(g-lastEnd)<Math.abs(a-lastEnd)?g:a); } // or any stretch not yet shown
      if(pick==null&&!s._bookend&&room>D){ let best=null; const ov=a=>U.reduce((t,[x,y])=>t+Math.max(0,Math.min(y,a+D)-Math.max(x,a)),0);   // every moment already shown: the least-repeated stretch, never the same start
        for(let a=0;a+D<=room;a+=0.25){ const v=ov(a)+(U.some(([x])=>Math.abs(x-a)<0.3)?99:0)+Math.abs(a-lastEnd)*0.01; if(!best||v<best.v) best={a,v}; } if(best&&best.v<99) pick=best.a; }
      if(pick!=null) s.src=+pick.toFixed(3);
      else if(s._bookend&&s._pre){ s.clip=s._pre.clip; s.src=s._pre.src; s._bookend=false; const c2=S.clips[s.clip], U2=used.get(s.clip)||[]; used.set(s.clip,U2); U2.push([s.src,s.src+D]); continue; } } // no unseen footage left to return to: the closing shot stays as it was
    U.push([s.src,s.src+D]); used.set(s.clip,U); }
}
function filmOrder(){ const list=S.clips.map((c,i)=>({i,t:c.file&&c.file.lastModified||0,n:c.name})).filter(x=>S.clips[x.i].samples);
  list.sort((a,b)=>a.t-b.t||a.n.localeCompare(b.n,undefined,{numeric:true})); const m=new Map(); list.forEach((x,k)=>m.set(x.i,list.length>1?k/(list.length-1):0.5)); return m; }

/* Transition budget: most cuts in a music video are plain cuts; effects are saved for moments that earn them.
   Drops first, then section changes, then the landing after a build, then gentle dissolves in quiet passages. */
function budgetTransitions(plan){
  if(!plan||plan.length<4||S._transManual) return;
  const len=plan[plan.length-1].end-plan[0].start, short=len<70, free=S.an&&S.an.feel&&S.an.feel.free;
  const budget=Math.round((plan.length-1)*(free?0.6:short?0.25:0.15));
  const cand=[]; for(let i=1;i<plan.length;i++){ const s=plan[i], p=plan[i-1]; if(!s.tr||s.tr.type==="cut"||s.tr.dur===0&&s.tr.type!=="match") continue;
    const pr=(s.drop?4:0)+(p.build&&!s.build?3:0)+(secOf(p.e)!==secOf(s.e)?2:0)+(s.e<0.35&&(s.tr.type==="crossfade"||s.tr.type==="dip")?1:0);
    cand.push({i,pr}); }
  cand.sort((a,b)=>b.pr-a.pr||a.i-b.i);
  const keep=new Set(cand.slice(0,budget).map(x=>x.i));
  for(const {i} of cand) if(!keep.has(i)) plan[i].tr={type:"cut",dur:0};
  // the kept effect cuts in the energetic passages all use this video's signature transition; quiet dissolves stay as they are
  const sig=$("sigTrans")&&$("sigTrans").value; if(sig&&sig!=="mixed"&&!free){ const len=+$("trLen").value;
    for(const {i} of cand){ const s=plan[i]; if(!keep.has(i)||s.e<0.45||s.tr.type==="match") continue; s.tr={type:sig,dur:Math.min(sig==="dip"?len*1.2:len*0.7,0.45*(s.end-s.start))}; } }
}
function assignTransitions(plan){ plan=plan||S.plan; if(!plan) return; assignTransitionsRaw(plan); budgetTransitions(plan); }
function assignTransitionsRaw(plan){
  plan=plan||S.plan; if(!plan) return;
  const mode=$("trans").value, len=+$("trLen").value, r=rng(S.seed+7);
  plan.forEach((s,i)=>{
    if(i===0){ s.tr={type:"cut",dur:0}; return; }
    let type=mode, d=len;
    const Dd=directOn(); if(Dd && mode==="auto"){ const dt=Dd[secOf(s.e)].t; if(dt!=="auto"){ type=dt; d=len*(dt==="crossfade"||dt==="dip"?1.4:0.6); } }
    if(type==="auto" && S.an.feel && S.an.feel.free){ const x=r(); type=x<0.7?"crossfade":x<0.85?"dip":"cut"; d=len*(S.an.feel.free==="beatless"?2.2:1.5); s.tr={type,dur:type==="cut"?0:d}; return; }
    if(type==="auto"){
      const x=r(), e=s.e, prev=plan[i-1], newSection=prev && secOf(prev.e)!==secOf(e);
      if(s.drop){ type=prev&&prev.build?"zoomthru":"flash"; d=len*0.6; }                 // the build lands with a zoom-through
      else if(newSection && e<0.6){ type=x<0.35?"mask":x<0.65?"zoomout":"match"; d=type==="match"?0:len*0.9; } // new section: wipe, pull back or match cut
      else if(e>0.7){ type=s.down?(x<0.35?"flash":x<0.6?"zoom":x<0.8?"spin":"whip"):(x<0.75?"cut":"whip"); d=len*0.5; }
      else if(e>0.4){ type=x<0.5?"cut":x<0.75?"whip":"crossfade"; d=len*0.8; }
      else { type=x<0.65?"crossfade":"dip"; d=len*1.5; }
      const lastFancy=plan.slice(0,i).reverse().find(p=>p.tr&&p.tr.type!=="cut"); // never the same effect twice in a row
      if(lastFancy && lastFancy.tr.type===type && type!=="cut") type=e>0.5?"cut":"crossfade";
    }
    d=Math.min(d,0.45*(s.end-s.start));
    s.tr={type, dur:type==="cut"||type==="match"?0:d};
  });
}

