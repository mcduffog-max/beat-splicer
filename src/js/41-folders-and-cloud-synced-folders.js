/* ---------------- Folders and cloud-synced folders ---------------- */
function isAudio(f){ return f.type.startsWith("audio/")||/\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(f.name); }
function isImage(f){ return f.type.startsWith("image/")||/\.(jpe?g|png|webp|gif|avif)$/i.test(f.name); }
function isVideo(f){ return f.type.startsWith("video/")||/\.(mp4|mov|webm|m4v)$/i.test(f.name); }
async function filesFromDrop(dt){
  const entries=[...(dt.items||[])].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean);
  if(!entries.length) return [...dt.files];
  const out=[];
  async function walk(en){
    if(en.isFile){ try{ out.push(await new Promise((res,rej)=>en.file(res,rej))); }catch(e){} }
    else if(en.isDirectory){ const rd=en.createReader(); let batch; do{ batch=await new Promise((res,rej)=>rd.readEntries(res,rej)); for(const x of batch) await walk(x); }while(batch.length); }
  }
  for(const en of entries) await walk(en);
  return out;
}
async function takeFiles(files,{preferAudio}={}){
  files=[...files].filter(f=>!/^\./.test(f.name)); if(NATIVE) files=await keepFiles(files); // in the Android app, work from the app's own copies
  const audio=files.filter(isAudio), video=files.filter(f=>isVideo(f)||isImage(f));
  if(audio.length && (preferAudio || !S.audioBuf)) await loadAudio(audio[0]);
  if(video.length) await addClips(video);
  if(!audio.length && !video.length) status("No audio or video files found there.",true);
  else if(audio.length>1 && !preferAudio) status(`Found ${audio.length} audio files. Using ${audio[0].name}; choose another under Your song if you prefer.`);
}

