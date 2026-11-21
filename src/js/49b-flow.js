/* ---------------- The beginner's path ----------------
   Two tiles (your song, your clips) → the cut is made by itself and starts playing → one big button makes the video.
   Everything else stays where it was, a scroll away. The page's state is mirrored on <body> (s-song, s-clips, s-ready)
   so the layout can change with it. */
document.body.classList.add("flow");
function flowKey(){ return (S.audioName||"")+"|"+S.clips.filter(c=>c.samples&&!c.off).length; }
const FRONT_JOBS=/^(Studying your clips|Reading the song|Listening to your songs)/; /* the jobs you wait for; the rest run quietly behind */
function flowState(){ const song=!!(S.an&&S.audioBuf), clips=S.clips.some(c=>c.samples&&!c.off), H=typeof _heavyCur!=="undefined"&&_heavyCur, heavyNow=H&&FRONT_JOBS.test(H.label)?H:null, busy=!!S.running;
  if((busy&&S.running.record)||S._making) return {k:"making",song,clips};
  if(heavyNow) return {k:"study",label:heavyNow.label,song,clips};
  if(S._songLoading) return {k:"study",label:"Reading the song",song,clips};
  if(!song) return {k:"song",song,clips}; if(!clips) return {k:"clips",song,clips};
  if(S._auto) return {k:"cutting",song,clips}; if(busy&&S.running.record) return {k:"making",song,clips}; if(busy) return {k:"playing",song,clips};
  if(!S.plan) return {k:"clips",song,clips}; return {k:"ready",song,clips,made:!!(S.results&&S.results.length)}; }
const songLabel=()=>{ const n=(typeof lySong==="function"?lySong():null), t=n&&n.title?(n.artist?`${n.title} · ${n.artist}`:n.title):String(S.audioName||"").replace(/\.[^.]+$/,""); return t+(S.an?` · ${fmtTime(S.an.duration)}`:""); };
function setText(el,t){ if(el&&el.textContent!==t) el.textContent=t; }
function canFolder(){ return (NATIVE&&!!NP("Folder"))||(typeof CAN_KEEP_DIR!=="undefined"&&CAN_KEEP_DIR)||(!matchMedia("(pointer:coarse)").matches&&"webkitdirectory" in document.createElement("input")); }
function renderFlow(){ const st=flowState(), B=document.body, ready=st.song&&st.clips&&!!S.plan;
  B.classList.toggle("s-song",st.song); B.classList.toggle("s-clips",st.clips); B.classList.toggle("s-ready",ready);
  $("tileSong").classList.toggle("done",st.song&&!S._songLoading); $("tileClips").classList.toggle("done",st.clips&&!(st.k==="study"&&/clip/i.test(st.label)));
  const studyingSong=st.k==="study"&&/song/i.test(st.label), studyingClips=st.k==="study"&&/clip|footage/i.test(st.label);
  $("tileSong").classList.toggle("busy",studyingSong); $("tileClips").classList.toggle("busy",studyingClips);
  setText($("tileSongSub"),studyingSong?"Listening to it…":st.song?songLabel():"MP3, M4A or WAV"); setText($("tileSongBtn"),st.song?"Change":"Choose a song");
  const nC=S.clips.filter(c=>c.samples&&!c.off).length, m=studyingClips&&($("status").textContent||"").match(/(\d+) of (\d+)/);
  setText($("tileClipsSub"),studyingClips?(m?`Looking at clip ${m[1]} of ${m[2]}…`:"Looking at your clips…"):st.clips?`${nC} clip${nC===1?"":"s"}`:"Videos and photos");
  setText($("tileFolder"),st.clips?"Add more":"Choose a folder");
  setText($("startLead"),!st.song&&!st.clips?"Make a video that cuts to your song.":!st.song?"Now choose your song.":!st.clips?"Now add your clips.":"Make a video that cuts to your song.");
  $("mainAct").hidden=!ready&&st.k!=="cutting"; const mk=$("makeNow"), mm=$("makeMain");
  setText(mm,st.k==="cutting"?"Making your cut…":st.k==="making"?"Stop":(mk.textContent||"Make video").replace(/^Make (?!my )/,"Make my ")); mm.disabled=st.k==="cutting"||mk.disabled;
  mm.classList.toggle("primary",st.k!=="making");
  $("remixChip").disabled=$("remix2").disabled; $("cmpChip").disabled=!!$("cmpOpen").disabled;
  $("playOv").hidden=!(ready&&!S.running&&!S._auto);
  $("trySample").hidden=HOSTED||st.song||st.clips; $("autoWhy").hidden=!($("autoOut").textContent||"").trim();
  renderBar(st); }
/* the clips tile: a whole folder where this device allows it, otherwise picked clips */
$("tileFolder").onclick=()=>{ if(NATIVE&&NP("Folder")) return pickClipFolder(); if(typeof CAN_KEEP_DIR!=="undefined"&&CAN_KEEP_DIR) return $("folderDrop").click(); if(canFolder()) return $("folderInput").click(); $("videoInput").click(); };
if(!canFolder()){ $("tileFolder").hidden=true; $("tilePick").classList.remove("quiet"); $("tilePick").classList.add("primary"); $("tilePick").textContent="Choose clips"; }
$("makeMain").onclick=()=>$("makeNow").click();
$("remixChip").onclick=()=>$("remix2").click(); $("cmpChip").onclick=()=>$("cmpOpen").click();
$("playOv").onclick=e=>{ e.stopPropagation(); $("playOv").classList.remove("pulse"); if(!S.running) $("preview").click(); };
$("stageBox").addEventListener("click",()=>{ if(S.running&&!S.running.record) $("preview").click(); }); /* tap the picture to stop */
/* sample clips and song, made for the app: abstract footage and a short track with a verse, chorus, breakdown and drop */
const SAMPLE=["sample/sample-song.m4a","sample/sample-1-city-lights.mp4","sample/sample-2-starfield.mp4","sample/sample-3-neon-grid.mp4","sample/sample-4-aurora.mp4","sample/sample-5-rain.mp4","sample/sample-6-ink.mp4"];
$("trySample").onclick=async()=>{ const b=$("trySample"); b.disabled=true; setText(b,"Getting the sample clips…");
  try{ const files=await Promise.all(SAMPLE.map(async u=>{ const r=await fetch(u); if(!r.ok) throw new Error(u+" "+r.status); const bl=await r.blob(), n=u.split("/").pop(); return new File([bl],n==="sample-song.m4a"?"Night Drive (sample).m4a":n,{type:n.endsWith(".m4a")?"audio/mp4":"video/mp4",lastModified:1700000000000}); }));
    S._sample=true; crumb("sample project"); await takeFiles(files,{preferAudio:true}); }
  catch(e){ status("Couldn't get the sample clips: "+(e&&e.message||e),true); }
  finally{ b.disabled=false; setText(b,"No clips handy? Try it with sample clips"); } };
/* as soon as the song and clips are in: make the cut, then play it */
let _flowBusy=false;
async function maybeAutoCut(){ if(_flowBusy||!$("autoCut")||!$("autoCut").checked) return; if(navigator.webdriver&&!window.BS_AUTOCUT) return; /* automated tests drive each step themselves */ const st=flowState(); if(st.k!=="ready"||S._restoring||S._songLoading) return;
  const key=flowKey(); if(S._autoCutKey===key) return; S._autoCutKey=key; _flowBusy=true;
  try{ crumb("automatic cut"); await autopilot(); }catch(e){} finally{ _flowBusy=false; }
  renderFlow(); if(!S.plan||S.running) return;
  const sticky=!navigator.userActivation||navigator.userActivation.hasBeenActive;
  if(sticky&&document.visibilityState==="visible"){ try{ $("stageBox").scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){} setTimeout(()=>{ if(!S.running&&S.plan) $("preview").click(); },500); }
  else $("playOv").classList.add("pulse"); }
{ const _rp=restoreProject; restoreProject=async function(p){ const r=await _rp(p); S._autoCutKey=flowKey(); return r; }; }
setInterval(()=>{ renderFlow(); maybeAutoCut(); },400);
/* the bar along the bottom: only ever the next step */
{ const bar=$("nextBar"), pb=document.createElement("i"); pb.className="nb-bar"; bar.appendChild(pb); }
let _sawLive=false;
function renderBar(st){ if(st.k!=="making") _sawLive=false; const H=$("nbHead"), Sb=$("nbSub"), B=$("nbBtn"), pb=$("nextBar").querySelector(".nb-bar"), stat=($("status").textContent||"").trim(), pct=(stat.match(/(\d+)%/)||[])[1];
  let h="",sub="",btn=null,act=null,prog=null;
  switch(st.k){
    case "song": h=st.clips?"Now your song":"Start with your song"; sub=st.clips?"Step 2 of 2":"Step 1 of 2: then your clips"; btn="Choose a song"; act=()=>$("audioInput").click(); break;
    case "clips": h="Now your clips"; sub="Step 2 of 2: videos and photos"; btn=$("tileFolder").hidden?"Choose clips":"Choose a folder"; act=()=>$("tileFolder").hidden?$("videoInput").click():$("tileFolder").click(); break;
    case "study": h=/song/i.test(st.label)?"Listening to your song":"Looking at your clips"; sub=stat.slice(0,80); break;
    case "cutting": h="Making your cut"; sub="Choosing shots, pace and look…"; break;
    case "playing": h="Playing your cut"; sub="Tap the picture to stop"; btn="Stop"; act=()=>$("preview").click(); break;
    case "making": { const live=/^Making the video/.test(stat), p2=live?pct:null; if(live) _sawLive=true; h=p2?`Making your video: ${p2}%`:_sawLive?"Finishing your video":"Getting ready"; sub=_sawLive&&!live?"Checking it against the plan":"Keep the app open"; btn=S.running&&S.running.record?"Stop":null; act=()=>$("makeNow").click(); prog=p2?+p2/100:null; break; }
    case "ready": if(st.made&&S._madePlan===S.plan){ h="Your video is ready"; sub="Share it or save it"; btn="Share"; act=()=>openFinish(); } else { h="Like it?"; sub="Make it into a video"; btn=$("makeMain").textContent; act=()=>$("makeMain").click(); } break; }
  setText(H,h); setText(Sb,sub); B.hidden=!btn; if(btn) setText(B,btn); B.onclick=act; B.classList.toggle("primary",btn!=="Stop");
  pb.style.width=prog!=null?(prog*100).toFixed(1)+"%":"0"; }
/* when the video is made: it's saved on the phone straight away, then shown playing with Share front and centre */
let _finI=0;
async function onVideosMade(){ S._madePlan=S.plan;
  if(NATIVE){ for(const r of S.results){ if(r._saved) continue; try{ if(await nativeSave(resultName(r),r.blob)) r._saved=true; }catch(e){} } }
  _finI=0; openFinish(); }
function openFinish(){ if(!S.results||!S.results.length) return; const R=S.results, sh=$("finSheet"); sh.hidden=false;
  const pick=$("finPick"); pick.innerHTML=""; if(R.length>1) R.forEach((r,i)=>{ const c=document.createElement("button"); c.type="button"; c.className="chip"; c.textContent=r.ep.name; c.setAttribute("aria-pressed",String(i===_finI)); c.onclick=()=>{ _finI=i; openFinish(); }; pick.appendChild(c); });
  const r=R[Math.min(_finI,R.length-1)], v=$("finVideo"); if(v.dataset.u) URL.revokeObjectURL(v.dataset.u); v.dataset.u=URL.createObjectURL(r.blob); v.src=v.dataset.u; v.play().catch(()=>{});
  setText($("finHead"),R.length>1?"Your videos are ready":r.ep.short?"Your Short is ready":"Your video is ready");
  setText($("finSaved"),r._saved?"Saved to your phone: Movies › Beat Splicer.":"");
  const share=NATIVE||(typeof canShareFiles==="function"&&canShareFiles()); $("finShare").hidden=!share; $("finTo").hidden=!share;
  setText($("finSave"),r._saved?"Saved ✓":NATIVE?"Save to phone":"Download"); $("finSave").disabled=!!r._saved; $("finSave").classList.toggle("primary",!share);
  const cap=typeof captionFor==="function"?captionFor(r.ep):""; $("finCaption").hidden=!cap;
  $("finShare").onclick=async()=>{ if(NATIVE) return nativeShare(resultName(r),r.blob,cap); try{ await navigator.share({files:[new File([r.blob],resultName(r),{type:r.blob.type||"video/mp4"})],text:cap||undefined}); }catch(e){ if(e&&e.name!=="AbortError") status("Sharing isn’t available here. Use Download instead.",true); } };
  $("finSave").onclick=async()=>{ await saveFile(resultName(r),r.blob); if(NATIVE){ r._saved=true; openFinish(); } };
  $("finCaption").onclick=async()=>{ try{ await navigator.clipboard.writeText(cap); setText($("finCaption"),"Caption copied ✓"); }catch(e){ const C=NP("Clipboard"); if(C){ await C.write({string:cap}); setText($("finCaption"),"Caption copied ✓"); } } };
  crumb("finish screen"); }
function closeFinish(){ const v=$("finVideo"); v.pause(); $("finSheet").hidden=true; setText($("finCaption"),"Copy caption"); }
$("finClose").onclick=closeFinish; $("finSheet").addEventListener("click",e=>{ if(e.target===$("finSheet")) closeFinish(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("finSheet").hidden) closeFinish(); });
$("finAgain").onclick=()=>{ closeFinish(); $("newDir").click(); };
{ const _la=loadAudio; loadAudio=async function(...a){ S._songLoading=true; try{ renderFlow(); }catch(e){} try{ return await _la.apply(this,a); } finally{ S._songLoading=false; } }; }
{ const _mv=makeVideos; makeVideos=async function(...a){ S._making=true; try{ return await _mv.apply(this,a); } finally{ S._making=false; } }; }
