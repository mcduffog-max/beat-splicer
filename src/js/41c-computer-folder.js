/* ---------------- Remembered folders on a computer ----------------
   Chrome and Edge can keep a folder you picked (the File System Access API): the folder is stored here, and next time
   "Load my folder again" asks the browser once for permission and brings in only what's new. Other browsers (Firefox,
   Safari) can't remember a folder, so there the ordinary folder picker stays. Folders go in their own small database, so
   "Start fresh" on a project doesn't forget them. */
const CAN_KEEP_DIR=!NATIVE&&!HOSTED&&typeof window.showDirectoryPicker==="function";
const FDB={ db:null, open(){ return this.db?Promise.resolve(this.db):new Promise((res,rej)=>{ const r=indexedDB.open("beatsplicer-folders",1); r.onupgradeneeded=()=>r.result.createObjectStore("h"); r.onsuccess=()=>{ this.db=r.result; res(this.db); }; r.onerror=()=>rej(r.error); }); },
  async put(k,v){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction("h","readwrite"); tx.objectStore("h").put(v,k); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); },
  async get(k){ const db=await this.open(); return new Promise(res=>{ const q=db.transaction("h").objectStore("h").get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); }); } };
async function dirFiles(dir,want,depth=0,out=[],path=""){ if(depth>3||out.length>=3000) return out;
  for await (const [name,h] of dir.entries()){ if(name.startsWith(".")) continue;
    if(h.kind==="directory") await dirFiles(h,want,depth+1,out,path+name+"/");
    else if(MEDIA_RE.test(name)){ try{ const f=await h.getFile(); if(want(f)) out.push(f.type?f:new File([f],f.name,{type:mimeGuess(f.name),lastModified:f.lastModified})); }catch(e){} } }
  return out; }
async function dirReady(h){ try{ if(await h.queryPermission({mode:"read"})==="granted") return true; return await h.requestPermission({mode:"read"})==="granted"; }catch(e){ return false; } }
async function loadDirClips(h){ if(!await dirReady(h)){ folderMsg(`The browser didn't allow reading “${h.name}”. Choose the folder again.`); return; }
  const have=new Set(S.clips.map(c=>c.name+"|"+(c.file?c.file.size:0))), isA=f=>/^audio\//.test(f.type||mimeGuess(f.name));
  status(`Looking in “${h.name}”…`); const files=await dirFiles(h,f=>isA(f)?!S.audioFile:!have.has(f.name+"|"+f.size));
  if(!files.length){ status(`Nothing new in “${h.name}”.`); folderMsg(`Everything in “${h.name}” is already in the project.`); return; }
  await takeFiles(files); folderMsg(`“${h.name}”: ${files.length} file${files.length===1?"":"s"} added.`); }
async function renderDirAgain(){ const h=await FDB.get("clips").catch(()=>null); if(!h) return; $("folderAgainRow").hidden=false; $("folderAgain").textContent=`Load “${h.name}” again`; }
if(CAN_KEEP_DIR){
  $("folderWhere").textContent="(the browser remembers it)";
  $("folderDrop").addEventListener("click",async e=>{ e.preventDefault(); let h; try{ h=await window.showDirectoryPicker({id:"beatsplicer-clips",mode:"read"}); }catch(err){ return; }
    await FDB.put("clips",h).catch(()=>{}); renderDirAgain(); await loadDirClips(h).catch(err=>status("Couldn't load the folder: "+(err&&err.message||err),true)); });
  $("folderAgain").onclick=async()=>{ const h=await FDB.get("clips").catch(()=>null); if(h) loadDirClips(h).catch(err=>status("Couldn't load the folder: "+(err&&err.message||err),true)); };
  { const l=document.querySelector('label[for="songFolder"]'); if(l) l.addEventListener("click",async e=>{ e.preventDefault(); let h; try{ h=await window.showDirectoryPicker({id:"beatsplicer-songs",mode:"read"}); }catch(err){ return; }
      await FDB.put("songs",h).catch(()=>{}); const fs=await dirFiles(h,f=>/^audio\//.test(f.type||mimeGuess(f.name))); if(fs.length) addSongFolder(fs); else status(`No songs found in “${h.name}”.`,true); }); }
  renderDirAgain(); }
