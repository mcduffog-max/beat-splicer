/* ---------------- Diagnostics: what this device can do, how fast, and a real test export ---------------- */
const BUILD="/*@BUILD@*/dev";
async function runDiagnostics(){
  const L=[], add=(k,v)=>L.push(v===undefined?k:`${k}: ${v}`), ms=t=>Math.round(t)+" ms", t0=performance.now();
  const box=$("diagOut"), txt=$("diagText"); box.hidden=false; const show=()=>{ txt.textContent=L.join("\n"); };
  add("Beat Splicer diagnostics", `${BUILD} · ${new Date().toISOString().slice(0,16).replace("T"," ")}`); add("");
  add("DEVICE"); add("Browser",navigator.userAgent); add("Screen",`${screen.width}×${screen.height} @${devicePixelRatio}x, window ${innerWidth}×${innerHeight}`);
  add("Memory",`${navigator.deviceMemory??"?"} GB device, page limit ${performance.memory?Math.round(performance.memory.jsHeapSizeLimit/1e6)+" MB":"?"}, in use ${performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6)+" MB":"?"}`);
  add("CPU cores",navigator.hardwareConcurrency??"?");
  try{ const e=await navigator.storage.estimate(); add("Storage",`${Math.round((e.usage||0)/1e6)} MB used of ${Math.round((e.quota||0)/1e6)} MB allowed${navigator.storage.persisted?`, kept: ${await navigator.storage.persisted()}`:""}`); }catch(e){ add("Storage","unknown"); }
  add("Hosted on claude.ai",HOSTED?"yes (AI = Claude; other AI services can’t be reached from here)":"no"); add("Theme / view",`${document.documentElement.getAttribute("data-theme")||"device"} / ${document.body.classList.contains("simple")?"essentials":"all settings"}`);
  show(); add(""); add("CAPABILITIES");
  const has=x=>typeof window[x]!=="undefined"?"yes":"NO"; add("WebCodecs",`decode ${has("VideoDecoder")}, encode ${has("VideoEncoder")}, audio encode ${has("AudioEncoder")}`);
  add("Keep screen awake",navigator.wakeLock?"yes":"NO"); add("Save to folder",window.showDirectoryPicker?"yes":"no (files download one by one or as a ZIP)");
  try{ const c=document.createElement("canvas"); add("Graphics (WebGL)",c.getContext("webgl2")?"WebGL 2":c.getContext("webgl")?"WebGL 1":"NO"); }catch(e){ add("Graphics (WebGL)","NO"); }
  const dec=async(codec,w,h)=>{ try{ return (await VideoDecoder.isConfigSupported({codec,codedWidth:w,codedHeight:h})).supported?"yes":"no"; }catch(e){ return "no"; } };
  if(typeof VideoDecoder!=="undefined") add("Can read video",`H.264 1080p ${await dec("avc1.640028",1920,1080)}, H.264 4K ${await dec("avc1.640033",3840,2160)}, HEVC (iPhone) ${await dec("hev1.1.6.L120.90",1920,1080)}, VP9 ${await dec("vp09.00.40.08",1920,1080)}, AV1 ${await dec("av01.0.08M.08",1920,1080)}`);
  const W=S.wc||{}; add("Frame-accurate export",[W.mp4?`MP4 (${W.mp4.v})`:"", W.webm?`WebM (${W.webm.v})`:""].filter(Boolean).join(", ")||"NOT available: standard recording only");
  try{ add("Standard recording",pickMime()||"none"); }catch(e){}
  { const eng=chooseEngine(); add("Export engine in use",eng?`frame-accurate ${eng.kind.toUpperCase()}`:"standard real-time recording (tab must stay visible)"); }
  show(); add(""); add("YOUR PROJECT");
  const vids=S.clips.filter(c=>c.samples), errs=S.clips.filter(c=>c.error), mb=S.clips.reduce((a,c)=>a+(c.file?c.file.size:0),0)/1e6;
  add("Clips",`${S.clips.length} added, ${vids.length} ready, ${errs.length} couldn’t be read${errs.length?` (e.g. ${errs.slice(0,3).map(c=>c.name).join(", ")})`:""}, ${Math.round(mb)} MB`);
  { const B=[...errs.map(c=>({why:c.error,kept:!!(c.file&&c.file._kept),size:c.file&&c.file.size})),...(errs.length?[]:(S._badClips||[]))]; if(B.length){ const g={}; B.forEach(b=>{ const k=String(b.why||"unknown").slice(0,90); g[k]=(g[k]||0)+1; });
    add("Why clips failed",Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}× ${k}`).join("; ")+(NATIVE?` (app copies: ${B.filter(b=>b.kept).length} of ${B.length})`:"")); } }
  if(vids.length){ const res=new Map(); vids.forEach(c=>{ const k=c.kind==="image"?"photo":`${Math.max(c.w,c.h)>=3000?"4K":Math.max(c.w,c.h)>=1800?"1080p":Math.max(c.w,c.h)>=1200?"720p":"smaller"} ${c.w>=c.h?"landscape":"portrait"}`; res.set(k,(res.get(k)||0)+1); }); add("Clip sizes",[...res].map(([k,n])=>`${n}× ${k}`).join(", ")); }
  add("Song",S.an?`${S.audioName}, ${fmtTime(S.an.duration)}, ${Math.round(S.an.bpm)} BPM${(S.an.tempoX||1)!==1?` (set to ${S.an.tempoX===2?"double":"half"} speed)`:""}, decoded ${S.audioBuf?Math.round(S.audioBuf.length*S.audioBuf.numberOfChannels*4/1e6)+" MB":"?"}`:"none yet");
  add("Characters / backgrounds",`${CAST().filter(x=>x.n>=2).length} characters${faceMode()?" (by face)":""}, ${new Set(S.clips.flatMap(c=>[...clipScenes(c).keys()])).size} background types, AI readings on ${S.clips.filter(c=>c.tags&&c.tags.length).length} clips`);
  add("Formats",S.eps.map(e=>(EP(e)||{}).name||e).join(", ")||"none ticked");
  show();
  if(S.an&&vids.length){ add(""); add("SPEED (this device)");
    let t=performance.now(); buildPlan(); add("Build the edit",ms(performance.now()-t));
    const ep=EP(S.eps.find(id=>EP(id))||"shorts"); t=performance.now(); makeExportPlan(ep,windowFor(ep)); add(`Plan a ${ep.name} cut`,ms(performance.now()-t));
    t=performance.now(); const pace=$("pace").value; calibratePace(); setControl("pace",pace); buildPlan(); add("Choose the pace (Do everything does this several times)",ms(performance.now()-t));
    add(""); add("TEST EXPORT (6 seconds of your edit)"); txt.textContent=L.join("\n")+"\nMaking the test video… keep this tab open and on screen.";
    if(S.running){ add("Skipped","an export is already running"); }
    else{ const w=windowFor(ep), win=[w[0],Math.min(w[1],w[0]+6)], len=win[1]-win[0]; let out=null;
      try{ status("Diagnostics: making a 6-second test video…"); $("prog").hidden=false; $("prog").value=0; S.passBase=0; S.passCount=len;
        const o=mkOut(ep); t=performance.now(); let dog=null; const res=await Promise.race([runPass([o],win,true,makeExportPlan(ep,win)), new Promise(r=>{ dog=setTimeout(()=>{ add("Result",`still going after 90 s, so stopped${document.hidden?" (the tab was hidden)":""}`); stopRun(); r(null); },90000); })]); clearTimeout(dog); const el=(performance.now()-t)/1000;
        if(!res||!res.length){ if(!L.some(x=>x.startsWith("Result: still going"))) add("Result","stopped before finishing"); }
        else{ out=res[0]; add("Result",`${ep.w}×${ep.h} ${out.blob?(out.blob.type||"video").split(";")[0]:"?"}, ${out.blob?(out.blob.size/1e6).toFixed(1)+" MB":"?"}`);
          add("Speed",`${el.toFixed(1)} s to make ${len.toFixed(0)} s of video (${(len/el).toFixed(2)}× real time). A 3-minute video would take about ${fmtTime(180*el/len)}.`);
          try{ const ck=await verifyExport(out); add("Output check",ck.ok?`passed (${(ck.shots||[]).join(" of ")} shots match)`:`FAILED: ${(ck.notes||[]).join(" ")}`); }catch(e){ add("Output check","couldn’t run: "+(e&&e.message||e)); } } }
      catch(e){ add("Result","FAILED: "+(e&&e.message||e)); }
      finally{ $("prog").hidden=true; $("offscreen").innerHTML=""; if(out&&out.url) try{ URL.revokeObjectURL(out.url); }catch(e){} status("Diagnostics finished."); } } }
  else { add(""); add("Add a song and clips, then run diagnostics again to time the edit and make a test video."); }
  add(""); add("SELF-TESTS"); try{ const r=await selfTests(); r.forEach(x=>add(`${x.ok?"ok  ":"FAIL"} ${x.name}`,x.ok?undefined:x.why)); }catch(e){ add("Self-tests couldn’t run",String(e&&e.message||e)); }
  add(""); add("RECENT STEPS"); try{ const a=JSON.parse(localStorage.getItem("beatsplicerCrumbs")||"[]"); a.slice(-10).forEach(c=>add(`${new Date(c.t).toLocaleTimeString()} ${c.step}${c.mem?` (${c.mem} MB)`:""}`)); }catch(e){}
  if(S.lastError){ add(""); add("LAST ERROR"); add(String(S.lastError).slice(0,1200)); }
  add(""); add(`Diagnostics took ${((performance.now()-t0)/1000).toFixed(1)} s`); show(); return L.join("\n"); }
$("diagBtn").onclick=async()=>{ const b=$("diagBtn"); b.disabled=true; b.textContent="Running…"; $("diagOut").hidden=false; $("diagText").textContent="Running diagnostics…"; try{ if(_heavyN>0){ const cur=_heavyCur?`“${_heavyCur.label}”, running for ${Math.round((Date.now()-_heavyCur.at)/1000)} s`:"a job"; crumb("diagnostics while busy: "+cur); await runDiagnostics(); $("diagText").textContent=`Busy when this ran: ${cur}.\n`+$("diagText").textContent; } else await heavy("Running diagnostics",runDiagnostics); } /* never wait behind a job that may be stuck */finally{ b.disabled=false; b.textContent="Run diagnostics again"; } };
$("diagCopy").onclick=async()=>{ if(NATIVE&&NP("Share")){ try{ await NP("Share").share({text:$("diagText").textContent,dialogTitle:"Send the report"}); }catch(e){} return; } try{ await navigator.clipboard.writeText($("diagText").textContent); $("diagCopy").textContent="Copied"; setTimeout(()=>$("diagCopy").textContent="Copy report",1800); }catch(e){ const r=document.createRange(); r.selectNodeContents($("diagText")); const s=getSelection(); s.removeAllRanges(); s.addRange(r); status("Couldn’t copy automatically: the report is selected, so copy it from the menu."); } };
$("diagSave").onclick=()=>saveFile(`Beat Splicer diagnostics ${new Date().toISOString().slice(0,10)}.txt`,new Blob([$("diagText").textContent],{type:"text/plain"}));
/* built-in self-tests: quick checks of the parts that have broken before */
async function selfTests(){ const T=[], t=(name,fn)=>{ try{ const r=fn(); T.push({name,ok:r===true,why:r===true?"":String(r)}); }catch(e){ T.push({name,ok:false,why:String(e&&e.message||e)}); } };
  t("Page fits the screen width",()=>document.documentElement.scrollWidth<=innerWidth+2||`page is ${document.documentElement.scrollWidth}px wide on a ${innerWidth}px screen`);
  t("Progress maths",()=>{ const pb=S.passBase,pc=S.passCount; S.passBase=30; S.passCount=60; const v=Math.min(1,(S.passBase+15)/Math.max(0.01,S.passCount)); S.passBase=pb; S.passCount=pc; return Math.abs(v-0.75)<1e-9||`got ${v}`; });
  t("Main-character check doesn’t loop",()=>{ isHeroTag({subj:"x",chars:undefined},"x"); isHeroTag({subj:"y"},"x"); return true; });
  t("Face fingerprints survive saving",()=>{ const d=new Float32Array(128).map((_,i)=>Math.sin(i)*0.2), e=fqDec(fqEnc(d)); return fDist(d,e)<0.02||"fingerprint changed too much"; });
  t("Watermark crop keeps the picture",()=>{ const c={w:640,h:360,crop:ZCROP,wm:[{x0:0,y0:0,x1:0.15,y1:0.12}],kind:"video"}; const cr=viewCrop(c,1920,1080,{fit:"fill"}); return (1-cr.l-cr.r)>0.5&&(1-cr.t-cr.b)>0.5||"crop too large"; });
  t("Song acts cover the whole song",()=>{ if(!S.an) return true; const a=actsFor([0,S.an.duration]); return a.length===5&&Math.abs(a[0].t0)<1e-6&&Math.abs(a[4].t1-S.an.duration)<1e-6&&a.every((x,i)=>i===0||Math.abs(x.t0-a[i-1].t1)<1e-6)||"gaps between acts"; });
  t("Source time stays inside the clip",()=>{ if(!S.plan) return true; const F=readFx(); for(const s of S.plan.slice(0,60)){ const c=S.clips[s.clip]; if(!c||c.kind==="image") continue; for(const f of [0,0.5,0.99]){ const v=srcTimeAt(s,s.start+(s.end-s.start)*f,F); if(!(v>=-0.01&&v<=c.dur+0.05)) return `shot at ${s.start.toFixed(1)}s asks for ${v.toFixed(2)}s of a ${c.dur.toFixed(1)}s clip`; } } return true; });
  t("Edit covers the song with no gaps",()=>{ if(!S.plan||!S.plan.length) return true; for(let i=1;i<S.plan.length;i++) if(Math.abs(S.plan[i].start-S.plan[i-1].end)>1e-3) return `gap at ${S.plan[i].start.toFixed(2)}s`; return true; });
  t("Settings can be saved",()=>{ saveSettings(); return !!localStorage.getItem("beatsplicer2")||"nothing saved"; });
  t("Timed lyrics are read to the line",()=>{ const P=parseLyrics("[ti:x]\n[00:12.00]First line\n[00:18.50]Second line\n[00:30.00]"); const L=P.lines.filter(l=>!l.gap); return P.timed&&L.length===2&&L[0].t===12&&L[1].t===18.5||JSON.stringify(P); });
  t("Plain lyrics are spread in order",()=>{ if(!S.an) return true; const L=spreadLyrics(parseLyrics("one\ntwo words here\nthree").lines); return L.every((l,i)=>i===0||l.t>L[i-1].t)&&L[0].t>=0&&L[L.length-1].t<S.an.duration||"lines out of order"; });
  t("Trims move the right cut",()=>{ const seg=(a,b)=>({start:a,end:b}), s=[seg(0,2),seg(2,4),seg(4,6)], keep=S.trims; S.trims=[{from:4,to:4.5}]; applyTrims(s); S.trims=keep; return s[1].end===4.5&&s[2].start===4.5&&s[0].end===2||JSON.stringify(s); });
  t("Essentials hides the advanced settings",()=>{ const adv=document.querySelector(".adv"); if(!adv) return "no advanced settings tagged"; const was=document.body.classList.contains("simple"); document.body.classList.add("simple"); const hid=getComputedStyle(adv).display==="none"; if(!was) document.body.classList.remove("simple"); return hid||"advanced settings still showing"; });
  t("Each export covers its whole window",()=>{ if(!S.plan) return true; for(const id of S.eps){ const ep=EP(id); if(!ep) continue; const w=windowFor(ep), P=makeExportPlan(ep,w); if(!P||!P.length) return `${ep.name}: empty plan`; if(Math.abs(P[0].start-w[0])>0.02||Math.abs(P[P.length-1].end-w[1])>0.02) return `${ep.name}: plan runs ${P[0].start.toFixed(2)}–${P[P.length-1].end.toFixed(2)}, window ${w[0].toFixed(2)}–${w[1].toFixed(2)}`; } return true; });
  t("Style card matches what’s in effect",()=>{ const st=S.style||{}; if(!st.name||st.custom) return true; return !(DSTYLES[st.name])||S.direct===st.name||`card says ${st.name}, director is ${S.direct}`; });
  t("Theme colours are defined",()=>{ const cs=getComputedStyle(document.documentElement); return ["--bg","--ink","--sel","--panel","--line"].every(v=>cs.getPropertyValue(v).trim())||"a theme colour is missing"; });
  return T; }
/* Essentials or all settings; steps renumber so the visible ones read 1, 2, 3… */
function applyView(v){ v=v==="all"?"all":"simple"; document.body.classList.toggle("simple",v==="simple"); try{ localStorage.setItem("beatsplicerView",v); }catch(e){}
  $("viewSimple").setAttribute("aria-pressed",String(v==="simple")); $("viewAll").setAttribute("aria-pressed",String(v==="all"));
  let n=0; document.querySelectorAll("details.step").forEach(d=>{ const num=d.querySelector(".num"); if(getComputedStyle(d).display!=="none"&&num) num.textContent=String(++n); }); }
$("viewSimple").onclick=()=>applyView("simple"); $("viewAll").onclick=()=>applyView("all");
applyView((()=>{ try{ return localStorage.getItem("beatsplicerView")||"simple"; }catch(e){ return "simple"; } })());
/* light, dark, or follow the device */
const THEME_ICON={system:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'};
function applyTheme(t){ if(t!=="light"&&t!=="dark") t="system"; const r=document.documentElement; if(t==="system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme",t);
  try{ localStorage.setItem("beatsplicerTheme",t); }catch(e){}
  const b=$("themeBtn"); if(b){ const lab={system:"Theme: matches your device",light:"Theme: light",dark:"Theme: dark"}[t]; b.innerHTML=THEME_ICON[t]; b.title=lab+" (tap to change)"; b.setAttribute("aria-label",lab); b.dataset.mode=t; }
  try{ drawTimeline(); }catch(e){} }
$("themeBtn").onclick=()=>{ const cur=$("themeBtn").dataset.mode||"system"; applyTheme({system:"dark",dark:"light",light:"system"}[cur]); };
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ try{ drawTimeline(); }catch(e){} }); }catch(e){}
applyTheme((()=>{ try{ return localStorage.getItem("beatsplicerTheme")||"system"; }catch(e){ return "system"; } })());
loadSettings(); try{ if(!localStorage.getItem("beatsplicerAdv1")){ if($("exclN").value==="0"||!$("exclN").value) $("exclN").value="adv"; localStorage.setItem("beatsplicerAdv1","1"); saveSettings(); } }catch(e){} /* reusing clips with fresh footage is the new default */ try{ if(!localStorage.getItem("beatsplicerBorder3")){ if($("progBorder").value==="frame") $("progBorder").value="line"; localStorage.setItem("beatsplicerBorder3","1"); saveSettings(); } }catch(e){} loadKeys(); loadBrand(); buildSoundUI(); buildCropUI(); buildStyleUI(); buildEndpointUI(); sizeStage();
$("clipSoundRow").hidden=!$("clipSound").checked; $("clipSoundNote").hidden=!$("clipSound").checked;
renderClips(); drawTimeline(); updateButtons();
if(NATIVE&&$("diagCopy")) $("diagCopy").textContent="Send report";
