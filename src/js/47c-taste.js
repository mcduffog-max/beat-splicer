/* ---------------- Your taste: blind comparisons that teach the app ----------------
   "Which is better?" builds two cuts of the same 20 seconds that differ only in how much a few of the app's judgements
   count (story, continuity, lyric matches, places, movement into the beat…). You watch both without knowing which is
   which and pick. Each pick moves the weights towards your choice (a Bradley–Terry preference model on what each cut
   scores for every judgement), so over time the edit follows your taste rather than my guesses. The AI reviewer can
   also judge a pair from contact sheets when you're busy; its picks count half. Every pick is kept, so the app can say
   how often the newly learned weights win. */
const TASTE_TERMS={q:"picture quality",cn:"movement flowing across cuts",se:"shots showing what's sung",st:"the story arc",mo:"the visual idea",ou:"the story outline",ly:"lyric matches",pl:"staying in a place",mc:"match cuts",rt:"what holds your viewers",om:"the returning image",nt:"your director's note",share:"fresh footage",rf:"your reference's liveliness"};
function tasteLoad(){ try{ const t=JSON.parse(localStorage.getItem("beatsplicerTaste")||"null"); if(t&&t.w) return t; }catch(e){} return {w:{},n:0,log:[]}; }
function tasteSave(t){ try{ t.log=t.log.slice(-200); localStorage.setItem("beatsplicerTaste",JSON.stringify(t)); }catch(e){} }
let TASTE=tasteLoad(), TASTE_OVR=null; // TASTE_OVR: weights in force while one side of a comparison is being built
function tw(k){ if(!has("taste")&&!TASTE_OVR) return 1; const w=TASTE_OVR||TASTE.w; return w[k]!=null?w[k]:1; }
function tasteSum(W){ let s=0; for(const k in TASTE_TERMS){ const v=W[k]; if(typeof v==="number"&&isFinite(v)) s+=tw(k)*v; } return s; }
/* what a cut scores for each judgement, per shot */
function planFeatures(plan,win){ const f={}, segs=plan.filter(s=>s._W&&(!win||s.end>win[0]&&s.start<win[1])); for(const k in TASTE_TERMS){ f[k]=segs.reduce((a,s)=>a+(+s._W[k]||0),0)/Math.max(1,segs.length); } return f; }
/* one pick: the winner's judgements count for more, the loser's for less */
function tasteUpdate(fWin,fLose,rate){ const w={...TASTE.w}; let d=0; for(const k in TASTE_TERMS) d+=(w[k]??1)*(fLose[k]-fWin[k]); const p=1/(1+Math.exp(-4*d)), g=(1-p)*rate;
  for(const k in TASTE_TERMS){ const x=(w[k]??1)+g*(fLose[k]-fWin[k])*3; w[k]=+Math.max(0.2,Math.min(3,x)).toFixed(3); } TASTE.w=w; TASTE.n++; }
function tasteSummary(){ const ch=Object.entries(TASTE.w).filter(([k,v])=>Math.abs(v-1)>=0.1&&TASTE_TERMS[k]).sort((a,b)=>Math.abs(b[1]-1)-Math.abs(a[1]-1)).slice(0,4);
  const L=TASTE.log.filter(x=>x.who==="you"&&x.pick!=="same"), wins=L.filter(x=>x.newer!=null&&x.pick===x.newer).length, withNew=L.filter(x=>x.newer!=null).length;
  if(!ch.length) return TASTE.n?`${TASTE.n} picks so far; no clear leaning yet.`:"No picks yet. Each pick teaches the app what you like.";
  return `${TASTE.n} picks. Learned so far: ${ch.map(([k,v])=>`${v>1?"more":"less"} weight on ${TASTE_TERMS[k]}`).join(", ")}.`+(withNew>=4?` The side closer to what you've taught wins ${Math.round(100*wins/withNew)}% of your picks.`:""); }
/* build one pair: the same cuts, different weights on two or three judgements */
async function makePair(){ const base={...TASTE.w}, keys=Object.keys(TASTE_TERMS).filter(k=>S.plan.some(s=>s._W&&Math.abs(+s._W[k]||0)>0.01)), r=Math.random;
  const pick=[]; while(pick.length<Math.min(3,keys.length)){ const k=keys[Math.floor(r()*keys.length)]; if(!pick.includes(k)) pick.push(k); }
  const dA={...base}, dB={...base}; pick.forEach(k=>{ const b=base[k]??1, s=r()<0.5?1:-1; dA[k]=Math.max(0.2,b*(1+0.6*s)); dB[k]=Math.max(0.2,b*(1-0.45*s)); });
  const seed=S.seed, ep=EP("shorts")||previewEp(), w0=windowFor(ep), win=[w0[0],Math.min(w0[1],w0[0]+20)], out=[];
  for(const w of [dA,dB]){ TASTE_OVR=w; try{ buildPlan(); }finally{ TASTE_OVR=null; } out.push({plan:S.plan.map(s=>({...s})),w}); await new Promise(r=>setTimeout(r,0)); }
  S.seed=seed; buildPlan(); const flip=r()<0.5, P=flip?[out[1],out[0]]:[out[0],out[1]];
  // which side leans the way earlier picks already pointed (to measure whether learning helps)
  const lean=x=>pick.reduce((a,k)=>a+Math.sign((base[k]??1)-1)*Math.sign(x.w[k]-(base[k]??1)),0), la=lean(P[0]), lb=lean(P[1]);
  return {A:P[0],B:P[1],win,keys:pick,newer:la>lb?"A":lb>la?"B":null}; }
let _pair=null;
async function comparePlay(side){ if(!_pair||S.running) { if(S.running) stopRun(); return; } const P=_pair[side].plan, cv=$("stage"); sizeStage(); cv.hidden=false; $("stageEmpty").hidden=true;
  const ep=previewEp(), o={ep:{...ep,w:cv.width,h:cv.height}, canvas:cv, g:cv.getContext("2d"), W:cv.width, H:cv.height}; status(`Playing cut ${side}…`);
  const keep=S.plan; S.plan=P; let plan; try{ plan=makeExportPlan(ep,_pair.win); }finally{ S.plan=keep; } await runPass([o],_pair.win,false,plan); status(`Cut ${side} played. Pick the one you prefer.`); }
async function compareStart(){ if(!S.plan||S.running) return; $("cmpBox").hidden=false; $("cmpMsg").textContent="Building two cuts of the same 20 seconds…"; ["cmpA","cmpB","cmpPickA","cmpPickB","cmpSame","cmpAI"].forEach(id=>$(id).disabled=true);
  _pair=await makePair(); ["cmpA","cmpB","cmpPickA","cmpPickB","cmpSame"].forEach(id=>$(id).disabled=false); $("cmpAI").disabled=false;
  $("cmpMsg").textContent=`Two cuts of ${fmtTime(_pair.win[0])}–${fmtTime(_pair.win[1])}. Play A and B (in either order), then pick. You won't be told which is which until after.`; }
function compareDecide(pick,who){ if(!_pair) return; const p=_pair, fA=planFeatures(p.A.plan,p.win), fB=planFeatures(p.B.plan,p.win);
  if(pick==="A") tasteUpdate(fA,fB,who==="ai"?0.25:0.5); else if(pick==="B") tasteUpdate(fB,fA,who==="ai"?0.25:0.5); else TASTE.n++;
  TASTE.log.push({at:Date.now(),pick,who,newer:p.newer,keys:p.keys,song:songTitle()}); tasteSave(TASTE);
  const told=p.keys.map(k=>{ const a=p.A.w[k], b=p.B.w[k]; return `${pick==="B"?"B":"A"} had ${((pick==="B"?b:a)>(pick==="B"?a:b))?"more":"less"} weight on ${TASTE_TERMS[k]}`; });
  _pair=null; buildPlan(); $("cmpMsg").textContent=(pick==="same"?"Noted: about the same. ":`Thanks. ${told.join("; ")}. `)+tasteSummary(); ["cmpA","cmpB","cmpPickA","cmpPickB","cmpSame","cmpAI"].forEach(id=>$(id).disabled=true); $("cmpAgain").hidden=false; }
/* the AI reviewer as a second judge: contact sheets of both cuts, one question */
async function sheetOf(plan,win){ const F=readFx(), ep=previewEp(), tw0=ep.w>=ep.h?240:135, th=Math.round(tw0*ep.h/ep.w), sh=document.createElement("canvas"); sh.width=tw0*4; sh.height=th*2; const g=sh.getContext("2d");
  const idx=plan.map((s,i)=>i).filter(i=>plan[i].end>win[0]&&plan[i].start<win[1]), keep=S.activePlan; S.activePlan=plan;
  try{ for(let k=0;k<8;k++){ const i=idx[Math.min(idx.length-1,Math.floor(k*idx.length/8))]; if(i==null) continue; const s=plan[i], c=document.createElement("canvas"); c.width=tw0; c.height=th;
      await renderStill({ep:{...ep,w:tw0,h:th},canvas:c,g:c.getContext("2d"),W:tw0,H:th},i,Math.max(win[0],s.start)+Math.min(0.5,(s.end-s.start)/2),F,false,plan); g.drawImage(c,(k%4)*tw0,Math.floor(k/4)*th); } }
  finally{ S.activePlan=keep; } return toJpeg(sh); }
async function compareAI(){ if(!_pair) return; let id=null; for(const k of Object.keys(PROVIDERS)) if(await providerReady(k).catch(()=>false)){ id=k; break; }
  if(!id){ $("cmpMsg").textContent="No AI reviewer is set up (see Review with AI). Pick yourself, or add a key there."; return; } $("cmpMsg").textContent="Asking the AI reviewer…";
  try{ const a=await sheetOf(_pair.A.plan,_pair.win), b=await sheetOf(_pair.B.plan,_pair.win), cut=P=>P.filter(s=>s.end>_pair.win[0]&&s.start<_pair.win[1]).map(s=>(s.end-s.start).toFixed(1)).join(", ");
    const prompt=`You are a music video editor judging two cuts of the same 20 seconds of "${songTitle()}". Image 1 is cut A, image 2 is cut B: eight moments in order, left to right, top to bottom. Shot lengths in seconds: A: ${cut(_pair.A.plan)}. B: ${cut(_pair.B.plan)}. Judge as an editor: does the sequence feel authored and original rather than generic, do shots follow on from each other (subject, scale, movement, colour), does it build, is any shot weak or repetitive? Reply with ONLY JSON: {"better":"A"|"B"|"same","why":"one sentence"}`;
    const j=await askAI(id,prompt,[a,b]), o=typeof j==="string"?parseLoose(j):j, pick=/^[AB]$/.test(o.better)?o.better:"same";
    const why=String(o.why||"").slice(0,200); compareDecide(pick,"ai"); $("cmpMsg").textContent=`${PROVIDERS[id].name} picked ${pick==="same"?"neither":pick}: ${why} `+tasteSummary(); }
  catch(e){ $("cmpMsg").textContent="The AI reviewer couldn't judge this pair: "+(aiErrorText?aiErrorText(e):(e&&e.message||e)); } }
$("cmpOpen").onclick=()=>{ if(needTier("taste")) compareStart(); }; $("cmpAgain").onclick=()=>{ $("cmpAgain").hidden=true; compareStart(); };
$("cmpA").onclick=()=>comparePlay("A"); $("cmpB").onclick=()=>comparePlay("B");
$("cmpPickA").onclick=()=>compareDecide("A","you"); $("cmpPickB").onclick=()=>compareDecide("B","you"); $("cmpSame").onclick=()=>compareDecide("same","you"); $("cmpAI").onclick=compareAI;
$("cmpReset").onclick=()=>{ TASTE={w:{},n:0,log:[]}; tasteSave(TASTE); buildPlan(); $("cmpMsg").textContent="Taste reset: every judgement counts equally again."; };
$("cmpClose").onclick=()=>{ $("cmpBox").hidden=true; _pair=null; };
