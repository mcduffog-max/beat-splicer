/* ---------------- Restraint: one bold move, spent where it counts ----------------
   Effects mean something when they're rare. With "Restraint" on its default, a video gets one bold moment (two in a
   long video): the showiest transitions (whip, zoom, zoom-through, spin, wipe, flash), speed ramps and rewinds are kept
   only at the most important moments (the biggest drop first, then chorus entries), at least 20 s apart, and everything
   else is a clean cut, with a few quiet dissolves where the song is soft. "A few" allows about one every 40 s;
   "Anything goes" is the old behaviour. */
const BOLD_TR=["whip","zoom","zoomout","zoomthru","spin","mask","flash"];
function restraint(){ const v=$("restraint")?$("restraint").value:"one"; return v; }
function restraintBudget(len,n){ const v=restraint(); if(v==="any") return null;
  return v==="few"?{bold:Math.max(2,Math.round(len/40)),soft:Math.round(n*0.1),moves:2}:{bold:len>120?2:1,soft:Math.max(1,Math.round(n*0.06)),moves:1}; }
function momentRank(plan,i){ const s=plan[i], p=plan[i-1]||{}; return (s.drop?6:0)+(p.build&&!s.build?3:0)+(s._entry||s._chorusLead?2:0)+(p._breath?3:0)+(s.e||0); }
function restrainTransitions(plan,kept){ plan.forEach(s=>{ s._bold=false; }); if(S._transManual||S.an&&S.an.feel&&S.an.feel.free) return; const len=plan[plan.length-1].end-plan[0].start, B=restraintBudget(len,plan.length); if(!B) return;
  const bold=kept.filter(c=>BOLD_TR.includes(plan[c.i].tr.type)).map(c=>({...c,r:momentRank(plan,c.i)})).sort((a,b)=>b.r-a.r), keepB=[];
  for(const c of bold){ if(keepB.length>=B.bold) break; if(keepB.some(k=>Math.abs(plan[k.i].start-plan[c.i].start)<20)) continue; keepB.push(c); }
  bold.forEach(c=>{ if(!keepB.includes(c)) plan[c.i].tr={type:"cut",dur:0}; }); keepB.forEach(c=>{ plan[c.i]._bold=true; });
  const soft=kept.filter(c=>["crossfade","dip"].includes(plan[c.i].tr.type)).sort((a,b)=>(plan[a.i].e||0)-(plan[b.i].e||0)); // the quietest dissolves stay
  soft.forEach((c,k)=>{ if(k>=B.soft) plan[c.i].tr={type:"cut",dur:0}; }); }
/* speed ramps and rewinds: the same budget, kept at the biggest moments */
function restrainMoves(plan){ if(!plan||!plan.length) return; const len=plan[plan.length-1].end-plan[0].start, B=restraintBudget(len,plan.length); if(!B) return;
  const pick=(flag,undo)=>{ const c=plan.map((s,i)=>({s,i})).filter(x=>x.s[flag]).map(x=>({...x,r:momentRank(plan,Math.min(plan.length-1,x.i+1))+(plan[x.i].e||0)})).sort((a,b)=>b.r-a.r);
    c.forEach((x,k)=>{ if(k>=B.moves) undo(x.s); }); };
  pick("_ramp",s=>{ s._ramp=false; s._rate=1; }); pick("_rev",s=>{ s._rev=false; }); }
