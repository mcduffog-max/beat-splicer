/* ---------------- Reading the footage: shot size, faces, expression, subject ----------------
   Scale: 0 extreme wide, 1 wide, 2 medium, 3 medium close-up, 4 close-up, 5 extreme close-up (eyes). */
const SCALE_NAMES=["extreme wide","wide","medium","medium close-up","close-up","extreme close-up"];
function tagAt(clip,t){ if(!clip||!clip.tags||!clip.tags.length) return null; return clip.tags.reduce((a,x)=>Math.abs(x.t-t)<Math.abs(a.t-t)?x:a,clip.tags[0]); }
function tagPoints(c){ if(c.kind==="image") return [0]; const d=c.dur; return d<4?[d*0.5]:[d*0.15,d*0.5,d*0.85]; }
async function frameAt(c,t,size){
  const cv=document.createElement("canvas"), g=cv.getContext("2d"); let src;
  if(c.kind==="image") src=c.img;
  else { src=document.createElement("video"); src.muted=true; src.preload="auto"; src.src=c.url; try{ await waitEvent(src,"loadeddata",8000); }catch(e){ return null; } await seekTo(src,t); }
  const w=src.videoWidth||src.naturalWidth, hh=src.videoHeight||src.naturalHeight, k=size/Math.max(w,hh); cv.width=Math.round(w*k); cv.height=Math.round(hh*k);
  g.drawImage(src,0,0,cv.width,cv.height); if(src.tagName==="VIDEO"){ src.removeAttribute("src"); src.load(); } return cv;
}
function readFootage(){ return heavy("Reading your footage",readFootageNow); }
async function readFootageNow(){
  const id=[...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v]); if(!id){ $("tagInfo").textContent=HOSTED?"Footage reading needs Claude, which isn’t available here.":"Add an AI key first: tap All settings, then Publish › Connect ChatGPT, Gemini or Grok."; return; }
  const items=[]; S.clips.forEach((c,ci)=>{ if(c.samples) tagPoints(c).forEach(t=>items.push({ci,t})); });
  if(!items.length) return;
  $("tagBtn").disabled=true; let done=0;
  const T=230, cols=4, per=16;
  try{
    for(let b=0;b<items.length;b+=per){
      const batch=items.slice(b,b+per); $("tagInfo").textContent=`Reading your footage… ${Math.min(items.length,b+per)} of ${items.length} frames`;
      const sheet=document.createElement("canvas"); sheet.width=T*cols; sheet.height=T*Math.ceil(batch.length/cols); const g=sheet.getContext("2d");
      g.fillStyle="#111"; g.fillRect(0,0,sheet.width,sheet.height);
      for(let k=0;k<batch.length;k++){ const f=await frameAt(S.clips[batch[k].ci],batch[k].t,T-8); const x=(k%cols)*T, y=Math.floor(k/cols)*T;
        if(f){ const ox=x+(T-f.width)/2, oy=y+(T-f.height)/2; g.drawImage(f,ox,oy); batch[k].rect=[ox-x,oy-y,f.width,f.height]; }
        g.fillStyle="#FFE14D"; g.font="bold 20px system-ui"; g.fillText(String(k+1),x+6,y+22); }
      const blob=await new Promise(r=>sheet.toBlob(r,"image/jpeg",0.85));
      const prompt=`Image 1 is a grid of ${batch.length} video frames, numbered in yellow (left to right, top to bottom). For EACH numbered frame, describe it for a music-video editor.
Reply with ONLY JSON: {"frames":[{"n":1,"people":[],"scale":0-5,"faces":0,"face":[cx,cy,w,h] or null,"eyes":true|false,"expression":"neutral|joy|calm|intense|sad|surprise|none","intensity":0-1,"subject":"short label for the main subject, the same label whenever the same person or thing appears","setting":"2-4 words","scene":["one or two of: ${SCENES.map(s=>s[0]).join(", ")}"],"role":"establishing|subject|action|detail|reaction"}]}
scale: 0 extreme wide (landscape, tiny or no people), 1 wide (full bodies with surroundings), 2 medium (waist up), 3 medium close-up (chest up), 4 close-up (face fills much of frame), 5 extreme close-up (eyes, mouth or a small detail).
face: centre and size of the most prominent face as fractions of THAT frame's picture (0 to 1, ignoring the black margins), or null if no face. intensity: how emotionally or physically intense the moment looks.
"people": EVERY distinct person or character visible in that frame, as [{"id":"","label":""}]. Characters already identified in this library: ${S.cast.length?S.cast.map(x=>`${x.id}: ${x.label}`).join("; "):"none yet"}. Reuse an id when it is clearly the same character (same face, hair, costume); otherwise give a new id (c${S.cast.length+1}, c${S.cast.length+2}…) with a short visual label such as "woman in red jacket" and a "type" (1-2 words: cyborg, cowboy, soldier, princess, villain…). [] when nobody is visible.
"scene": the kind of place the frame is set in, using only the words listed.
Describe only what is visible. Do not identify real people by name.`;
      const r=await askAI(id,prompt,[blob]);
      const arr=Array.isArray(r.frames)?r.frames:[];
      for(const fr of arr){ const k=(+fr.n)-1, it=batch[k]; if(!it) continue; const c=S.clips[it.ci]; c.tags=c.tags||[];
        const sc=Math.max(0,Math.min(5,Math.round(+fr.scale||0))); let box=null;
        if(Array.isArray(fr.face) && fr.face.length===4 && fr.face.every(v=>typeof v==="number")){ const [cx,cy,w,hh]=fr.face.map(v=>Math.max(0,Math.min(1,v))); if(w>0.01&&hh>0.01) box={cx,cy,w,h:hh}; }
        c.tags=c.tags.filter(x=>Math.abs(x.t-it.t)>0.01);
        c.tags.push({t:it.t, scale:sc, faces:Math.max(0,+fr.faces||0), box, eyes:!!fr.eyes, expr:String(fr.expression||"none").slice(0,12), inten:Math.max(0,Math.min(1,+fr.intensity||0)), subj:String(fr.subject||"").toLowerCase().slice(0,40), setting:String(fr.setting||"").toLowerCase().slice(0,30), scene:(Array.isArray(fr.scene)?fr.scene:[fr.scene]).map(x=>String(x||"").toLowerCase().trim()).filter(x=>SCENE_IDS.has(x)).slice(0,2), role:String(fr.role||"").slice(0,14)});
        { const ids=[]; for(const pp of (Array.isArray(fr.people)?fr.people:[])){ if(!pp) continue; let id=String(pp.id||"").trim().toLowerCase().slice(0,8); const label=String(pp.label||"").trim().toLowerCase().slice(0,40);
            let known=S.cast.find(x=>x.id===id)||(label&&S.cast.find(x=>x.label===label)); if(!known){ if(!label) continue; id="c"+(S.cast.length+1); known={id,label,name:null,n:0}; S.cast.push(known); } if(pp.type&&!known.type) known.type=String(pp.type).trim().toLowerCase().slice(0,20); if(!ids.includes(known.id)) ids.push(known.id); }
          c.tags[c.tags.length-1].chars=ids; }
        c.tags.sort((a,b)=>a.t-b.t); done++; }
    }
    refreshChars(); renderScenes();
    $("tagInfo").textContent=`Read ${done} frames from ${S.clips.filter(c=>c.tags&&c.tags.length).length} clips and found ${S.cast.filter(x=>x.n).length} character${S.cast.filter(x=>x.n).length===1?"":"s"}. The story now follows shot sizes and faces; pick characters in step 2 to sort by them.`;
    S.protagonist=null; buildPlan(); saveProjectSoon();
  }catch(e){ $("tagInfo").textContent=aiErrorText(e); }
  finally{ $("tagBtn").disabled=!S.plan; }
}

