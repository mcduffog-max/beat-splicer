/* ---------------- Project files: save one anywhere, open it later and point it at your media ---------------- */
async function saveProjectFile(){
  if(!S.audioFile && !S.clips.length){ status("Nothing to save yet.",true); return; }
  const ref=f=>f?{name:f.name,size:f.size,lastModified:f.lastModified}:null;
  const an=S.an?{...S.an, peaks:Array.from(S.an.peaks||[]), freeEvents:S.an.freeEvents?[...S.an.freeEvents]:null}:null;
  let settings=null; try{ settings=JSON.parse(localStorage.getItem("beatsplicer2")||"null"); }catch(e){}
  const proj={app:"Beat Splicer",kind:"project",v:3,vetoes:[...(S.vetoes||[])],style:S.style,trims:S.trims||[],locks:[...(S.locks||new Map())],lyrics:S.lyrics||null,outline:S.outline||null,castMode:S.castMode,sceneMode:S.sceneMode,faceCast:S.faceCast||[],cast:S.cast,mainChar:S.mainChar,meta:S.meta||null,saved:new Date().toISOString(),audio:ref(S.audioFile),audioName:S.audioName,an,
    clips:S.clips.filter(c=>c.samples).map(c=>({ref:ref(c.file),name:c.name,kind:c.kind||"video",dur:c.dur,samples:c.samples,thumb:c.thumb,w:c.w,h:c.h,crop:c.crop,mute:!!c.mute,tags:c.tags||null,off:!!c.off,mv:c.mv||1,wm:c.wm,faces:faceSave(c)})),
    look:snapshot(),seed:S.seed,winPick:S.winPick||0,direct:S.direct||null,titles:S.titles,eps:S.eps,protagonist:S.protagonist||null,versions:S.versions||[],verIdx:S.verIdx||0,settings,
    songs:S.songs.filter(s=>s.an).map(s=>ref(s.file))};
  await saveFile(`${smartTitle()}.beatsplicer.json`,new Blob([JSON.stringify(proj)],{type:"application/json"}));
  status("Project saved. Open it any time with “Open project…”, then choose the folder with your song and clips.");
}
let pendingProj=null;
async function openProjectFile(f){
  try{ const p=JSON.parse(await f.text()); if(p.app!=="Beat Splicer"||p.kind!=="project") throw 0; pendingProj=p;
    $("projInfo").textContent=`“${f.name}”: “${p.audioName}” with ${p.clips.length} clips. Now choose the folder that holds them (subfolders are searched too).`; $("relinkLbl").hidden=false;
  }catch(e){ status("That isn’t a Beat Splicer project file.",true); }
}
async function relinkProject(files){
  const p=pendingProj; if(!p) return; files=[...files];
  const find=r=>r?(files.find(f=>f.name===r.name&&f.size===r.size)||files.find(f=>f.name===r.name)||null):null;
  const audio=find(p.audio); if(!audio){ status(`Couldn’t find “${p.audioName}” in that folder. Choose the folder that has it.`,true); return; }
  const clips=[]; let missing=0; for(const c of p.clips){ const f=find(c.ref); if(f) clips.push({...c,file:f}); else missing++; }
  const an=p.an?{...p.an,peaks:new Float32Array(p.an.peaks||[]),freeEvents:p.an.freeEvents?new Set(p.an.freeEvents):null}:null;
  if(p.settings) try{ localStorage.setItem("beatsplicer2",JSON.stringify(p.settings)); }catch(e){}
  await restoreProject({vetoes:p.vetoes,style:p.style,trims:p.trims,locks:p.locks,lyrics:p.lyrics,outline:p.outline,castMode:p.castMode,sceneMode:p.sceneMode,faceCast:p.faceCast,cast:p.cast,mainChar:p.mainChar,meta:p.meta,audio,audioName:p.audioName,an,clips,overlays:[],seed:p.seed,winPick:p.winPick,titles:p.titles,eps:p.eps,protagonist:p.protagonist,direct:p.direct,skipped:missing});
  if(p.look){ restore(p.look); }
  S.versions=p.versions||[]; S.verIdx=Math.min(p.verIdx||0,Math.max(0,S.versions.length-1)); renderVersions();
  if(p.songs&&p.songs.length){ S.songs=p.songs.map(r=>find(r)).filter(Boolean).map(f=>({file:f,an:f===audio?S.an:null})); renderSongs(); }
  buildPlan(); pendingProj=null; $("relinkLbl").hidden=true; $("projInfo").textContent="";
  status(`Project opened.${missing?` ${missing} clip${missing===1?" wasn’t":"s weren’t"} found in that folder.`:""}`);
}
let checklistTimer=0;
function scheduleChecklist(){ clearTimeout(checklistTimer); checklistTimer=setTimeout(renderChecklist,150); }
function renderChecklist(){
  const box=$("proList"); if(!box) return;
  if(!S.plan||!S.an){ box.textContent="Add audio and clips to see how each export measures up."; return; }
  box.innerHTML=""; S.checklist=[];
  { const h=document.createElement("div"); h.className="pro-ep"; h.textContent="Originality (all platforms)"; box.appendChild(h);
    const add=(k,t)=>{ const d=document.createElement("div"); d.className="pro-it "+k; const i=document.createElement("i"); i.textContent=k==="ok"?"✓":k==="warn"?"!":k==="fail"?"✕":"i"; const s=document.createElement("span"); s.textContent=t; d.append(i,s); box.appendChild(d); };
    const p=currentPrint(), hist=loadHistory(), c=closestTo(p,hist);
    if(!c) add("ok","First export from this device, so there’s nothing to repeat yet.");
    else { const diff=Math.round((1-c.sim)*100); add(c.sim<=0.6?"ok":"warn", c.sim<=0.6?`${diff}% different from your closest earlier export (“${c.ref.title}”, ${c.ref.date}).`:`Only ${diff}% different from “${c.ref.title}” (${c.ref.date}). Platforms limit reach for near-identical, templated uploads. Press Remix or change the director.`); }
    add("info","Use footage you shot or have rights to, with no other app’s watermark (TikTok, CapCut). Instagram and TikTok push those down. Crop removes corner marks from your own clips.");
    add("ok","Each platform gets its own opening line, framing and length, cut from your own footage. Platforms of the same length share a cut, which is fine: posting your own edit on several platforms counts as original.");
    const hooks=S.eps.map(EP).filter(e=>e&&e.short).map(e=>titleFor(e).hook).filter(Boolean);
    let dup=0; for(let i=0;i<hooks.length;i++) for(let j=0;j<i;j++) if(tSim(hooks[i],hooks[j])>=0.5) dup++;
    if(hooks.length>1) add(dup?"warn":"ok", dup?"Some platforms share nearly the same opening line. Press Write new titles.":"Every platform opens with its own line."); }
  for(const ep of S.eps.map(EP).filter(Boolean)){
    const r=evalExport(ep); S.checklist.push({platform:ep.name,warnings:r.items.filter(x=>x.k==="warn").map(x=>x.t)});
    const h=document.createElement("div"); h.className="pro-ep"; h.textContent=`${ep.name}, ${lenTag(r.len)}`; box.appendChild(h);
    r.items.forEach(x=>{ const d=document.createElement("div"); d.className="pro-it "+x.k; const i=document.createElement("i"); i.textContent=x.k==="ok"?"✓":x.k==="warn"?"!":x.k==="fail"?"✕":"i"; const s=document.createElement("span"); s.textContent=x.t; d.append(i,s); box.appendChild(d); });
  }
}

