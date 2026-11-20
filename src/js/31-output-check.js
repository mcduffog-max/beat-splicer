/* ---------------- Output check: does the file match what was planned? ----------------
   Size, length and sound are read from the file. Then shots are sampled at their midpoints and compared with a still rendered
   from the planned clip at that moment, and with the neighbouring shots, to confirm the right footage is on screen. */
async function verifyExport(r){
  const v=document.createElement("video"); v.muted=true; v.playsInline=true; const u=URL.createObjectURL(r.blob); v.src=u;
  try{ return await verifyExportInner(r,v); }
  finally{ v.pause(); v.removeAttribute("src"); v.load(); URL.revokeObjectURL(u); } // always let go of the finished file
}
async function verifyExportInner(r,v){
  const out={ok:true, notes:[]};
  try{ await waitEvent(v,"loadedmetadata",10000); }catch(e){ return {ok:false,notes:["The file couldn’t be opened for checking."]}; }
  if(!isFinite(v.duration)){ v.currentTime=1e9; await new Promise(res=>{ v.ontimeupdate=()=>{ v.ontimeupdate=null; res(); }; setTimeout(res,3000); }); }
  const D=v.duration, want=r.win[1]-r.win[0];
  const sizeOk=v.videoWidth===r.ep.w && v.videoHeight===r.ep.h, lenOk=Math.abs(D-want)<0.5;
  out.size=`${v.videoWidth}×${v.videoHeight}`; out.len=D;
  if(!sizeOk){ out.ok=false; out.notes.push(`Size is ${v.videoWidth}×${v.videoHeight}, expected ${r.ep.w}×${r.ep.h}.`); }
  if(!lenOk){ out.ok=false; out.notes.push(`Length is ${D.toFixed(1)} s, expected ${want.toFixed(1)} s.`); }
  let fb=null; // read and decode the soundtrack once, at low resolution, and only for files of a sensible size
  if(r.blob.size<150e6){ try{ const ac=new OfflineAudioContext(1,8000,8000); fb=await ac.decodeAudioData(await r.blob.arrayBuffer()); }catch(e){ fb=null; } } // big files: don't pull the whole video into memory
  if(fb){ const d=fb.getChannelData(0); let pk=0; for(let i=0;i<d.length;i+=10) pk=Math.max(pk,Math.abs(d[i])); out.audio=pk>0.01; } else out.audio=r.audioChunks!=null?r.audioChunks>0:null;
  if(out.audio===false){ out.ok=false; out.notes.push("The soundtrack is silent."); }
  try{
    if(!fb) throw 0;
    const env=(buf,from,secs)=>{ const ch=buf.getChannelData(0), sr=buf.sampleRate, hop=Math.round(sr/200), n=Math.floor(secs*200), out=new Float32Array(n);
      for(let k=0;k<n;k++){ let s=0; const a=Math.round(from*sr)+k*hop; for(let i=a;i<a+hop&&i<ch.length;i++) s+=Math.abs(ch[i]||0); out[k]=s/hop; } return out; };
    const corr=(x,y)=>{ const n=Math.min(x.length,y.length); let mx=0,my=0; for(let i=0;i<n;i++){ mx+=x[i]; my+=y[i]; } mx/=n; my/=n; let a=0,b=0,c=0; for(let i=0;i<n;i++){ const dx=x[i]-mx, dy=y[i]-my; a+=dx*dy; b+=dx*dx; c+=dy*dy; } return a/Math.sqrt(b*c+1e-12); };
    const fe=env(fb,0,Math.min(6,fb.duration-0.1)); let best=null;
    for(let ms=-500;ms<=800;ms+=5){ const st=r.win[0]+ms/1000; if(st<0) continue; const c=corr(fe,env(S.audioBuf,st,fe.length/200)); if(!best||c>best.c) best={ms,c}; }
    if(best && best.c>0.6){
      const lag=best.ms/1000, endErr=(fb.duration+lag)-want; out.startMs=best.ms; out.endErr=endErr;
      if(r.engine!=="exact"){
        if(Math.abs(lag)>0.03){ S.recLat=Math.max(0,Math.min(0.6,S.recLat+lag)); }
        if(endErr<0.02) S.recTail=Math.min(1,S.recTail+(0.06-endErr)); else if(endErr>0.3) S.recTail=Math.max(0.1,S.recTail-0.1);
        saveCalib(); }
      if(r.engine!=="exact" && Math.abs(lag)>0.04) out.notes.push(`Started ${Math.round(Math.abs(lag)*1000)} ms ${lag>0?"late":"early"}. The recorder has now been calibrated for this computer, so Make again for a frame-exact start.`);
      if(r.engine!=="exact" && Math.abs(lag)>0.15) out.ok=false; // the frame-accurate engine renders sound with the picture, sample for sample: a lag reading there is the music repeating, not a real offset
    }
  }catch(e){}
  // shot check
  const plan=r.plan||S.plan, F=readFx(), w=r.win, shots=plan.map((s,i)=>({s,i,a:Math.max(s.start,w[0])-w[0],b:Math.min(s.end,w[1])-w[0]})).filter(x=>x.b-x.a>=0.4 && (!x.s.tr||x.s.tr.dur<0.05||x.b-x.a>x.s.tr.dur+0.3));
  const pick=[]; const n=Math.min(12,shots.length); for(let k=0;k<n;k++) pick.push(shots[Math.floor(k*shots.length/n)]);
  const TW=64, TH=Math.max(8,Math.round(64*r.ep.h/r.ep.w)), cv=document.createElement("canvas"); cv.width=TW; cv.height=TH; const g=cv.getContext("2d",{willReadFrequently:true});
  const grab=()=>{ g.drawImage(v,0,0,TW,TH); return g.getImageData(0,Math.floor(TH*0.45),TW,Math.floor(TH*0.25)).data; };
  const still=async(i,t)=>{ const c=document.createElement("canvas"); c.width=TW; c.height=TH; const o={ep:{...r.ep,w:TW,h:TH},canvas:c,g:c.getContext("2d",{willReadFrequently:true}),W:TW,H:TH};
    S.activePlan=plan; try{ await renderStill(o,i,t,{...F,hook:"",end:"",lower:"",brand:"off",doodles:false,glitch:false,grain:false},false); }finally{ S.activePlan=null; }
    return o.g.getImageData(0,Math.floor(TH*0.45),TW,Math.floor(TH*0.25)).data; };
  // effects that switch on the beat (multiplied grids, strobes, split bars, mirrors) move pixels around without changing the footage,
  // so with those on, frames are compared by their colour make-up instead of pixel by pixel
  const beatFx=F.multiply||F.strobe||F.split||F.mirror||motifId()==="mirror";
  // running totals of each colour channel (64 levels): comparing these measures how far the colours have shifted, so a
  // slight change from compression counts as slight, while different footage still reads as different
  const hist=a=>{ const hh=new Float32Array(192); let n=0; for(let i=0;i<a.length;i+=4){ hh[a[i]>>2]++; hh[64+(a[i+1]>>2)]++; hh[128+(a[i+2]>>2)]++; n++; }
    for(let c=0;c<3;c++){ let run=0; for(let k=0;k<64;k++){ run+=hh[c*64+k]/(n||1); hh[c*64+k]=run; } } return hh; };
  const diff=beatFx
    ? (a,b)=>{ const x=hist(a), y=hist(b); let s=0; for(let k=0;k<192;k++) s+=Math.abs(x[k]-y[k]); return s/64*100; }
    : (a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4) s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return s/(a.length/4*3); };
  let good=0, checked=0; const bad=[];
  for(const x of pick){
    const mid=(x.a+x.b)/2; v.currentTime=Math.min(D-0.05,mid); await new Promise(res=>{ v.onseeked=res; setTimeout(res,2500); });
    const got=grab(), exp=await still(x.i,w[0]+mid);
    const others=[]; for(const j of [x.i-1,x.i+1]) if(j>=0&&j<plan.length&&plan[j].clip!==x.s.clip) others.push(await still(j,Math.max(plan[j].start,w[0])+0.3));
    const de=diff(got,exp), dmin=others.length?Math.min(...others.map(o=>diff(got,o))):Infinity;
    checked++; if(de<=dmin*0.85 || de<18) good++; else bad.push(mid);
  }
  out.shots=[good,checked];
  if(checked && good<checked){ out.ok=good/checked>=0.9 && out.ok; out.notes.push(`${checked-good} of ${checked} sampled shots didn’t show the planned footage (around ${bad.slice(0,3).map(t=>t.toFixed(1)+" s").join(", ")}). This happens when a clip can’t load in time on a busy computer. Close other tabs and make it again.`); }

  return out;
}

function previewEp(){ return EP($("previewEp").value) || EP(S.eps[0]) || ENDPOINTS[0]; }
function sizeStage(){ const ep=previewEp(); const cv=$("stage"); cv.width=Math.round(ep.w/2); cv.height=Math.round(ep.h/2); $("stageBox").style.setProperty("--ar",String(ep.w/ep.h)); }

async function preview(){
  if(S.running){ stopRun(); return; }
  if(!S.plan) return;
  stopListen();
  const ep=previewEp(); sizeStage();
  const cv=$("stage"); cv.hidden=false; $("stageEmpty").hidden=true;
  const o={ep:{...ep,w:cv.width,h:cv.height}, canvas:cv, g:cv.getContext("2d"), W:cv.width, H:cv.height};
  status(`Previewing the ${ep.name} version…`);
  const w=windowFor(ep); await runPass([o], w, false, makeExportPlan(ep,w));
  status("Preview finished.");
}

/* drop everything the last run produced before making new videos, so old videos never take up room */
function releaseResults(){
  const rv=$("resultVideo"); if(rv){ rv.pause(); if(rv.dataset.u){ URL.revokeObjectURL(rv.dataset.u); delete rv.dataset.u; } rv.removeAttribute("src"); rv.load(); rv.hidden=true; }
  (S.extras||[]).forEach(x=>{ if(x.url) URL.revokeObjectURL(x.url); });
  S.results=[]; S.extras=[]; S.clipAudio={};
}
async function storageReport(){
  const box=$("storeInfo"); if(!box) return;
  try{ const est=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate():null;
    const mem=(S.results||[]).reduce((a,r)=>a+r.blob.size,0)+(S.extras||[]).reduce((a,x)=>a+x.blob.size,0);
    box.textContent=`Saved project files: ${est?Math.round(est.usage/1e6):"?"} MB used${est&&est.quota?` of ${Math.round(est.quota/1e9)} GB available to this page`:""}. Finished videos held for saving: ${Math.round(mem/1e6)} MB.`;
  }catch(e){ box.textContent=""; }
}
async function freeSpace(){
  releaseResults(); renderResults();
  try{ const db=await PDB.open(); const keys=await new Promise(res=>{ const q=db.transaction("kv").objectStore("kv").getAllKeys(); q.onsuccess=()=>res(q.result); q.onerror=()=>res([]); });
    const keep=new Set([...(S.savedKeys||[])]); for(const k of keys){ if(String(k).startsWith("f:") && !keep.has(k)) await PDB.del(k); } }catch(e){}
  S.decIdx=new Map(); await storageReport(); status("Space freed: old videos and leftover files from earlier projects are gone.");
}
function showError(e,where){
  const msg=(e&&(e.message||e.name))||String(e||"unknown error");
  S.lastError=`${where||"Export"} failed: ${msg}\n${(e&&e.stack)||""}\nBrowser: ${navigator.userAgent}\nEngine: ${JSON.stringify(chooseEngine&&chooseEngine())}\nFormats: ${S.eps.join(", ")}\nClips: ${S.clips.length}, song ${S.an?Math.round(S.an.duration)+" s":"none"}`;
  if(/could not be read|NotReadable|permission problems/i.test(String(msg))||NATIVE&&/can’t be played in this browser/i.test(String(msg))) status(`${where||"Export"} stopped: Android took back access to some of your clips or the song (it does that after the app has been closed for a while). Add them again${NATIVE?" and the app will keep its own copy, so it won't happen again":""}.`,true);
  else status(`${where||"Export"} stopped with an error: ${msg}. Tap “Report this problem” to send it in.`,true);
  $("errBtn").hidden=false;
}
window.addEventListener("error",ev=>{ if(S.running||S._exporting) showError(ev.error||ev.message,"Export"); });
window.addEventListener("unhandledrejection",ev=>{ if(S.running||S._exporting) showError(ev.reason,"Export"); });
async function makeVideos(skipGate){
  if(S.running){ stopRun(); return; }
  if(S._retrySafe){ S._retrySafe=false; S._safeExport=true; crumb("export: safe mode after a stopped export"); }
  if(S._exporting) return;
  S._exporting=true; $("errBtn").hidden=true;
  try{ return await makeVideosInner(skipGate); }
  catch(e){ showError(e,"Export"); }
  finally{ S._exporting=false; if(S.running){ try{ S.running.stop(); }catch(_){} } S.running=null; S.activePlan=null; $("prog").hidden=true; updateButtons(); }
}
async function makeVideosInner(skipGate){
  if(!S.plan) return;
  const eps=S.eps.map(EP).filter(Boolean);
  if(!eps.length){ status("Tick at least one place to publish.",true); return; }
  if(!pickMime()){ status("This browser can’t record video. Use Chrome, Edge or Safari.",true); return; }
  { const g=gateProblems(); if(g.length){ status(g[0]+" Add more in step 2, or untick that platform.",true); renderChecklist(); return; } }
  if(!skipGate && $("aiGate").checked && await sampleP && S.reviewedSig!==projectSig()){
    status("Getting the AI review first. Check it, then export."); await runReview(true); return;
  }
  stopListen();
  { const r=await preflightClips(eps); if(r.lost) status(`${r.lost} clip${r.lost===1?"":"s"} could no longer be opened (Android took back access), so ${r.lost===1?"it's":"they're"} left out of this video. Add ${r.lost===1?"it":"them"} again to use ${r.lost===1?"it":"them"}.`); if(r.lost&&!S.plan) return; }
  // group exports that use the same part of the song; at most 3 encoders at once
  const groups=new Map();
  for(const ep of eps){ const w=windowFor(ep), key=w.map(x=>x.toFixed(2)).join("-")+(PRO()&&ep.short?"s":"l"); if(!groups.has(key)) groups.set(key,{win:w,eps:[]}); groups.get(key).eps.push(ep); }
  const passes=[]; for(const g of groups.values()) for(let i=0;i<g.eps.length;i+=3) passes.push({win:g.win, eps:g.eps.slice(i,i+3)});
  S.passCount=passes.reduce((a,p)=>a+(p.win[1]-p.win[0]),0); S.passBase=0;
  const total=passes.reduce((a,p)=>a+(p.win[1]-p.win[0]),0);
  $("offscreen").innerHTML=""; $("prog").hidden=false; $("prog").value=0;
  const cv=$("stage"); cv.hidden=false; $("stageEmpty").hidden=true;
  releaseResults(); renderResults();
  let done=0;
  for(let k=0;k<passes.length;k++){
    const p=passes[k], firstEp=p.eps[0];
    cv.width=Math.round(firstEp.w/2); cv.height=Math.round(firstEp.h/2); $("stageBox").style.setProperty("--ar",String(firstEp.w/firstEp.h));
    status(`Making ${p.eps.map(e=>e.name).join(", ")} (pass ${k+1} of ${passes.length}, about ${fmtTime(total-done)} left). Keep this tab visible.`);
    S.passBase=done; S.passCount=total;
    const outs=p.eps.map(ep=>mkOut(ep));
    const res=await runPass(outs,p.win,true,makeExportPlan(p.eps[0],p.win));
    if(!res){ status("Stopped. Finished files are kept below."); break; }
    S.results.push(...res); renderResults();
    done+=p.win[1]-p.win[0];
  }
  $("offscreen").innerHTML=""; $("prog").hidden=true;
  if(S.results.length){ status("Checking each file against its plan…");
    for(const r of S.results) recordUsage(r.plan); recordMade(S.results); // counts as a previous video from the next Remix or Do everything on
    try{ logRecipes(S.results); }catch(e){}
    for(const r of S.results){ try{ r.check=await verifyExport(r); }catch(e){ r.check={ok:null,notes:["Couldn’t check this file."]}; } await new Promise(res=>setTimeout(res,50)); }
    S.clipAudio={}; // release decoded clip sound
    renderResults(); }
  if(S.results.length) saveTitleHistory(S.results.flatMap(r=>{ const T=titleFor(r.ep); return [T.hook,T.title].filter(Boolean).map(t=>({t,date:today()})); }));
  if(S.results.length) saveHistory(S.results.map(r=>{ const pl=makeExportPlan(r.ep,r.win)||S.plan; return {shots:planPrint(pl,r.win,1), style:styleSig(), ep:r.ep.id, title:smartTitle(), date:today()}; }));
  S.extras=[];
  if(S.results.length && PRO()){ try{ S.extras=await makeCoverImages(); }catch(e){} renderResults(); }
  storageReport();
  if(S._swapped&&S._swapped.length){ const sw=S._swapped.slice(), n=sw.length; S._swapped=[]; setTimeout(()=>status(`Done, but ${n} clip${n===1?"":"s"} wouldn’t play on this device, so ${n===1?"its":"their"} shots used other clips: ${sw.slice(0,4).join(", ")}${n>4?"…":""}.`),50); }
  if(S.results.length===eps.length) status(`Done: ${S.results.length} video${S.results.length===1?"":"s"}${S.extras.length?" plus "+S.extras.length+" thumbnail"+(S.extras.length>1?"s":""):""} ready to save.`);
}


/* Before a video is made: every clip it uses must still open. A clip Android has taken back access to is recovered
   from the app's own copy or the saved project when one exists; otherwise it's left out and the edit is rebuilt
   without it, instead of the export failing halfway. */
async function canRead(f){ try{ await f.slice(0,65536).arrayBuffer(); return true; }catch(e){ return false; } }
async function recoverFile(c){ const f=c.file, key=`${f.size}-${f.lastModified}-${f.name}`.replace(/[\\/:*?"<>|]/g,"_").slice(0,180);
  try{ const dir=typeof keptDir==="function"?await keptDir():null; if(dir){ const g=await (await dir.getFileHandle(key)).getFile(); if(g.size===f.size){ const k=new File([g],f.name,{type:f.type,lastModified:f.lastModified}); k._kept=key; if(await canRead(k)) return k; } } }catch(e){}
  try{ const g=await PDB.get("f:"+f.name+":"+f.size+":"+f.lastModified); if(g&&await canRead(g)) return g; }catch(e){}
  return null; }
async function preflightClips(eps){ let lost=0, fixed=0; const used=new Set(); eps.forEach(ep=>{ const P=makeExportPlan(ep,windowFor(ep))||S.plan; P.forEach(s=>used.add(s.clip)); });
  for(const ci of used){ const c=S.clips[ci]; if(!c||!c.file||c.kind==="image") continue; if(await canRead(c.file)) continue;
    const g=await recoverFile(c); if(g){ try{ URL.revokeObjectURL(c.url); }catch(e){} c.file=g; c.url=URL.createObjectURL(g); if(S.decIdx) S.decIdx.delete(c); fixed++; crumb("recovered "+c.name); }
    else { c.off=true; lost++; crumb("can't open "+c.name+": left out"); } }
  if(lost){ refreshExclusion(true); buildPlan(); } return {lost,fixed}; }
