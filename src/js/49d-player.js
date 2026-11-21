/* ---------------- A real player ----------------
   Under the picture: where you are in the cut, and a slider to play from anywhere. A tapped shot gets plain buttons:
   Swap clip, Shorter and Longer (the cut after it moves one beat), Earlier or Later in its clip. */
async function playFrom(t){ if(S.running) stopRun(); await new Promise(r=>setTimeout(r,60)); if(!S.plan||S.running) return; stopListen();
  const ep=previewEp(); sizeStage(); const cv=$("stage"); cv.hidden=false; $("stageEmpty").hidden=true;
  const o={ep:{...ep,w:cv.width,h:cv.height}, canvas:cv, g:cv.getContext("2d"), W:cv.width, H:cv.height}, w=windowFor(ep), from=Math.max(w[0],Math.min(w[1]-0.5,t));
  S._pv={t0:performance.now(),from,w}; status(`Playing from ${fmtTime(from-w[0])}…`); await runPass([o],[from,w[1]],false,makeExportPlan(ep,w)); status("Preview finished."); }
{ const _p=preview; preview=async function(){ if(!S.running&&S.plan){ const w=windowFor(previewEp()); S._pv={t0:performance.now(),from:w[0],w}; } return _p(); }; $("preview").onclick=()=>preview(); }
let _scrubbing=false;
function renderScrub(){ const box=$("scrub"); if(!box) return; const ready=!!(S.plan&&S.an); box.hidden=!ready; if(!ready) return; const w=windowFor(previewEp()), len=w[1]-w[0];
  setText($("scrL"),fmtTime(len)); let at=0; if(S.running&&!S.running.record&&S._pv){ at=Math.min(len,S._pv.from-w[0]+(performance.now()-S._pv.t0)/1000); } else if(S._pv&&S._pvStop!=null) at=S._pvStop;
  if(!_scrubbing){ $("scrR").value=String(Math.round(at/Math.max(0.1,len)*1000)); setText($("scrT"),fmtTime(at)); } }
$("scrR").addEventListener("input",()=>{ _scrubbing=true; const w=windowFor(previewEp()); setText($("scrT"),fmtTime(+$("scrR").value/1000*(w[1]-w[0]))); });
$("scrR").addEventListener("change",()=>{ _scrubbing=false; const w=windowFor(previewEp()); playFrom(w[0]+(+$("scrR").value/1000)*(w[1]-w[0])); });
setInterval(()=>{ if(S.running&&!S.running.record&&S._pv) S._pvStop=Math.min(S._pv.w[1]-S._pv.w[0],S._pv.from-S._pv.w[0]+(performance.now()-S._pv.t0)/1000); renderScrub(); },200);
/* Shorter / Longer: the cut at the end of the chosen shot moves one beat (half-beats count), like dragging it */
function moveCut(i,dir){ const P=S.plan; if(!P||S.running) return; const a=P[i], b=P[i+1]; if(!a||!b){ status(dir<0?"The last shot ends with the song.":"The last shot already runs to the end.",true); return; }
  const B=S.an.beats, grid=[]; for(let k=0;k<B.length;k++){ grid.push(B[k]); if(B[k+1]!=null) grid.push((B[k]+B[k+1])/2); }
  const orig=b.start, lo=a.start+0.35, hi=b.end-0.35; let to=null;
  if(dir<0){ for(const g of grid) if(g<orig-0.02&&g>=lo) to=g; } else { for(const g of grid) if(g>orig+0.02&&g<=hi){ to=g; break; } }
  if(to==null){ status(dir<0?"This shot is as short as it can be.":"The next shot is too short to give up any more.",true); return; }
  const ca=S.clips[a.clip]; if(dir>0&&ca&&ca.kind!=="image"&&a.src+(to-a.start)>ca.dur-0.05){ status("This shot's clip isn't long enough to run any longer.",true); return; }
  pushUndo(); a.end=to; b.start=to; const cb=S.clips[b.clip]; if(cb&&cb.kind!=="image") b.src=Math.max(0,Math.min(cb.dur-(b.end-b.start)-0.05,b.src+(to-orig))); a._manual=true; b._manual=true;
  S.trims=S.trims||[]; const ex=S.trims.find(x=>Math.abs(x.to-orig)<0.03); if(ex) ex.to=+to.toFixed(3); else S.trims.push({from:+orig.toFixed(3),to:+to.toFixed(3)});
  histButtons(); markEdited(); drawTimeline(); showShot(i); status(`Shot ${i+1} is now ${(a.end-a.start).toFixed(1)} s, ending on the beat.`); }
$("shotShorter").onclick=()=>{ if(S.sel!=null) moveCut(S.sel,-1); }; $("shotLonger").onclick=()=>{ if(S.sel!=null) moveCut(S.sel,1); };
