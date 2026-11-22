/* ---------------- UI: clips, stats, timeline ---------------- */
/* clips from the last N versions/exports are left out of the edit entirely (not just discouraged) */
/* Videos you've made: each export run is remembered as one entry (every format it produced), newest last. */
function madeMem(){ try{ return JSON.parse(localStorage.getItem("beatsplicerMade")||"[]"); }catch(e){ return []; } }
function recordMade(results){ try{ const plans=results.map(r=>r.plan).filter(Boolean); if(!plans.length) return; const keys=new Set(); plans.forEach(P=>P.forEach(s=>{ if(S.clips[s.clip]) keys.add(clipKey(s.clip)); }));
    const spans={}; plans.forEach(P=>P.forEach(s=>{ const c=S.clips[s.clip]; if(!c||c.kind==="image") return; const k=clipKey(s.clip), a=s.src||0, b=a+(s.end-s.start)*(s._ramp?RAMP_SPAN:(s._rate||1)); (spans[k]=spans[k]||[]).push([+a.toFixed(2),+b.toFixed(2)]); })); // the stretch of each clip actually shown
    const m=madeMem(), sig=[...keys].sort().join(","); if(m.length&&m[m.length-1].sig===sig) return; m.push({t:Date.now(), song:S.audioName||"", clips:[...keys], spans, sig}); localStorage.setItem("beatsplicerMade",JSON.stringify(m.slice(-12))); }catch(e){} }
/* "Don't reuse clips from my last N videos": the newest video's clips go first, then older ones, for as long as enough
   fresh footage is left for the formats being made; anything that can't be kept out is let back in oldest-first. */
/* Footage already shown in videos you've made, per clip: a clip can come back in a later video, but only with footage
   past what was shown (or any stretch not shown yet), so every video stays fresh. On unless the setting is off. */
function shownBefore(){ const mode=optV("exclN")??"adv"; if(mode==="0") return null; if(S._shown&&S._shownGen===S._planGen&&S._planGen) return S._shown.map; S._shownGen=S._planGen; const m=madeMem(), key=m.length+":"+(m.length?m[m.length-1].t:0);
  if(S._shown&&S._shown.key===key) return S._shown.map; const map=new Map();
  m.forEach(v=>Object.entries(v.spans||{}).forEach(([k,L])=>{ const a=map.get(k)||[]; L.forEach(x=>a.push(x)); map.set(k,a); }));
  map.forEach((L,k)=>{ L.sort((x,y)=>x[0]-y[0]); const out=[]; L.forEach(([a,b])=>{ const l=out[out.length-1]; if(l&&a<=l[1]+0.1) l[1]=Math.max(l[1],b); else out.push([a,b]); }); map.set(k,out); });
  S._shown={key,map}; return map; }
function shownSpans(ci){ const m=shownBefore(); return m&&m.get(clipKey(ci))||null; }
function excludedKeys(need){ const n=+($("exclN")&&$("exclN").value)||0; S._exclPartial=null; if(!n) return null; const vids=madeMem().slice(-n).reverse(); if(!vids.length) return null;
  const keyIdx=new Map(); S.clips.forEach((c,i)=>{ if(c.samples&&!c.off) keyIdx.set(clipKey(i),i); });
  const set=new Set(), fams=new Set(), freshLeft=()=>S.clips.filter((c,i)=>c.samples&&!c.off&&!set.has(clipKey(i))&&!(c.fam&&fams.has(c.fam))).length; let wanted=0, skipped=0;
  for(const v of vids) for(const k of v.clips){ if(set.has(k)) continue; const i=keyIdx.get(k); if(i==null) continue; wanted++; const f=S.clips[i].fam;
    set.add(k); const addF=f&&!fams.has(f); if(addF) fams.add(f); if(freshLeft()<need){ set.delete(k); if(addF) fams.delete(f); skipped++; } }
  if(skipped) S._exclPartial={kept:wanted-skipped, wanted}; S._exclFamPre=fams; return set.size?set:null; }
function isExcluded(ci){ if(S._filtOut&&S._filtOut.has(ci)) return true; const ex=S._excl; if(!ex) return false; if(ex.has(clipKey(ci))) return true; const c=S.clips[ci]; return !!(c&&c.fam&&S._exclFam&&S._exclFam.has(c.fam)); }
function refreshExclusion(force){
  if(!force && S._exclSet) return; S._exclSet=true; // worked out once per new version, so the current edit never excludes itself
  const need=S.an?Math.max(6,...S.eps.map(EP).filter(Boolean).map(ep=>{ try{ return needFor(ep).min; }catch(e){ return 6; } })):6;
  S._excl=excludedKeys(need); S._exclRelaxed=false; S._exclFam=S._excl?S._exclFamPre:null;
  // too few fresh clips: excludedKeys has already let the oldest ones back in, and says how many
}
/* Clips that look alike (same composition and colours: variants of one prompt, re-renders, near-identical takes) are
   grouped into a family. Variety, recency and the exclusion all treat a family as one clip, so lookalikes don't repeat. */
function fpDist(a,b){ let cd=0; for(let i=0;i<a.grid.length;i++) cd+=Math.abs(a.grid[i]-b.grid[i]); cd/=a.grid.length; let hd=0; for(let i=0;i<64;i++) if(a.hash[i]!==b.hash[i]) hd++; return {cd,hd}; }
function buildFamilies(){
  const ix=S.clips.map((c,i)=>i).filter(i=>S.clips[i].fp&&S.clips[i].fp.length), par=new Map(ix.map(i=>[i,i])), find=i=>{ while(par.get(i)!==i){ par.set(i,par.get(par.get(i))); i=par.get(i); } return i; };
  const mid=c=>c.fp[Math.floor(c.fp.length/2)];
  for(let a=0;a<ix.length;a++) for(let b=a+1;b<ix.length;b++){ const A=S.clips[ix[a]], B=S.clips[ix[b]];
    const m=fpDist(mid(A),mid(B)); if(m.cd>FAM_CD||m.hd>FAM_HD) continue;
    let ok=0; for(const fa of A.fp) for(const fb of B.fp){ const d=fpDist(fa,fb); if(d.cd<=FAM_CD&&d.hd<=FAM_HD) ok++; } // more than one moment must match
    if(ok>=Math.min(2,A.fp.length,B.fp.length)) par.set(find(ix[a]),find(ix[b])); }
  const size=new Map(); S.clips.forEach((c,i)=>{ c.fam=par.has(i)?"f"+find(i):null; if(c.fam) size.set(c.fam,(size.get(c.fam)||0)+1); });
  S.clips.forEach(c=>{ c.famSize=c.fam?size.get(c.fam):1; if(c.famSize<=1) c.fam=null; });
  const sh=S.clips.flatMap(c=>(c.samples||[]).map(s=>s.sharp).filter(v=>v!=null)).sort((a,b)=>a-b); S._sharpP20=sh.length?sh[Math.floor(sh.length*0.2)]:null; S._sharpMed=sh.length?sh[sh.length>>1]:null;
  S._fatigue=null; S._families=new Set(S.clips.map(c=>c.fam).filter(Boolean)).size;
}
const FAM_CD=16, FAM_HD=12;
const famOf=ci=>{ const c=S.clips[ci]; return c&&c.fam?c.fam:"c"+ci; };
function nFamilies(){ const s=new Set(); S.clips.forEach((c,i)=>{ if(c.samples&&!c.off&&!isExcluded(i)) s.add(famOf(i)); }); return Math.max(1,s.size); }
function clipFitNow(c){ if(!S.an||!c.samples) return 0; const sp=songProfile(S.an), st=clipStats(c); let f=1-0.7*Math.abs(st.mot-sp.wantMot)-0.3*Math.abs(st.br-sp.bright); if(c.kind==="image") f-=sp.wantMot>0.5?0.25:0.05; return f; }
function libOrder(){
  const sort=$("libSort").value, show=$("libShow").value, fz=fatigue();
  let ix=S.clips.map((c,i)=>i);
  const recent=i=>(fz.clip.get(clipKey(i))||0)>0.05;
  if(show==="in") ix=ix.filter(i=>S.clips[i].samples&&!S.clips[i].off&&!isExcluded(i));
  else if(show==="out") ix=ix.filter(i=>S.clips[i].off||isExcluded(i));
  else if(show==="fresh") ix=ix.filter(i=>!recent(i));
  else if(show==="recent") ix=ix.filter(i=>recent(i));
  else if(show==="lookalike") ix=ix.filter(i=>S.clips[i].famSize>1).sort((a,b)=>String(S.clips[a].fam).localeCompare(String(S.clips[b].fam)));
  if((S.castSel&&S.castSel.size)||(S.sceneSel&&S.sceneSel.size)) ix=ix.filter(i=>!S.clips[i].samples||filterMatch(S.clips[i]));
  const castN=i=>S.castMode==="except"?0:faceMode()?-(S.clips[i].faces||[]).filter(f=>S.castSel.has(f.id)).length:-(S.clips[i].tags||[]).filter(t=>(t.chars||[]).some(x=>S.castSel.has(x))).length;
  const key={cast:castN, fit:i=>-clipFitNow(S.clips[i]), motion:i=>-(clipStats(S.clips[i]).mot||0), bright:i=>-(clipStats(S.clips[i]).br||0), long:i=>-(S.clips[i].dur||0), fresh:i=>fz.clip.get(clipKey(i))||0, name:null}[sort];
  if(sort==="name") ix.sort((a,b)=>S.clips[a].name.localeCompare(S.clips[b].name,undefined,{numeric:true}));
  else if(key) ix.sort((a,b)=>key(a)-key(b));
  return ix;
}
let _rcT=0;
function renderClips(){ const nw=performance.now(); if(S.clips.length>60 && nw-_rcT<1200 && S.clips.some(c=>!c.samples&&!c.error)){ clearTimeout(S._rcLater); S._rcLater=setTimeout(renderClips,1300); return; } _rcT=nw; // big libraries: redraw the grid less often while analysing
  if(S.songs&&S.songs.length) setTimeout(renderSongs,0);
  renderCast(); renderScenes(); renderSee();
  refreshExclusion(false);
  const box=$("clipList"); box.innerHTML="";
  const order=libOrder(), ready=S.clips.filter(c=>c.samples).length, inEdit=S.clips.filter((c,i)=>c.samples&&!c.off&&!isExcluded(i)).length, exN=S._excl?S.clips.filter((c,i)=>c.samples&&S._excl.has(clipKey(i))).length:0;
  $("libCount").textContent=`${S.clips.length} clips · ${inEdit} in the edit${S.castSel&&S.castSel.size?` · ${S.castMode==="except"?"without":"featuring"} ${[...S.castSel].map(k=>k.startsWith("t:")?k.slice(2)+"s":castLabel(k)).join(" or ")}`:""}${S.sceneSel&&S.sceneSel.size?` · ${S.sceneMode==="except"?"not set in":"set in"} ${[...S.sceneSel].map(sceneLabel).join(" or ").toLowerCase()}`:""}${S._filtRelaxed?" · too few clips match, so the edit uses all of them":""}${S._families?` · ${S._families} look-alike group${S._families===1?"":"s"}`:""}${exN?` · ${exN} kept out (in your last ${$("exclN").value} video${$("exclN").value==="1"?"":"s"})`:""}${S._exclPartial?` · ${S._exclPartial.wanted-S._exclPartial.kept} let back in: not enough fresh footage for this format`:""}${S.clips.length-ready?` · ${S.clips.length-ready} still being studied`:""}${S._exclRelaxed?" · not enough fresh clips for this format, so recent ones are allowed":""}${order.length!==S.clips.length?` · showing ${order.length}`:""}`;
  const lim=S.clipsAll?Infinity:9, shown=order.filter((i,k)=>k<lim||i===S.cropIdx); { const mb=$("clipMore"); if(mb){ mb.hidden=order.length<=9; mb.textContent=S.clipsAll?"Show fewer clips":`Show all ${order.length} clips`; } }
  shown.forEach(i=>{ const c=S.clips[i];
    const d=document.createElement("div"); d.className="clip"+(c.samples?"":" busy"); d.style.setProperty("--hue",hue(i));
    if(c.thumb){ const im=document.createElement("img"); im.src=c.thumb; im.alt=""; d.appendChild(im); }
    const sp=document.createElement("span"); sp.textContent=c.error? "Can’t use: "+c.name : (c.samples? fmtTime(c.dur)+"  "+c.name : "Reading "+c.name+"…"); d.appendChild(sp);
    if(c.crop && (c.crop.t||c.crop.b||c.crop.l||c.crop.r)){ const cb=document.createElement("span"); cb.className="crop-badge"; cb.textContent="Cropped"; d.appendChild(cb); }
    if(i===S.cropIdx) d.classList.add("sel");
    if(c.samples){ d.tabIndex=0; d.setAttribute("role","button"); d.setAttribute("aria-label","Crop "+c.name);
      d.onclick=()=>openCrop(i); d.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openCrop(i); } }; }
    if(c.samples && c.kind!=="image" && $("clipSound").checked){
      const sb=document.createElement("button"); sb.className="snd"; sb.textContent=c.mute?"🔇":"🔊";
      sb.title=c.mute?"Sound muted for this clip":"Sound on for this clip"; sb.setAttribute("aria-label",(c.mute?"Unmute ":"Mute ")+c.name); sb.setAttribute("aria-pressed",String(!c.mute));
      sb.onclick=e=>{ e.stopPropagation(); c.mute=!c.mute; renderClips(); }; d.appendChild(sb);
    }
    if(c.samples && c.famSize>1){ const fb=document.createElement("span"); fb.className="crop-badge"; fb.textContent=`Look-alike ×${c.famSize}`; fb.style.bottom="22px"; fb.style.top="auto"; fb.title="This clip looks very similar to others; they count as one for variety"; d.appendChild(fb); }
    if(c.wm&&c.wm.length&&$("wmAvoid").checked){ const wb=document.createElement("span"); wb.className="crop-badge"; wb.textContent="Watermark avoided"; wb.style.bottom="42px"; wb.style.top="auto"; wb.title="A logo or watermark was found in this clip; each format is framed to keep it out"; d.appendChild(wb); }
    if(c.samples && isExcluded(i)){ d.classList.add("off"); const ex=document.createElement("span"); ex.className="crop-badge"; ex.textContent=isFiltered(i)?"Filtered out":"Used recently"; ex.style.top="22px"; d.appendChild(ex); }
    if(c.samples){ const u=document.createElement("button"); u.className="use"; u.textContent=c.off?"Not used":"✓"; u.title=c.off?"Left out of the edit: tap to use it":"In the edit: tap to leave it out";
      u.setAttribute("aria-pressed",String(!c.off)); u.setAttribute("aria-label",(c.off?"Use ":"Leave out ")+c.name);
      u.onclick=e=>{ e.stopPropagation(); if(S.running) return; c.off=!c.off; renderClips(); buildPlan(); saveProjectSoon(); }; d.appendChild(u); if(c.off) d.classList.add("off"); }
    const x=document.createElement("button"); x.textContent="×"; x.title="Remove "+c.name; x.setAttribute("aria-label","Remove "+c.name);
    x.onclick=e=>{ e.stopPropagation(); if(S.running) return; URL.revokeObjectURL(c.url); S.clips.splice(i,1); if(S.cropIdx===i) closeCrop(); else if(S.cropIdx>i) S.cropIdx--; renderClips(); buildPlan(); };
    d.appendChild(x); box.appendChild(d);
  });
  const ok=S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)).length;
  $("clipInfo").textContent= S.clips.length ? `${ok} clip${ok===1?"":"s"} ready. Add more for more variety.` : "Add as many as you like. More variety gives better matches.";
}

function renderStats(){
  const st=$("stats"); st.innerHTML="";
  if(!S.an) return;
  const items=[[Math.round(S.an.bpm),"BPM"],[fmtTime(S.an.duration),"Length"],[S.an.lufs.toFixed(0),"LUFS (approx.)"]];
  if(S.plan) items.push([S.plan.length,"Cuts"]);
  if(S.plan){ const w=windowFor(previewEp()); if(w[1]-w[0]<S.an.duration-0.1) items.push([fmtTime(w[1]-w[0]),previewEp().name+" cut"]); }
  for(const [v,l] of items){ const d=document.createElement("div"); d.className="stat"; const b=document.createElement("b"); b.textContent=String(v); const s=document.createElement("small"); s.textContent=String(l); d.append(b,s); st.appendChild(d); }
}

function drawTimeline(playhead){ if(S._dry||S._quiet) return;
  document.body.classList.toggle("has-song",!!S.an); { const em=$("stageEmpty"); if(em) em.textContent=S.plan?"Press Preview to watch your edit here.":"Your edit plays here once you’ve added a song and clips."; }
  const cv=$("timeline"), box=cv.parentElement;
  const pps=S.tlZoom==="fit"||!S.an?0:24*(S.tlZoom||1), cssW=Math.max(box.clientWidth, S.an? Math.min(16000,S.an.duration*pps):0), cssH=132, dpr=window.devicePixelRatio||1;
  cv.style.width=cssW+"px"; cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
  const g=cv.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,cssW,cssH);
  const css=getComputedStyle(document.documentElement);
  const muted=css.getPropertyValue("--muted"), waveC=css.getPropertyValue("--wave"), beatC=css.getPropertyValue("--beat"), ink=css.getPropertyValue("--ink");
  g.font="12px -apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif";
  if(!S.an){ g.fillStyle=muted; g.fillText(t("Add audio to see its beats here."),14,70); return; }
  const dur=S.an.duration, X=t=>t/dur*cssW;
  // waveform
  const pk=S.an.peaks, mid=46, amp=34; g.fillStyle=waveC;
  for(let x=0;x<cssW;x++){ const p=pk[Math.floor(x/cssW*pk.length)]||0; const h=Math.max(1,p*amp); g.fillRect(x,mid-h,1,h*2); }
  // beats
  S.an.beats.forEach((b,i)=>{ const isDown=isDownAt(S.an,i); g.fillStyle=beatC; g.globalAlpha=isDown?0.95:0.45; g.fillRect(Math.round(X(b)),isDown?6:14,1,isDown?80:64); });
  g.globalAlpha=1;
  // segments
  if(S.plan){
    S.plan.forEach(s=>{ const x0=X(s.start), x1=X(s.end); g.fillStyle=hue(s.clip); g.fillRect(x0,96,Math.max(1,x1-x0-1),30);
      if(s.tr && s.tr.dur>0){ const tw=Math.max(2,X(s.start+s.tr.dur)-x0); g.fillStyle="rgba(255,255,255,0.55)"; g.beginPath(); g.moveTo(x0,96); g.lineTo(x0+tw,96); g.lineTo(x0,126); g.fill(); } });
  } else { g.fillStyle=muted; g.fillText(t("Add video clips to build the edit."),14,116); }
  if(S.plan){ const w=windowFor(previewEp()); if(w[0]>0.05||w[1]<dur-0.05){ g.fillStyle="rgba(0,0,0,0.45)"; g.fillRect(0,0,X(w[0]),cssH); g.fillRect(X(w[1]),0,cssW-X(w[1]),cssH); } }
  if(S.plan && S.an.E){ const pw=previewEp?windowFor(previewEp()):[0,dur], pl=(typeof makeExportPlan==="function"?makeExportPlan(previewEp(),pw):null)||S.plan, pr=paceReport(pl,pw);
    if(pr){ const yOf=v=>88-v*76; g.lineWidth=1.5;
      g.strokeStyle="rgba(201,138,7,0.9)"; g.beginPath(); pr.rows.forEach((r,k)=>{ const x=X((r.a+r.b)/2); k?g.lineTo(x,yOf(r.e)):g.moveTo(x,yOf(r.e)); }); g.stroke();
      g.strokeStyle=css.getPropertyValue("--cobalt"); g.setLineDash([4,3]); g.beginPath(); pr.rows.forEach((r,k)=>{ const x=X((r.a+r.b)/2); k?g.lineTo(x,yOf(r.dyn)):g.moveTo(x,yOf(r.dyn)); }); g.stroke(); g.setLineDash([]);
      g.font="11px Archivo, system-ui, sans-serif"; g.fillStyle=beatC; g.fillText(t("energy"),6,12); g.fillStyle=css.getPropertyValue("--cobalt"); g.fillText(t("pace"),6+g.measureText(t("energy")).width+12,12); } }
  if(S.plan && storyOn()){ g.font="10px Archivo, system-ui, sans-serif"; g.fillStyle=muted; let lastB="";
    let freeX=-1; S.plan.forEach((s,i)=>{ const b=s._beat||storyBeat(s,i,S.plan); if(b!==lastB){ lastB=b; const x=X(s.start)+2, w=g.measureText(t(b)).width; if(x>=freeX){ g.fillText(t(b),x,94); freeX=x+w+6; } } }); } /* a label that would run into the one before is left out */
  if(S.plan && S.sel!=null && S.plan[S.sel]){ const s=S.plan[S.sel]; g.strokeStyle=ink; g.lineWidth=2; g.strokeRect(X(s.start)+1,95,Math.max(3,X(s.end)-X(s.start)-2),32); }
  if(S.plan){ g.fillStyle=ink; S.plan.forEach(s=>{ if(s._lock){ g.beginPath(); g.arc(X(s.start)+5,101,2.5,0,Math.PI*2); g.fill(); } }); }
  if(S.plan&&S.drag&&S.drag.active){ const d=S.drag;
    if(d.mode==="trim"){ const x=X(S.plan[d.i].start); g.fillStyle=css.getPropertyValue("--sel")||"#FFE98A"; g.fillRect(x-2,92,4,38); g.fillStyle=ink; g.font="600 11px -apple-system, Inter, system-ui, sans-serif"; g.fillText(fmtTenth(S.plan[d.i].start),Math.min(cssW-40,x+5),90); }
    if(d.mode==="move"&&d.j!=null&&d.j!==d.i){ const s=S.plan[d.j]; g.strokeStyle=css.getPropertyValue("--sel")||"#FFE98A"; g.lineWidth=3; g.strokeRect(X(s.start)+1,95,Math.max(3,X(s.end)-X(s.start)-2),32); }
    if(d.mode==="move"){ const s=S.plan[d.i]; g.globalAlpha=0.55; g.fillStyle=hue(s.clip); const w=Math.max(8,X(s.end)-X(s.start)); g.fillRect(d.x-w/2,98,w,26); g.globalAlpha=1; } }
  if(playhead!=null){ g.fillStyle=ink; g.fillRect(Math.round(X(playhead)),0,2,cssH); }
  else if(S.scrubT!=null&&!S.running){ g.fillStyle=ink; g.fillRect(Math.round(X(S.scrubT)),0,2,cssH); }
}

