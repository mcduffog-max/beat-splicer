/* ---------------- Wiring ---------------- */

function wireDropZone(zone,opts){
  zone.addEventListener("dragover",e=>{ e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave",()=>zone.classList.remove("over"));
  zone.addEventListener("drop",e=>{ e.preventDefault(); e.stopPropagation(); zone.classList.remove("over"); filesFromDrop(e.dataTransfer).then(fs=>takeFiles(fs,opts)); });
}
wireDropZone($("audioDrop"),{preferAudio:true}); wireDropZone($("videoDrop"),{}); wireDropZone($("folderDrop"),{});
document.addEventListener("dragover",e=>e.preventDefault());
document.addEventListener("drop",e=>{ e.preventDefault(); filesFromDrop(e.dataTransfer).then(fs=>takeFiles(fs)); });
$("folderInput").addEventListener("change",e=>{ takeFiles(e.target.files); e.target.value=""; });
$("ovInput").addEventListener("change",e=>{ addOverlays(e.target.files); e.target.value=""; });
(()=>{ const z=$("ovDrop"); z.addEventListener("dragover",e=>{ e.preventDefault(); z.classList.add("over"); }); z.addEventListener("dragleave",()=>z.classList.remove("over"));
  z.addEventListener("drop",e=>{ e.preventDefault(); e.stopPropagation(); z.classList.remove("over"); addOverlays(e.dataTransfer.files); }); })();
Object.keys(DSTYLES).forEach(n=>{ const o=document.createElement("option"); o.value=n; o.textContent="Direct as: "+n; $("direct").appendChild(o); });
$("direct").addEventListener("change",()=>{ const v=$("direct").value;
  if(v==="off") setDirect(null); else if(v==="auto"){ if(!S.an||!S.clips.length){ $("directWhy").textContent="Add audio and clips first, then choose."; return; } const p=pickDirector(); setDirect(p.name,p.why); } else setDirect(v,""); });
$("aiDirect").onclick=aiChooseDirector;
$("titleBtn").onclick=()=>writeTitles(true);
$("autoBtn").onclick=autopilot;
$("newDir").onclick=()=>{ S._avoidDir=[motifId(),...dirHistory().slice(-2).map(x=>x.motif)]; autopilot(); };
$("motif").addEventListener("change",()=>{ saveSettings(); renderStyleState(); if(!S.running) buildPlan(); });
$("sigTrans").addEventListener("change",()=>{ saveSettings(); if(!S.running) buildPlan(); });
["fxReverse","camMoves","lens","camEnergy","colMatch","cutAction","matchCuts","phrasing","restraint"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); if(!S.running) buildPlan(); }));
$("ownMusic").addEventListener("change",()=>{ saveSettings(); if(S.plan) writeTitles(false); });
$("songVer").addEventListener("change",()=>{ saveSettings(); applySongVersion(); });
["audTexture","audRadio","audFilterDrop","audStutter","audEcho","sfxWhoosh","sfxImpact","sfxRiser"].forEach(id=>$(id).addEventListener("change",saveSettings));
$("wmAvoid").addEventListener("change",()=>{ saveSettings(); S.clips.forEach(c=>{ c._wmc=null; c._wmcs=null; }); renderClips(); wmCatchUp(); });
$("progBorder").addEventListener("change",saveSettings);
["songEnd","endStyle","endCard"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); S._endingFor=null; if(!S.running) buildPlan(); }));
$("artistName").addEventListener("input",()=>{ S._artistAuto=false; });
["libSort","libShow"].forEach(id=>$(id).addEventListener("change",()=>{ _rcT=0; renderClips(); }));
$("exclN").addEventListener("change",()=>{ saveSettings(); refreshExclusion(true); _rcT=0; renderClips(); if(!S.running) buildPlan(); });
$("libUseAll").onclick=()=>{ libOrder().forEach(i=>{ if(S.clips[i].samples) S.clips[i].off=false; }); _rcT=0; renderClips(); buildPlan(); saveProjectSoon(); };
$("libOffAll").onclick=()=>{ libOrder().forEach(i=>{ if(S.clips[i].samples) S.clips[i].off=true; }); _rcT=0; renderClips(); buildPlan(); saveProjectSoon(); };
$("clearHist").onclick=()=>{ localStorage.removeItem("beatsplicerUsage"); S._fatigue=null; refreshExclusion(true); _rcT=0; renderClips(); if(!S.running) buildPlan(); status("History cleared: every clip counts as fresh again."); };
$("trans").addEventListener("input",()=>{ S._transManual=$("trans").value!=="auto"; });
$("songFolder").onchange=e=>{ const fs=[...e.target.files]; e.target.value=""; addSongFolder(fs); };
$("comboBtn").onclick=bestCombo;
$("moreSongs").onclick=()=>heavy("Listening to more songs",()=>analyseSongs(40));
$("saveProj").onclick=saveProjectFile;
$("openProj").onchange=e=>{ const f=e.target.files[0]; e.target.value=""; if(f) openProjectFile(f); };
$("relinkInput").onchange=e=>{ const fs=[...e.target.files]; e.target.value=""; relinkProject(fs); };
$("freeBtn").onclick=freeSpace;
$("aiImagery").addEventListener("change",()=>{ saveSettings(); S.eps.forEach(id=>{ const T=S.titles[id]; if(T&&T.desc&&$("aiImagery").checked&&!/AI-generated/i.test(T.desc)) T.desc=T.desc.replace(/(\n\n#[^\n]*)?$/,m=>"\n\nThis video contains AI-generated imagery."+(m||"")); if(T&&T.desc&&!$("aiImagery").checked) T.desc=T.desc.replace(/\n\nThis video contains AI-generated imagery\./,""); }); renderTitles(); scheduleChecklist(); });
$("tagBtn").onclick=readFootage;
$("faceBtn").onclick=findFaces;
$("outlineWrite").onclick=writeOutline;
$("outlineOn").addEventListener("change",()=>{ if(!S.running&&S.an) buildPlan(); });
$("progScope").addEventListener("change",saveSettings); $("progOpacity").addEventListener("input",saveSettings); ["progDir","progColor","progShadow"].forEach(id=>$(id).addEventListener("change",saveSettings));
["storyOn","storyShape","faceFrame"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); if(!S.running) buildPlan(); }));
offerRestore(); setTimeout(lastExportNotice,0); lastAnalysisNotice(); crumbsNotice(); // after the rest of the script has run (the notice names the build)
$("errBtn").onclick=async()=>{ try{ await navigator.clipboard.writeText(S.lastError||""); status("Error details copied. Paste them into our chat."); }catch(e){ const ta=document.createElement("textarea"); ta.value=S.lastError||""; ta.style.cssText="width:100%;height:120px"; $("errBtn").after(ta); ta.select(); status("Select all the text below and copy it."); } };
$("engine").addEventListener("change",()=>{ saveSettings(); engineNote(); });
detectEngine().then(w=>{ S.wc=w||{}; engineNote(); });
$("autoTitles").addEventListener("change",()=>{ saveSettings(); if($("autoTitles").checked) writeTitles(false,true).then(renderTitles); else renderTitles(); scheduleChecklist(); });
$("payoffOn").addEventListener("change",()=>{ saveSettings(); renderTitles(); });
$("artistName").addEventListener("change",()=>{ saveSettings(); if(!$("autoTitles").checked) return;
  S.eps.map(EP).filter(e=>e&&!e.short&&S.titles[e.id]&&S.titles[e.id].src!=="edit").forEach(e=>delete S.titles[e.id]); writeTitles(false,true); });
$("proRules").addEventListener("change",()=>{ saveSettings(); drawTimeline(); renderStats(); scheduleChecklist(); });
document.querySelector(".panel").addEventListener("change",scheduleChecklist);
$("clipSound").addEventListener("change",()=>{ const on=$("clipSound").checked; $("clipSoundRow").hidden=!on; $("clipSoundNote").hidden=!on; saveSettings(); renderClips(); });
$("clipVol").addEventListener("change",saveSettings);
$("brandInput").addEventListener("change",e=>{ setBrandLogo(e.target.files[0]); e.target.value=""; });
(()=>{ const z=$("brandDrop"); z.addEventListener("dragover",e=>{ e.preventDefault(); z.classList.add("over"); }); z.addEventListener("dragleave",()=>z.classList.remove("over"));
  z.addEventListener("drop",e=>{ e.preventDefault(); e.stopPropagation(); z.classList.remove("over"); setBrandLogo(e.dataTransfer.files[0]); }); })();
BRAND_IDS.forEach(id=>$(id).addEventListener("change",saveBrand));
["projName","nameScheme","capTopic","hookText"].forEach(id=>$(id).addEventListener("input",updateNamePreview));
$("projName").addEventListener("change",saveSettings); $("nameScheme").addEventListener("change",()=>{ saveSettings(); updateNamePreview(); });
$("aiName").onclick=aiName;
$("folderBtn").onclick=saveToFolder;
if(window.showDirectoryPicker && !HOSTED){ $("folderBtn").hidden=false; }
$("audioInput").addEventListener("change",e=>{ const f=e.target.files[0]; e.target.value=""; if(f) heavy("Reading the song",()=>loadAudio(f)); });
$("videoInput").addEventListener("change",e=>{ addClips(e.target.files); e.target.value=""; });
["mode","pace","variety"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); if(!S.running) buildPlan(); }));
["trans","trLen"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); assignTransitions(); drawTimeline(); }));
["fit","zoom","kb","fadeIn","fadeOut","look","fxPulse","fxShake","fxGlitch","fxGrain","fxVignette","fxBars","space","spaceAmt","showSafe","aiGate",
 "fxFisheye","fxSplit","fxMultiply","fxMirror","fxStrobe","fxHandheld","fxWash","fxDoodles","slowmo","stillMotion","textStyle","ovLeaks","ovBokeh","ovDust"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); document.querySelectorAll("#styles .chip").forEach(c=>c.setAttribute("aria-pressed","false")); }));
["hookText","endText","ovLower"].forEach(id=>$(id).addEventListener("change",saveSettings));
$("shortLen").addEventListener("change",()=>{ saveSettings(); drawTimeline(); renderStats(); });
$("previewEp").addEventListener("change",()=>{ sizeStage(); saveSettings(); drawTimeline(); });
$("space").addEventListener("change",()=>{ if(LISTEN) status("3D sound changes take effect next time you press Listen or Preview."); });
$("shuffle").onclick=remix; $("remix2").onclick=remix;
$("verPrev").onclick=()=>{ if(S.verIdx>0){ S.verIdx--; restore(S.versions[S.verIdx]); renderVersions(); } };
$("verNext").onclick=()=>{ if(S.verIdx<S.versions.length-1){ S.verIdx++; restore(S.versions[S.verIdx]); renderVersions(); } };
$("preview").onclick=preview;
$("render").onclick=()=>makeVideos(false);
$("zipBtn").onclick=saveZip; $("zipNow").onclick=saveZip;
$("aiBtn").onclick=()=>runReview(false);
window.addEventListener("resize",()=>drawTimeline());
["rvClaude","rvOpenai","rvGemini","rvGrok","modelOpenai","modelGemini","modelGrok","capTopic"].forEach(id=>$(id).addEventListener("change",saveSettings));
["keyOpenai","keyGemini","keyGrok"].forEach(id=>$(id).addEventListener("change",()=>{ saveKeys(); syncCapWith(); }));
$("keepKeys").addEventListener("change",()=>{ $("passRow").hidden=!$("keepKeys").checked || HOSTED; saveSettings(); saveKeys(); });
$("lockKeys").onclick=lockKeys; $("unlockKeys").onclick=unlockKeys; $("forgetKeys").onclick=forgetKeys;
/* Saved API keys are encrypted with AES-256-GCM, using a key derived from the user's passphrase (PBKDF2-SHA256, 310,000 rounds).
   The passphrase is never stored. Plain-text keys are never written to storage. */
const KEYSTORE="beatsplicerKeysV2";
const b64e=u8=>btoa(String.fromCharCode(...u8)), b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){ const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]); }
async function lockKeys(){
  const pass=$("keyPass").value; if(pass.length<8){ status("Use a passphrase of at least 8 characters.",true); return; }
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12)), k=await deriveKey(pass,salt);
  const data=new TextEncoder().encode(JSON.stringify({o:$("keyOpenai").value,g:$("keyGemini").value,x:$("keyGrok").value}));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,data));
  try{ localStorage.setItem(KEYSTORE,JSON.stringify({s:b64e(salt),i:b64e(iv),c:b64e(ct)})); $("keyPass").value=""; status("Keys saved, locked with your passphrase."); }catch(e){ status("Couldn’t save keys on this computer.",true); }
}
async function unlockKeys(){
  try{ const st=JSON.parse(localStorage.getItem(KEYSTORE)||"null"); if(!st) return;
    const k=await deriveKey($("unlockPass").value,b64d(st.s)); const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(st.i)},k,b64d(st.c));
    const v=JSON.parse(new TextDecoder().decode(pt)); $("keyOpenai").value=v.o||""; $("keyGemini").value=v.g||""; $("keyGrok").value=v.x||"";
    $("unlockPass").value=""; $("unlockRow").hidden=true; status("Keys unlocked for this session."); syncCapWith();
  }catch(e){ status("That passphrase didn’t unlock the saved keys.",true); }
}
function forgetKeys(){ try{ localStorage.removeItem(KEYSTORE); localStorage.removeItem("beatsplicerKeys"); }catch(e){}
  ["keyOpenai","keyGemini","keyGrok","unlockPass","keyPass"].forEach(id=>$(id).value=""); $("unlockRow").hidden=true; $("keepKeys").checked=false; $("passRow").hidden=true; saveSettings(); syncCapWith(); status("Saved keys removed."); }
function saveKeys(){ if(!$("keepKeys").checked){ try{ localStorage.removeItem(KEYSTORE); }catch(e){} } }
function loadKeys(){ try{ localStorage.removeItem("beatsplicerKeys"); /* remove any plain-text keys from the earlier version */
  if(localStorage.getItem(KEYSTORE) && !HOSTED) $("unlockRow").hidden=false; }catch(e){} }
$("capBtn").onclick=writeCaptions;
$("dlApp").onclick=()=>saveFile("beat-splicer.html",APP_SRC);
if(HOSTED){ $("hostedNote").hidden=false; $("dlAppRow").hidden=false; ["rvOpenai","rvGemini","rvGrok"].forEach(id=>{ $(id).checked=false; $(id).disabled=true; }); ["keyOpenai","keyGemini","keyGrok"].forEach(id=>$(id).disabled=true); }
sampleP.then(s=>{ if(!s){ $("rvClaude").checked=false; $("rvClaude").disabled=true; } syncCapWith(); });

/* progress wheel: follows the progress bar's value and visibility */
(function(){ const pr=$("prog"), wh=$("wheel"), arc=$("wheelArc"), pct=$("wheelPct"); if(!pr||!wh) return; const C=2*Math.PI*18;
  const working=()=>!pr.hidden||_heavyN>0||!!S._auto||_aiN>0||!!(S.running&&S.running.record);
  const sync=()=>{ const on=working(); wh.hidden=!on; wh.title=on?"Working…":""; const v=+pr.value||0, m=+pr.max||1, f=Math.max(0,Math.min(1,v/m)); const busy=on&&(pr.hidden||f<=0.001);
    wh.classList.toggle("spin",busy); if(!busy) arc.style.strokeDashoffset=String(C*(1-f)); pct.textContent=busy?"":Math.round(f*100)+"%"; };
  const d=Object.getOwnPropertyDescriptor(HTMLProgressElement.prototype,"value"); // value changes don't always show as attribute changes, so watch the property too
  Object.defineProperty(pr,"value",{get(){ return d.get.call(this); },set(x){ if(!isFinite(+x)) return; d.set.call(this,+x); sync(); },configurable:true});
  new MutationObserver(sync).observe(pr,{attributes:true,attributeFilter:["hidden","value","max"]}); sync(); setInterval(sync,400); })();


