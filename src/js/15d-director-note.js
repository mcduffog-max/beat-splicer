/* ---------------- The director's note ----------------
   One line from you before the edit: "lonely at first, turns hopeful at the last chorus", "the city at night through a
   passenger window". The note is split into phases ("then", "turns", "becomes", "until", ";", "→"); each phase covers
   its share of the song, or the choruses / the end when it names them. Words with a clear visual meaning steer
   brightness, warmth and movement for that stretch (lonely, hopeful, night, golden, wild, still…). With the
   picture-and-word model, the phase itself is compared with every moment of footage, so "passenger window" finds
   passenger windows. The note also leans Do everything's rhythm and camera energy. */
const NOTE_WORDS=[
  [/lonel|alone|empty|isolat|distant|cold|grey|gray|bleak/,{b:0.32,w:-0.5,m:0.25,pace:"spacious",en:"gentle"}],
  [/sad|melanchol|grief|mourn|lost|regret|blue\b/,{b:0.3,w:-0.3,m:0.2,pace:"spacious",en:"gentle"}],
  [/hope|light|bright|open|free|joy|happy|uplift|sun/,{b:0.75,w:0.4,m:0.6}],
  [/warm|golden|sunset|summer|glow|nostalg/,{w:0.7,b:0.6}],
  [/night|dark|neon|midnight|shadow/,{b:0.18,m:0.45}],
  [/wild|chaos|frantic|rush|energy|party|riot|explod/,{m:0.95,b:0.6,pace:"tight",en:"bold"}],
  [/calm|still|quiet|peace|gentle|slow|drift|dream|float/,{m:0.15,pace:"spacious",en:"gentle"}],
  [/tense|anx|uneasy|dread|claustro/,{b:0.3,m:0.55,w:-0.2,pace:"tight"}],
  [/love|tender|intimate|close/,{w:0.4,b:0.5,m:0.35}],
];
function noteText(){ return ($("dirNote")&&$("dirNote").value||"").trim(); }
function noteAttrs(t){ const a={}; NOTE_WORDS.forEach(([re,v])=>{ if(re.test(t.toLowerCase())) Object.entries(v).forEach(([k,x])=>{ if(a[k]==null) a[k]=x; }); }); return a; }
function notePhases(){ const t=noteText(); if(!t) return []; if(S._notePh&&S._notePh.t===t) return S._notePh.ph;
  const parts=t.split(/\s*(?:;|→|->|\bthen\b|\bturns?\b|\bbecomes?\b|\buntil\b|\bbut\b)\s*/i).map(x=>x.replace(/^[,.\s]+|[,.\s]+$/g,"")).filter(x=>x.length>1);
  const n=parts.length, ph=parts.map((p,k)=>({text:p, a:noteAttrs(p), r0:k/n, r1:(k+1)/n, chorus:/chorus/i.test(p), last:/\b(last|final|end)\b/i.test(p)}));
  S._notePh={t,ph,vec:null}; noteVectors(); return ph; }
function notePhaseAt(t){ const ph=notePhases(); if(!ph.length||!S.an) return null; const rel=t/(S.an.duration||1), AS=S.an.sections||[], inCh=AS.some(x=>x.chorus&&t>=x.t0&&t<x.t1);
  const lastCh=AS.filter(x=>x.chorus).slice(-1)[0];
  for(const p of ph){ if(p.chorus&&p.last){ if(lastCh&&t>=lastCh.t0) return p; continue; } if(p.chorus){ if(inCh) return p; continue; } }
  return ph.filter(p=>!p.chorus).find(p=>rel>=p.r0&&rel<p.r1)||ph.filter(p=>!p.chorus).slice(-1)[0]||null; }
/* with the picture-and-word model: each phase described the same way as the footage */
async function noteVectors(){ const N=S._notePh; if(!N||N.vec||!seeAvailable()||!S.clips.some(c=>c.samples&&c.samples.some(s=>s.ce))) return;
  try{ const vs=await embedTexts(N.ph.map(p=>p.text)); const all=[]; S.clips.forEach(c=>(c.samples||[]).forEach(s=>{ const v=sampleVec(s); if(v) all.push(v); })); if(!all.length) return;
    N.vec=vs.map(q=>{ let m=0,m2=0; for(const v of all){ const d=dotV(q,v); m+=d; m2+=d*d; } m/=all.length; return {q,m,sd:Math.sqrt(Math.max(1e-6,m2/all.length-m*m))}; });
    if(S._notePh===N&&!S.running) buildPlan(); }catch(e){} }
function noteCost(seg,clip,s){ const p=notePhaseAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)); if(!p) return 0; let c=0; const a=p.a;
  if(a.b!=null&&s.bN!=null) c+=0.6*Math.abs(s.bN-a.b);
  if(a.m!=null) c+=0.5*Math.abs((clip.kind==="image"?0.1:(s.mN||0))-a.m);
  if(a.w!=null&&s.col){ const w=Math.max(-1,Math.min(1,(s.col[0]-s.col[2])/90)); c+=0.35*Math.abs(w-a.w); }
  const N=S._notePh, k=N&&N.vec?N.ph.indexOf(p):-1, v=k>=0?sampleVec(s):null; if(v){ const L=N.vec[k], z=(dotV(L.q,v)-L.m)/L.sd; c-=0.5*Math.max(0,Math.min(3,z-0.5)); }
  return c-0.35; } // centred so a good fit reads as a reason
function noteBias(){ const ph=notePhases(); if(!ph.length) return {}; const o={}, cnt={}; ph.forEach(p=>{ ["pace","en"].forEach(k=>{ if(p.a[k]){ cnt[k+p.a[k]]=(cnt[k+p.a[k]]||0)+1; if(!o[k]||cnt[k+p.a[k]]>cnt[k+o[k]]) o[k]=p.a[k]; } }); }); return o; }
