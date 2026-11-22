/* ---------------- Beat Splicer for AI assistants ----------------
   window.BeatSplicer: the app as a handful of commands, so an assistant can drive it without clicking buttons.
   The MCP server (mcp/) runs the app in a hidden browser and calls these; browsers with WebMCP (navigator.modelContext)
   are offered the same commands directly. Everything still happens on the device. */
const API_VERSION=1;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function apiIdle(ms=600000){ const t0=Date.now(); await sleep(50); while(Date.now()-t0<ms){ const busy=(typeof _heavyCur!=="undefined"&&_heavyCur&&FRONT_JOBS.test(_heavyCur.label))||S._auto||S._making||S._songLoading||(S.running&&S.running.record); if(!busy) return true; await sleep(150); } throw new Error("timed out waiting for the app"); }
function apiSummary(){ const ep=previewEp(), w=S.an&&S.plan?windowFor(ep):null, P=w?(makeExportPlan(ep,w)||S.plan):null, shots=P?P.filter(s=>s.end>w[0]&&s.start<w[1]):[];
  return { song:S.audioName||null, length:S.an?+S.an.duration.toFixed(1):null, bpm:S.an?Math.round(S.an.bpm):null, clips:S.clips.filter(c=>c.samples&&!c.off).length,
    ready:!!S.plan, mood:S._mood||null, style:S.style&&S.style.name||null, look:$("look").value, platforms:S.eps.slice(), cut:w?{from:+w[0].toFixed(2),to:+w[1].toFixed(2),shots:shots.length}:null,
    title:$("quickTitle").value||null, chose:($("autoOut").textContent||"").replace(/\s*•\s*/g,"\n• ").trim().slice(0,1500)||null, status:$("status").textContent||"" }; }
async function apiSheet(){ if(!S.plan) throw new Error("no cut yet: add a song and clips first"); const ep=previewEp(), w=windowFor(ep), P=makeExportPlan(ep,w)||S.plan; const b=await sheetOf(P,w);
  return await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(b); }); }
const BeatSplicer={ version:API_VERSION,
  status:()=>apiSummary(),
  moods:()=>MOODS.map(m=>({id:m.k,name:m.name,about:m.d})),
  platforms:()=>ENDPOINTS.map(e=>({id:e.id,name:e.name,size:`${e.w}x${e.h}`,short:!!e.short,tip:e.tip})),
  async useSample(){ $("trySample").click(); await sleep(300); await apiIdle(); return apiSummary(); },
  async addFiles(files){ await takeFiles(files); await apiIdle(); return apiSummary(); },
  async makeCut(){ await apiIdle(); if(!S.plan) throw new Error("add a song and clips first"); S._autoCutKey=flowKey(); await autopilot(); await apiIdle(); return apiSummary(); },
  async setMood(id){ const m=MOODS.find(x=>x.k===id||x.name.toLowerCase()===String(id).toLowerCase()); if(!m) throw new Error("unknown mood: "+id+". Try one of "+MOODS.map(x=>x.k).join(", ")); if(S.running&&!S.running.record) stopRun(); await apiIdle();
    S._mood=m.k; if(m.style){ if(DSTYLES[m.style]){ $("direct").value=m.style; setDirect(m.style,""); } else applyStyle(m.style); } else { S._autoCutKey=flowKey(); await autopilot(); } await apiIdle(); renderMoods(); return apiSummary(); },
  async newIdea(){ await apiIdle(); $("newDir").click(); await sleep(200); await apiIdle(); return apiSummary(); },
  async shuffle(){ await apiIdle(); remix(); await apiIdle(); return apiSummary(); },
  setTitle(t){ const q=$("quickTitle"); q.value=String(t||"").slice(0,60); q.dispatchEvent(new Event("input")); q.dispatchEvent(new Event("change")); return apiSummary(); },
  setPlatforms(ids){ const ok=(ids||[]).filter(id=>EP(id)); if(!ok.length) throw new Error("no known platform in "+JSON.stringify(ids)); S.eps=ok; buildEndpointUI(); saveSettings(); updateButtons(); return apiSummary(); },
  sheet:()=>apiSheet(),
  async makeVideos(){ await apiIdle(); if(!S.plan) throw new Error("add a song and clips first"); if(S.running) stopRun(); await sleep(150); if(S.wc&&(S.wc.mp4||S.wc.webm)&&$("engine").value==="auto") $("engine").value="exact"; /* frame-exact when this browser can */ await makeVideos(true); await apiIdle(); if(!S.results.length) throw new Error(($("status").textContent||"the video wasn't made").slice(0,300)); try{ closeFinish(); }catch(e){}
    return S.results.map((r,i)=>({i,name:resultName(r),platform:r.ep.id,size:`${r.ep.w}x${r.ep.h}`,seconds:+(r.win[1]-r.win[0]).toFixed(1),bytes:r.blob.size,check:r.check?{ok:r.check.ok,notes:r.check.notes}:null})); },
  resultBlob:i=>S.results[i]&&S.results[i].blob,
  /* hands a made video to the browser's download (the MCP server catches it and saves it where you asked) */
  download(i){ const r=S.results[i]; if(!r) throw new Error("no video "+i); const a=document.createElement("a"), u=URL.createObjectURL(r.blob); a.href=u; a.download=resultName(r); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),60000); return a.download; }
};
window.BeatSplicer=BeatSplicer;
/* WebMCP: browsers that let pages offer tools to an assistant get the same commands (only those that need no files) */
(function webmcp(){ const mc=navigator.modelContext; if(!mc) return; const text=o=>({content:[{type:"text",text:typeof o==="string"?o:JSON.stringify(o,null,1)}]});
  const tools=[
    {name:"beat_splicer_status",description:"What's loaded in Beat Splicer (song, clips, mood, platforms) and the current cut.",inputSchema:{type:"object",properties:{}},execute:async()=>text(apiSummary())},
    {name:"beat_splicer_use_sample",description:"Load Beat Splicer's sample song and clips, so a cut can be made without the user's own files.",inputSchema:{type:"object",properties:{}},execute:async()=>text(await BeatSplicer.useSample())},
    {name:"beat_splicer_set_mood",description:"Remake the cut in a mood: "+MOODS.map(m=>`${m.k} (${m.d})`).join(", ")+".",inputSchema:{type:"object",properties:{mood:{type:"string",enum:MOODS.map(m=>m.k)}},required:["mood"]},execute:async a=>text(await BeatSplicer.setMood(a.mood))},
    {name:"beat_splicer_new_idea",description:"A different idea for the cut: new story, pace and look.",inputSchema:{type:"object",properties:{}},execute:async()=>text(await BeatSplicer.newIdea())},
    {name:"beat_splicer_set_title",description:"The title shown at the start of the video (empty for none).",inputSchema:{type:"object",properties:{title:{type:"string",maxLength:60}},required:["title"]},execute:async a=>text(BeatSplicer.setTitle(a.title))},
    {name:"beat_splicer_set_platforms",description:"Which videos to make: "+ENDPOINTS.map(e=>e.id).join(", ")+".",inputSchema:{type:"object",properties:{platforms:{type:"array",items:{type:"string"}}},required:["platforms"]},execute:async a=>text(BeatSplicer.setPlatforms(a.platforms))},
    {name:"beat_splicer_frames",description:"Eight frames from the current cut, in order, as one picture.",inputSchema:{type:"object",properties:{}},execute:async()=>{ const d=await apiSheet(); return {content:[{type:"image",data:d.split(",")[1],mimeType:"image/jpeg"}]}; }},
    {name:"beat_splicer_make_videos",description:"Make the videos for the chosen platforms. They're saved on the device; the user can share them from the finish screen.",inputSchema:{type:"object",properties:{}},execute:async()=>{ const r=await BeatSplicer.makeVideos(); try{ openFinish(); }catch(e){} return text(r); }}];
  try{ if(typeof mc.provideContext==="function") mc.provideContext({tools}); else if(typeof mc.registerTool==="function") tools.forEach(t=>mc.registerTool(t)); crumb("WebMCP tools offered"); }catch(e){ crumb("WebMCP: "+(e&&e.message||e)); } })();
