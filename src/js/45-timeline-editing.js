/* ---------------- Timeline editing: trim, swap, scrub, zoom, and one undo history for everything ---------------- */
const fmtTenth=t=>`${Math.floor(t/60)}:${(Math.floor(t%60*10)/10).toFixed(1).padStart(4,"0")}`;
S.trims=S.trims||[]; S.hist=[]; S.fut=[]; S.tlZoom=1; S.drag=null; S.scrubT=null;
function applyTrims(segs){ if(!S.trims||!S.trims.length) return; for(const tr of S.trims){ const i=segs.findIndex((s,k)=>k>0&&Math.abs(s.start-tr.from)<0.03); if(i<1) continue;
    const a=segs[i-1], b=segs[i], to=Math.max(a.start+0.2,Math.min(b.end-0.2,tr.to)); a.end=to; b.start=to; } }
function planState(){ return {style:S.style?{...S.style}:null,snap:snapshot(), plan:S.plan?S.plan.map(s=>({start:s.start,end:s.end,clip:s.clip,src:s.src,_manual:s._manual,_lock:s._lock,_rev:s._rev,_manualRev:s._manualRev})):null, locks:[...(S.locks||new Map())], trims:(S.trims||[]).map(x=>({...x}))}; }
function histButtons(){ $("undoBtn").disabled=!S.hist.length; $("redoBtn").disabled=!S.fut.length; const u=$("shotUndo"); if(u) u.disabled=!S.hist.length; }
function pushUndo(st){ S.hist.push(st||planState()); if(S.hist.length>60) S.hist.shift(); S.fut=[]; S._lastPush=performance.now(); histButtons(); }
function applyState(st){ S._undoing=true; try{ S.locks=new Map(st.locks); S.trims=st.trims.map(x=>({...x})); restore(st.snap);
    if(st.plan&&S.plan&&st.plan.length===S.plan.length) st.plan.forEach((x,k)=>Object.assign(S.plan[k],x)); }
  finally{ S._undoing=false; } if(st.style){ S.style={...st.style}; renderStyleState(); } S._cur=planState(); S._curJ=JSON.stringify(S._cur.snap); if(S.sel!=null&&S.plan&&S.plan[S.sel]) showShot(S.sel); drawTimeline(); renderStats&&renderStats(); saveProjectSoon(); histButtons(); }
function undo(){ if(!S.hist.length||S.running) return; S.fut.push(planState()); applyState(S.hist.pop()); status("Undone."); }
function redo(){ if(!S.fut.length||S.running) return; S.hist.push(planState()); applyState(S.fut.pop()); status("Redone."); }
/* settings changes, remixes and Do everything become undo steps too: the state before a burst of changes is kept */
{ const _bp=buildPlan; buildPlan=function(){ if(S._hold) return; const r=_bp.apply(this,arguments);
    if(!S._dry&&!S._undoing&&!S._auto&&S.plan&&!S.running){ const j=JSON.stringify(snapshot());
      if(S._cur&&S._curJ!==j&&(performance.now()-(S._lastPush||0))>1200) pushUndo(S._cur);
      if(S._curJ!==j||!S._cur||!S._cur.plan||S._cur.plan.length!==S.plan.length){ S._cur=planState(); S._curJ=j; } }
    return r; }; }
function markEdited(){ S._cur=planState(); S._curJ=JSON.stringify(S._cur.snap); saveProjectSoon(); }
/* geometry */
function tlGeo(e){ const cv=$("timeline"), r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, dur=S.an.duration, W=r.width; return {x,y,t:Math.max(0,Math.min(dur,x/W*dur)),pxs:W/dur}; }
function snapBeat(t){ const B=S.an.beats; let best=t,bd=1e9; for(let i=0;i<B.length;i++){ const c=[B[i],B[i+1]!=null?(B[i]+B[i+1])/2:null]; for(const v of c){ if(v==null) continue; const d=Math.abs(v-t); if(d<bd){ bd=d; best=v; } } if(B[i]>t+2) break; } return best; }
/* scrub: draw the edit at a moment into the preview */
let _stillBusy=false, _stillNext=null;
async function showFrameAt(t){ if(S.running||!S.plan) return; S.scrubT=t; drawTimeline(); if(_stillBusy){ _stillNext=t; return; } _stillBusy=true;
  try{ const ep=previewEp(), w=windowFor(ep), tt=Math.max(w[0],Math.min(w[1]-0.01,t)), P=makeExportPlan(ep,w)||S.plan, i=P.findIndex(s=>tt>=s.start&&tt<s.end); if(i<0) return;
    const cv=$("stage"); cv.hidden=false; $("stageEmpty").hidden=true; const W=Math.round(ep.w/2), H=Math.round(ep.h/2); if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; } $("stageBox").style.setProperty("--ar",String(ep.w/ep.h));
    const prevP=S.activePlan; S.activePlan=P; try{ await renderStill({ep,canvas:cv,g:cv.getContext("2d"),W,H},i,tt,readFx(),$("showSafe")&&$("showSafe").checked,P); }finally{ S.activePlan=prevP; } }
  catch(e){} finally{ _stillBusy=false; if(_stillNext!=null){ const n=_stillNext; _stillNext=null; showFrameAt(n); } } }
/* pointer handling: mouse drags right away; on touch, hold briefly first so a quick swipe still scrolls the timeline */
{ const cv=$("timeline"); let hold=0, suppressClick=false;
  const begin=(e)=>{ if(!S.plan||S.running) return; const G=tlGeo(e); let mode=null,i=-1;
    if(G.y>=90){ for(let k=1;k<S.plan.length;k++){ if(Math.abs(S.plan[k].start*G.pxs-G.x)<=9){ mode="trim"; i=k; break; } }
      if(!mode){ i=S.plan.findIndex(s=>G.t>=s.start&&G.t<s.end); if(i>=0) mode="move"; } }
    else mode="scrub";
    if(!mode) return; S.drag={mode,i,j:null,x:G.x,x0:G.x,y0:G.y,active:false,touch:e.pointerType!=="mouse",id:e.pointerId,orig:mode==="trim"?S.plan[i].start:null,st:planState()};
    if(S.drag.touch){ clearTimeout(hold); hold=setTimeout(()=>{ if(S.drag&&!S.drag.active){ S.drag.active=true; cv.classList.add("dragging"); try{ navigator.vibrate&&navigator.vibrate(12); }catch(_){} if(S.drag.mode==="scrub") showFrameAt(G.t); drawTimeline(); } },260); } };
  cv.addEventListener("pointerdown",e=>{ begin(e); if(S.drag&&!S.drag.touch) try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
  cv.addEventListener("pointermove",e=>{ const d=S.drag; if(!d||e.pointerId!==d.id) return; const G=tlGeo(e);
    if(!d.active){ if(Math.hypot(G.x-d.x0,G.y-d.y0)>(d.touch?8:3)){ if(d.touch){ clearTimeout(hold); S.drag=null; return; } d.active=true; cv.classList.add("dragging"); } else return; }
    d.x=G.x;
    if(d.mode==="trim"){ const a=S.plan[d.i-1], b=S.plan[d.i]; let t=snapBeat(G.t); t=Math.max(a.start+0.25,Math.min(b.end-0.25,t)); a.end=t; b.start=t; drawTimeline(); }
    else if(d.mode==="move"){ d.j=S.plan.findIndex(s=>G.t>=s.start&&G.t<s.end); drawTimeline(); }
    else if(d.mode==="scrub") showFrameAt(G.t); });
  cv.addEventListener("touchmove",e=>{ if(S.drag&&S.drag.active) e.preventDefault(); },{passive:false}); // keep the page still while dragging
  const end=e=>{ clearTimeout(hold); const d=S.drag; if(!d) return; S.drag=null; cv.classList.remove("dragging"); if(!d.active){ drawTimeline(); return; } suppressClick=true; setTimeout(()=>suppressClick=false,60);
    if(d.mode==="trim"){ const a=S.plan[d.i-1], b=S.plan[d.i], now=b.start, moved=now-d.orig;
      if(Math.abs(moved)<0.01){ drawTimeline(); return; }
      // the earlier shot's clip must be long enough to run on; the later shot keeps its ending and loses (or gains) its head
      let short=false; const ca=S.clips[a.clip]; if(ca&&ca.kind!=="image"&&a.src+(now-a.start)>ca.dur-0.05){ short=true; let lim=a.start+Math.max(0.25,ca.dur-0.05-a.src);
        const B=S.an.beats; let best=null; for(let k=0;k<B.length;k++){ for(const v of [B[k],B[k+1]!=null?(B[k]+B[k+1])/2:null]){ if(v!=null&&v<=lim+1e-6&&v>a.start+0.25&&(best==null||v>best)) best=v; } } if(best!=null) lim=best; // the last beat this clip can reach
        a.end=lim; b.start=lim; }
      const cb=S.clips[b.clip], dm=b.start-d.orig; if(cb&&cb.kind!=="image") b.src=Math.max(0,Math.min(cb.dur-(b.end-b.start)-0.05,b.src+dm));
      a._manual=true; b._manual=true;
      const ex=S.trims.find(x=>Math.abs(x.to-d.orig)<0.03); if(ex) ex.to=b.start; else S.trims.push({from:+d.orig.toFixed(3),to:+b.start.toFixed(3)});
      if(b._lock){ const L=S.locks.get(Math.round(d.orig*20)); if(L){ S.locks.delete(Math.round(d.orig*20)); S.locks.set(lockKey(b),L); } }
      S.hist.push(d.st); S.fut=[]; histButtons(); markEdited(); drawTimeline(); if(S.sel!=null) showShot(S.sel); const mv=b.start-d.orig; status(`Cut moved to ${fmtTenth(b.start)} (${mv>0?"+":""}${mv.toFixed(2)} s), on the beat${short?": as far as that shot’s clip can run":""}.`); }
    else if(d.mode==="move"){ const j=d.j; if(j==null||j<0||j===d.i){ drawTimeline(); return; } const A=S.plan[d.i], B=S.plan[j];
      const fit=(s,c,src)=>c&&c.kind!=="image"?Math.max(0,Math.min(c.dur-(s.end-s.start)-0.05,src)):src;
      const a={clip:A.clip,src:A.src,_rev:A._rev}, b={clip:B.clip,src:B.src,_rev:B._rev};
      A.clip=b.clip; A.src=fit(A,S.clips[b.clip],b.src); A._rev=b._rev; B.clip=a.clip; B.src=fit(B,S.clips[a.clip],a.src); B._rev=a._rev; A._manual=B._manual=true;
      for(const s of [A,B]) if(s._lock) S.locks.set(lockKey(s),{clip:s.clip,src:s.src,rev:!!s._rev});
      S.hist.push(d.st); S.fut=[]; histButtons(); markEdited(); showShot(j); status(`Swapped shots ${d.i+1} and ${j+1}.`); }
    else { drawTimeline(); } };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",e=>{ clearTimeout(hold); if(S.drag&&!S.drag.active) S.drag=null; else end(e); });
  cv.addEventListener("click",e=>{ if(suppressClick){ e.stopImmediatePropagation(); return; } if(!S.plan||S.running) return; const G=tlGeo(e); if(G.y<90) showFrameAt(G.t); },true);
  cv.addEventListener("keydown",e=>{ if(!S.plan) return; if(e.key==="ArrowRight"||e.key==="ArrowLeft"){ const n=S.sel==null?0:Math.max(0,Math.min(S.plan.length-1,S.sel+(e.key==="ArrowRight"?1:-1))); showShot(n); showFrameAt(S.plan[n].start+0.05); e.preventDefault(); } }); }
document.addEventListener("keydown",e=>{ const tag=(e.target&&e.target.tagName)||""; if(/INPUT|TEXTAREA|SELECT/.test(tag)||e.target.isContentEditable) return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){ e.preventDefault(); e.shiftKey?redo():undo(); } else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){ e.preventDefault(); redo(); } });
$("undoBtn").onclick=undo; $("redoBtn").onclick=redo;
const ZOOMS=["fit",0.5,1,2,4];
function setZoom(dir){ const k=ZOOMS.indexOf(S.tlZoom); S.tlZoom=ZOOMS[Math.max(0,Math.min(ZOOMS.length-1,(k<0?2:k)+dir))]; const wr=$("timeline").parentElement, c=wr.scrollLeft+wr.clientWidth/2, rel=c/Math.max(1,wr.scrollWidth);
  drawTimeline(); wr.scrollLeft=rel*wr.scrollWidth-wr.clientWidth/2; $("zoomOut").disabled=S.tlZoom==="fit"; $("zoomIn").disabled=S.tlZoom===4; }
$("zoomOut").onclick=()=>setZoom(-1); $("zoomIn").onclick=()=>setZoom(1);

