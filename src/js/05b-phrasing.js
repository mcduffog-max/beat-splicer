/* ---------------- Phrasing: cutting like an editor, not a metronome ----------------
   Cutting on every beat is what gives an auto-edit away. After the beat grid is laid out, the rhythm is reshaped:
     vocal entries   a cut moves to the moment the singer comes in (often just before the bar), so pictures follow the voice
     off-beat cuts   now and then in a driving passage, a cut lands on the "and" where the music itself hits there
     long takes      one or two places where the song breathes (steady, moderate, not a chorus) hold a single shot for a couple of bars
     the held breath the shot before the biggest drop stops moving for a moment, so the drop lands harder
   All of it leaves drops exactly on the drop, and nothing gets shorter than 0.4 s. */
function beatIdx(B,t){ let lo=0,hi=B.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(B[m]<=t+1e-6) lo=m; else hi=m-1; } return lo; }
function phraseShape(segs,an){ if(!segs||segs.length<3||!$("phrasing")||!$("phrasing").checked||an.feel&&an.feel.free) return segs;
  const B=an.beats, P=60/(an.bpm||120), M=an.meter||4, H=an.halfHit||[], sw=an.swing||0.5, AS=an.sections||[], minL=0.4;
  const chorusAt=t=>AS.some(x=>x.chorus&&t>=x.t0&&t<x.t1);
  // 1. vocal entries
  if(S.lyrics&&S.lyrics.lines&&S.lyrics.lines.length) for(const ln of S.lyrics.lines){ const t=ln.t; if(!(t>0.5)) continue;
    let k=-1, bd=1e9; for(let j=1;j<segs.length;j++){ const d=Math.abs(segs[j].start-t); if(d<bd){ bd=d; k=j; } }
    if(k>=1&&bd<0.06) continue;
    if(k<1||bd>Math.min(0.6,P*1.1)){ const j=segs.findIndex(s=>s.start<t&&s.end>t); const s=segs[j]; // no cut nearby: a long shot splits where the voice enters
      if(s&&!s.drop&&!s.build&&!s._split2&&t-s.start>=0.7&&s.end-t>=0.7){ const n={...s,start:t,drop:false,down:false,_vocal:true,_split2:true}; s.end=t; s._split2=true; segs.splice(j+1,0,n); } continue; }
    const a=segs[k-1], b=segs[k]; if(b.drop||b.build||a._vocal&&Math.abs(a.start-t)<0.5) continue;
    if(t-a.start<minL||b.end-t<minL) continue; a.end=t; b.start=t; b._vocal=true; }
  // 2. off-beat cuts where the music hits on the "and"
  let lastSync=-99;
  for(let j=1;j<segs.length;j++){ const a=segs[j-1], b=segs[j]; if(b.drop||b.build||b._vocal||b.e<0.55||b.start-lastSync<refSyncGap()) continue;
    const i=beatIdx(B,b.start); if(i<1||Math.abs(B[i]-b.start)>0.03) continue; const h=H[i-1]||0; if(h<(refSyncGap()<=7?0.9:1.15)) continue;
    const t=B[i-1]+sw*(B[i]-B[i-1]); if(t-a.start<minL||b.end-t<minL) continue; a.end=t; b.start=t; b._sync=true; lastSync=t; }
  // 3. long takes where the song breathes
  const dur=an.duration||B[B.length-1]||1, want=refTakes(dur)??(dur>=150?2:1), cands=[]; let takeLen=2*M*P; if(takeLen<3.5) takeLen*=2; takeLen=Math.min(6.5,takeLen);
  for(let j=0;j<segs.length;j++){ const s0=segs[j]; if(s0.start<8||chorusAt(s0.start)) continue; let k=j, end=s0.start;
    while(k<segs.length&&end-s0.start<takeLen-0.05){ end=segs[k].end; k++; } if(end-s0.start<takeLen*0.8||end-s0.start>takeLen*1.35) continue;
    const run=segs.slice(j,k); if(run.some(s=>s.drop||s.build||s._vocal&&s!==s0||chorusAt(s.start))) continue;
    const i0=beatIdx(B,s0.start), i1=beatIdx(B,end); const Es=an.E.slice(i0,Math.max(i0+1,i1)), m=Es.reduce((x,y)=>x+y,0)/Es.length, v=Es.reduce((x,y)=>x+(y-m)**2,0)/Es.length;
    const hh=H.slice(i0,i1).reduce((x,y)=>x+y,0)/Math.max(1,i1-i0); if(m<0.18||m>0.68) continue;
    cands.push({j,k,score:Math.sqrt(v)*3+hh*0.6+Math.abs(m-0.42)}); }
  cands.sort((x,y)=>x.score-y.score); const picks=[];
  for(const c of cands){ if(picks.length>=want) break; if(picks.some(p=>Math.abs(segs[p.j].start-segs[c.j].start)<60||!(c.k<=p.j||c.j>=p.k))) continue; picks.push(c); }
  picks.sort((x,y)=>y.j-x.j).forEach(c=>{ const run=segs.slice(c.j,c.k), D=run[run.length-1].end-run[0].start;
    const m={...run[0], end:run[run.length-1].end, e:run.reduce((x,s)=>x+s.e*(s.end-s.start),0)/D, c:run.reduce((x,s)=>x+(s.c||0)*(s.end-s.start),0)/D, _take:true, _vocal:run[0]._vocal, _sync:run[0]._sync};
    segs.splice(c.j,c.k-c.j,m); });
  // 4. the held breath before the biggest drop
  let best=null; segs.forEach((s,j)=>{ if(!s.drop||j<1) return; const i=beatIdx(B,s.start), R=an.Eraw||an.E, jump=(R[i]+(R[i+1]??R[i]))/2-((R[i-2]??R[i])+(R[i-1]??R[i]))/2; if(!best||jump>best.jump) best={j,jump}; });
  if(best){ if(best.j>=2&&segs[best.j-1].build&&segs[best.j-2].build&&segs[best.j-1].end-segs[best.j-2].start<1.6){ segs[best.j-2].end=segs[best.j-1].end; segs.splice(best.j-1,1); best.j--; } // the last chop of the build becomes one held shot
    const a=segs[best.j-1], D=a.end-a.start; if(D>=0.5){ a._freeze=+Math.min(0.5,Math.max(0.25,D*0.45)).toFixed(2); a._breath=true; } }
  return segs; }
function phraseReason(seg){ return seg._take?"A long take: the song breathes here":seg._breath?"Holds still for a breath before the drop":seg._vocal?"Cut where the singer comes in":seg._sync?"Cut on the off-beat, where the music hits":null; }
