/* ---------------- Directions: one visual idea organises the whole video ----------------
   Some shape which footage goes where (two worlds, visual refrain, light to dark); others shape the picture itself
   (colour awakening, breathing frame, echoes, temperature arc, mirror moments, held breath). */
const MOTIF_INFO={
  none:["Straight cut","nothing but footage and rhythm"],
  twoworlds:["Two worlds","verses live in your cooler footage and choruses in the warmer, so each chorus feels like stepping somewhere else"],
  awakening:["Colour awakening","it begins in black and white and colour floods in when the song opens up, draining again in the quiet"],
  refrain:["Visual refrain","the chorus has its own set of shots that returns each time, the way a sung chorus does, while the verses keep moving on"],
  breathing:["Breathing frame","the letterbox closes in during quiet passages and opens wide at the peaks"],
  echoes:["Echoes","movement leaves trails on the loudest moments and stays clean everywhere else"],
  temperature:["Temperature arc","the colour travels from cold to warm across the song"],
  lightdark:["Light to dark","it opens on your brightest footage and sinks toward the darkest"],
  mirror:["Mirror moments","the picture folds into symmetry on the choruses"],
  heldbreath:["Held breath","the picture freezes for a moment before each drop, then lets go"]
};
const motifId=()=>($("motif")&&$("motif").value)||"none";
function clipWarmth(c){ const cols=(c.samples||[]).map(s=>s.col).filter(Boolean); return cols.length?cols.reduce((a,x)=>a+(x[0]-x[2]),0)/cols.length:null; }
function motifSetup(){
  const id=motifId(), M={id};
  if(id==="twoworlds"){ const w=S.clips.map((c,i)=>[i,c.samples&&!c.off?clipWarmth(c):null]).filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]); const med=w.length?w[w.length>>1][1]:0; M.world=new Map(w.map(([i,v])=>[i,v>=med?1:0])); }
  if(id==="refrain"){ const seen=new Set(), pick=[], r=rng((S.seed||1)*13+5); // two strong, different-looking clips; which two changes with each new cut
    S.clips.map((c,i)=>[i,c]).filter(([i,c])=>c.samples&&!c.off&&c.kind!=="image"&&c.dur>=3&&!isExcluded(i)).map(([i,c])=>[i,clipStats(c).mot+0.25*r()]).sort((a,b)=>b[1]-a[1]).forEach(([i])=>{ const f=famOf(i); if(pick.length<2&&!seen.has(f)){ seen.add(f); pick.push(i); } });
    M.refList=pick.map(i=>{ const c=S.clips[i], sm=c.samples.filter(s=>!s.cut&&!s.dark).sort((a,b)=>(b.motion||0)-(a.motion||0))[0]||c.samples[0]; return {clip:i,src:sm.t}; }); M.refrain=new Set(pick); }
  if(id==="echoes"&&S.an){ const e=[...S.an.E].sort((a,b)=>a-b); M.echoThr=Math.max(0.72,e[Math.floor(e.length*0.85)]||0.72); }
  S._motif=M;
}
function motifCost(seg,clip,ci,s){
  const M=S._motif; if(!M||M.id==="none"||!S.an) return 0; const rel=M.t1>M.t0?Math.max(0,Math.min(1,(seg.start-M.t0)/(M.t1-M.t0))):0;
  if(M.id==="twoworlds"&&M.world&&M.world.has(ci)){ if(rel>0.85) return 0; return M.world.get(ci)===(seg.e>(M.split??0.6)?1:0)?-0.2:0.9; } // the final stretch intercuts both worlds
  if(M.id==="refrain"&&M.refrain) return M.refrain.has(ci)?2.5:0; // refrain shots are kept for the choruses, where they are placed directly
  if(M.id==="lightdark"&&s.bN!=null) return 2.2*Math.abs(s.bN-(0.88-0.76*rel));
  return 0;
}
function annotateMotif(plan){ const id=motifId(), beatLen=S.an?60/S.an.bpm:0.5; let lastEntry=-99, lead=0, k=0, seen=false;
  plan.forEach((s,i)=>{ let lo=s.e; for(let j=i-1;j>=0&&s.start-plan[j].start<=12;j--) lo=Math.min(lo,plan[j].e); // the quietest point in the last 12 s
    const entry=(s.drop||(s.e>=0.65&&s.e-lo>=0.15))&&s.start-lastEntry>=10&&i>0;
    if(entry){ lastEntry=s.start; lead=2; k=0; } s._entry=entry; s._chorusLead=lead>0&&s.e>=0.55; s._refK=s._chorusLead?k:null; if(lead>0){ lead--; k++; }
    if(s.e>0.65) seen=true; s._seenLoud=seen; s._mfx=null; });
  const n=plan.length, t0=n?plan[0].start:0, t1=n?plan[n-1].end:1, es=plan.map(s=>s.e).sort((a,b)=>a-b), M=S._motif||{};
  M.t0=t0; M.t1=t1; M.lo=es[0]??0; M.hi=es[n-1]??1; M.split=Math.max(0.3,Math.min(0.8,es[n>>1]??0.6)); if(M.hi-M.lo>0.35) M.split=Math.min(M.split,0.62);
  // a window that opens already loud (most shorts): black and white for its opening moments, then colour arrives on a cut
  if(n&&plan[0].e>0.65){ const at=t0+Math.min(3,(t1-t0)*0.2); plan.forEach(s=>{ s._seenLoud=s.start>=at-0.01; }); }
  // no chorus entry inside the window: two or three evenly spaced shots (on bar lines where possible) carry the accent instead
  if(n>=6&&!plan.some(s=>s._chorusLead)){ const m=Math.max(2,Math.min(3,Math.round(n/7)));
    for(let j=0;j<m;j++){ let i=Math.max(1,Math.min(n-2,Math.round(n*(j+0.6)/(m+0.2)))); for(const d of [0,1,-1]){ if(plan[i+d]&&plan[i+d].down&&i+d>0&&i+d<n-1){ i+=d; break; } } plan[i]._chorusLead=true; plan[i]._refK=0; plan[i]._entry=true; } }
  let lastHold=-99;
  plan.forEach((s,i)=>{ const nx=plan[i+1], D=s.end-s.start; // held breath: the picture stops just before the music lands (never twice within a few seconds)
    const hold=id==="heldbreath"&&nx&&(nx._entry||nx.drop)&&D>=0.35&&!s._ramp&&s.end-lastHold>=6;
    s._freeze=hold?Math.min(0.45,beatLen,D*0.6):0; if(hold) lastHold=s.end; }); }
/* visual refrain: every chorus opens on the same two shots, at the same moments in their clips, the way a sung chorus repeats */
function applyRefrain(plan){ const M=S._motif; if(!M||M.id!=="refrain"||!M.refList||!M.refList.length) return;
  for(const s of plan){ if(s._refK==null||s._manual||s._loop||s._bookend) continue; const r=M.refList[s._refK%M.refList.length], c=S.clips[r.clip]; if(!c) continue;
    const D=s.end-s.start; s.clip=r.clip; s.src=Math.max(0,Math.min(c.dur-D-0.1,r.src)); s._refrain=true; s._ramp=false; } }
function motifFx(F,seg){
  const id=motifId(); if(id!=="awakening"&&id!=="mirror") return F;
  if(seg._mfx&&seg._mfxBase===F) return seg._mfx;
  let out=F;
  if(id==="awakening"){ const gray=seg._seenLoud?(seg.e<0.35?0.55:0):1; if(gray>0) out={...F,filter:(F.filter&&F.filter!=="none"?F.filter+" ":"")+`grayscale(${gray})`}; }
  if(id==="mirror"&&(seg._chorusLead||seg.drop)) out={...F,mirror:true};
  seg._mfx=out; seg._mfxBase=F; return out;
}
function motifPost(o,t,F,bi,opts,win){
  const id=motifId(); if(id==="none"||!S.an) return; const {g,W,H}=o, E=S.an.E, B=S.an.beats, e0=(E[bi.i]??0.5), e1=(E[bi.i+1]??e0);
  const span=(B[bi.i+1]??0)-(B[bi.i]??0), e=span>0?e0+(e1-e0)*Math.max(0,Math.min(1,bi.ph/span)):e0;
  const w0=win?win[0]:0, w1=win?win[1]:S.an.duration;
  if(id==="temperature"){ const rel=Math.max(0,Math.min(1,(t-w0)/Math.max(1,w1-w0))), a=0.24*Math.abs(2*rel-1); g.save(); g.globalCompositeOperation="soft-light"; g.fillStyle=rel<0.5?`rgba(50,110,255,${a})`:`rgba(255,145,45,${a})`; g.fillRect(0,0,W,H); g.restore(); }
  if(id==="breathing"){ const M=S._motif||(S._motif={id}), key=w0.toFixed(2)+"-"+w1.toFixed(2); M.rg=M.rg||{};
    if(!M.rg[key]){ let a=1,b=0; B.forEach((bt,i)=>{ if(bt>=w0&&bt<=w1){ a=Math.min(a,E[i]); b=Math.max(b,E[i]); } }); M.rg[key]={lo:(b-a>=0.06?a:Math.min(a,0.55)),hi:Math.max(b,a+0.01)}; }
    const lo=M.rg[key].lo, eR=(e-lo)/Math.max(0.1,M.rg[key].hi-lo); // measured against this video's own quietest and loudest moments
    const bh=Math.round(H*(W>=H?0.115:0.07)*(1-Math.max(0,Math.min(1,eR*1.1)))); if(bh>0){ g.fillStyle="#000"; g.fillRect(0,0,W,bh); g.fillRect(0,H-bh,W,bh); } }
  if(id==="echoes"&&!opts.still){ if(!o.echo){ o.echo=document.createElement("canvas"); o.echo.width=W; o.echo.height=H; o.echoOn=false; }
    const eg=o.echo.getContext("2d");
    if(e>=((S._motif&&S._motif.echoThr)||0.72)){ if(o.echoOn){ g.save(); g.globalAlpha=0.45; g.globalCompositeOperation="lighten"; g.drawImage(o.echo,-W*0.004,-H*0.004,W*1.008,H*1.008); g.restore(); } eg.drawImage(o.canvas,0,0); o.echoOn=true; } else o.echoOn=false; }
}
function annotateStory(plan){ annotateMotif(plan); plan.forEach((s,i)=>{ s._beat=storyBeat(s,i,plan); }); let k=0; for(let i=plan.length-1;i>=0;i--){ if(plan[i].build){ k++; plan[i].buildK=k; } else k=0; } }
/* focus: punch in on a face when the story wants a tighter shot than the footage has, and keep faces in vertical crops */
function assignFocus(plan){
  if(!$("faceFrame").checked) { plan.forEach(s=>s._focus=null); return; }
  plan.forEach(s=>{ const c=S.clips[s.clip], tg=tagAt(c,s.src+(s.end-s.start)/2); s._focus=null;
    if(!tg||!tg.box) return;
    const want=storyOn()?wantScale(s,s._beat||"introduce"):tg.scale, gap=Math.max(0,want-tg.scale);
    const z1=1+Math.min(0.3,gap*0.15), z0=s.build?1+Math.min(0.3,Math.max(0,gap-0.8)*0.15):z1; // a subtle push at most: the footage itself should carry the shot
    const eyeLift=want>=4.6?-0.12:want>=3.5?-0.06:0; // tighter shots frame higher on the face, toward the eyes
    s._focus={cx:tg.box.cx, cy:Math.max(0,tg.box.cy+eyeLift*tg.box.h*4), z0, z1}; });
}

const PDB={ db:null,
  open(){ return this.db?Promise.resolve(this.db):new Promise((res,rej)=>{ const r=indexedDB.open("beatsplicer",1); r.onupgradeneeded=()=>r.result.createObjectStore("kv"); r.onsuccess=()=>{ this.db=r.result; res(this.db); }; r.onerror=()=>rej(r.error); }); },
  async put(k,v){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction("kv","readwrite"); tx.objectStore("kv").put(v,k); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); },
  async get(k){ const db=await this.open(); return new Promise((res,rej)=>{ const q=db.transaction("kv").objectStore("kv").get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); },
  async del(k){ const db=await this.open(); return new Promise(res=>{ const tx=db.transaction("kv","readwrite"); tx.objectStore("kv").delete(k); tx.oncomplete=res; tx.onerror=res; }); } };
let saveTimer=0;
function saveProjectSoon(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveProject,1500); }
async function saveProject(){ try{ if(navigator.storage&&navigator.storage.persist&&!S._askedKeep){ S._askedKeep=true; navigator.storage.persist().catch(()=>{}); } }catch(e){}
  if(!S.audioFile||S._restoring) return;
  try{
    S.savedKeys=S.savedKeys||new Set();
    const fkey=f=>"f:"+f.name+":"+f.size+":"+f.lastModified, putFile=async f=>{ if(NATIVE&&f._kept) return "k:"+(f.type||"")+"\n"+f._kept; /* the app already keeps its own copy: don't store the file twice */ const k=fkey(f); if(!S.savedKeys.has(k)){ await PDB.put(k,f); S.savedKeys.add(k); } return k; };
    let budget=3e9; budget-=S.audioFile.size; const audioKey=await putFile(S.audioFile);
    const clips=[]; for(const c of S.clips){ if(!c.samples||!c.file) continue; if(c.file.size>budget) continue; budget-=c.file.size;
      clips.push({name:c.name,fileKey:await putFile(c.file),kind:c.kind||"video",dur:c.dur,samples:c.samples,thumb:c.thumb,w:c.w,h:c.h,crop:c.crop,mute:!!c.mute,tags:c.tags||null,mv:c.mv||1,off:!!c.off,wm:c.wm,faces:faceSave(c)}); }
    const ovs=S.overlays.map(o=>({name:o.name,pos:o.pos,size:o.size,opacity:o.opacity,blend:o.blend,timing:o.timing,anim:o.anim,file:o.file})).filter(o=>o.file);
    { const want=new Set([audioKey,...clips.map(c=>c.fileKey)]); for(const k of [...S.savedKeys]){ if(!want.has(k)){ await PDB.del(k); S.savedKeys.delete(k); } } } // files no longer in the project
    await PDB.put("project",{v:2,vetoes:[...(S.vetoes||[])],style:S.style,trims:S.trims||[],locks:[...(S.locks||new Map())],lyrics:S.lyrics||null,outline:S.outline||null,castMode:S.castMode,sceneMode:S.sceneMode,faceCast:S.faceCast||[],cast:S.cast,mainChar:S.mainChar,meta:S.meta||null,saved:Date.now(),audioKey,audioName:S.audioName,an:S.an,clips,skipped:S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)).length-clips.length,overlays:ovs,seed:S.seed,winPick:S.winPick||0,direct:S.direct||null,titles:S.titles,eps:S.eps,protagonist:S.protagonist||null});
  }catch(e){ /* storage full or unavailable: the project just won't survive a refresh */ }
}
async function offerRestore(){
  try{ const p=await PDB.get("project"); if(!p||!(p.audio||p.audioKey)) return;
    $("restoreText").textContent=`Pick up where you left off? “${p.audioName}” with ${p.clips.length} clip${p.clips.length===1?"":"s"}, saved ${new Date(p.saved).toLocaleString()}.${p.skipped?` ${p.skipped} very large clip${p.skipped===1?" needs":"s need"} adding again.`:""}`;
    $("restoreBox").hidden=false;
    $("restoreBtn").onclick=()=>restoreProject(p); $("freshBtn").onclick=async()=>{ try{ const db=await PDB.open(); db.transaction("kv","readwrite").objectStore("kv").clear(); }catch(e){} S.savedKeys=new Set(); $("restoreBox").hidden=true; };
  }catch(e){} }
async function restoreProject(p){
  $("restoreBox").hidden=true; S._restoring=true; status("Restoring your project…"); S.vetoes=new Set(p.vetoes||[]);
  try{
    const getF=async(k,name)=>{ if(!/^k:/.test(k)) return PDB.get(k); try{ const [type,kept]=k.slice(2).split("\n"), dir=await keptDir(), g=await (await dir.getFileHandle(kept)).getFile(), f=new File([g],name,{type,lastModified:g.lastModified}); f._kept=kept; return f; }catch(e){ return null; } };
    if(p.audioKey) p.audio=await getF(p.audioKey,p.audioName||"song");
    for(const c of p.clips){ if(c.fileKey&&!c.file) c.file=await getF(c.fileKey,c.name); }
    p.clips=p.clips.filter(c=>c.file);
    S.savedKeys=new Set([p.audioKey,...p.clips.map(c=>c.fileKey)].filter(k=>k&&!/^k:/.test(k)));
    S.clips=p.clips.map(c=>({...c,url:URL.createObjectURL(c.file)}));
    for(const c of S.clips){ if(c.kind==="image"){ c.img=new Image(); c.img.src=c.url; try{ await c.img.decode(); }catch(e){} } }
    { const old=S.clips.filter(c=>c.kind!=="image" && c.mv!==2); // measured with the older motion method: measure again so movement is judged correctly
      for(let k=0;k<old.length;k++){ status(`Re-measuring movement in your clips (${k+1} of ${old.length})…`); try{ const fresh=await analyzeClip(old[k].file); URL.revokeObjectURL(fresh.url); old[k].samples=fresh.samples; old[k].mv=2; old[k].wm=fresh.wm; }catch(e){} } }
    S.overlays=[]; for(const o of p.overlays||[]){ const url=URL.createObjectURL(o.file), img=new Image(); img.src=url; try{ await img.decode(); S.overlays.push({...o,url,img}); }catch(e){} }
    S.audioFile=p.audio; S.audioName=p.audioName; const ac=new (window.AudioContext||window.webkitAudioContext)(); S.audioBuf=await ac.decodeAudioData(await p.audio.arrayBuffer()); ac.close();
    S.audioOrig=S.audioBuf; S._endingFor=null; if($("songVer").value!=="orig") S.audioBuf=await versionedBuffer(S.audioOrig,$("songVer").value);
    buildFamilies();
    S.cast=p.cast||[]; S.faceCast=p.faceCast||[]; S.outline=p.outline||null; S.lyrics=p.lyrics||null; S.trims=p.trims||[]; S.locks=new Map(p.locks||[]); S.hist=[]; S.fut=[]; if(p.style) S.style=p.style; setTimeout(renderStyleState,0); renderLyrics(); S.castMode=p.castMode||"only"; S.sceneMode=p.sceneMode||"only"; S.mainChar=p.mainChar||""; renderOutline(); S.meta=p.meta||null; refreshChars();
    S.an=p.an; S.seed=p.seed||1; S.winPick=p.winPick||0; S.titles=p.titles||{}; if(Array.isArray(p.eps)) S.eps=p.eps; S.protagonist=p.protagonist||null;
    if(p.direct){ S.direct=p.direct; $("direct").value=p.direct; }
    $("audioInfo").textContent=`${S.audioName}, ${fmtTime(S.an.duration)} at about ${Math.round(S.an.bpm)} BPM. Feel: ${S.an.feel?S.an.feel.label:"4/4"}`; renderTempo(); $("listen").disabled=false;
    buildEndpointUI(); renderClips(); renderOverlays(); buildPlan(); syncCapWith(); renderTitles();
    setTimeout(()=>backfillFlow().catch(()=>{}),4000); if(S.clips.some(c=>c.samples&&c.samples.some(s=>s.ce))) setTimeout(()=>seeReady(),1500);
    status("Project restored."+(p.skipped?` Add the ${p.skipped} very large clip${p.skipped===1?"":"s"} again if you want them.`:""));
  }catch(e){ crumb("restore failed: "+(e&&e.message||e)); status(`Couldn’t restore that project (${String(e&&e.message||e).slice(0,120)}). Add your audio and clips again.`,true); }
  finally{ S._restoring=false; }
}

function movingShare(P,w){ let mov=0; const len=Math.max(0.1,w[1]-w[0]);
  P.forEach(s=>{ const d=Math.min(s.end,w[1])-Math.max(s.start,w[0]); if(d<=0) return; const c=S.clips[s.clip]; if(!c||c.kind==="image"||!c.samples) return;
    const sm=c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]); if((sm.motion||0)>=2) mov+=d; });
  return mov/len; }
/* find the pace setting that lands each export near the research targets: about 2 s a shot for full music videos,
   about 1.6 s for short-form (with quick cuts and half-beat accents still happening inside that) */
function calibratePace(){ const it=paceSteps(); let r; do{ r=it.next(); }while(!r.done); return r.value; }
async function calibratePaceAsync(){ const it=paceSteps(); let r; while(!(r=it.next()).done) await new Promise(res=>setTimeout(res,0)); return r.value; } // same search, letting the page breathe between steps
function* paceSteps(){
  const eps=S.eps.map(EP).filter(Boolean); if(!eps.length||!S.an) return; let best=null;
  try{ for(const pc of [0.5,0.75,1,1.25,1.5,1.75,2]){ S._dry=true; setControl("pace",pc); buildPlan(); let err=0;
    for(const ep of eps){ const w=windowFor(ep), P=makeExportPlan(ep,w)||S.plan, asl=(w[1]-w[0])/Math.max(1,P.length), fk=Math.min(1.6,feelK(S.an))*(S._paceK||1), tgt=(ep.short?1.6:2.0)*fk;
      // the loud passages set the pace (that's where momentum lives); the overall average only loosely
      const loud=P.filter(s=>s.e>0.7).map(s=>Math.min(s.end,w[1])-Math.max(s.start,w[0])).filter(d=>d>0), aslL=loud.length>=4?loud.reduce((a,b)=>a+b,0)/loud.length:null, tL=(ep.short?1.0:1.1)*fk;
      err+=((aslL?Math.abs(Math.log(aslL/tL)):0)+(ep.short?0.7:0.4)*Math.abs(Math.log(asl/tgt)))*(ep.short?1:1.5); }
    if(!best||err<best.err) best={pc,err}; S._dry=false; yield; } } finally{ S._dry=false; }
  setControl("pace",best.pc); buildPlan(); return best.pc;
}
function dirHistory(){ try{ return JSON.parse(localStorage.getItem("beatsplicerDirections")||"[]"); }catch(e){ return []; } }
/* which directions this song and this footage can actually carry */
function feasibleMotifs(){
  const vids=S.clips.filter(c=>c.samples&&!c.off), warm=vids.map(clipWarmth).filter(v=>v!=null).sort((a,b)=>a-b), spread=warm.length?warm[Math.floor(warm.length*0.8)]-warm[Math.floor(warm.length*0.2)]:0;
  const br=vids.flatMap(c=>c.samples.map(s=>s.bright)).sort((a,b)=>a-b), bsp=br.length?br[Math.floor(br.length*0.85)]-br[Math.floor(br.length*0.15)]:0;
  const E=S.an.E, n0=Math.max(1,Math.floor(E.length*0.15)), intro=E.slice(0,n0).reduce((a,b)=>a+b,0)/n0, range=Math.max(...E)-Math.min(...E), loud=E.filter(e=>e>0.65).length/E.length;
  const drops=makeSegments(S.an,1).filter(s=>s.drop).length, free=!!(S.an.feel&&S.an.feel.free);
  return {none:1, breathing:range>0.4?1.1:0.5, temperature:1, mirror:loud>0.15&&loud<0.7?1:0.4, echoes:free?0.15:(loud>0.2?1:0.4), awakening:intro<0.5?1.2:0.4,
    heldbreath:!free&&drops>=2?1.1:0, twoworlds:warm.length>=12&&spread>25?1.2:0, refrain:vids.length>=20&&loud>0.2&&loud<0.75?1.1:0, lightdark:bsp>45?1:0};
}
function weightedPick(pairs){ const tot=pairs.reduce((a,p)=>a+p[1],0); let r=Math.random()*tot; for(const p of pairs){ r-=p[1]; if(r<=0) return p[0]; } return pairs[pairs.length-1][0]; }
/* choose by fit AND by what hasn't been done lately: the last three directions are all but ruled out, older ones are discounted */
function pickDirection(avoid){
  const hist=dirHistory().slice(-6), fit=feasibleMotifs();
  return weightedPick(Object.keys(fit).filter(k=>fit[k]>0).map(k=>{ let x=fit[k]*(k==="none"?0.6:1); hist.forEach((hh,i)=>{ if(hh.motif===k) x*=(hist.length-i)<=3?0.02:0.4; }); if(avoid&&avoid.includes(k)) x*=0.005; return [k,x*learnW("motif",k)]; }));
}
function versionScore(){
  let ok=0,warn=0,fail=0,total=0; const mot=[];
  for(const ep of S.eps.map(EP).filter(Boolean)){
    const r=evalExport(ep); r.items.forEach(x=>{ if(x.k==="ok") ok++; else if(x.k==="warn") warn++; else if(x.k==="fail") fail++; });
    const w=windowFor(ep), P=makeExportPlan(ep,w)||S.plan, pr=paceReport(P,w); if(pr) total+=3*Math.max(0,pr.r);
    const m=movingShare(P,w); mot.push(m); total+=(ep.short?6:3)*m;
    // pacing against the research targets: music videos about 2 s a shot, short-form 1.2 to 2 s; reward a few half-beat accents
    const asl=(w[1]-w[0])/Math.max(1,P.length), lo=ep.short?1.2:1.6, hi=ep.short?2.0:2.6;
    total-=4*Math.max(0,asl-hi)+4*Math.max(0,lo-asl);
    { const loud=P.filter(s=>s.e>0.7).map(s=>Math.min(s.end,w[1])-Math.max(s.start,w[0])).filter(d=>d>0); // momentum lives in the loud passages
      if(loud.length>=4){ const aL=loud.reduce((a,b)=>a+b,0)/loud.length; total-=5*Math.max(0,aL-(ep.short?1.3:1.6)); } }
    if(P.some(s=>s._accent)) total+=ep.short?1.5:1; }
  total+=ok-2*warn-6*fail; const c=closestTo(currentPrint(),loadHistory()); if(c) total+=5*(1-c.sim); // novelty against your own recent videos
  return {total,ok,warn,fail,motion:Math.round(100*(mot.length?Math.min(...mot):0))};
}
async function autopilot(){
  if(!S.plan||!S.an){ status("Add your song and clips first, then press Do everything.",true); return; }
  if(S.running||S._auto) return;
  S._auto=true; S._quiet=true; const btn=$("autoBtn"); btn.disabled=true; const out=$("autoOut"), lines=[]; const breathe=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
  await breathe();
  if(S.plan){ const ep=S.eps.map(EP).filter(Boolean)[0]; recordUsage(ep?(makeExportPlan(ep,windowFor(ep))||S.plan):S.plan); } refreshExclusion(true); // the edit being replaced counts as a previous version
  const say=t=>{ lines.push(t); out.innerHTML=""; for(const l of lines){ const d=document.createElement("div"); d.textContent="• "+l; out.appendChild(d); } };
  try{
    const aiId=[...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v]);
    if(aiId && !hasTags()){ status("Reading your footage…"); await readFootage(); }
    say(hasTags()?`Footage read: ${S.clips.filter(c=>c.tags&&c.tags.length).length} clips understood (shot sizes, faces, subject).`:"No AI available to read the footage, so choices use movement, brightness and filming order.");
    // proven defaults from the research behind each feature
    [["mode","energy"],["variety",0.25],["trans","auto"],["proRules",true],["storyOn",true],["faceFrame",true],["shortLen","rec"],["fit","fill"],["fadeIn",true],["fadeOut",true],["pace",1]].forEach(([k,v])=>setControl(k,v));
    const tagged=S.clips.filter(c=>c.tags&&c.tags.length), hero=hasTags()?protagonist():"";
    const heroShare=hero?tagged.filter(c=>c.tags.some(t=>t.subj===hero)).length/Math.max(1,tagged.length):0;
    const times=S.clips.map(c=>c.file&&c.file.lastModified).filter(Boolean), spanH=times.length>1?(Math.max(...times)-Math.min(...times))/3.6e6:0;
    const camLike=S.clips.filter(c=>c.samples&&/^(IMG|VID|DSC|PXL|MVI|GOPR|GH0|DJI|MOV|DSCF|P\d{7})[_-]?\d/i.test(c.name)).length/Math.max(1,S.clips.filter(c=>c.samples).length);
    const shape=heroShare>=0.6?"portrait":(spanH>=0.5&&spanH<=96&&camLike>=0.6)?"journey":"peak"; setControl("storyShape",shape); // journey only for real filming order (camera files), never just folder order
    say(`Story: ${shape==="portrait"?`a portrait of “${hero}”, who appears in ${Math.round(heroShare*100)}% of your clips`:shape==="journey"?`a journey in the order you filmed (your clips span ${Math.round(spanH)} hours)`:"build to the peak: open wide, push in through each build, land the drops on faces, pull back to finish"}.`);
    const GIMMICK=["Doodle pop","Frantic strobe","Glitch nightmare","Infinite loop"], big=S.clips.length>120, hist=dirHistory();
    // the direction: one visual idea for this video, chosen by fit and by what recent videos haven't done
    const dirId=pickDirection(S._avoidDir); S._avoidDir=null; setControl("motif",dirId);
    say(`Direction: ${MOTIF_INFO[dirId][0]}. ${MOTIF_INFO[dirId][1][0].toUpperCase()+MOTIF_INFO[dirId][1].slice(1)}.`);
    // style: any of the six best-suited, weighted away from the ones used lately
    const ranked=rankDirectors().filter(d=>!GIMMICK.includes(d.name)).slice(0,6), pool=ranked.map((d,i)=>{ let x=(1/(1+i*0.5))*learnW("style",d.name); hist.slice(-5).forEach((hh,k,a)=>{ if(hh.dir===d.name) x*=(a.length-k)===1?0.001:(a.length-k)===2?0.08:0.5; }); return [d,x]; }); // never the style of the video just before
    const top=[]; for(let k=0;k<2&&pool.length;k++){ const d=weightedPick(pool); top.push(d); pool.splice(pool.findIndex(p=>p[0]===d),1); }
    // rhythm personality, colour look and lettering also rotate
    const recent=k=>hist.slice(-2).map(hh=>hh[k]), nb=noteBias(), paceName=weightedPick([["tight",1],["classic",1.2],["spacious",1]].filter(p=>!recent("pace").slice(-1).includes(p[0])||nb.pace===p[0]).map(p=>[p[0],p[1]*learnW("pace",p[0])*(nb.pace===p[0]?4:1)])); S._paceName=paceName;
    S._paceK={tight:0.85,classic:1,spacious:1.22}[paceName];
    const LOOKPOOL={awakening:["own","vivid","glossy"],temperature:["own","none","moody"],twoworlds:["own","none","vivid"]}[dirId]||["own","none","warmfilm","moody","painterly","fincher","cold","bw","tealorange","vivid","glossy"], LOOKW={own:5,none:1.5,tealorange:0.3,glossy:0.4,vivid:0.5,neon:0.2,vhs:0.2}; // its own grade first; trend looks rarely
    let textPick=weightedPick(["clean","box","cinema","impact","serif"].filter(t=>!recent("text").includes(t)).map(t=>[t,learnW("text",t)]));
    const calm=!!(S.an.feel&&S.an.feel.free), sigPick=calm?"mixed":weightedPick(["whip","zoomthru","spin","mask","flash","zoom","zoomout","dip","mixed"].filter(t=>!recent("sig").includes(t)).map(t=>[t,(t==="mixed"?0.6:1)*learnW("sig",t)]));
    // the camera: a lens kit and an energy that suit the style, the song and the footage (and what has kept viewers)
    const lensKit=(()=>{ const sty=(top[0]&&top[0].name)||"", w={cinema:1.2,epic:0.8,vintage:0.8,indie:0.7,dream:0.6,clean:0.7};
      if(/Cinematic|Dark precision|Stark|Symmetry/.test(sty)){ w.epic*=2.2; w.cinema*=1.4; } if(/Dreamlike|Painterly|Fisheye glam/.test(sty)){ w.dream*=2.2; w.vintage*=1.4; } if(/Playful|one-take|Infinite/.test(sty)){ w.indie*=2; w.vintage*=1.5; } if(/Glossy|Frantic|Glitch|Doodle/.test(sty)){ w.clean*=2; w.cinema*=1.2; }
      if(calm||S.an.bpm<88){ w.dream*=1.6; w.vintage*=1.3; w.clean*=0.6; } if(S.an.bpm>128){ w.clean*=1.5; w.dream*=0.6; }
      const vids=S.clips.filter(c=>c.samples&&!c.off&&c.kind!=="image"), small=vids.filter(c=>Math.max(c.w||0,c.h||0)<1200).length/Math.max(1,vids.length);
      if(small>0.6){ w.vintage*=1.6; w.indie*=1.6; w.clean*=0.4; w.epic*=0.8; } // grain and glow suit soft, small footage; clinical glass shows it up
      return weightedPick(Object.entries(w).filter(([k])=>!recent("lens").includes(k)).map(([k,x])=>[k,x*learnW("lensKit","kit:"+k)])); })();
    const camEnergy=(()=>{ const body=S.an.E.filter(v=>v>0.05), e=body.reduce((a,b)=>a+b,0)/Math.max(1,body.length); const base=calm||S.an.bpm<85?"gentle":(S.an.bpm>125&&e>0.55)?"bold":"normal";
      const nb2=noteBias(); return weightedPick(["gentle","normal","bold"].map(k=>[k,(k===(nb2.en||base)?5:1)*learnW("camEnergy",k)])); })();
    const dress=()=>{ setControl("camMoves","director"); setControl("lens",has("lens")?"kit:"+lensKit:"none"); setControl("camEnergy",camEnergy); const cur=$("look").value; if(cur!=="own"&&recent("look").includes(cur)||!LOOKPOOL.includes(cur)||dirId==="awakening"&&cur==="bw"){ const opts=LOOKPOOL.filter(l=>l!=="own"||has("ownLook")).filter(l=>(l==="own"||!recent("look").includes(l))&&!(dirId==="awakening"&&l==="bw")); if(opts.length) setControl("look",weightedPick(opts.map(l=>[l,(LOOKW[l]||1)*learnW("look",l)]))); } if($("look").value!=="own"&&S._ownPick&&has("ownLook")) setControl("look","own"); setControl("textStyle",textPick); setControl("sigTrans",sigPick); }; // a style's preset look gives way to the video's own grade most of the time
    const HS=houseStyle(); if(HS&&$("houseOn").checked){ textPick=HS.text||textPick; if(HS.end!=null) setControl("endStyle",!!HS.end); } // the channel's own lettering and ending
    S._ownPick=Math.random()<0.75*learnW("look","own");
    let best=null, tried=0; const seeds=big?2:3;
    // restraint: the footage carries the edit; no overlays or zooms layered on top of it
    const restrain=()=>["fxDoodles","fxStrobe","fxGlitch","fxShake","fxMultiply","fxSplit","fxFisheye","fxMirror","fxWash","fxPulse","kb","fxHandheld"].forEach(id=>setControl(id,false));
    for(const d of top){ for(let k=0;k<seeds;k++){ tried++; status(`Trying cut ${tried} of ${top.length*seeds}…`); await new Promise(r=>setTimeout(r,0));
      S.seed=(Math.random()*1e9)|0; S.winPick=k; $("direct").value=d.name; S._hold=true; try{ setDirect(d.name,""); restrain(); setControl("motif",dirId); dress(); }finally{ S._hold=false; } await breathe(); await calibratePaceAsync(); await breathe();
      const sc=versionScore(); await breathe(); if(!best||sc.total>best.sc.total) best={dir:d.name,snap:snapshot(),sc}; } }
    S._hold=true; try{ restore(best.snap); $("direct").value=best.dir; S._autoRun=true; try{ setDirect(best.dir,"chosen by Do everything"); }finally{ S._autoRun=false; } }finally{ S._hold=false; } restrain(); setControl("motif",dirId); setControl("look",best.snap.look.look); setControl("textStyle",best.snap.look.textStyle); setControl("sigTrans",sigPick); setControl("pace",best.snap.look.pace); S.seed=best.snap.seed; S.winPick=best.snap.winPick; buildPlan();
    await breathe();
    try{ const hh=dirHistory(); hh.push({motif:dirId,dir:best.dir,lens:lensKit,look:$("look").value,text:$("textStyle").value,pace:paceName,sig:sigPick,t:Date.now()}); localStorage.setItem("beatsplicerDirections",JSON.stringify(hh.slice(-12))); }catch(e){}
    S.versions.push({...snapshot(),print:currentPrint()}); S.verIdx=S.versions.length-1; renderVersions(); setStyleState(best.dir,"auto",true);
    say(`Style: ${best.dir}, with a ${paceName} rhythm, the “${$("look").selectedOptions[0].textContent}” colour look, ${$("textStyle").selectedOptions[0].textContent.toLowerCase()} lettering${sigPick!=="mixed"?` and ${$("sigTrans").selectedOptions[0].textContent.toLowerCase()} as its signature transition`:""}.`);
    { const c=closestTo(currentPrint(),loadHistory()); if(c) say(`Novelty: ${Math.round((1-c.sim)*100)}% different from the closest of your recent videos${c.sim>0.6?" (close: “Try another direction” for something further away)":""}.`); }
    if($("look").value==="own") say(`Colour: a grade of its own, built from this footage and song (${ownLookWords()}).`);
    if(has("lens")) say(`Camera: ${LENS_KITS[lensKit].name.toLowerCase()} lenses (${[["verse","verses"],["chorus","choruses"],["bridge","the bridge"]].map(([k,w])=>`${w} on ${LENSES[LENS_KITS[lensKit][k]].name.split(/ \(| style|:/)[0]}`).join(", ")}), ${camEnergy} camera moves that follow the song's sections.`);
    { const bo=S.plan.filter(s=>s._bold&&s.tr); if(bo.length&&restraint()!=="any") say(`Restraint: ${bo.length===1?"one bold moment":`${bo.length} bold moments`}, ${bo.map(s=>`${{whip:"a whip pan",zoom:"a punch zoom",zoomout:"a pull-back",zoomthru:"a zoom-through",spin:"a spin",mask:"a wipe",flash:"a flash"}[s.tr.type]||s.tr.type} at ${fmtTime(s.start)}`).join(" and ")}; everything else cuts clean.`); }
    say(`Tried ${tried} cuts in this direction and kept the strongest: ${best.sc.ok} checks passed${best.sc.warn?`, ${best.sc.warn} to look at`:""}${best.sc.fail?`, ${best.sc.fail} blocking export`:""}.`);
    say(`Movement: at least ${best.sc.motion}% of every cut shows genuinely moving footage. Not happy with the idea? “Try another direction” picks a different one.`);
    await breathe(); S._cur=planState(); S._curJ=JSON.stringify(S._cur.snap); S._lastPush=0;
    if($("autoTitles").checked){ status("Writing titles…"); await writeTitles(!!aiId); say(`Titles written for ${S.eps.length} platform${S.eps.length===1?"":"s"}${aiId?" from your footage":""}.`); }
    else say($("hookText").value.trim()?`Title: “${$("hookText").value.trim()}”.`:"No on-screen title. Type one under the preview if you want one.");
    { const L=learned(); if(L&&$("learnOn")&&$("learnOn").checked&&L.n>=2){ const s=learnSummary(L).filter(x=>x.startsWith("Working")); if(s.length) say(`Leaning towards what has kept your viewers (${L.n} Shorts): ${s.map(x=>x.replace("Working: ","").replace(/ \(.*$/,"")).join(", ")}.`); } }
    { const se=S.eps.map(EP).find(e=>e&&e.short); if(se){ windowFor(se); say(S._hookWhy?`The ${se.name} opens on ${S._hookWhy}, so viewers recognise the song in the first second.`:`The ${se.name} opens on the strongest beat it could find. Add the song’s lyrics for an opening on the chorus.`); } }
    await breathe(); renderChecklist();
    status(best.sc.fail?"Settings chosen, but something is blocking export. See the checklist under Where it’s going.":`Your cut is ready. Press play to watch it, or ${$("makeNow").textContent}.`);
  }catch(e){ showError(e,"Do everything"); }
  finally{ const wasBig=true; S._auto=false; S._quiet=false; S._hold=false; if(wasBig&&S.plan&&!S.running) try{ buildPlan(); }catch(e){} btn.disabled=!S.plan; try{ drawTimeline(); renderStats(); updateButtons(); }catch(e){} }
}
