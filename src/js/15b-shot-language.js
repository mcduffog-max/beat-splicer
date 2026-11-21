/* ---------------- Shot language: ordering shots by what they show ----------------
   Once the app has learned what's in the clips (the picture-and-word model), it also knows:
     shot size   extreme wide to extreme close-up, for every moment, so the story arc (open wide, close in for the peaks,
                 pull back to finish) works without the AI review
     places      clips that show the same place are grouped, so within a section the edit stays somewhere for a few shots
                 (different angles, different moments) and a new section moves somewhere new, the way scenes are cut
   And from the picture's layout, for any library:
     match cuts  now and then the next shot is one whose shapes line up with where the last shot ended (a round sun into
                 a round wheel, a horizon into a horizon), at most one every eight seconds and never at a drop */
const SCALE_PROMPTS=["an extreme wide shot of a landscape","a wide shot showing a whole scene","a medium shot of a person from the waist up","a medium close-up of a person","a close-up of a face","an extreme close-up of a small detail"];
const FACE_PROMPTS=["a photo of a person's face","a photo with no people in it"];
function seeShotLanguageSaved(){ if(S._seeScale) return true; try{ const v=JSON.parse(localStorage.getItem("beatsplicerShotVecs")||"null"); if(v&&v.length===8){ S._seeScale=v.map(unpackVec); return true; } }catch(e){} return false; }
async function seeShotLanguage(){ if(!seeAvailable()||seeShotLanguageSaved()) return; try{ const v=await embedTexts(SCALE_PROMPTS.concat(FACE_PROMPTS)); S._seeScale=v; S._placeKey=null;
    try{ localStorage.setItem("beatsplicerShotVecs",JSON.stringify(v.map(packVec))); }catch(e){} }catch(e){} }
const softmax=a=>{ const m=Math.max(...a), e=a.map(x=>Math.exp(x-m)), s=e.reduce((x,y)=>x+y,0); return e.map(x=>x/s); };
/* a stand-in for the AI review's shot notes, read from the picture-and-word model */
function seeTagAt(clip,t){ const V=S._seeScale; if(!V||!clip||!clip.samples) return null; let s=null;
  for(const x of clip.samples) if(x.ce&&(!s||Math.abs(x.t-t)<Math.abs(s.t-t))) s=x; if(!s||Math.abs(s.t-t)>2.5) return null; if(s._stag) return s._stag;
  const v=sampleVec(s); if(!v) return null; const p=softmax(V.slice(0,6).map(q=>100*dotV(q,v))), scale=p.reduce((a,x,i)=>a+x*i,0);
  const near=(clip.faces||[]).filter(f=>Math.abs(f.t-s.t)<1.6), pf=softmax([100*dotV(V[6],v),100*dotV(V[7],v)])[0];
  const faces=clip.faces?near.length:(pf>0.6?1:0);
  return (s._stag={t:s.t, scale:+scale.toFixed(2), faces, inten:0, role:scale<=1.2?"establishing":"", fchars:[...new Set(near.filter(f=>f.id).map(f=>f.id))], see:true}); }
/* places: clips whose overall picture is close enough to be the same location */
function placeVec(c){ if(c._pv) return c._pv; const vs=(c.samples||[]).map(sampleVec).filter(Boolean); if(!vs.length) return null; const m=new Float32Array(vs[0].length); vs.forEach(v=>{ for(let i=0;i<m.length;i++) m[i]+=v[i]; }); return (c._pv=unitVec(m)); }
function places(){ if(S._placesGen&&S._placesGen===S._planGen) return S._places; S._placesGen=S._planGen; const ok=S.clips.filter(c=>c.samples&&!c.off), withV=ok.filter(c=>placeVec(c)), key=withV.length+":"+S.clips.length;
  if(S._placeKey===key) return S._places; S._placeKey=key; S._places=null; S.clips.forEach(c=>{ c._place=null; });
  if(withV.length<Math.max(4,ok.length*0.6)) return null;
  const r=rng(11), sims=[]; for(let k=0;k<Math.min(6000,withV.length*withV.length);k++){ const a=withV[Math.floor(r()*withV.length)], b=withV[Math.floor(r()*withV.length)]; if(a!==b) sims.push(dotV(a._pv,b._pv)); }
  sims.sort((x,y)=>x-y); const th=Math.max(0.8,Math.min(0.92,sims[Math.floor(sims.length*0.85)]||0.85)); // the closest seventh of pairs, within sensible bounds
  const P=[]; withV.forEach(c=>{ let best=-1, bs=th; P.forEach((p,i)=>{ const d=dotV(p.v,c._pv); if(d>=bs){ bs=d; best=i; } });
    if(best<0){ P.push({v:Float32Array.from(c._pv),n:1}); c._place=P.length-1; } else { const p=P[best]; for(let i=0;i<p.v.length;i++) p.v[i]=(p.v[i]*p.n+c._pv[i])/(p.n+1); p.v=unitVec(p.v); p.n++; c._place=best; } });
  return (S._places={n:P.length,th}); }
function secIdx(t){ const AS=S.an&&S.an.sections; if(!AS||!AS.length) return Math.floor(t/20); const i=AS.findIndex(x=>t>=x.t0&&t<x.t1); return i<0?AS.length:i; }
/* stay in a place for a few shots within a section; move somewhere new when the section changes */
function placeCost(seg,ci,ctx){ if(!places()) return 0; const p=S.clips[ci]._place; if(p==null||ctx.plPlace==null) return 0;
  const same=p===ctx.plPlace; if(secIdx(seg.start)!==ctx.plSec) return same?0.18:-0.05;
  return same?(ctx.plRun>=4?0.12:-0.3):(ctx.plRun<2?0.15:0); }
function fpAt(c,t){ const F=c.fp; if(!F||!F.length) return null; if(F.length<3||!c.samples||c.samples.length<3) return F[0]; const n=c.samples.length, T=[c.samples[0].t,c.samples[n>>1].t,c.samples[n-1].t];
  let k=0; for(let i=1;i<3;i++) if(Math.abs(T[i]-t)<Math.abs(T[k]-t)) k=i; return Math.abs(T[k]-t)<2.5?F[k]:null; }
function hashSim(a,b){ if(!a||!b||a.length!==b.length) return 0; let s=0; for(let i=0;i<a.length;i++) if(a[i]===b[i]) s++; return s/a.length; }
/* a different shot whose shapes line up with where the last one ended */
function matchCutCost(seg,clip,ci,start,ctx){ if(!ctx.prevFp||seg.drop||seg.build||!optV("matchCuts")) return 0; if(ctx.lastMatch!=null&&seg.start-ctx.lastMatch<8) return 0;
  if(famOf(ci)===ctx.prevFam) return 0; const fp=fpAt(clip,start); if(!fp) return 0; const sim=hashSim(fp.hash,ctx.prevFp.hash); if(sim<0.8) return 0;
  return -0.15-0.4*(sim-0.8)/0.2; }
function shotLangNote(ctx,seg,clip,src){ const c=S.clips[clip]; if(!c) return; const sec=secIdx(seg.start);
  if(sec!==ctx.plSec){ ctx.plSec=sec; ctx.plRun=0; } if(c._place!=null&&c._place===ctx.plPlace) ctx.plRun++; else { ctx.plPlace=c._place; ctx.plRun=1; }
  ctx.prevFam=famOf(clip); ctx.prevFp=c.kind==="image"?(c.fp&&c.fp[0]):fpAt(c,src+(seg.end-seg.start)*(seg._rate||1)); if(seg._mcut) ctx.lastMatch=seg.start; }
