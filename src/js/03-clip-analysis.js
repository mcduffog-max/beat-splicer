/* ---------------- Clip analysis ---------------- */
function waitEvent(el, ok, ms){ return new Promise((res,rej)=>{ let t;
  const done=()=>{ cleanup(); res(); }, fail=()=>{ cleanup(); const c=el.error&&el.error.code; rej(new Error(c===2?"The file couldn’t be read (Android didn’t let the app open it)":c===3?"The video couldn’t be decoded (damaged, or a format this phone can’t decode)":"This video format can’t be played in this browser")); };
  const cleanup=()=>{ clearTimeout(t); el.removeEventListener(ok,done); el.removeEventListener("error",fail); };
  el.addEventListener(ok,done); el.addEventListener("error",fail); t=setTimeout(()=>{ cleanup(); rej(new Error("Timed out loading video")); }, ms); }); }
function seekTo(el,t,limit){ return new Promise(res=>{ let done=false;
  const fin=()=>{ if(done) return; done=true; el.removeEventListener("seeked",fin); res(); };
  t=Math.max(0,t);
  if(el.readyState>=2 && !el.seeking && Math.abs(el.currentTime-t)<0.0005) return res(); // already there: no "seeked" event would ever come
  el.addEventListener("seeked",fin);
  const go=()=>{ try{ el.currentTime=t; }catch(e){ fin(); } };
  if(el.readyState>=1) go(); else el.addEventListener("loadedmetadata",go,{once:true});
  setTimeout(fin,limit||2500); }); }

/* which way the picture moves over half a second (a pan or a subject crossing), and where in the frame the movement is.
   Global shift by block matching on the 96x54 looks; the centre of what changes once that shift is taken out. */
function flowOf(A,C,w,h){ let best=null; const m=8;
  for(let dy=-3;dy<=3;dy++) for(let dx=-6;dx<=6;dx++){ let s=0,n=0; for(let y=m;y<h-m;y+=2) for(let x=m;x<w-m;x+=2){ s+=Math.abs(A[y*w+x]-C[(y+dy)*w+x+dx]); n++; } s/=n; if(!best||s<best.s) best={s,dx,dy}; }
  let sx=0,sy=0,sw=0; for(let y=m;y<h-m;y++) for(let x=m;x<w-m;x++){ const v=Math.abs(A[y*w+x]-C[(y+best.dy)*w+x+best.dx]); if(v>18){ sx+=x*v; sy+=y*v; sw+=v; } }
  return {dx:+(best.dx/w).toFixed(3), dy:+(best.dy/h).toFixed(3), fx:sw?+(sx/sw/w).toFixed(2):0.5, fy:sw?+(sy/sw/h).toFixed(2):0.5, fl:1}; }
/* clips studied before movement direction was measured get it in the background, a few seconds each, without holding anything up */
async function backfillFlow(){ const todo=S.clips.filter(c=>c.kind!=="image"&&c.samples&&c.samples.length&&!c.samples[0].fl&&c.file); if(!todo.length||S._flowBusy) return; S._flowBusy=true;
  try{ await heavy("Measuring movement direction",async()=>{ const v=analysisPlayer(), cv=document.createElement("canvas"); cv.width=96; cv.height=54; const g=cv.getContext("2d",{willReadFrequently:true});
    const look=async t=>{ await seekTo(v,t); g.drawImage(v,0,0,96,54); const d=g.getImageData(0,0,96,54).data, L=new Float32Array(96*54); for(let i=0;i<L.length;i++) L[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; return L; };
    for(let k=0;k<todo.length;k++){ while(S.running) await new Promise(r=>setTimeout(r,2000)); const c=todo[k]; if(!S.clips.includes(c)) continue;
      const url=URL.createObjectURL(c.file); try{ v.src=url; await waitEvent(v,"loadeddata",15000); for(const s of c.samples){ const A=await look(s.t), C=await look(Math.min(c.dur-0.05,s.t+0.5)); Object.assign(s,flowOf(A,C,96,54)); } }catch(e){ c.samples.forEach(s=>{ s.fl=0; }); }
      finally{ v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); }
      if(k%5===0||k===todo.length-1) status(`Measuring which way your clips move: ${k+1} of ${todo.length} (in the background).`);
      if(k%25===24) saveProjectSoon(); }
    status("Movement measured: cuts now follow the direction of movement."); saveProjectSoon(); if(!S.running) buildPlan(); }); }
  finally{ S._flowBusy=false; } }
/* One video player is reused for studying every clip. Creating a new player per clip made the browser hold on to
   several decoders at once (about 0.5 GB before it caught up), enough to tip a busy tab over. */
function analysisPlayer(){ if(!S._anaV){ const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.preload="auto"; S._anaV=v; } return S._anaV; }
/* one clip, with a second try on a fresh player: on Android a player that hit an error can stay broken for the next clips */
async function analyzeClip(file){
  try{ return await analyzeClipOnce(file); }
  catch(e1){ if(S._anaV){ try{ S._anaV.removeAttribute("src"); S._anaV.load(); }catch(_){} S._anaV=null; }
    if(typeof canRead==="function"&&!(await canRead(file))) throw new Error("The file couldn’t be read (Android didn’t let the app open it; it may be in the cloud rather than on the phone)");
    try{ return await analyzeClipOnce(file); }
    catch(e2){ if(S._anaV){ try{ S._anaV.removeAttribute("src"); S._anaV.load(); }catch(_){} S._anaV=null; } throw e2; } } }
async function analyzeClipOnce(file){
  const url=URL.createObjectURL(file);
  const v=analysisPlayer(); v.src=url;
  try{ await waitEvent(v,"loadeddata",20000); }catch(e){ URL.revokeObjectURL(url); throw e; }
  const dur=v.duration;
  if(!isFinite(dur)||dur<0.3) throw new Error("Couldn’t read the clip’s length");
  const c=document.createElement("canvas"); c.width=96; c.height=54; const g=c.getContext("2d",{willReadFrequently:true});
  let lastD=null; const wmc=wmCanvas(v), wmF=[], wmT=[];
  const grab=async t=>{ await seekTo(v,t); g.drawImage(v,0,0,96,54); const d=g.getImageData(0,0,96,54).data; const L=new Float32Array(96*54);
    for(let i=0;i<L.length;i++) L[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; lastD=d; return L; };
  const fps=[];
  const n=Math.max(3,Math.min(12,Math.ceil(dur/1.5))), samples=[];
  for(let i=0;i<n;i++){
    const t=Math.max(0,(dur-0.3)*(i+0.5)/n);
    const A=await grab(t), fa=frameFeatures(lastD,A,96,54); if(i===0||i===Math.floor(n/2)||i===n-1) fps.push(fa.fp); wmF.push(wmGrab(wmc,v)); wmT.push(t);
    const C=await grab(Math.min(dur-0.05,t+0.5));
    let m=0,b=0; for(let k=0;k<A.length;k++){ m+=Math.abs(A[k]-C[k]); b+=A[k]; } const q=m*0.75; // two looks per sample; a cut shows up as a huge change
    const mm=m/A.length, qq=q/A.length, bb=b/A.length;
    // movement over half a second on a sharper thumbnail, so slow real motion (a drifting camera, a turning head) counts;
    // a huge change within 0.15 s is a cut or flash inside the source
    samples.push({t, motion:mm, bright:bb, cut:qq>38, dark:bb<12, col:fa.col, sharp:fa.sharp, ...flowOf(A,C,96,54)});
  }
  await seekTo(v,Math.min(dur*0.4,dur-0.1));
  const vw=v.videoWidth||16, vh=v.videoHeight||9, tc=document.createElement("canvas");
  if(vw>=vh){ tc.width=480; tc.height=Math.round(480*vh/vw); } else { tc.height=480; tc.width=Math.round(480*vw/vh); }
  const tg=tc.getContext("2d"); tg.drawImage(v,0,0,tc.width,tc.height);
  const thumb=tc.toDataURL("image/jpeg",0.72);
  v.removeAttribute("src"); v.load();
  const wm=detectWatermarks(wmF,wmc.w,wmc.h,wmT,dur);
  return { name:file.name, url, dur, samples, thumb, w:vw, h:vh, crop:{t:0,b:0,l:0,r:0}, mv:2, fp:fps, wm };
}

