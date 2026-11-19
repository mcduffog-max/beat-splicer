/* ---------------- What each shot shows: a picture-and-word model ----------------
   CLIP reads a frame from every moment of every clip once and keeps a 512-number description of it. A lyric line,
   a search ("night city") or a story beat is described the same way, and the closest moments win. No AI service
   is asked about each clip; the model (about 150 MB, downloaded once and kept by the browser) runs on the phone.
   Only where the app has its own address: inside claude.ai the model can't be downloaded. */
const SEE={lib:"https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2", model:"Xenova/clip-vit-base-patch32", dtype:"q8", local:null, prefix:"a photo of "};
let _see=null, _seeLoading=null;
function seeAvailable(){ return !HOSTED&&typeof WebAssembly!=="undefined"; }
async function seeModel(onProg){ if(_see) return _see; if(_seeLoading) return _seeLoading;
  _seeLoading=(async()=>{ const T=await import(SEE.lib); if(SEE.local){ T.env.allowRemoteModels=false; T.env.allowLocalModels=true; T.env.localModelPath=SEE.local; }
    if(T.env.backends&&T.env.backends.onnx&&T.env.backends.onnx.wasm) T.env.backends.onnx.wasm.numThreads=1; // phones: one thread keeps memory flat
    const gpu=(navigator.deviceMemory||4)>=8&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&await webgpuReady().catch(()=>false), opt={dtype:SEE.dtype, ...(gpu&&!SEE.local?{device:"webgpu"}:{}), progress_callback:p=>{ if(onProg&&p&&p.status==="progress"&&p.total) onProg(p.file,p.loaded/p.total); }};
    const proc=await T.AutoProcessor.from_pretrained(SEE.model), tok=await T.AutoTokenizer.from_pretrained(SEE.model);
    const vis=await T.CLIPVisionModelWithProjection.from_pretrained(SEE.model,opt), txt=await T.CLIPTextModelWithProjection.from_pretrained(SEE.model,opt);
    _see={T,proc,tok,vis,txt}; return _see; })();
  try{ return await _seeLoading; } finally{ _seeLoading=null; } }
const unitVec=a=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*a[i]; s=Math.sqrt(s)||1; const o=new Float32Array(a.length); for(let i=0;i<a.length;i++) o[i]=a[i]/s; return o; };
// stored compactly with the project: each number to one byte
function packVec(v){ const b=new Int8Array(v.length); for(let i=0;i<v.length;i++) b[i]=Math.max(-127,Math.min(127,Math.round(v[i]*127*4))); let s=""; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]&255); return btoa(s); }
function unpackVec(p){ if(!p) return null; if(p._v) return p._v; const s=atob(p), v=new Float32Array(s.length); for(let i=0;i<s.length;i++){ let x=s.charCodeAt(i); if(x>127) x-=256; v[i]=x/(127*4); } return unitVec(v); }
const _ceCache=new Map(); function sampleVec(s){ if(!s||!s.ce) return null; let v=_ceCache.get(s.ce); if(!v){ v=unpackVec(s.ce); _ceCache.set(s.ce,v); } return v; }
async function embedCanvas(cv){ const {T,proc,vis}=await seeModel(); const img=await T.RawImage.fromCanvas(cv); const inp=await proc(img); const out=await vis(inp); return unitVec(out.image_embeds.data); }
const _txtCache=new Map();
async function embedTexts(list){ const need=list.filter(t=>!_txtCache.has(t)); if(need.length){ const {tok,txt}=await seeModel();
    for(let i=0;i<need.length;i+=16){ const part=need.slice(i,i+16), inp=tok(part.map(t=>SEE.prefix+t.toLowerCase()),{padding:true,truncation:true}); const out=await txt(inp), d=out.text_embeds.data, n=d.length/part.length;
      part.forEach((t,k)=>_txtCache.set(t,unitVec(d.slice(k*n,(k+1)*n)))); } }
  return list.map(t=>_txtCache.get(t)); }
const dotV=(a,b)=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
/* read every moment of every clip once; runs in the background, pauses during exports, saves as it goes */
async function seeAll(){ if(!seeAvailable()||S._seeBusy) return; const todo=S.clips.filter(c=>c.samples&&c.samples.some(s=>!s.ce)&&(c.file||c.img)); if(!todo.length){ seeReady(); return; } S._seeBusy=true; renderSee();
  try{ await heavy("Learning what's in your clips",async()=>{
      status("Downloading the picture-and-word model (about 150 MB, once)…"); await seeModel((f,q)=>status(`Downloading the picture-and-word model: ${Math.round(q*100)}%…`));
      const v=analysisPlayer(), cv=document.createElement("canvas"); cv.width=224; cv.height=224; const g=cv.getContext("2d",{willReadFrequently:true});
      const frame=src=>{ const w=src.videoWidth||src.naturalWidth, h=src.videoHeight||src.naturalHeight, k=Math.max(224/w,224/h); g.drawImage(src,(224-w*k)/2,(224-h*k)/2,w*k,h*k); };
      for(let n=0;n<todo.length;n++){ while(S.running) await new Promise(r=>setTimeout(r,2000)); const c=todo[n]; if(!S.clips.includes(c)) continue;
        if(c.kind==="image"){ frame(c.img); const e=await embedCanvas(cv); c.samples.forEach(s=>{ s.ce=packVec(e); }); }
        else { const url=URL.createObjectURL(c.file); try{ v.src=url; await waitEvent(v,"loadeddata",15000); const sm=c.samples, pick=sm.length<=5?sm:[0,1,2,3,4].map(k=>sm[Math.round(k*(sm.length-1)/4)]); // five well-spread moments per clip; the rest borrow the nearest
            for(const s of pick){ if(s.ce) continue; await seekTo(v,s.t); frame(v); s.ce=packVec(await embedCanvas(cv)); }
            sm.forEach(s=>{ if(!s.ce){ const nb=pick.reduce((a,x)=>Math.abs(x.t-s.t)<Math.abs(a.t-s.t)?x:a,pick[0]); s.ce=nb.ce; } }); }catch(e){} finally{ v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); } }
        if(n%3===0||n===todo.length-1) status(`Learning what's in your clips: ${n+1} of ${todo.length}. You can keep working.`);
        if(n%25===24) saveProjectSoon(); }
      await seeShotLanguage(); S._placeKey=null; seeReady(); saveProjectSoon(); status("Done: the app knows what's in your clips. Lyrics now find shots that show what's sung."); if(!S.running) buildPlan(); }); }
  catch(e){ status("Couldn't load the picture-and-word model: "+(e&&e.message||e),true); }
  finally{ S._seeBusy=false; renderSee(); } }
function seeCount(){ let n=0,t=0; S.clips.forEach(c=>(c.samples||[]).forEach(s=>{ t++; if(s.ce) n++; })); return [n,t]; }
/* once clips are read, each lyric line is described too, and scored against every moment of footage */
async function seeReady(){ S._seeLines=null; if(!seeShotLanguageSaved()&&S.clips.some(c=>c.samples&&c.samples.some(x=>x.ce))) seeShotLanguage().then(()=>{ S._placeKey=null; if(S._seeScale&&!S.running) buildPlan(); }); if(!S.lyrics||!S.lyrics.lines.length) return; try{ const texts=[...new Set(S.lyrics.lines.map(l=>l.text).filter(Boolean))]; const vs=await embedTexts(texts);
    const all=[]; S.clips.forEach(c=>(c.samples||[]).forEach(s=>{ const v=sampleVec(s); if(v) all.push(v); })); if(!all.length) return;
    const map=new Map(); texts.forEach((t,i)=>{ const q=vs[i]; let m=0,m2=0; for(const v of all){ const d=dotV(q,v); m+=d; m2+=d*d; } m/=all.length; map.set(t,{q,m,sd:Math.sqrt(Math.max(1e-6,m2/all.length-m*m))}); });
    S._seeLines=map; if(!S.running) buildPlan(); }catch(e){} }
/* the cost term: a moment that shows what's being sung wins the shot */
function seeCost(seg,s,ci){ const M=S._seeLines; if(!M||!S.lyrics) return 0; const ln=lyricAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)); if(!ln) return 0; const L=M.get(ln.text), v=sampleVec(s); if(!L||!v) return 0;
  const z=(dotV(L.q,v)-L.m)/L.sd; return -0.45*Math.max(0,Math.min(3,z-0.5)); }
/* search: type what you're after, see the clips that show it */
async function seeSearch(q){ q=String(q||"").trim(); if(!q) return []; const [qv]=await embedTexts([q]); const hits=[];
  S.clips.forEach((c,ci)=>(c.samples||[]).forEach(s=>{ const v=sampleVec(s); if(v) hits.push({ci,t:s.t,d:dotV(qv,v)}); }));
  hits.sort((a,b)=>b.d-a.d); const seen=new Set(), out=[]; for(const h of hits){ if(seen.has(h.ci)) continue; seen.add(h.ci); out.push(h); if(out.length>=12) break; } return out; }
$("seeBtn").onclick=()=>seeAll();
{ let tq=0; $("seeQ").addEventListener("input",()=>{ clearTimeout(tq); tq=setTimeout(async()=>{ const box=$("seeHits"); box.innerHTML=""; const hits=await seeSearch($("seeQ").value);
    hits.forEach(h=>{ const c=S.clips[h.ci], im=document.createElement("img"); im.src=c.thumb||""; im.alt=c.name; im.title=`${c.name} at ${fmtTime(h.t)}`; im.style.cssText="width:96px;height:54px;object-fit:cover;border-radius:6px;cursor:pointer"; im.onclick=()=>openCrop&&openCrop(h.ci); box.appendChild(im); }); },350); }); }
function renderSee(){ const box=$("seeBox"); if(!box) return; box.hidden=!seeAvailable()||!S.clips.some(c=>c.samples); if(box.hidden) return;
  const [n,t]=seeCount(), done=t&&n>=t; $("seeBtn").hidden=done||!!S._seeBusy; $("seeBtn").textContent=n?`Finish learning what's in your clips (${t-n} moments left)`:"Learn what's in my clips";
  $("seeInfo").textContent=S._seeBusy?"Learning what's in your clips…":done?`The app knows what's in all ${S.clips.filter(c=>c.samples).length} clips. Search them, and lyrics find matching shots.`:"Lets lyrics and searches find shots by what they show. Downloads a 150 MB model once; then works offline.";
  $("seeSearchRow").hidden=!n; }
