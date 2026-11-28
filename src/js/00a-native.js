/* ---------------- Inside the Android app ----------------
   The same app runs inside a real Android app (Capacitor). There, a browser download doesn't exist, so finished videos
   are written straight into the phone's Movies/Beat Splicer folder (pictures into Pictures, other files into Download),
   the screen is kept on while a video is made, and Share hands the file to YouTube, Instagram, TikTok or any app. */
const NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const NP=n=>NATIVE&&window.Capacitor.Plugins?window.Capacitor.Plugins[n]:null;
function nativeFolder(name){ return /\.(mp4|webm|mov)$/i.test(name)?"Movies/Beat Splicer":/\.(jpe?g|png|webp)$/i.test(name)?"Pictures/Beat Splicer":"Download/Beat Splicer"; }
const blobB64=b=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]||""); r.onerror=rej; r.readAsDataURL(b); });
/* written in slices, so a long video never has to sit in memory as one huge string */
async function nativeWrite(path,directory,blob,onProg){ const FS=NP("Filesystem"), step=3*1024*1024;
  for(let at=0; at<blob.size||at===0; at+=step){ const data=await blobB64(blob.slice(at,at+step));
    if(at===0) await FS.writeFile({path,directory,data,recursive:true}); else await FS.appendFile({path,directory,data});
    if(onProg) onProg(Math.min(1,(at+step)/Math.max(1,blob.size))); if(blob.size===0) break; }
  return (await FS.getUri({path,directory})).uri; }
async function nativeSave(name,data){ const FS=NP("Filesystem"); if(!FS) return false; const blob=data instanceof Blob?data:new Blob([data]);
  try{ await FS.requestPermissions(); }catch(e){}
  const path=`${nativeFolder(name)}/${name}`;
  try{ await nativeWrite(path,"EXTERNAL_STORAGE",blob,q=>status(`Saving ${name}… ${Math.round(q*100)}%`)); status(`Saved to ${nativeFolder(name)} on your phone: ${name}.`); return true; }
  catch(e){ try{ await nativeWrite(`Beat Splicer/${name}`,"DOCUMENTS",blob); status(`Saved to Documents/Beat Splicer: ${name}.`); return true; }
    catch(e2){ status("Couldn't save to the phone: "+(e2&&e2.message||e2),true); return true; } } }
async function nativeShare(name,blob,text){ const SH=NP("Share"); if(!SH) return; try{ status("Preparing to share…"); const uri=await nativeWrite(`share/${name}`,"CACHE",blob);
    await SH.share({files:[uri], text:text||undefined, dialogTitle:"Share your video"}); status("Shared."); }
  catch(e){ if(!/cancel/i.test(String(e&&e.message||e))) status("Couldn't share: "+(e&&e.message||e),true); } }
async function nativeAwake(on){ const K=NP("KeepAwake"); if(!K) return false; try{ if(on) await K.keepAwake(); else await K.allowSleep(); return true; }catch(e){ return false; } }
if(NATIVE) document.documentElement.classList.add("native");
/* Android lends the app the files you pick only for a while: after the app has been closed, or the phone needed
   memory, reading them fails ("the requested file could not be read"). So in the app, each clip and song you add is
   copied once into the app's own private storage, and the app works from that copy from then on. Copies of files no
   longer in your project are cleared when space runs short. */
async function keptDir(){ if(!navigator.storage||!navigator.storage.getDirectory) return null; try{ return await (await navigator.storage.getDirectory()).getDirectoryHandle("kept",{create:true}); }catch(e){ return null; } }
function keptName(f){ return `${f.size}-${f.lastModified}-${f.name}`.replace(/[\\/:*?"<>|]/g,"_").slice(0,180); }
/* the app's copies: those the project uses stay; copies of files no longer in it are kept for reopening projects up to
   KEPT_SPARE, oldest cleared first, and cleared earlier when new files need the room */
const KEPT_SPARE=1.5e9;
function keptLive(){ return new Set([...(S.clips||[]).map(c=>c.file&&c.file._kept), S.audioFile&&S.audioFile._kept, ...(S.songs||[]).map(x=>x.file&&x.file._kept)].filter(Boolean)); }
async function tidyKept(need=0,incoming=[],spare=KEPT_SPARE,songsToo=false){ const dir=await keptDir(); if(!dir) return {freed:0,room:Infinity,used:0};
  const live=new Set([...keptLive(),...incoming]), old=[]; let used=0, spareN=0;
  try{ for await (const [n,h] of dir.entries()){ try{ const f=await h.getFile(); used+=f.size; if(!live.has(n)&&(songsToo||!/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i.test(n))){ old.push({n,size:f.size,t:f.lastModified}); spareN+=f.size; } }catch(e){} } }catch(e){}
  let room=Infinity; try{ const e=await navigator.storage.estimate(); if(e&&e.quota) room=e.quota-(e.usage||0); }catch(e){}
  const MARGIN=250e6; let freed=0; old.sort((a,b)=>a.t-b.t);
  for(const x of old){ if(spareN-freed<=spare && need+MARGIN<=room+freed) break; try{ await dir.removeEntry(x.n); freed+=x.size; }catch(e){} }
  if(freed) crumb(`app copies: cleared ${Math.round(freed/1e6)} MB of files no longer in the project`);
  return {freed, room:room+freed-MARGIN, used:used-freed}; }
async function keepFiles(files){ files=[...files]; if(!NATIVE||!files.length) return files; const dir=await keptDir(); if(!dir) return files;
  const name=keptName, out=[];
  let need=0; for(const f of files){ try{ const g=await (await dir.getFileHandle(name(f))).getFile(); if(g.size===f.size) continue; }catch(e){} need+=f.size; }
  let {room}=await tidyKept(need,files.map(name));
  let fails=0, full=0; for(let i=0;i<files.length;i++){ const f=files[i], n=name(f);
    try{ let h=null; try{ h=await dir.getFileHandle(n); const g=await h.getFile(); if(g.size!==f.size) h=null; }catch(e){ h=null; }
      if(!h){ if(f.size>room){ full++; out.push(f); continue; } // no room for a copy: work from the file itself for now
        status(`Keeping a copy of your files in the app (so Android can't take them back): ${i+1} of ${files.length}…`);
        try{ h=await dir.getFileHandle(n,{create:true}); const w=await h.createWritable(); await f.stream().pipeTo(w); }
        catch(e){ try{ await dir.removeEntry(n); }catch(x){} if(!/quota|space/i.test(String(e&&(e.name+e.message)))) throw e; room=(await tidyKept(f.size,files.map(name))).room; if(f.size>room) throw e; h=await dir.getFileHandle(n,{create:true}); const w=await h.createWritable(); await f.stream().pipeTo(w); }
        room-=f.size; }
      const g=await h.getFile(), k=new File([g],f.name,{type:f.type,lastModified:f.lastModified}); k._kept=n; k._path=f._path||f.webkitRelativePath||""; k._doc=f._doc||""; k._parent=f._parent||""; out.push(k); }
    catch(e){ fails++; if(fails<=3) crumb("couldn't keep a copy of "+f.name+": "+(e&&e.message||e)); out.push(f); } }
  if(full){ crumb(`app copies: no room for ${full} of ${files.length}`); S._keptFull=full; }
  if(fails) crumb(`app copies: ${files.length-fails} of ${files.length} kept`); return out; }

/* the clipboard: the app's web view can't always offer Paste on a long press, so buttons read it directly */
async function readClipboard(){ const C=NP("Clipboard"); if(C){ try{ const r=await C.read(); if(r&&typeof r.value==="string") return r.value; }catch(e){} }
  try{ if(navigator.clipboard&&navigator.clipboard.readText) return await navigator.clipboard.readText(); }catch(e){} return null; }
