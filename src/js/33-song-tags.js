/* ---------------- Song tags: the title and artist stored inside the file (MP3, WAV, FLAC, M4A) ---------------- */
function decTag(b){ if(!b||!b.length) return ""; const enc=b[0], d=b.subarray(1); let s="";
  try{ if(enc===0) s=new TextDecoder("windows-1252").decode(d);
    else if(enc===1){ const be=d[0]===0xFE&&d[1]===0xFF; s=new TextDecoder(be?"utf-16be":"utf-16le").decode(d.subarray(d[0]===0xFF||d[0]===0xFE?2:0)); }
    else if(enc===2) s=new TextDecoder("utf-16be").decode(d); else s=new TextDecoder("utf-8").decode(d); }catch(e){}
  return s.replace(/\u0000[\s\S]*$/,"").trim(); }
async function readTags(file){
  const out={}; try{
    const N=Math.min(file.size,1<<20), head=new Uint8Array(await file.slice(0,N).arrayBuffer()), tail=new Uint8Array(await file.slice(Math.max(0,file.size-(1<<18))).arrayBuffer());
    const str=(a,i,j)=>String.fromCharCode(...a.subarray(i,j)), u32le=(a,i)=>a[i]|a[i+1]<<8|a[i+2]<<16|(a[i+3]<<24>>>0), u32be=(a,i)=>((a[i]<<24)>>>0)+(a[i+1]<<16)+(a[i+2]<<8)+a[i+3];
    if(str(head,0,3)==="ID3"){ const ver=head[3], syn=i=>(head[i]&127)<<21|(head[i+1]&127)<<14|(head[i+2]&127)<<7|(head[i+3]&127), end=Math.min(head.length,10+syn(6)); let q=10;
      if(head[5]&0x40) q+=ver===4?syn(10):u32be(head,10)+4;
      while(q+10<=end){ const id=str(head,q,q+4); if(!/^[A-Z0-9]{4}$/.test(id)) break; const sz=ver===4?syn(q+4):u32be(head,q+4); const body=head.subarray(q+10,q+10+sz);
        if(id==="TIT2") out.title=decTag(body); else if(id==="TPE1") out.artist=decTag(body); else if(id==="TALB") out.album=decTag(body); else if((id==="TYER"||id==="TDRC")&&!out.year) out.year=decTag(body).slice(0,4);
        else if(id==="TXXX"&&!out.lyrics){ const enc=body[0], wide=enc===1||enc===2; let i=1; if(wide){ while(i+1<body.length&&!(body[i]===0&&body[i+1]===0)) i+=2; } else { while(i<body.length&&body[i]!==0) i++; }
          const desc=decTag(body.subarray(0,i)).toUpperCase(); if(/^(USLT|LYRICS|UNSYNCEDLYRICS|UNSYNCED LYRICS)$/.test(desc)){ i+=wide?2:1; const rest=new Uint8Array(body.length-i+1); rest[0]=enc; rest.set(body.subarray(i),1); out.lyrics=decTag(rest); } }
        else if(id==="USLT"&&!out.lyrics){ const enc=body[0], wide=enc===1||enc===2; let i=4; if(wide){ while(i+1<body.length&&!(body[i]===0&&body[i+1]===0)) i+=2; i+=2; } else { while(i<body.length&&body[i]!==0) i++; i++; }
          const rest=new Uint8Array(body.length-i+1); rest[0]=enc; rest.set(body.subarray(i),1); out.lyrics=decTag(rest); }
        q+=10+sz; } }
    if(!out.title && tail.length>=128 && str(tail,tail.length-128,tail.length-125)==="TAG"){ const t=tail.subarray(tail.length-128), f=(a,b)=>new TextDecoder("windows-1252").decode(t.subarray(a,b)).replace(/\u0000[\s\S]*$/,"").trim(); out.title=f(3,33); out.artist=out.artist||f(33,63); out.album=out.album||f(63,93); out.year=out.year||f(93,97); }
    if(str(head,0,4)==="fLaC"){ let q=4; for(let k=0;k<30&&q+4<=head.length;k++){ const last=head[q]&0x80, type=head[q]&0x7f, len=(head[q+1]<<16)|(head[q+2]<<8)|head[q+3];
        if(type===4){ let r=q+4; const vl=u32le(head,r); r+=4+vl; const cnt=u32le(head,r); r+=4; for(let j=0;j<cnt&&r<q+4+len;j++){ const l=u32le(head,r); const kv=new TextDecoder("utf-8").decode(head.subarray(r+4,r+4+l)); r+=4+l; const m=/^(\w+)=(.*)$/s.exec(kv); if(!m) continue; const K=m[1].toUpperCase();
            if((K==="LYRICS"||K==="UNSYNCEDLYRICS")&&!out.lyrics) out.lyrics=m[2]; if(K==="TITLE") out.title=m[2]; if(K==="ARTIST") out.artist=m[2]; if(K==="ALBUM") out.album=m[2]; if(K==="DATE") out.year=m[2].slice(0,4); } }
        q+=4+len; if(last) break; } }
    const riff=(a)=>{ const i=a.findIndex((x,k)=>x===0x49&&a[k+1]===0x4E&&a[k+2]===0x46&&a[k+3]===0x4F&&a[k-4]===0x4C); if(i<0) return; let q=i+4; // LIST INFO
      while(q+8<=a.length){ const id=str(a,q,q+4), l=u32le(a,q+4); if(!/^[A-Z][A-Z0-9 ]{3}$/.test(id)) break; const v=new TextDecoder("utf-8").decode(a.subarray(q+8,q+8+l)).replace(/\u0000[\s\S]*$/,"").trim();
        if(id==="INAM") out.title=out.title||v; if(id==="IART") out.artist=out.artist||v; if(id==="IPRD") out.album=out.album||v; if(id==="ICRD") out.year=out.year||v.slice(0,4); q+=8+l+(l&1); } };
    if(str(head,0,4)==="RIFF"){ riff(head); riff(tail); }
    const mp4=(a)=>{ const find=tag=>{ for(let i=0;i+8<a.length;i++){ if(a[i]===0xA9&&str(a,i+1,i+4)===tag&&str(a,i+8,i+12)==="data"){ const sz=u32be(a,i+4); return new TextDecoder("utf-8").decode(a.subarray(i+20,i+4+sz)).trim(); } } return ""; };
      out.title=out.title||find("nam"); out.artist=out.artist||find("ART"); out.lyrics=out.lyrics||find("lyr"); out.album=out.album||find("alb"); out.year=out.year||find("day").slice(0,4); };
    if(str(head,4,8)==="ftyp"){ mp4(head); if(!out.title) mp4(tail); }
  }catch(e){}
  for(const k of Object.keys(out)) if(!out[k]) delete out[k];
  return out;
}
/* "It's No Good [Album Version]" → "It's No Good": version and edition notes in brackets aren't part of the song's name */
function cleanTagTitle(t){ return String(t||"").replace(/\s*[\[(][^\])]*(version|remaster|edit|mix|mono|stereo|explicit|clean|official|audio|video|bonus|deluxe|single|live|demo|lyric|hq|hd|4k)[^\])]*[\])]/gi,"").replace(/\s{2,}/g," ").trim(); }
const SONG_VER_SUFFIX={spedup:" (Sped Up)",nightcore:" (Nightcore)",slowed:" (Slowed + Reverb)"};
function songTitle(){ const base=(S.meta&&S.meta.title)?cleanTagTitle(S.meta.title):cleanSongName(S.audioName); const v=$("songVer")&&$("songVer").value; return base?base+(SONG_VER_SUFFIX[v]||""):""; }
function songArtistLine(){ const s=songTitle(), a=$("artistName").value.trim(); return s&&a?`${s} — ${a}`:s; }
function cleanSongName(n){
  let s=String(n||"").replace(/\.[^.]+$/,"").replace(/^Recording_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(_EQ)?$/i,"");
  s=s.replace(/([A-Za-z])_(s|t|re|ll|ve|d|m)(?=[_\s.-]|$)/g,"$1’$2").replace(/[_.]+/g," ").replace(/\s+\d{1,3}\s*$/,"").replace(/^\s*\d{1,3}\s*[-.)]?\s+/,"").replace(/\(.*?\)|\[.*?\]/g," ").replace(JUNK," ").replace(/\s*-\s*$/,"").replace(/^\s*-\s*/,"").replace(/\s{2,}/g," ").trim();
  return s.length>=2?titleCase(s):"";
}
function smartTitle(){
  const own=$("projName").value.trim(); if(own) return safeName(own,60);
  const topic=$("capTopic").value.trim(); if(topic) return safeName(titleCase(topic.split(/\s+/).slice(0,6).join(" ").replace(/[.,!?;:]+$/,"")),60);
  const hook=$("hookText").value.trim(); if(hook) return safeName(titleCase(hook),60);
  const song=songTitle(), art=$("artistName").value.trim(); if(song) return safeName(art?`${art} - ${song}`:song,60);
  return "Beat Edit";
}
function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function styleTag(){ return S.direct || [...document.querySelectorAll("#styles .chip,#dstyles .chip")].find(c=>c.getAttribute("aria-pressed")==="true")?.textContent || ""; }
function folderName(){ const st=styleTag(); return safeName(`${today()} ${smartTitle()}${st?" ("+st+")":""}`,90); }

function lenTag(sec){ sec=Math.round(sec); return sec<90?`${sec}s`:`${Math.floor(sec/60)}m${String(sec%60).padStart(2,"0")}s`; }
function resultName(r){
  const t=smartTitle(), p=safeName(r.ep.name,40), size=`${r.ep.w}x${r.ep.h}`, len=lenTag(r.win[1]-r.win[0]), sch=$("nameScheme").value;
  const core = sch==="date" ? `${today()} ${t} - ${p} ${size} ${len}` : sch==="platform" ? `${p} - ${t} ${size} ${len}` : `${t} - ${p} ${size} ${len}`;
  return safeName(core,120)+"."+r.ext;
}
function autoTitle(){ const v=$("projName").value; $("projName").value=""; const s=smartTitle(); $("projName").value=v; return s; }
function updateNamePreview(){
  const ep=EP(S.eps[0])||ENDPOINTS[0], fake={ep, win:S.an?windowFor(ep):[0,30], ext:"mp4"};
  $("projName").placeholder=autoTitle()+" (automatic)";
  $("namePreview").textContent=`Folder: ${folderName()}  •  File: ${resultName(fake)}`;
}
async function aiName(){
  const id=[...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v]); if(!id||!S.plan) return;
  $("aiName").disabled=true; $("namePreview").textContent="Thinking of a name…";
  try{
    const img=await buildReviewImages();
    const r=await askAI(id,`Suggest a short, specific project title (2 to 5 words, Title Case, no emoji, no quotes, no file extension) for this music video, based on the frames in image 1 and these details: ${JSON.stringify({song:songTitle()||S.audioName, topic:$("capTopic").value, hook:$("hookText").value, style:styleTag(), bpm:Math.round(S.an.bpm)})}. Don't invent names of people or places that aren't given. Reply with ONLY JSON: {"title":"..."}`, img.blobs.slice(0,1));
    const t=safeName(r.title,60); if(!t) throw {code:"invalid_json"};
    $("projName").value=t; saveSettings(); updateNamePreview();
  }catch(e){ $("namePreview").textContent=aiErrorText(e); }
  finally{ $("aiName").disabled=false; }
}
function renderResults(){
  const box=$("results"); box.innerHTML="";
  $("result").style.display=S.results.length?"block":"none"; { const z=$("zipNow"); if(z){ z.hidden=!S.results.length; z.textContent=S.results.length>1?`Download ZIP (${S.results.length})`:"Download ZIP"; } }
  S.results.forEach((r,i)=>{
    const row=document.createElement("div"); row.className="res";
    const info=document.createElement("div");
    const b=document.createElement("b"); b.textContent=r.ep.name; info.appendChild(b);
    const sm=document.createElement("small"); sm.textContent=`${r.ep.w} × ${r.ep.h}, ${fmtTime(r.win[1]-r.win[0])}, ${(r.blob.size/1048576).toFixed(1)} MB`; info.appendChild(sm);
    if(r.check){ const ck=document.createElement("small"); ck.style.display="block"; ck.style.color=r.check.ok?"var(--cobalt)":"var(--danger)";
      const startTxt=r.check.startMs!=null&&Math.abs(r.check.startMs)<=40?`, starts on the beat (${r.check.startMs>=0?"+":""}${r.check.startMs} ms)`:"";
      ck.textContent=(r.check.ok?`✓ Checked: size, length${r.check.audio?", sound":""}${r.check.shots&&r.check.shots[1]?`, ${r.check.shots[0]}/${r.check.shots[1]} shots match the plan`:""}${startTxt}`:"! ")+(r.check.notes.length?(r.check.ok?". ":"")+r.check.notes.join(" "):""); info.appendChild(ck); }
    const play=document.createElement("button"); play.className="btn"; play.textContent="Watch";
    play.onclick=()=>{ const rv=$("resultVideo"); if(rv.dataset.u) URL.revokeObjectURL(rv.dataset.u); rv.dataset.u=URL.createObjectURL(r.blob); rv.src=rv.dataset.u; rv.hidden=false; rv.play().catch(()=>{}); };
    const save=document.createElement("button"); save.className="btn"; save.textContent="Save";
    save.onclick=()=>saveFile(resultName(r), r.blob);
    row.append(info,play,save);
    if(canShareFiles()){ const sh=document.createElement("button"); sh.className="btn"; sh.textContent="Share";
      sh.onclick=async()=>{ try{ await navigator.share({files:[new File([r.blob],resultName(r),{type:r.blob.type||"video/mp4"})], text:captionFor(r.ep)||undefined}); }catch(e){ if(e&&e.name!=="AbortError") status("Sharing isn’t available here. Use Save instead.",true); } };
      row.appendChild(sh); }
    else if(UPLOAD[r.ep.id]){ const a=document.createElement("a"); a.className="btn"; a.href=UPLOAD[r.ep.id]; a.target="_blank"; a.rel="noopener"; a.textContent="Upload page"; row.appendChild(a); }
    else row.appendChild(document.createElement("span"));
    try{ ytUploadUI(r,row); }catch(e){}
    box.appendChild(row);
  });
  (S.extras||[]).forEach(x=>{
    const row=document.createElement("div"); row.className="extra";
    const im=document.createElement("img"); im.alt=""; if(!x.url) x.url=URL.createObjectURL(x.blob); im.src=x.url; row.appendChild(im);
    const info=document.createElement("div"); const b=document.createElement("b"); b.textContent=/thumbnail/i.test(x.name)?"YouTube thumbnail":"Cover image"; const sm=document.createElement("small"); sm.textContent=`${(x.blob.size/1024).toFixed(0)} KB JPG`; sm.style.display="block"; info.append(b,sm); row.appendChild(info);
    const sv=document.createElement("button"); sv.className="btn"; sv.style.cssText="padding:7px 12px;font-size:13px"; sv.textContent="Save"; sv.onclick=()=>saveFile(x.name,x.blob); row.appendChild(sv);
    box.appendChild(row);
  });
}
async function saveFile(name,data){
  const dl=await downloadsP;
  if(dl){
    try{ await dl.save({filename:name,data}); status("Saved "+name+"."); return; }
    catch(e){
      if(e && e.code==="declined"){ status("Save cancelled."); return; }
      if(e && e.code==="too_large"){ status("That file is too large to save here. Save the videos one at a time instead.",true); return; }
    }
  }
  const a=document.createElement("a"); a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data])); setTimeout(()=>URL.revokeObjectURL(a.href),60000); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  status("Downloading "+name+".");
}
function publishNotes(){
  const L=[`${smartTitle()}`, `Publishing package, made with Beat Splicer on ${today()}`, `Song file: ${S.audioName||"unknown"}${styleTag()?", style: "+styleTag():""}`, ""];
  for(const r of S.results){
    L.push(`${r.ep.name}: ${resultName(r)}`);
    L.push(`  ${r.ep.w} x ${r.ep.h} at ${r.ep.fps} fps, ${fmtTime(r.win[1]-r.win[0])} long (song ${fmtTime(r.win[0])} to ${fmtTime(r.win[1])}), loudness target ${r.ep.lufs} LUFS`);
    L.push(`  ${r.ep.tip}`);
    if(r.check) L.push(r.check.ok?`  Output check passed: ${r.check.size}, ${r.check.len.toFixed(1)} s${r.check.audio?", sound present":""}${r.check.shots&&r.check.shots[1]?`, ${r.check.shots[0]}/${r.check.shots[1]} sampled shots match the plan`:""}.`:`  Output check: ${r.check.notes.join(" ")}`);
    { const T=titleFor(r.ep); if(T.title) L.push(`  Upload title: ${T.title}`);
      if(T.desc) L.push("  Description:",...T.desc.split("\n").map(x=>"    "+x)); if(T.tags&&T.tags.length) L.push(`  Tags: ${T.tags.join(", ")}`); if(T.pin) L.push(`  Pinned comment: ${T.pin}`);
      if((r.ep.id==="youtube"||r.ep.id==="shorts") && $("aiImagery").checked) L.push("  When uploading, answer YES to YouTube’s “Altered or synthetic content” question."); if(T.hook) L.push(`  On-screen opening: ${T.hook}`); if(T.card) L.push(`  Title card: ${T.card}${T.sub?" / "+T.sub:""}`); }
    const cap=captionFor(r.ep); if(cap) L.push("  Caption:", ...cap.split("\n").map(x=>"    "+x));
    L.push("");
  }
  if(S.checklist&&S.checklist.length){ L.push("Industry checklist"); S.checklist.forEach(c=>L.push(`  ${c.platform}: ${c.warnings.length?c.warnings.join(" "):"all checks passed"}`)); L.push(""); }
  if((S.extras||[]).length){ L.push("Images: "+S.extras.map(x=>x.name).join(", "),"  Upload the thumbnail in YouTube Studio, and pick the cover when posting Shorts, Reels or TikTok.",""); }
  if(S.review){ L.push("AI review", `  Score ${S.review.score}/10. ${S.review.verdict}`); (S.review.issues||[]).forEach(i=>L.push(`  - ${i.title}: ${i.detail}`)); L.push(""); }
  L.push("Loudness is estimated and limited to stay below 0 dB. Check each platform’s help pages before a big campaign, as limits change.");
  return L.join("\r\n");
}
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();

/* Builds the ZIP without ever copying a video: each file's checksum is worked out by reading it 8 MB at a time, and the ZIP
   itself is the original video Blobs joined with small headers, which the browser links rather than duplicates.
   (Files are "stored", not compressed: video doesn't compress further, so this is also the fastest way.) */
async function crc32Blob(blob,onBytes){
  let c=0xFFFFFFFF; const CH=8<<20;
  for(let pos=0;pos<blob.size;pos+=CH){ const u8=new Uint8Array(await blob.slice(pos,Math.min(blob.size,pos+CH)).arrayBuffer());
    for(let i=0;i<u8.length;i++) c=CRC_T[(c^u8[i])&255]^(c>>>8);
    if(onBytes) onBytes(u8.length); await yieldNow(); }
  return (c^0xFFFFFFFF)>>>0;
}
async function makeZip(files,onProgress){
  const enc=new TextEncoder(), parts=[], central=[]; let offset=0;
  const items=files.map(f=>({name:enc.encode(f.name), blob:f.data instanceof Blob?f.data:new Blob([enc.encode(f.data)])}));
  const total=items.reduce((a,x)=>a+x.blob.size,0); let done=0;
  if(total+items.length*200>0xFFFFFFF0) throw new Error("too big for one ZIP");
  const d=new Date(), time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1), date=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const it of items){
    const size=it.blob.size, crc=await crc32Blob(it.blob,n=>{ done+=n; if(onProgress) onProgress(done/total); });
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,time,true); lh.setUint16(12,date,true); lh.setUint32(14,crc,true); lh.setUint32(18,size,true); lh.setUint32(22,size,true);
    lh.setUint16(26,it.name.length,true); lh.setUint16(28,0,true);
    parts.push(lh.buffer,it.name,it.blob); // the video itself is linked, not copied
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
    ch.setUint16(12,time,true); ch.setUint16(14,date,true); ch.setUint32(16,crc,true); ch.setUint32(20,size,true); ch.setUint32(24,size,true);
    ch.setUint16(28,it.name.length,true); ch.setUint32(42,offset,true);
    central.push(ch.buffer,it.name);
    offset+=30+it.name.length+size;
  }
  const cdSize=central.reduce((a,p)=>a+(p.byteLength!==undefined?p.byteLength:p.length),0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true); end.setUint16(8,items.length,true); end.setUint16(10,items.length,true); end.setUint32(12,cdSize,true); end.setUint32(16,offset,true);
  return new Blob([...parts,...central,end.buffer],{type:"application/zip"});
}
function packageFiles(){ const files=S.results.map(r=>({name:resultName(r), data:r.blob})); (S.extras||[]).forEach(x=>files.push({name:x.name,data:x.blob})); files.push({name:`${smartTitle()} - publishing notes.txt`, data:publishNotes()}); return files; }
async function saveZip(){
  if(!S.results.length) return;
  status("Packing the ZIP…"); $("zipBtn").disabled=true; if($("zipNow")) $("zipNow").disabled=true;
  try{
    const dir=folderName();
    const zip=await makeZip(packageFiles().map(f=>({name:dir+"/"+f.name, data:f.data})),p=>status(`Packing the ZIP: ${Math.round(p*100)}%…`));
    status(`ZIP ready (${Math.round(zip.size/1e6)} MB). Saving…`);
    await saveFile(`${dir}.zip`, zip);
  }catch(e){ status(String(e&&e.message).includes("too big")?"That package is too big for one ZIP. Save the videos one at a time with their Save buttons.":"Couldn’t make the ZIP. Save the videos one at a time with their Save buttons instead.",true); }
  finally{ $("zipBtn").disabled=false; if($("zipNow")) $("zipNow").disabled=false; }
}
async function saveToFolder(){
  if(!S.results.length || !window.showDirectoryPicker) return;
  try{
    const parent=await window.showDirectoryPicker({mode:"readwrite", id:"beatsplicer-out"});
    const dir=await parent.getDirectoryHandle(folderName(),{create:true});
    for(const f of packageFiles()){ const fh=await dir.getFileHandle(f.name,{create:true}); const w=await fh.createWritable(); await w.write(f.data); await w.close(); }
    status(`Saved ${S.results.length} video${S.results.length===1?"":"s"} into “${folderName()}”.`);
  }catch(e){ if(e && e.name!=="AbortError") status("Couldn’t save into that folder. Use the ZIP package instead.",true); }
}

