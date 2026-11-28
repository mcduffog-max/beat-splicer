/* ---------------- Organising the clips folder on the phone ----------------
   The collections become real folders: each clip is moved into <category>/<collection> inside the folder you chose
   ("People/Beach · 12 Oct"). Android moves the file in place, so no space is used. Every move is written down, and
   "Put them back" returns the last organising to where the files were. Clips already in one of your own subfolders stay
   where you put them. The next time the folder is loaded, the subfolders are read back as these collections. */
const MOVES_KEY="beatsplicerMoves";
function movesLog(){ try{ const L=JSON.parse(localStorage.getItem(MOVES_KEY)||"[]"); return Array.isArray(L)?L:[]; }catch(e){ return []; } }
function saveMovesLog(L){ try{ localStorage.setItem(MOVES_KEY,JSON.stringify(L.slice(-5))); }catch(e){} }
function safeName(s){ return String(s||"").replace(/[\\/:*?"<>|]/g," ").replace(/\s+/g," ").trim().slice(0,60)||"Clips"; }
function canOrganise(){ return !!(NATIVE&&NP("Folder")&&savedFolders().clips); }
/* which clips go where: only clips that came from the remembered clips folder, and not those already in their place */
function organisePlan(){ const fo=savedFolders().clips; if(!fo) return []; const C=buildCollections(), root=fo.uri+"/document/", out=[];
  S.clips.forEach((c,ci)=>{ if(!c.samples||!c.doc||!c.docParent||!String(c.doc).startsWith(root)) return; const g=C.byId.get(C.byClip[ci]); if(!g||g.id.startsWith("f:")) return; // your own subfolders stay as they are
    const path=`${safeName(g.cat?CAT_NAME[g.cat]:"Other")}/${safeName(g.name)}`; if((c.folder||"")===path) return; out.push({ci,path}); });
  return out; }
let _orgArm=0;
async function organiseFolder(){ const FP=NP("Folder"), b=$("collOrg"); let fo=savedFolders().clips; if(!FP||!fo||S.running||S._organising) return;
  const plan=organisePlan(); if(!plan.length){ status("Everything is already in its folder."); return; }
  if(Date.now()-_orgArm>5000){ _orgArm=Date.now(); b.textContent=`Tap again to move ${plan.length} clips into subfolders of “${fo.name}”`; setTimeout(()=>{ if(Date.now()-_orgArm>=5000) renderOrganise(); },5100); return; }
  _orgArm=0; let ok=false; try{ ok=!!(await FP.check({uri:fo.uri})).write; }catch(e){}
  if(!ok){ status(`Choose “${fo.name}” again and allow the app to change it, so it can organise the folder.`); let f; try{ f=await FP.pick(); }catch(e){ renderOrganise(); return; }
    if(f.uri!==fo.uri){ status(`That’s a different folder from “${fo.name}”. Choose “${fo.name}” itself to organise it.`,true); renderOrganise(); return; }
    saveFolder("clips",{uri:f.uri,name:f.name||fo.name}); fo=savedFolders().clips; }
  S._organising=true; const log={at:Date.now(), folder:fo.name, uri:fo.uri, items:[]}, dirs=new Map(); let moved=0, failed=0;
  try{ for(let k=0;k<plan.length;k++){ const {ci,path}=plan[k], c=S.clips[ci]; if(!c) continue;
      if(k%5===0) status(`Organising “${fo.name}”: ${k+1} of ${plan.length}…`);
      try{ if(!dirs.has(path)) dirs.set(path,(await FP.mkdirs({uri:fo.uri,path})).dir); const to=dirs.get(path);
        const r=await FP.move({doc:c.doc,from:c.docParent,to}); log.items.push({key:clipKey(ci),name:c.name,doc:r.doc,at:to,back:c.docParent,folder:c.folder||""});
        c.doc=r.doc; c.docParent=to; c.folder=path; delete collUser().moves[clipKey(ci)]; moved++; }
      catch(e){ failed++; if(failed<=3) crumb(`organise: couldn't move ${c.name}: ${e&&e.message||e}`); } } }
  finally{ S._organising=false; if(log.items.length){ const L=movesLog(); L.push(log); saveMovesLog(L); } saveCollUser(); buildCollections(); saveProjectSoon(); }
  crumb(`organised “${fo.name}”: ${moved} moved into ${dirs.size} folders, ${failed} failed`);
  status(`Moved ${moved} clips into ${dirs.size} folders in “${fo.name}”.`+(failed?` Couldn’t move ${failed}.`:"")+" Put them back undoes it.",failed>0);
  renderCollSheet(); renderCollBar(); }
async function unorganiseFolder(){ const FP=NP("Folder"), L=movesLog(), log=L[L.length-1]; if(!FP||!log||S.running||S._organising) return;
  S._organising=true; let back=0, failed=0;
  try{ for(let k=log.items.length-1;k>=0;k--){ const it=log.items[k]; if(k%5===0) status(`Putting clips back in “${log.folder}”: ${log.items.length-k} of ${log.items.length}…`);
      try{ const r=await FP.move({doc:it.doc,from:it.at,to:it.back}); const ci=S.clips.findIndex((c,i)=>clipKey(i)===it.key); if(ci>=0){ const c=S.clips[ci]; c.doc=r.doc; c.docParent=it.back; c.folder=it.folder; } back++; }
      catch(e){ failed++; if(failed<=3) crumb(`put back: couldn't move ${it.name}: ${e&&e.message||e}`); } } }
  finally{ S._organising=false; L.pop(); saveMovesLog(L); buildCollections(); saveProjectSoon(); }
  status(`Put ${back} clips back where they were in “${log.folder}”.`+(failed?` Couldn’t move ${failed}.`:" The empty subfolders can be deleted."),failed>0);
  renderCollSheet(); renderCollBar(); }
function renderOrganise(){ const row=$("collOrgRow"); if(!row) return; row.hidden=!canOrganise(); if(row.hidden) return; const fo=savedFolders().clips, n=organisePlan().length, L=movesLog();
  $("collOrg").textContent=n?`Organise “${fo.name}” into subfolders (${n} clips)`:`“${fo.name}” is organised`; $("collOrg").disabled=!n;
  $("collUndo").hidden=!L.length; if(L.length) $("collUndo").textContent=`Put them back (${L[L.length-1].items.length} clips)`; }
