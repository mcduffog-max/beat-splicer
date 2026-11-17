/* ---------------- Shot-level editing: tap a shot, then swap it, pick from options, nudge it, lock it, or undo ---------------- */
S.locks=S.locks||new Map();
const lockKey=s=>Math.round(s.start*20); // a shot is identified by when it starts
/* (undo history: see "Timeline editing" below) */
function applyLocks(segs){ if(!S.locks||!S.locks.size) return; for(const s of segs){ const L=S.locks.get(lockKey(s)); if(L && S.clips[L.clip] && S.clips[L.clip].samples){ s.clip=L.clip; s.src=L.src; s._manual=true; s._lock=true; if(L.rev){ s._rev=true; s._manualRev=true; } } } }
function shotCtx(i){ const ctx={ recent:S.plan.slice(Math.max(0,i-3),i).map(s=>s.clip), usage:new Map(), rand:rng((Math.random()*1e9)|0) }; ctx.recentF=ctx.recent.map(famOf);
  S.plan.forEach((s,j)=>{ if(j===i) return; if(!ctx.usage.has(s.clip)) ctx.usage.set(s.clip,[]); ctx.usage.get(s.clip).push([s.src,s.src+(s.end-s.start)]); });
  const prev=S.plan[i-1]; if(prev){ const c=S.clips[prev.clip], sm=c&&c.samples&&c.samples.reduce((a,x)=>Math.abs(x.t-prev.src)<Math.abs(a.t-prev.src)?x:a,c.samples[0]); if(sm&&sm.col) ctx.prevCol=sm.col; ctx.prevSm=sm||null; }
  return ctx; }
function setShot(i,clip,src,msg){ pushUndo(); const s=S.plan[i]; s.clip=clip; s.src=src; s._manual=true; if(s._lock) S.locks.set(lockKey(s),{clip,src,rev:!!s._rev}); showShot(i); drawTimeline(); markEdited(); if(msg) status(msg); }
function showShot(i){
  const s=S.plan[i]; if(!s){ $("shotPanel").hidden=true; S.sel=null; return; } S.sel=i; const c=S.clips[s.clip];
  $("shotPanel").hidden=false; $("shotThumb").src=c&&c.thumb||"";
  const ft=x=>`${Math.floor(x/60)}:${(x%60).toFixed(1).padStart(4,"0")}`;
  $("shotInfo").textContent=`Shot ${i+1} of ${S.plan.length} · ${ft(s.start)}–${ft(s.end)} (${(s.end-s.start).toFixed(1)} s) · ${c?c.name:"?"}${c&&c.kind!=="image"?` from ${s.src.toFixed(1)} s`:""}${s._lock?" · locked: kept through remixes and exports":s._manual?" · your choice (lock it to keep it through a remix)":""}`;
  { const cam={settle:"steady drift",push:"push-in building to the chorus",punch:"punch-in on the entry",ride:"riding the beat",float:"floating drift",reveal:"pull back to reveal"}[s._dmove]; if(cam){ const lp=$("lens").value==="tiltshift"?"tilt-shift":(lensProfile(s)&&LENSES[lensProfile(s)]?LENSES[lensProfile(s)].name.split(":")[0]:"none"); $("shotInfo").textContent+=` · Camera: ${cam} · Lens: ${lp}`; } }
  { const wb=$("shotWhy"); wb.innerHTML=""; const R=s._manual?null:s.why; if(R&&R.length){ const h=document.createElement("div"); h.textContent="Why this shot:"; h.style.fontWeight="600"; wb.appendChild(h);
      R.forEach(r=>{ const row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"; const t=document.createElement("span"); t.textContent="• "+r.t; row.appendChild(t);
        if(r.veto==="line"){ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent="Wrong match"; b.title="This clip doesn't show that line: never pair them again";
          b.onclick=()=>{ S.vetoes.add(lyKey(r.line)+"|"+clipKey(s.clip)); saveProjectSoon(); const opt=shotOptions(i,1)[0]; if(opt) setShot(i,opt.clip,opt.src,`Noted: that clip won't be matched to “${r.line}” again.`); }; row.appendChild(b); }
        wb.appendChild(row); }); }
    else if(s._manual){ wb.textContent="Your choice."; } }
  $("shotLock").textContent=s._lock?"Unlock":"Lock"; $("shotRev").textContent=s._rev?"Forwards":"Reverse"; $("shotRev").disabled=!c||c.kind==="image"; $("shotOpts").innerHTML=""; drawTimeline();
}
function shotOptions(i,n){ const seg=S.plan[i], out=[], ctx=shotCtx(i), used=new Set([seg.clip]);
  for(let k=0;k<n;k++){ const pick=chooseClip(seg,ctx,-1); if(!pick) break; if(!used.has(pick.clip)) out.push(pick); used.add(pick.clip); const c=S.clips[pick.clip]; c._tmpOff=c.off; c.off=true; } // each next option skips the ones already offered
  S.clips.forEach(c=>{ if("_tmpOff" in c){ c.off=c._tmpOff; delete c._tmpOff; } }); return out; }
$("timeline").addEventListener("click",e=>{
  if(!S.plan||S.running) return;
  const r=e.currentTarget.getBoundingClientRect(), t=(e.clientX-r.left)/r.width*S.an.duration;
  const i=S.plan.findIndex(s=>t>=s.start&&t<s.end); if(i<0) return; showShot(i);
});
$("shotSwap").onclick=()=>{ const i=S.sel; if(i==null) return; const o=shotOptions(i,1)[0]; if(o) setShot(i,o.clip,o.src,`Shot ${i+1} now uses ${S.clips[o.clip].name}.`); };
$("shotMore").onclick=()=>{ const i=S.sel; if(i==null) return; const box=$("shotOpts"); box.innerHTML="";
  for(const o of shotOptions(i,8)){ const c=S.clips[o.clip], b=document.createElement("button"); b.type="button"; b.className="chip"; b.style.cssText="padding:2px;display:flex;flex-direction:column;align-items:center;gap:2px;max-width:104px";
    const im=document.createElement("img"); im.src=c.thumb||""; im.alt=""; im.style.cssText="width:96px;height:54px;object-fit:cover;border-radius:5px"; const sp=document.createElement("span"); sp.style.cssText="font-size:10px;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"; sp.textContent=c.name;
    b.append(im,sp); b.title=c.name; b.onclick=()=>setShot(i,o.clip,o.src,`Shot ${i+1} now uses ${c.name}.`); box.appendChild(b); } };
const nudge=d=>{ const i=S.sel; if(i==null) return; const s=S.plan[i], c=S.clips[s.clip]; if(!c||c.kind==="image") return; const D=s.end-s.start, ns=Math.max(0,Math.min(c.dur-D-0.05,s.src+d)); if(Math.abs(ns-s.src)<0.01) return; setShot(i,s.clip,ns); };
$("shotBack").onclick=()=>nudge(-0.5); $("shotFwd").onclick=()=>nudge(0.5);
$("shotRev").onclick=()=>{ const i=S.sel; if(i==null) return; const s=S.plan[i], c=S.clips[s.clip]; if(!c||c.kind==="image") return; pushUndo(); s._rev=!s._rev; s._manualRev=true; s._manual=true; showShot(i); drawTimeline(); saveProjectSoon(); status(s._rev?`Shot ${i+1} now plays backwards (shows in exports; the quick preview plays forwards).`:`Shot ${i+1} plays forwards again.`); };
$("shotLock").onclick=()=>{ const i=S.sel; if(i==null) return; pushUndo(); const s=S.plan[i]; s._lock=!s._lock; s._manual=s._manual||s._lock; if(s._lock) S.locks.set(lockKey(s),{clip:s.clip,src:s.src,rev:!!s._rev}); else S.locks.delete(lockKey(s)); showShot(i); saveProjectSoon(); };
$("shotUndo").onclick=()=>undo();
$("shotClose").onclick=()=>{ $("shotPanel").hidden=true; S.sel=null; drawTimeline(); };


