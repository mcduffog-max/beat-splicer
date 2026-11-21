/* ---------------- Song library and the best song + clips combination ---------------- */
S.songs=[];
const AUDIO_EXT=/\.(wav|mp3|m4a|aac|ogg|flac|opus)$/i;
function addSongFolder(files){ const list=[...files]; return heavy("Listening to your songs",()=>addSongFolderNow(list)); }
async function addSongFolderNow(files){
  S.lrcFiles=new Map([...files].filter(f=>/\.lrc$/i.test(f.name)).map(f=>[f.name.replace(/\.lrc$/i,"").toLowerCase(),f]));
  const list=[...files].filter(f=>AUDIO_EXT.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!list.length){ status("No audio files in that folder.",true); return; }
  S.songs=list.map(f=>({file:f,an:null,big:f.size>(/\.wav$/i.test(f.name)?2e9:250e6),err:isSkipped(f)?"skipped":false})); renderSongs();
  for(const s of S.songs){ if(!s.big && !s.err && s.file.size>25e6){ const d=await audioDuration(s.file); if(d && d>LONG_LIMIT){ s.long=d; s.err="long"; } } }
  await analyseSongs(40);
}
/* songs are analysed in batches of 40, so pointing at a whole music library can't swamp the browser */
async function analyseSongs(batch){
  const todo=S.songs.filter(s=>!s.an&&!s.err&&!s.big).slice(0,batch);
  for(let k=0;k<todo.length;k++){ const s=todo[k]; status(`Listening to your songs: ${k+1} of ${todo.length} (${s.file.name})…`);
    // decoded at analysis quality (22 kHz): the analysis works at that rate anyway, and it halves the memory of a long song
    anaMark("song",s.file,k+1,todo.length);
    try{ const buf=await songForAnalysis(s.file); s.an=await analyzeAudio(buf,()=>{}); }catch(e){ s.err=true; }
    anaMark(null);
    renderSongs(); await new Promise(r=>setTimeout(r,80)); } // a breath between songs so the browser can free the last one
  const left=S.songs.filter(s=>!s.an&&!s.err&&!s.big).length, big=S.songs.filter(s=>s.big).length;
  status(`${S.songs.filter(s=>s.an).length} songs ready.${left?` ${left} more not analysed yet (use “Analyse more songs”).`:""}${big?` ${big} file${big===1?" is":"s are"} too large to analyse (over 300 MB).`:""}${S.clips.some(c=>c.samples)?" Press “Find the best song and clips”.":" Add your clips, then press “Find the best song and clips”."}`);
  $("moreSongs").hidden=!left;
  const first=S.songs.find(s=>s.an);
  if(!S.audioFile && first){ if(_heavyN>1){ S._deferredSong=first; crumb("songs done; opening the first song after the clips"); } else { crumb("opening song "+first.file.name); await loadAudio(first.file,first.an); } }
  renderSongs(); updateButtons();
}
function renderSongs(){
  const box=$("songList"); box.innerHTML="";
  S.songs.forEach((s,i)=>{ const row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid var(--line)";
    const fit=s.an&&S.clips.some(c=>c.samples)?comboFor(s.an):null;
    const t=document.createElement("span"); t.style.flex="1"; t.textContent=s.err==="long"?`${s.file.name}: ${fmtTime(s.long)} long recording (tap Use to pick a section)`:s.big?`${s.file.name}: too large to analyse`:s.err==="skipped"?`${s.file.name}: set aside (it stopped the page last time)`:s.err?`${s.file.name}: couldn’t read`:s.an?`${s.file.name} · ${fmtTime(s.an.duration)} · ${s.an.feel&&s.an.feel.free==="beatless"?"no steady beat":Math.round(s.an.bpm)+" BPM"} · ${s.an.feel?s.an.feel.label:""}${fit?` · fit ${Math.round(fit.score*100)}%`:""}`:`${s.file.name}: listening…`;
    row.appendChild(t);
    if(s.err==="long"){ const b=document.createElement("button"); b.className="chip"; b.textContent="Use"; b.onclick=()=>heavy("Reading the song",()=>loadAudio(s.file)).then(renderSongs); row.appendChild(b); }
    if(s.an){ const b=document.createElement("button"); b.className="chip"; b.textContent=S.audioFile===s.file?"In use":"Use"; b.disabled=S.audioFile===s.file||!!S.running; b.onclick=()=>loadAudio(s.file,s.an).then(renderSongs); row.appendChild(b); }
    box.appendChild(row); });
}
function clipStats(c){ if(c.kind==="image") return {mot:0.1,br:0.5}; const ms=c.samples; return {mot:Math.min(1,ms.reduce((a,x)=>a+(x.motion||0),0)/ms.length/6), br:Math.min(1,ms.reduce((a,x)=>a+(x.bright||0),0)/ms.length/200)}; }
function songProfile(an){ const body=an.E.filter(v=>v>0.05), e=body.reduce((a,b)=>a+b,0)/(body.length||1), fe=an.feel||{}, tk=Math.min(1,Math.max(0,(an.bpm-60)/110));
  const wantMot=fe.free==="beatless"?0.15:fe.free?0.3:Math.min(1,Math.max(0.1,0.25+0.4*e+0.35*tk-(fe.halftime?0.1:0)));
  return {e,wantMot,bright:Math.min(1,Math.max(0,((an.centroid||2000)-1200)/2800))}; }
/* how well the footage suits a song: movement against the music's drive, brightness against its tone, and whether there are
   enough good clips for each format (a full music video needs far more than a short) */
function comboFor(an){
  const sp=songProfile(an), dur=an.duration, pool=S.clips.map((c,i)=>({c,i})).filter(x=>x.c.samples);
  const scored=pool.map(({c,i})=>{ const st=clipStats(c); let f=1-0.7*Math.abs(st.mot-sp.wantMot)-0.3*Math.abs(st.br-sp.bright);
      if(c.kind==="image") f-=sp.wantMot>0.5?0.25:0.05;
      if(c.tags&&c.tags.length){ const inten=c.tags.reduce((a,t)=>a+(t.inten||0),0)/c.tags.length; f+=0.15*(1-Math.abs(inten-sp.e)); }
      return {i,f,dur:c.kind==="image"?3:c.dur}; }).sort((a,b)=>b.f-a.f);
  const good=scored.filter(x=>x.f>=0.55), footage=good.reduce((a,x)=>a+x.dur,0);
  const longNeed=Math.max(6,Math.ceil(dur/15)), longIdeal=Math.max(longNeed,Math.round(dur/8)), shortNeed=6, shortIdeal=14;
  const longOK=good.length>=longNeed && footage>=dur*0.5, shortOK=good.length>=shortNeed;
  const pickN=Math.min(scored.length,Math.max(longOK?longIdeal:shortIdeal,good.length)), picks=scored.slice(0,pickN);
  const quality=picks.reduce((a,x)=>a+x.f,0)/(picks.length||1), coverage=Math.min(1,good.length/(longOK?longIdeal:shortIdeal));
  return {score:Math.max(0,Math.min(1,0.65*quality+0.35*coverage)), longOK, shortOK, picks:picks.map(x=>x.i), good:good.length, longNeed, footage, sp, total:pool.length};
}
async function bestCombo(){
  const cands=S.songs.filter(s=>s.an).map(s=>({file:s.file,an:s.an})); if(!cands.length && S.an) cands.push({file:S.audioFile,an:S.an});
  if(!cands.length||!S.clips.some(c=>c.samples)){ status("Add songs and clips first.",true); return; }
  const res=cands.map(c=>({...c,...comboFor(c.an)})).sort((a,b)=>b.score-a.score), best=res[0], out=$("comboOut"); out.innerHTML="";
  const fmts=best.longOK&&best.shortOK?"both a full music video and short-form":best.shortOK?"short-form (Shorts, Reels, TikTok)":"a short teaser at most";
  const p=document.createElement("p"); p.style.margin="4px 0";
  p.textContent=`Best match: “${best.file.name}” (fit ${Math.round(best.score*100)}%). It uses ${best.picks.length} of your ${best.total} clips: the ones whose movement and colour suit this song${best.sp.wantMot>0.6?" (lively footage for a driving track)":best.sp.wantMot<0.3?" (calmer footage for a gentle track)":""}. Your footage suits ${fmts}.${!best.longOK?` A full-length video needs about ${best.longNeed} well-matched clips; you have ${best.good}.`:""}`;
  out.appendChild(p);
  if(res.length>1){ const alt=document.createElement("p"); alt.style.margin="2px 0"; alt.textContent="Next best: "+res.slice(1,4).map(r=>`${r.file.name} (${Math.round(r.score*100)}%)`).join(", "); out.appendChild(alt); }
  const b=document.createElement("button"); b.className="btn primary"; b.textContent="Use this combination"; out.appendChild(b);
  b.onclick=async()=>{ if(S.audioFile!==best.file) await loadAudio(best.file,best.an);
    const keep=new Set(best.picks); S.clips.forEach((c,i)=>{ if(c.samples) c.off=!keep.has(i); });
    S.eps=best.longOK?["youtube","shorts","reels","tiktok"]:["shorts","reels","tiktok"]; buildEndpointUI(); renderClips(); renderSongs(); buildPlan(); saveProjectSoon();
    const msg=best.longOK?"Song and clips chosen. Both long and short versions are ticked under Publish.":"Song and clips chosen for short-form. You can still tick YouTube under Publish, but there isn’t enough well-matched footage for a full-length video yet.";
    status(msg); b.remove(); const ok=document.createElement("p"); ok.style.cssText="margin:4px 0;font-weight:600"; ok.textContent="✓ "+msg; out.appendChild(ok); };
}

