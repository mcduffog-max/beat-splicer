/* ---------------- Inputs ---------------- */
/* ---------------- Long recordings: check the length first, decode only the part being used ---------------- */
const IS_PHONE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.deviceMemory||8)<=4;
const LONG_LIMIT=IS_PHONE?600:900; // seconds; decoding more than this at once can exhaust a phone (or a busy laptop)
function audioDuration(file){ return new Promise(res=>{ const a=document.createElement("audio"), u=URL.createObjectURL(file); let done=false;
  const fin=d=>{ if(done) return; done=true; a.removeAttribute("src"); a.load(); URL.revokeObjectURL(u); res(d); };
  a.preload="metadata"; a.onloadedmetadata=()=>fin(isFinite(a.duration)?a.duration:null); a.onerror=()=>fin(null); setTimeout(()=>fin(null),8000); a.src=u; }); }
function wavBlob(buf){ // 16-bit stereo WAV of an AudioBuffer
  const ch=Math.min(2,buf.numberOfChannels), n=buf.length, sr=buf.sampleRate, out=new DataView(new ArrayBuffer(44+n*ch*2)), w=(o,s)=>{ for(let i=0;i<s.length;i++) out.setUint8(o+i,s.charCodeAt(i)); };
  w(0,"RIFF"); out.setUint32(4,36+n*ch*2,true); w(8,"WAVEfmt "); out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,ch,true); out.setUint32(24,sr,true); out.setUint32(28,sr*ch*2,true); out.setUint16(32,ch*2,true); out.setUint16(34,16,true); w(36,"data"); out.setUint32(40,n*ch*2,true);
  const d=[...Array(ch)].map((_,c)=>buf.getChannelData(c)); let o=44; for(let i=0;i<n;i++) for(let c=0;c<ch;c++){ const v=Math.max(-1,Math.min(1,d[c][i])); out.setInt16(o,v<0?v*32768:v*32767,true); o+=2; }
  return new Blob([out.buffer],{type:"audio/wav"});
}
async function decodeSection(file,dur,start,len){
  const ac=new OfflineAudioContext(2,1,44100);
  if(/\.wav$/i.test(file.name)){ const head=new DataView(await file.slice(0,Math.min(file.size,1<<16)).arrayBuffer()); /* reuse the streaming reader on a byte range */
    const b=await wavRead(file,"playback",start,len); if(b) return b; }
  if(/\.mp3$/i.test(file.name)||/mpeg/.test(file.type)){
    const h10=new Uint8Array(await file.slice(0,10).arrayBuffer()); let id3=0; if(h10[0]===0x49&&h10[1]===0x44&&h10[2]===0x33) id3=10+((h10[6]&127)<<21|(h10[7]&127)<<14|(h10[8]&127)<<7|(h10[9]&127));
    const bps=(file.size-id3)/dur, a=Math.max(id3,Math.floor(id3+start*bps)-8192), b=Math.min(file.size,Math.ceil(id3+(start+len)*bps)+8192); // MP3 frames re-sync on their own, so a byte range decodes cleanly
    const buf=await ac.decodeAudioData(await file.slice(a,b).arrayBuffer());
    const skip=Math.round(Math.max(0,(start*bps+id3-a)/bps)*buf.sampleRate), n=Math.min(buf.length-skip,Math.round(len*buf.sampleRate));
    const out=new AudioBuffer({length:Math.max(1,n),numberOfChannels:buf.numberOfChannels,sampleRate:buf.sampleRate}); for(let c=0;c<buf.numberOfChannels;c++) out.copyToChannel(buf.getChannelData(c).subarray(skip,skip+n),c); return out; }
  throw new Error("Only MP3 and WAV recordings this long can be opened in sections. Trim it to under "+Math.round(LONG_LIMIT/60)+" minutes in an audio app first.");
}
function askSection(file,dur){ return new Promise(res=>{ const box=$("longAudio"); box.hidden=false;
  $("longText").textContent=`“${file.name}” is ${fmtTime(dur)} long, too long to edit as one piece${IS_PHONE?" on a phone":""}. Choose the part to use:`;
  $("longStart").value="0:00"; $("longStart").max=fmtTime(Math.max(0,dur-30));
  $("longGo").onclick=()=>{ const p=$("longStart").value.split(":").map(Number), st=p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:+p[0]||0;
    const len=Math.min(+$("longLen").value,LONG_LIMIT,dur-st); box.hidden=true; res(isFinite(st)&&len>10?{start:Math.max(0,st),len}:null); };
  $("longCancel").onclick=()=>{ box.hidden=true; res(null); }; }); }
/* Sped up, nightcore and slowed + reverb: the song is re-rendered at a new speed (pitch follows, as on TikTok) and re-analysed */
async function versionedBuffer(buf,ver){
  const R={spedup:1.2,nightcore:1.3,slowed:0.85}[ver]; if(!R||!buf) return buf;
  const sr=buf.sampleRate, oc=new OfflineAudioContext(Math.min(2,buf.numberOfChannels),Math.ceil(buf.length/R),sr), s=oc.createBufferSource(); s.buffer=buf; s.playbackRate.value=R;
  if(ver==="slowed"){ const dry=oc.createGain(); dry.gain.value=0.82; s.connect(dry); dry.connect(oc.destination); const rv=reverb(oc,3.4,0.42); s.connect(rv.input); rv.output.connect(oc.destination); }
  else s.connect(oc.destination);
  s.start(0); return await oc.startRendering();
}
async function applySongVersion(){
  if(!S.audioOrig||S.running) return; const v=$("songVer").value;
  $("prog").hidden=false; status(v==="orig"?"Back to the original song…":`Making the ${$("songVer").selectedOptions[0].textContent.toLowerCase()} version…`);
  try{ S.audioBuf=v==="orig"?S.audioOrig:await versionedBuffer(S.audioOrig,v); S._endingFor=null;
    const tx=S.an&&S.an.tempoX||1; S.an=await analyzeAudio(S.audioBuf,q=>{ $("prog").value=q; status(`Finding the beat… ${Math.round(q*100)}%`); },tx!==1?{x:tx}:undefined);
    $("audioInfo").textContent=songInfoText(); renderTempo();
    S.titles={}; buildPlan(); status("Song version ready."); }
  catch(e){ status("Couldn’t make that version of the song.",true); }
  finally{ $("prog").hidden=true; }
}
async function loadAudio(file,cachedAn){
  if(!file) return;
  stopRun(); stopListen();
  if(!file._section){ const dur=file.size>25e6?await audioDuration(file):null;
    if(dur && dur>LONG_LIMIT){ crumb(`long recording ${file.name}: ${Math.round(dur/60)} min`); const pick=await askSection(file,dur); if(!pick){ status("Choose a song, or a section of a long recording."); return; }
      status(`Opening ${fmtTime(pick.len)} of ${file.name} from ${fmtTime(pick.start)}…`); crumb(`opening section ${fmtTime(pick.start)} + ${fmtTime(pick.len)} of ${file.name}`);
      try{ const buf=await decodeSection(file,dur,pick.start,pick.len); const base=file.name.replace(/\.[^.]+$/,"");
        const sec=new File([wavBlob(buf)],`${base} (${fmtTime(pick.start).replace(":","m")}s–${fmtTime(pick.start+pick.len).replace(":","m")}s).wav`,{type:"audio/wav",lastModified:Date.now()}); sec._section=true;
        return loadAudio(sec); }
      catch(e){ status(e.message||"Couldn’t open that section.",true); return; } } }
  status("Reading "+file.name+"…"); crumb(`opening song ${file.name} (${(file.size/1e6).toFixed(0)} MB)`);
  try{
    let pb=null; if(/\.wav$/i.test(file.name) && file.size>40e6){ try{ pb=await wavForPlayback(file); }catch(e){ pb=null; } }
    if(pb) S.audioBuf=pb;
    else { const ab=await file.arrayBuffer(); const ac=new (window.AudioContext||window.webkitAudioContext)(); S.audioBuf=await ac.decodeAudioData(ab); ac.close(); }
    S.audioOrig=S.audioBuf; S._endingFor=null;
    if($("songVer").value!=="orig"){ status("Making the "+$("songVer").selectedOptions[0].textContent.toLowerCase()+" version…"); S.audioBuf=await versionedBuffer(S.audioOrig,$("songVer").value); cachedAn=null; }
    S.audioName=file.name; S.audioFile=file; S.an=null; S.plan=null; S.titles={}; updateButtons(); // never pair new audio with the old song's beat map
    S.meta=file._meta||await readTags(file);
    S.lyrics=null; S._lyricsFor=file.name; renderLyrics(); // lyrics belong to a song: found next to it, inside it, or added again
    try{ const lf=S.lrcFiles&&S.lrcFiles.get(file.name.replace(/\.[^.]+$/,"").toLowerCase()); if(lf) S._pendingLyrics={text:await lf.text(),src:"file"}; else if(S.meta&&S.meta.lyrics) S._pendingLyrics={text:S.meta.lyrics,src:"song"}; }catch(e){}
    if(S.meta.artist && (!$("artistName").value.trim()||S._artistAuto)){ $("artistName").value=S.meta.artist; S._artistAuto=true; }
    $("prog").hidden=false;
    anaMark("song",file,1,1);
    S.an=cachedAn || await analyzeAudio(S.audioBuf,p=>{ $("prog").value=p; status(`Finding the beat… ${Math.round(p*100)}%`); });
    anaMark(null);
    $("prog").hidden=true;
    $("audioInfo").textContent=`${file.name}, ${fmtTime(S.an.duration)}${S.an.feel&&S.an.feel.free==="beatless"?"":` at about ${Math.round(S.an.bpm)} BPM`}. Feel: ${S.an.feel?S.an.feel.label:"4/4"}`; renderTempo();
    if(S._pendingLyrics){ const pl=S._pendingLyrics; S._pendingLyrics=null; setLyrics(pl.text,pl.src); }
    else setTimeout(()=>{ try{ autoLyrics(); }catch(e){} },0);
    setTimeout(()=>{ btReferee().catch(()=>{}); },1500); // a neural second opinion on the beat, where the device can run it
    foldAfter("Your song",S.clips.length?null:"Video clips"); status("Audio ready."); $("listen").disabled=false; syncCapWith(); updateNamePreview(); crumb("song ready");
    buildPlan();
  }catch(err){
    $("prog").hidden=true;
    status("Couldn’t read that audio file. Try a WAV, MP3 or M4A.",true);
  }
}

/* Heavy work (studying clips, listening to songs, reading footage) runs one job at a time, never side by side:
   running them together doubles the memory and can freeze or crash the tab. Later jobs wait their turn. */
let _heavy=Promise.resolve(), _heavyN=0;
var _heavyCur=null; // the job running now, so diagnostics can name what is busy
function heavy(label,fn){ _heavyN++; if(_heavyN>1) status(`${label} will start when the current analysis finishes…`);
  const run=_heavy.then(async()=>{ crumb("start: "+label.toLowerCase()); _heavyCur={label,at:Date.now()}; const r=await fn(); _heavyCur=null; crumb("finished: "+label.toLowerCase()); return r; })
    .finally(async()=>{ _heavyN--; if(_heavyN===0){ crumb("idle"); if(S._deferredSong){ const d=S._deferredSong; S._deferredSong=null; await loadAudio(d.file,d.an); renderSongs(); } } });
  _heavy=run.catch(()=>{}).then(()=>new Promise(r=>setTimeout(r,1200))); // a breather between jobs so the browser can free memory
  return run; }
function addClips(files){ const list=[...files]; return heavy("Studying your clips",()=>addClipsNow(list)); }
async function addClipsNow(files){
  const vids=[...files].filter(f=>isVideo(f)||isImage(f));
  if(!vids.length) return;
  const start=S.clips.length;
  vids.forEach(f=>S.clips.push({name:f.name, file:f}));
  renderClips();
  let doneN=0; const work=async k=>{ const entry=S.clips[start+k]; if(!entry) return;
    if(isSkipped(entry.file)){ entry.error="set aside (it stopped the page last time)"; }
    else { anaMark("clip",entry.file,k+1,vids.length); if(k<3||k%10===0) crumb(`clip ${k+1} of ${vids.length}: ${entry.file.name} (${(entry.file.size/1e6).toFixed(0)} MB)`);
      try{ Object.assign(entry, isImage(entry.file) ? await analyzeImage(entry.file) : await analyzeClip(entry.file)); }
      catch(err){ entry.error=err.message; S._clipErrN=(S._clipErrN||0)+1; if(S._clipErrN<=5) crumb(`couldn’t read ${entry.file.name} (${(entry.file.size/1e6).toFixed(0)} MB${entry.file._kept?", app copy":""}): ${err.message}`); }
      anaMark(null); }
    doneN++; status(`Studying your clips: ${doneN} of ${vids.length}`); if(doneN%4===0||doneN===vids.length) renderClips(); };
  for(let k=0;k<vids.length;k++) await work(k); // one at a time, on the one shared player
  buildFamilies();
  const bad=S.clips.filter(c=>c.error);
  bad.forEach(c=>{ if(c.url) URL.revokeObjectURL(c.url); });
  S.clips=S.clips.filter(c=>!c.error);
  renderClips();
  if(S.an) foldAfter("Video clips");
  S._badClips=bad.map(c=>({name:c.name,size:c.file&&c.file.size,kept:!!(c.file&&c.file._kept),why:c.error}));
  status(bad.length ? `${bad.length} clip${bad.length===1?"":"s"} couldn’t be used and ${bad.length===1?"was":"were"} skipped. ${badClipAdvice(bad)}` : "Clips ready.", bad.length>0);
  buildPlan();
}



function badClipAdvice(bad){ const w=bad.map(c=>c.error||""), n=re=>w.filter(x=>re.test(x)).length;
  const read=n(/couldn’t be read|NotReadable|permission/i), fmt=n(/format|decoded/i);
  if(read>=fmt&&read) return NATIVE?"Android didn’t let the app open them. If they’re in Google Photos but not on the phone, download them first (open each and choose Download), or pick them from the Files app.":"The browser couldn’t open the files. Add them again from the folder.";
  if(fmt) return NATIVE?"This phone can’t decode them. Try re-saving them as MP4 (H.264).":"Convert them to MP4 (H.264) and add them again (often iPhone HEVC video on Windows).";
  return "Tap “Report this problem” to send me the details."; }
