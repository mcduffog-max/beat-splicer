/* ---------------- Filters: only these characters / backgrounds, or everything except them ---------------- */
S.sceneSel=new Set(); S.castMode="only"; S.sceneMode="only";
function clipTypes(c){ const L=CAST(); return new Set((c.chars||[]).map(id=>{ const x=L.find(k=>k.id===id); return x&&x.type; }).filter(Boolean)); }
function filterMatch(c){
  let ok=true;
  if(S.castSel&&S.castSel.size){ const ty=clipTypes(c), has=[...S.castSel].some(k=>k.startsWith("t:")?ty.has(k.slice(2)):(c.chars||[]).includes(k)); ok=ok&&(S.castMode==="except"?!has:has); }
  if(S.sceneSel&&S.sceneSel.size){ const sc=clipScenes(c), has=[...S.sceneSel].some(k=>sc.has(k)); ok=ok&&(S.sceneMode==="except"?!has:has); }
  return ok; }
function refreshFilter(){ S._filtOut=null; S._filtRelaxed=false; if(!(S.castSel&&S.castSel.size)&&!(S.sceneSel&&S.sceneSel.size)) return;
  const out=new Set(); S.clips.forEach((c,i)=>{ if(c.samples&&!filterMatch(c)) out.add(i); });
  const left=S.clips.filter((c,i)=>c.samples&&!c.off&&!out.has(i)).length; if(left<4){ S._filtRelaxed=true; return; } // too few would be left to cut a video from
  S._filtOut=out; }
function isFiltered(ci){ return !!(S._filtOut&&S._filtOut.has(ci)); }
function filterChanged(){ refreshFilter(); _rcT=0; renderClips(); renderCast(); renderScenes(); saveProjectSoon(); if(!S.running&&S.an) buildPlan(); }
function modeChip(get,set){ const b=document.createElement("button"); b.type="button"; b.className="chip"; const m=get(); b.textContent=m==="except"?"Everything except these":"Only these"; b.title="Switch between using only the selected ones and using everything except them"; b.setAttribute("aria-pressed",String(m==="except")); b.onclick=()=>{ set(get()==="except"?"only":"except"); filterChanged(); }; return b; }
function renderScenes(){ const box=$("sceneBar"); if(!box) return; box.innerHTML=""; const vids=S.clips.filter(c=>c.samples); if(!vids.length){ box.hidden=true; box.style.display="none"; return; }
  box.hidden=false; box.style.display="flex"; const lab=document.createElement("span"); lab.textContent="Backgrounds:"; lab.style.marginRight="4px"; box.appendChild(lab);
  const cnt=new Map(); vids.forEach(c=>clipScenes(c).forEach((n,k)=>cnt.set(k,(cnt.get(k)||0)+1)));
  if(!cnt.size){ const hint=document.createElement("span"); hint.style.opacity="0.75"; hint.textContent="press “Read my footage with AI” to sort your clips by where they’re set (city, landscape, futuristic…)."; box.appendChild(hint); return; }
  [...cnt.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent=`${sceneLabel(k)} (${n})`; b.setAttribute("aria-pressed",String(S.sceneSel.has(k))); b.title="Use clips set here (choose several to combine)";
    b.onclick=()=>{ S.sceneSel.has(k)?S.sceneSel.delete(k):S.sceneSel.add(k); filterChanged(); }; box.appendChild(b); });
  if(S.sceneSel.size){ box.appendChild(modeChip(()=>S.sceneMode,v=>S.sceneMode=v)); const cl=document.createElement("button"); cl.type="button"; cl.className="chip"; cl.textContent="Clear"; cl.onclick=()=>{ S.sceneSel.clear(); filterChanged(); }; box.appendChild(cl); } }
function aiProvider(){ return [...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v])||null; }
/* the AI looks at each character's faces side by side: it names them by what it sees ("bald cyborg with breathing mask"),
   gives a type ("cyborg", "cowboy"), points out any face that is a different person, and says which rows are the same person */
async function aiCheckCharacters(){
  const id=aiProvider(), L=(S.faceCast||[]).slice(0,10); if(!id||!L.length) return false;
  const T=72, cols=6, sheet=document.createElement("canvas"); sheet.width=T*(cols+1); sheet.height=T*L.length; const g=sheet.getContext("2d"); g.fillStyle="#111"; g.fillRect(0,0,sheet.width,sheet.height);
  const tiles=[]; for(let r=0;r<L.length;r++){ const all=S.clips.flatMap(c=>(c.faces||[]).filter(f=>f.id===L[r].id)), cv=fqDec(L[r].c), far=f=>fDist(f._v||fqDec(f.d),cv);
    // the clearest faces show who it is; the ones furthest from the group are the ones worth double-checking
    const best=[...all].sort((a,b)=>b.s-a.s).slice(0,3), odd=[...all].filter(f=>!best.includes(f)).sort((a,b)=>far(b)-far(a)).slice(0,cols-best.length), fs=[...best,...odd]; tiles.push(fs);
    g.fillStyle="#FFE14D"; g.font="bold 30px system-ui"; g.fillText(String(r+1),18,r*T+48);
    for(let k=0;k<fs.length;k++){ const im=new Image(); im.src=fs[k].th; try{ await im.decode(); g.drawImage(im,T*(k+1)+2,r*T+2,T-4,T-4); }catch(e){} g.fillStyle="#fff"; g.font="bold 13px system-ui"; g.fillText(String.fromCharCode(97+k),T*(k+1)+5,r*T+16); } }
  const blob=await new Promise(r=>sheet.toBlob(r,"image/jpeg",0.88));
  const prompt=`Image 1 shows ${L.length} rows of face crops from a video library. Each row (numbered in yellow) is meant to be one character; tiles in a row are lettered a, b, c….
Reply with ONLY JSON: {"rows":[{"row":1,"name":"3-6 word visual description","type":"1-2 word character type","odd":["c"]}],"same":[[1,4]]}
name: what makes this character recognisable at a glance, from what is visible (e.g. "bald man with breathing mask", "woman with side buns in white", "cowboy with stubble and hat"). Never a real person's name, even if someone looks familiar.
type: an archetype or role such as cyborg, cowboy, soldier, princess, detective, villain, hero, gangster, alien, robot, warrior, musician, child, elder.
odd: letters of any tile in that row that is clearly a DIFFERENT person from the rest of the row ([] if all match).
same: pairs of row numbers that are clearly the same person shown in two rows ([] if none).`;
  const r=await askAI(id,prompt,[blob]); if(!r||!Array.isArray(r.rows)) return false;
  for(const x of r.rows){ const k=(+x.row)-1, ch=L[k]; if(!ch) continue;
    if(x.name) ch.desc=String(x.name).trim().toLowerCase().slice(0,48); if(x.type) ch.type=String(x.type).trim().toLowerCase().slice(0,20);
    for(const o of (Array.isArray(x.odd)?x.odd:[])){ const f=tiles[k][String(o).toLowerCase().charCodeAt(0)-97]; if(f){ f.ban=[...new Set([...(f.ban||[]),ch.id])]; f.id=null; } } }
  for(const pr of (Array.isArray(r.same)?r.same:[])){ const a=L[(+pr[0])-1], b=L[(+pr[1])-1]; if(!a||!b||a===b) continue; // join b into a
    S.clips.forEach(c=>(c.faces||[]).forEach(f=>{ if(f.id===b.id) f.id=a.id; })); S.faceCast=S.faceCast.filter(x=>x!==b); if(!a.name&&b.name) a.name=b.name; }
  S.faceCast.forEach(x=>{ x.n=new Set(S.clips.filter(c=>(c.faces||[]).some(f=>f.id===x.id)).map(c=>c)).size; }); S.faceCast=S.faceCast.filter(x=>x.n>=2);
  return true; }
function charName(x){ return x.name||x.desc||x.label; }
function CAST(){ return S.faceCast&&S.faceCast.length?S.faceCast:S.cast; }
function faceMode(){ return !!(S.faceCast&&S.faceCast.length); }
function findFaces(){ return heavy("Finding characters by face",findFacesNow); }
async function findFacesNow(){
  const todo=S.clips.filter(c=>(c.samples||c.kind==="image")&&!c.faces); $("faceBtn").disabled=true;
  try{ $("faceInfo").textContent="Loading face recognition (about 12 MB, once)…"; const fa=await loadFaceLib();
    crumb("face models ready"); const done0=S.clips.filter(c=>c.faces).length, all=done0+todo.length;
    for(let k=0;k<todo.length;k++){ $("faceInfo").textContent=`Looking for faces… clip ${done0+k+1} of ${all}`; status(`Finding characters by face (${done0+k+1} of ${all})…`); await faceScanClip(fa,todo[k]);
      if(k%10===9) await new Promise(r=>setTimeout(r,30));
      if(k%25===24){ let gm=""; try{ const m=fa.tf.memory(); gm=` · ${m.numTensors} tensors, ${Math.round((m.numBytesInGPUAllocated||m.numBytes||0)/1e6)} MB graphics`; }catch(e){}
        crumb(`faces: ${done0+k+1} of ${all} clips${gm}`); await saveProject(); } } // progress is kept: if the page stops, pressing the button again carries on from here
    let cast=clusterFaces(); const nf=S.clips.reduce((a,c)=>a+(c.faces||[]).length,0); let named=false;
    if(cast.length&&aiProvider()){ $("faceInfo").textContent="Asking the AI to name and double-check each character…"; try{ named=await aiCheckCharacters(); cast=S.faceCast; }catch(e){ crumb("character check failed: "+(e&&e.message||e)); } }
    refreshChars(); renderClips(); buildPlan(); saveProjectSoon();
    const msg=cast.length?`Found ${cast.length} character${cast.length===1?"":"s"} who appear in two or more clips (from ${nf} faces)${named?", named and double-checked by the AI":aiProvider()?"":". Connect an AI to have them named and double-checked"}. Pick them above your clips to sort by them.`:`Found ${nf} face${nf===1?"":"s"}, but nobody appears in more than one clip.`;
    $("faceInfo").textContent=msg; status(msg); }
  catch(e){ $("faceInfo").textContent=`Face recognition couldn’t start here (${String(e&&e.message||e).slice(0,90)}).`; status("Face recognition couldn’t start.",true); }
  finally{ $("faceBtn").disabled=!S.clips.some(c=>c.samples); } }
function faceSave(c){ return c.faces?c.faces.map(f=>({t:f.t,box:f.box,s:f.s,d:f.d,th:f.th,id:f.id||null,ban:f.ban})):undefined; }
function castLabel(id){ const c=CAST().find(x=>x.id===id); return c?charName(c):id; }
function castClipCount(id){ return S.clips.filter(c=>c.samples&&(c.chars||[]).includes(id)).length; }
/* footage read before characters were tracked: each frame's main subject (with a face) becomes a character, so the
   cast bar works straight away. Reading the footage again gives every person in the frame, not just the main one. */
function migrateChars(){ let made=0;
  S.clips.forEach(c=>(c.tags||[]).forEach(t=>{ if(t.chars!==undefined) return; const lab=String(t.subj||"").trim().toLowerCase();
    if(!lab||!(t.faces>0)){ t.chars=[]; return; } let x=S.cast.find(k=>k.label===lab); if(!x){ x={id:"c"+(S.cast.length+1),label:lab,name:null,n:0,old:true}; S.cast.push(x); made++; } t.chars=[x.id]; }));
  if(made){ // a subject seen in only one clip is too thin to sort by
    const inClips=id=>S.clips.filter(c=>c.samples&&(c.tags||[]).some(t=>(t.chars||[]).includes(id))).length, drop=new Set(S.cast.filter(x=>x.old&&inClips(x.id)<2).map(x=>x.id));
    if(drop.size){ S.clips.forEach(c=>(c.tags||[]).forEach(t=>{ if(t.chars) t.chars=t.chars.filter(i=>!drop.has(i)); })); S.cast=S.cast.filter(x=>!drop.has(x.id)); } }
  return made; }
function refreshChars(){ migrateChars();
  if(faceMode()){ const ids=new Set(S.faceCast.map(x=>x.id)); S.clips.forEach(c=>{ const fs=(c.faces||[]).filter(f=>f.id&&ids.has(f.id)); c.chars=[...new Set(fs.map(f=>f.id))];
      (c.tags||[]).forEach(t=>{ t.fchars=[...new Set(fs.filter(f=>Math.abs(f.t-t.t)<1.2).map(f=>f.id))]; }); }); }
  else S.clips.forEach(c=>{ const s=new Set(); (c.tags||[]).forEach(t=>(t.chars||[]).forEach(x=>s.add(x))); c.chars=[...s]; });
  const L=CAST(); L.forEach(x=>x.n=castClipCount(x.id)); L.sort((a,b)=>b.n-a.n); renderCast(); }
function heroId(){ const L=CAST(); if(S.mainChar&&L.some(x=>x.id===S.mainChar)) return S.mainChar; const top=L.filter(x=>x.n>=2)[0]; return top?top.id:""; }
function isHeroTag(tg,hero){ const id=heroId(); if(id&&faceMode()) return (tg.fchars||[]).includes(id); if(id&&tg.chars) return tg.chars.includes(id); return !!hero&&tg.subj===hero; }
function renderCast(){ const box=$("castBar"); if(!box) return; box.innerHTML=""; const vids=S.clips.filter(c=>c.samples);
  if(!vids.length){ box.hidden=true; box.style.display="none"; return; } box.hidden=false; box.style.display="flex";
  const lab=document.createElement("span"); lab.textContent="Characters:"; lab.style.marginRight="4px"; box.appendChild(lab);
  if(!CAST().some(x=>x.n)){ const hint=document.createElement("span"); hint.style.opacity="0.75";
    hint.textContent=vids.some(c=>c.faces)?"nobody appears in more than one clip.":vids.some(c=>c.tags&&c.tags.length)?"none found yet. Press “Find characters by face” to recognise everyone across your clips.":"press “Find characters by face” to recognise the people across your clips, or “Read my footage with AI” to find the people in your clips, then pick them here to sort by them.";
    box.appendChild(hint); return; }
  if(!faceMode()&&CAST().some(x=>x.old&&x.n)){ const tip=document.createElement("span"); tip.style.cssText="opacity:.7;flex-basis:100%;order:9"; tip.textContent="These come from an earlier reading of your footage (one main person per shot). Read it again to pick out everyone in each shot."; box.appendChild(tip); }
  for(const x of CAST()){ if(!x.n) continue; const wrap=document.createElement("span"); wrap.style.cssText="display:inline-flex;gap:2px;align-items:center";
    const b=document.createElement("button"); b.type="button"; b.className="chip"; b.setAttribute("aria-pressed",String(S.castSel.has(x.id))); b.textContent=`${x.id===heroId()?"★ ":""}${charName(x)} (${x.n})`; if(x.type) b.title=x.type; if(x.thumb){ const im=document.createElement("img"); im.src=x.thumb; im.alt=""; im.style.cssText="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;margin:-3px 6px -3px -4px"; b.prepend(im); } b.title="Show only clips with this character (choose several to combine)";
    b.onclick=()=>{ S.castSel.has(x.id)?S.castSel.delete(x.id):S.castSel.add(x.id); filterChanged(); };
    const ed=document.createElement("button"); ed.type="button"; ed.className="chip"; ed.textContent="✎"; ed.title="Rename this character"; ed.setAttribute("aria-label","Rename "+(x.name||x.label));
    ed.onclick=()=>{ const inp=document.createElement("input"); inp.value=charName(x); inp.maxLength=30; inp.style.cssText="width:140px;font:inherit;padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink)";
      const done=()=>{ const v=inp.value.trim(); x.name=v&&v!==(x.desc||x.label)?v:null; renderCast(); saveProjectSoon(); }; inp.onkeydown=e=>{ if(e.key==="Enter") done(); if(e.key==="Escape") renderCast(); }; inp.onblur=done; wrap.replaceChildren(inp); inp.focus(); inp.select(); };
    const st=document.createElement("button"); st.type="button"; st.className="chip"; st.textContent="★"; st.title="Make this the main character of the story"; st.setAttribute("aria-pressed",String(S.mainChar===x.id));
    st.onclick=()=>{ S.mainChar=S.mainChar===x.id?"":x.id; S.protagonist=null; renderCast(); saveProjectSoon(); if(!S.running) buildPlan(); };
    wrap.append(b,st,ed); box.appendChild(wrap); }
  { const ty=new Map(); CAST().forEach(x=>{ if(x.type&&x.n) ty.set(x.type,(ty.get(x.type)||0)+1); });
    if(ty.size){ const tl=document.createElement("span"); tl.textContent="Types:"; tl.style.cssText="margin:0 4px 0 8px"; box.appendChild(tl);
      [...ty.entries()].sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>{ const k="t:"+t, tb=document.createElement("button"); tb.type="button"; tb.className="chip"; tb.textContent=`${t}${n>1?` ×${n}`:""}`; tb.setAttribute("aria-pressed",String(S.castSel.has(k))); tb.title="Every character of this type"; tb.onclick=()=>{ S.castSel.has(k)?S.castSel.delete(k):S.castSel.add(k); filterChanged(); }; box.appendChild(tb); }); } }
  if(S.castSel.size){ box.appendChild(modeChip(()=>S.castMode,v=>S.castMode=v)); const cl=document.createElement("button"); cl.type="button"; cl.className="chip"; cl.textContent="Clear"; cl.onclick=()=>{ S.castSel.clear(); filterChanged(); }; box.appendChild(cl); } }
function protagonist(){
  if(S.protagonist!==undefined && S.protagonist!==null) return S.protagonist;
  { const id=heroId(); if(id){ S.protagonist=castLabel(id); return S.protagonist; } }
  const cnt=new Map(); S.clips.forEach(c=>(c.tags||[]).forEach(t=>{ if(t.subj && t.faces>0) cnt.set(t.subj,(cnt.get(t.subj)||0)+1); }));
  const top=[...cnt.entries()].sort((a,b)=>b[1]-a[1])[0]; S.protagonist=top&&top[1]>=2?top[0]:""; return S.protagonist;
}
function hasTags(){ return S.clips.some(c=>c.tags&&c.tags.length); }

