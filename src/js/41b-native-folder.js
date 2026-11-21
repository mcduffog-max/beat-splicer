/* ---------------- Whole folders on the phone ----------------
   Android's web view can't open a folder from a web page, so the app asks Android directly (the Folder plugin). The app
   keeps permission to read that folder: "Load my folder again" brings in what's new without picking files one by one.
   Each file is copied once into the app's own storage (the same copies keepFiles makes), so later loads are quick. */
const FOLDERS_KEY="beatsplicerFolders";
function savedFolders(){ try{ return JSON.parse(localStorage.getItem(FOLDERS_KEY)||"{}"); }catch(e){ return {}; } }
function saveFolder(kind,f){ const o=savedFolders(); o[kind]=f; try{ localStorage.setItem(FOLDERS_KEY,JSON.stringify(o)); }catch(e){} }
const MEDIA_RE=/\.(mp4|mov|m4v|webm|3gp|mkv|jpe?g|png|webp|heic|mp3|m4a|wav|aac|flac|ogg|opus)$/i;
function mimeGuess(n){ const x=(n.split(".").pop()||"").toLowerCase(); return {mp4:"video/mp4",m4v:"video/mp4",mov:"video/quicktime",webm:"video/webm","3gp":"video/3gpp",mkv:"video/x-matroska",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",aac:"audio/aac",flac:"audio/flac",ogg:"audio/ogg",opus:"audio/ogg"}[x]||""; }
/* the folder's files as File objects backed by the app's own copies; already-copied files are reused */
async function nativeFolderFiles(folder,want,say){ const FP=NP("Folder"); const r=await FP.list({uri:folder.uri});
  const list=(r.files||[]).filter(f=>MEDIA_RE.test(f.name)&&want(f)).sort((a,b)=>(b.mtime||0)-(a.mtime||0)), dir=await keptDir(), out=[]; let copied=0, failed=0;
  for(let i=0;i<list.length;i++){ const f=list[i], type=(f.mime&&f.mime!=="application/octet-stream")?f.mime:mimeGuess(f.name), meta={size:f.size,lastModified:f.mtime||0,name:f.name}, key=keptName(meta);
    try{ let h=null; if(dir){ try{ h=await dir.getFileHandle(key); if((await h.getFile()).size!==f.size) h=null; }catch(e){ h=null; } }
      if(!h){ say(`Bringing in “${folder.name}”: ${i+1} of ${list.length} (${(f.size/1e6).toFixed(0)} MB)…`); const c=await FP.copy({uri:f.uri});
        try{ const res=await fetch(window.Capacitor.convertFileSrc(c.path)); if(!res.ok) throw new Error("HTTP "+res.status);
          if(dir){ h=await dir.getFileHandle(key,{create:true}); const w=await h.createWritable(); await res.body.pipeTo(w); }
          else { const b=await res.blob(); out.push(new File([b],f.name,{type,lastModified:meta.lastModified})); copied++; continue; } }
        finally{ FP.remove({path:c.path}).catch(()=>{}); } copied++; }
      const g=await h.getFile(), k=new File([g],f.name,{type,lastModified:meta.lastModified}); k._kept=key; out.push(k); }
    catch(e){ failed++; if(failed<=3) crumb(`folder: couldn't bring in ${f.name}: ${e&&e.message||e}`); } }
  crumb(`folder “${folder.name}”: ${out.length} files (${copied} new), ${failed} failed`); return {files:out, copied, failed, total:list.length}; }
function folderMsg(t){ const m=$("folderMsg"); if(m){ m.hidden=!t; m.textContent=t||""; } }
function renderFolderAgain(){ const f=savedFolders().clips, row=$("folderAgainRow"); if(!row) return; row.hidden=!(NATIVE&&f); if(f) $("folderAgain").textContent=`Load “${f.name}” again`; }
async function loadClipFolder(folder){ const have=new Set(S.clips.map(c=>c.name+"|"+(c.file?c.file.size:0)));
  folderMsg(""); const r=await nativeFolderFiles(folder,f=>!have.has(f.name+"|"+f.size)&&!/^audio\//.test(f.mime||mimeGuess(f.name))||(!S.audioFile&&/^audio\//.test(f.mime||mimeGuess(f.name))),t=>status(t));
  if(!r.total){ status(`Nothing new in “${folder.name}”.`); folderMsg(`Everything in “${folder.name}” is already in the project.`); return; }
  if(r.files.length) await takeFiles(r.files);
  folderMsg(`“${folder.name}”: ${r.files.length} file${r.files.length===1?"":"s"} added${r.copied?` (${r.copied} copied into the app)`:""}${r.failed?`, ${r.failed} couldn’t be read`:""}.`); }
async function pickClipFolder(){ const FP=NP("Folder"); if(!FP) return false;
  let f; try{ f=await FP.pick(); }catch(e){ if(!/cancel/i.test(String(e&&e.message||e))) status("Couldn't open that folder: "+(e&&e.message||e),true); return true; }
  saveFolder("clips",{uri:f.uri,name:f.name||"folder"}); renderFolderAgain(); await heavyFolder(()=>loadClipFolder(savedFolders().clips)); return true; }
function heavyFolder(fn){ return fn().catch(e=>{ status("Couldn't load the folder: "+(e&&e.message||e)+". Choose it again.",true); }); }
async function pickSongFolder(){ const FP=NP("Folder"); if(!FP) return false;
  let f; try{ f=await FP.pick(); }catch(e){ return true; } saveFolder("songs",{uri:f.uri,name:f.name||"folder"});
  await heavyFolder(async()=>{ const r=await nativeFolderFiles(f,x=>/^audio\//.test(x.mime||mimeGuess(x.name)),t=>status(t)); if(r.files.length) addSongFolder(r.files); else status(`No songs found in “${f.name}”.`,true); }); return true; }
if(NATIVE&&NP("Folder")){
  $("folderWord").textContent="Choose a folder on this phone"; $("folderWhere").textContent="(the app remembers it)";
  $("folderDrop").addEventListener("click",e=>{ e.preventDefault(); pickClipFolder(); });
  $("folderAgain").onclick=()=>{ const f=savedFolders().clips; if(f) heavyFolder(()=>loadClipFolder(f)); };
  { const l=document.querySelector('label[for="songFolder"]'); if(l) l.addEventListener("click",e=>{ e.preventDefault(); pickSongFolder(); }); }
  renderFolderAgain(); }
