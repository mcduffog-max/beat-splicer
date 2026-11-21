/* ---------------- Crop editor ---------------- */
S.cropIdx=-1;
const cropImg=new Image();
const CROP_SIDES=[["t","Top"],["b","Bottom"],["l","Left"],["r","Right"]];
const cropInputs={};
function buildCropUI(){
  const box=$("cropSliders");
  CROP_SIDES.forEach(([k,label])=>{
    const row=document.createElement("label"); row.className="eqrow";
    const l=document.createElement("span"); l.textContent=label;
    const r=document.createElement("input"); r.type="range"; r.min=0; r.max=40; r.step=0.5; r.value=0;
    const o=document.createElement("output"); o.textContent="0%";
    r.addEventListener("input",()=>{ const c=S.clips[S.cropIdx]; if(!c) return; c.crop[k]=+r.value/100; o.textContent=r.value+"%"; drawCropPreview(); });
    r.addEventListener("change",()=>renderClips());
    row.append(l,r,o); box.appendChild(row); cropInputs[k]={r,o};
  });
}
function openCrop(i){
  const c=S.clips[i]; if(!c||!c.samples) return;
  S.cropIdx=i; $("cropEditor").hidden=false; $("cropTitle").textContent="Crop "+c.name;
  CROP_SIDES.forEach(([k])=>{ cropInputs[k].r.value=c.crop[k]*100; cropInputs[k].o.textContent=(c.crop[k]*100)+"%"; });
  cropImg.onload=drawCropPreview; cropImg.src=c.thumb;
  renderClips(); $("cropEditor").scrollIntoView({block:"nearest",behavior:"smooth"});
}
function closeCrop(){ S.cropIdx=-1; $("cropEditor").hidden=true; renderClips(); }
function drawCropPreview(){
  const c=S.clips[S.cropIdx]; if(!c||!cropImg.complete||!cropImg.naturalWidth) return;
  const cv=$("cropCanvas"), w=cropImg.naturalWidth, hh=cropImg.naturalHeight; cv.width=w; cv.height=hh;
  const g=cv.getContext("2d"); g.drawImage(cropImg,0,0);
  const x=w*c.crop.l, y=hh*c.crop.t, cw=w*(1-c.crop.l-c.crop.r), ch=hh*(1-c.crop.t-c.crop.b);
  g.fillStyle="rgba(0,0,0,0.62)";
  g.fillRect(0,0,w,y); g.fillRect(0,y+ch,w,hh-y-ch); g.fillRect(0,y,x,ch); g.fillRect(x+cw,y,w-x-cw,ch);
  g.strokeStyle="#fff"; g.lineWidth=2; g.strokeRect(x+1,y+1,Math.max(0,cw-2),Math.max(0,ch-2));
}
$("cropDone").onclick=closeCrop;
$("cropReset").onclick=()=>{ const c=S.clips[S.cropIdx]; if(!c) return; c.crop={t:0,b:0,l:0,r:0}; openCrop(S.cropIdx); };
$("cropAll").onclick=()=>{ const c=S.clips[S.cropIdx]; if(!c) return; S.clips.forEach(o=>{ if(o.samples) o.crop={...c.crop}; }); renderClips(); status("Applied this crop to every clip."); };


function updateButtons(){
  const ready=!!S.plan, busy=!!S.running;
  $("preview").disabled=!ready || (busy && S.running.record);
  if($("cmpOpen")) $("cmpOpen").disabled=!ready||busy;
  $("render").disabled=!ready || (busy && !S.running.record);
  $("preview").textContent= busy && !S.running.record ? "Stop preview" : "Preview";
  $("render").textContent= busy && S.running.record ? "Stop" : (S.eps.length>1?`Make ${S.eps.length} videos`:"Make video");
  { const mk=$("makeNow"); if(mk){ const one=S.eps.length===1&&EP(S.eps[0]); mk.disabled=!ready||(busy&&!S.running.record); mk.textContent=busy&&S.running.record?"Stop":S.eps.length>1?`Make ${S.eps.length} videos`:one&&one.short?"Make Short":"Make video";
    mk.title=S.eps.length?`Makes: ${S.eps.map(e=>(EP(e)||{}).name||e).join(", ")}. Change them under Where it’s going.`:"Makes a YouTube Short. Pick others under Where it’s going."; } }
  $("shuffle").disabled=!ready||busy;
  $("aiBtn").disabled=!ready||busy;
  $("aiDirect").disabled=!ready||busy||!$("capWith").options.length||!PROVIDERS[$("capWith").value];
  $("aiName").disabled=$("aiDirect").disabled;
  stepStatus(); posterSoon(); $("remix2").disabled=$("shuffle").disabled; $("tagBtn").disabled=!ready||busy; if($("outlineWrite")) $("outlineWrite").disabled=!ready||busy; if($("faceBtn")) $("faceBtn").disabled=!S.clips.some(c=>c.samples)||busy;
  $("comboBtn").disabled=busy||!S.clips.some(c=>c.samples)||!(S.songs.some(s=>s.an)||S.an);
  $("newDir").disabled=!ready||busy||!!S._auto; $("autoBtn").disabled=!ready||busy||!!S._auto; $("titleBtn").disabled=!ready||busy;
  if(ready && $("autoTitles").checked && S.eps.some(id=>!S.titles[id]) && !S._titling){ S._titling=true; setTimeout(()=>{ writeTitles(false,true).finally(()=>{ S._titling=false; }); },0); }
  const gp=(ready&&S.an)?gateProblems():[]; $("gateNote").hidden=!gp.length; $("gateNote").textContent=gp.join(" ");
  updateNamePreview(); scheduleChecklist();
}

