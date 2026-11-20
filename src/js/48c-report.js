/* ---------------- Report a problem, from inside the app ----------------
   One button, one box for what happened. The report carries the app version, the device, the last error, the steps
   leading up to it and the settings in use (diagnostics too, if they were run), and lands as an issue in the GitHub
   repository, where it can be fixed and shipped as an update. Nothing personal is sent: no clips, no song, no names
   beyond the file names already in the steps. */
function reportInfo(){ const crumbs=(()=>{ try{ return JSON.parse(localStorage.getItem("beatsplicerCrumbs")||"[]"); }catch(e){ return []; } })().slice(-14).map(x=>`${new Date(x.t).toLocaleTimeString()} ${x.step}${x.mem?` (${x.mem} MB)`:""}`).join("\n");
  const set={}; (typeof LOOK_IDS!=="undefined"?LOOK_IDS:[]).forEach(id=>{ const el=$(id); if(el&&!/^key|^rv|artistName|projName|dirNote|hookText|endText|brandText/.test(id)) set[id]=el.type==="checkbox"?el.checked:el.value; });
  const proj=`Clips: ${S.clips.length} (${S.clips.filter(c=>c.samples).length} ready)${S.audioName?`; song ${fmtTime(S.an?S.an.duration:0)} at ${S.an?Math.round(S.an.bpm):"?"} BPM`:"; no song"}; formats: ${(S.eps||[]).join(", ")}; shots: ${S.plan?S.plan.length:0}`;
  return {crumbs, settings:JSON.stringify(set), proj}; }
async function appLabel(){ let v="web"; if(NATIVE){ try{ const i=await NP("AppUpdate").info(); v=`Android app build ${i.versionCode}`; }catch(e){ v="Android app"; } } return `${v} · ${BUILD} · ${navigator.userAgent.slice(0,160)} · ${navigator.deviceMemory||"?"} GB`; }
function openReport(prefill){ const box=$("repBox"); box.hidden=false; $("repWhat").value=prefill||""; $("repMsg").textContent=""; $("repSend").disabled=false; $("repWhat").focus(); }
async function sendReport(){ const what=$("repWhat").value.trim(); if(!what&&!S.lastError){ $("repMsg").textContent="Say briefly what happened, so it can be found and fixed."; return; }
  $("repSend").disabled=true; $("repMsg").textContent="Sending…"; const inc=$("repDiag").checked, info=reportInfo(), app=await appLabel();
  const diag=inc?[info.proj,"",`Recent steps:\n${info.crumbs}`,"",`Settings: ${info.settings}`, $("diagText")&&$("diagText").textContent.length>40?`\n${$("diagText").textContent}`:""].join("\n"):"";
  const r={title:(what.split(/[.\n]/)[0]||"Problem in the app").slice(0,90), what, app, error:inc?(S.lastError||""):"", diag, contact:$("repContact").value.trim()};
  if(RELAY.url){ try{ const res=await fetch(RELAY.url.replace(/\/$/,"")+"/report",{method:"POST",headers:{"content-type":"application/json","x-app-key":RELAY.key},body:JSON.stringify(r)}); const j=await res.json().catch(()=>({}));
      if(res.ok&&j.number){ $("repMsg").textContent=`Thanks: report #${j.number} is in. A fix will arrive through Update app.`; crumb("reported problem #"+j.number); setTimeout(()=>{ $("repBox").hidden=true; },5000); return; }
      throw new Error(j.error||("status "+res.status)); }catch(e){ crumb("report relay failed: "+(e&&e.message||e)); } }
  // no relay yet (or it failed): a pre-filled GitHub issue, opened in the browser
  const body=`**What happened**\n\n${what||"(not described)"}\n\n**App**: ${app}\n\n${r.error?"**Error details**\n```\n"+r.error.slice(0,2500)+"\n```\n\n":""}${diag?"**Diagnostics**\n```\n"+diag.slice(0,3500)+"\n```":""}`;
  const url=`https://github.com/mcduffog-max/beat-splicer/issues/new?labels=from-app&title=${encodeURIComponent(r.title)}&body=${encodeURIComponent(body)}`;
  window.open(url,"_blank"); $("repMsg").textContent="Opened a pre-filled report on GitHub: press Submit there to send it."; $("repSend").disabled=false; }
$("repOpen").onclick=()=>openReport(""); $("repSend").onclick=sendReport; $("repCancel").onclick=()=>{ $("repBox").hidden=true; };
if($("errReport")) $("errReport").onclick=()=>openReport("The app stopped with an error while I was ");
{ const mirror=()=>{ $("errReport").hidden=$("errBtn").hidden; }; new MutationObserver(mirror).observe($("errBtn"),{attributes:true,attributeFilter:["hidden"]}); mirror(); } // wherever an error offers its details, it offers a report too
