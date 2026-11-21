/* ---------------- A motif from your own footage ----------------
   Editors make a video feel authored by letting one image come back: planted early, returning changed in the middle,
   closing the film. The app looks for an image that recurs naturally across your clips: the same kind of thing (a road,
   a window, hands, the sea) in at least three different clips. With the picture-and-word model it compares what the
   moments show; without it, it compares their composition. Its moments are saved for three places: near the start,
   past the middle, and the final shot. Elsewhere they're used sparingly, so the return means something. */
function motifMoments(){ const key=S.clips.length+":"+seeCount()[0]; if(S._ownMotif&&S._ownMotif.key===key) return S._ownMotif;
  const pts=[]; S.clips.forEach((c,ci)=>{ if(!c.samples||c.off||isExcluded(ci)) return; c.samples.forEach(s=>{ if(s.cut||s.dark) return; const v=sampleVec(s); pts.push({ci,s,v,f:famOf(ci)}); }); });
  const withV=pts.filter(p=>p.v), useV=withV.length>=Math.max(12,pts.length*0.6); let cand=useV?withV:pts.map(p=>({...p,fp:fpAt(S.clips[p.ci],p.s.t)})).filter(p=>p.fp);
  { const r0=rng(23); if(cand.length>1500) cand=cand.filter(()=>r0()<1500/cand.length); } // big libraries: a fair sample is plenty
  const sim=useV?(a,b)=>dotV(a.v,b.v):(a,b)=>hashSim(a.fp.hash,b.fp.hash)*0.6+0.4*(1-gridDist(a.fp.grid,b.fp.grid)), thr=useV?0.86:0.8;
  let best=null; const r=rng(17), probe=cand.length>150?[...Array(150)].map(()=>cand[Math.floor(r()*cand.length)]):cand;
  for(const p of probe){ const mem=cand.filter(q=>q.ci!==p.ci&&sim(p,q)>=thr), fams=new Set([p.f,...mem.map(q=>q.f)]); if(fams.size<3) continue;
    const byClip=new Map(); [p,...mem].forEach(q=>{ const o=byClip.get(q.ci); if(!o||(q.s.mN||0)>(o.s.mN||0)) byClip.set(q.ci,q); }); // one moment per clip, the liveliest
    const score=Math.min(fams.size,6)-0.2*Math.max(0,fams.size-6)+0.3*[...byClip.values()].reduce((a,q)=>a+(q.s.mN||0),0); if(!best||score>best.score) best={score,members:[...byClip.values()],fams:fams.size}; }
  const out={key, ok:!!best&&best.fams>=3, set:new Map(), by:useV?"what they show":"composition"};
  if(out.ok){ best.members.sort((a,b)=>(b.s.mN||0)-(a.s.mN||0)).slice(0,8).forEach(q=>{ if(!out.set.has(q.ci)) out.set.set(q.ci,[]); out.set.get(q.ci).push(q.s.t); }); }
  return (S._ownMotif=out); }
function gridDist(a,b){ if(!a||!b||a.length!==b.length) return 1; let d=0; for(let i=0;i<a.length;i++) d+=Math.abs(a[i]-b[i]); return d/(a.length*255); }
/* the three places: the first verse, past the middle, the last shot */
function markMotifSlots(segs,short){ segs.forEach(s=>{ s._motifSlot=0; }); if(!has("motif")) return; if(!$("ownMotif")||!$("ownMotif").checked||segs.length<8) return; const M=motifMoments(); if(!M.ok) return;
  const T=segs[segs.length-1].end, near=rel=>{ let k=-1,bd=1e9; segs.forEach((s,i)=>{ if(s.drop||s.build||s._take) return; const d=Math.abs((s.start+s.end)/2-rel*T); if(d<bd){ bd=d; k=i; } }); return k; };
  const a=near(0.1), b=near(0.62), c=segs.length-1; [[a,1],[b,2],[c,3]].forEach(([i,n])=>{ if(i>=0&&!segs[i]._motifSlot) segs[i]._motifSlot=n; }); }
function ownMotifCost(seg,ci,s){ const M=S._ownMotif; if(!has("motif")) return 0; if(!M||!M.ok||!optV("ownMotif")) return 0; const ts=M.set.get(ci); const hit=ts&&ts.some(t=>Math.abs(t-s.t)<1.6);
  if(seg._motifSlot) return hit?-2.4:0; return hit?0.7:0; }
