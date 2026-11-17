/* ---------------- Characters by face: on-device face recognition ----------------
   Every sampled frame is searched for faces; each face becomes a 128-number fingerprint. Fingerprints that sit close
   together are the same person. Anyone found in two or more different clips becomes a character. */
const FACE_LIB="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const FACE_MODELS=["models/","https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/"]; // shipped with the app; the CDN copy serves saved standalone copies
let _faceLib=null;
function loadFaceLib(){ if(_faceLib) return _faceLib;
  _faceLib=(async()=>{ await loadScript(FACE_LIB); const fa=window.faceapi; if(!fa) throw new Error("face library didn’t load");
    try{ await fa.tf.setBackend("webgl"); }catch(e){} await fa.tf.ready(); let err=null;
    try{ fa.tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD",48*1024*1024); }catch(e){} // phones: don't hoard spare graphics memory
    const nf=window.fetch.bind(window), shim=async(url,init)=>{ // the app's own copies of the weights are stored as text (.bin.json); turn them back into binary
        const u=String(url&&url.url||url); let U=null; try{ U=new URL(u,location.href); }catch(e){}
        if(U&&U.origin===location.origin&&/\/models\/[^/]+\.bin$/.test(U.pathname)){ const r=await nf(U.href+".json"); if(!r.ok) throw new Error("model file "+r.status);
          const s=atob((await r.json()).b64), a=new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return new Response(a.buffer,{status:200,headers:{"Content-Type":"application/octet-stream"}}); }
        return nf(url,init); };
    window.fetch=shim;
    try{
    for(const base of FACE_MODELS){ try{ await fa.nets.ssdMobilenetv1.loadFromUri(base); await fa.nets.tinyFaceDetector.loadFromUri(base); await fa.nets.faceLandmark68Net.loadFromUri(base); await fa.nets.faceRecognitionNet.loadFromUri(base); return fa; }catch(e){ err=e; } }
    throw err||new Error("face models didn’t load"); }finally{ window.fetch=nf; } })();
  _faceLib.catch(()=>{ _faceLib=null; }); return _faceLib; }
const FACE_Q=400; // fingerprints are kept as small whole numbers to save space
function fqEnc(d){ let s=""; for(let i=0;i<d.length;i++) s+=String.fromCharCode(Math.max(0,Math.min(255,Math.round(d[i]*FACE_Q)+128))); return btoa(s); }
function fqDec(s){ const b=atob(s), v=new Float32Array(b.length); for(let i=0;i<b.length;i++) v[i]=(b.charCodeAt(i)-128)/FACE_Q; return v; }
function fDist(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s); }
async function faceScanClip(fa,c){
  const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.preload="auto"; v.src=c.url; const out=[];
  try{ if(c.kind==="image"){ out.push(...await faceFrame(fa,c.img,0)); }
    else { await waitEvent(v,"loadeddata",20000); const dur=v.duration, n=Math.max(3,Math.min(8,Math.ceil(dur/1.6)));
      for(let i=0;i<n;i++){ const t=Math.max(0,(dur-0.2)*(i+0.5)/n); await seekTo(v,t); out.push(...await faceFrame(fa,v,t)); } } }
  catch(e){} finally{ v.removeAttribute("src"); v.load(); }
  c.faces=out; }
const _fcv=document.createElement("canvas"), _fth=document.createElement("canvas"); _fth.width=_fth.height=56;
async function faceFrame(fa,src,t){
  const sw=src.videoWidth||src.naturalWidth, sh=src.videoHeight||src.naturalHeight; if(!sw||!sh) return [];
  // every frame is searched at one fixed size (letterboxed): clips come in many sizes, and each new size makes the graphics
  // library set aside more memory, which is what ran a phone out of memory part-way through a big library
  const FS=640, k=FS/Math.max(sw,sh), dw=sw*k, dh=sh*k, ox=(FS-dw)/2, oy=(FS-dh)/2; if(_fcv.width!==FS){ _fcv.width=FS; _fcv.height=FS; }
  const g=_fcv.getContext("2d"); g.fillStyle="#000"; g.fillRect(0,0,FS,FS); g.drawImage(src,ox,oy,dw,dh);
  const W=dw, H=dh, res=await fa.detectAllFaces(_fcv,new fa.SsdMobilenetv1Options({minConfidence:FACE_CONF,maxResults:8})).withFaceLandmarks().withFaceDescriptors(), out=[];
  const iou=(a,b)=>{ const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)), y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)), i=x*y; return i/(a.width*a.height+b.width*b.height-i); };
  res.sort((a,b)=>b.detection.score-a.detection.score); const kept=[]; let second=null;
  for(const r of res){ const b=r.detection.box; if(b.width<30||b.height<30) continue; // too small to recognise reliably
    if(kept.some(k=>iou(k.detection.box,b)>0.3)) continue; // the same face boxed twice
    if(r.detection.score<FACE_SURE){ // not sure it's a real face (a helmet, a drawing): a second, different detector must agree
      if(!second) second=await fa.detectAllFaces(_fcv,new fa.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.3}));
      if(!second.some(d=>iou(d.box,b)>0.3)) continue; }
    kept.push(r); }
  for(const r of kept){ const b=r.detection.box;
    const tg=_fth.getContext("2d"), m=0.25; tg.fillStyle="#222"; tg.fillRect(0,0,56,56); const sz=Math.max(b.width,b.height)*(1+2*m);
    tg.drawImage(_fcv,b.x+b.width/2-sz/2,b.y+b.height/2-sz/2,sz,sz,0,0,56,56);
    out.push({t:+t.toFixed(2), box:{cx:+((b.x+b.width/2-ox)/W).toFixed(3),cy:+((b.y+b.height/2-oy)/H).toFixed(3),w:+(b.width/W).toFixed(3),h:+(b.height/H).toFixed(3)}, s:+r.detection.score.toFixed(2), d:fqEnc(r.descriptor), th:_fth.toDataURL("image/jpeg",0.7)}); }
  return out; }
/* group fingerprints into people. Tight threshold for accuracy; two faces in the same frame are never the same person. */
let FACE_SAME=0.5, FACE_MERGE=0.42, FACE_CONF=0.35, FACE_SURE=0.75;
function clusterFaces(){
  const all=[]; S.clips.forEach((c,ci)=>{ if(c.off&&false) return; (c.faces||[]).forEach(f=>{ f._v=f._v||fqDec(f.d); all.push({ci,f}); }); });
  const q=x=>x.f.s*Math.min(1,x.f.box.w*x.f.box.h*40); all.sort((a,b)=>q(b)-q(a)); // clearest faces lead each group
  let cl=[]; const cen=c=>{ const v=new Float32Array(128); for(const m of c.m) for(let i=0;i<128;i++) v[i]+=m.f._v[i]; for(let i=0;i<128;i++) v[i]/=c.m.length; c.v=v; };
  const fits=(x,c)=>{ const ms=c.m.length>12?c.m.slice(0,12):c.m; let s=0; for(const m of ms) s+=fDist(x.f._v,m.f._v); return s/ms.length<FACE_SAME+0.06; }; // close to the group as a whole, not just its average: stops one person drifting into the next
  for(const x of all){ let best=null,bd=FACE_SAME; for(const c of cl){ const d=fDist(x.f._v,c.v); if(d<bd&&!c.m.some(m=>m.ci===x.ci&&m.f.t===x.f.t)&&fits(x,c)){ bd=d; best=c; } }
    if(best){ best.m.push(x); cen(best); } else cl.push({m:[x],v:x.f._v}); }
  for(let pass=0;pass<2;pass++){ // settle: each face joins the person it's nearest to
    const next=cl.map(c=>({m:[],v:c.v}));
    for(const x of all){ let bi=-1,bd=FACE_SAME*1.04; next.forEach((c,i)=>{ const d=fDist(x.f._v,c.v); if(d<bd&&!c.m.some(m=>m.ci===x.ci&&m.f.t===x.f.t)&&(!c.m.length||fits(x,c))){ bd=d; bi=i; } }); if(bi>=0) next[bi].m.push(x); else next.push({m:[x],v:x.f._v}); }
    cl=next.filter(c=>c.m.length); cl.forEach(cen); }
  for(let merged=true;merged;){ merged=false; // one person split in two
    for(let a=0;a<cl.length&&!merged;a++) for(let b=a+1;b<cl.length;b++){ if(fDist(cl[a].v,cl[b].v)<FACE_MERGE&&!cl[a].m.some(x=>cl[b].m.some(y=>y.ci===x.ci&&y.f.t===x.f.t))){ cl[a].m.push(...cl[b].m); cen(cl[a]); cl.splice(b,1); merged=true; break; } } }
  // a group of only blurry or doubtful faces can't stand as a person on its own: it joins the nearest clear person, or is set aside
  { const strong=c=>c.m.some(x=>x.f.s>=FACE_SURE), S2=cl.filter(strong);
    for(const c of cl.filter(c=>!strong(c))){ let best=null,bd=0.56; for(const s of S2){ const d=fDist(c.v,s.v); if(d<bd&&!c.m.some(x=>s.m.some(y=>y.ci===x.ci&&y.f.t===x.f.t))){ bd=d; best=s; } } if(best){ best.m.push(...c.m); cen(best); } }
    cl=S2; }
  // AI checks from earlier runs: faces it said were someone else are kept out, people it said were one are joined
  for(const c of cl){ c.m=c.m.filter(x=>!(x.f.ban&&c.m.length>1&&cl.some(o=>o!==c&&o.m.some(y=>y.f.id&&x.f.ban.includes(y.f.id)))||false)); }
  // recruit: a face left on its own joins a person when it is clearly closest to them and to nobody else
  { const big=cl.filter(c=>new Set(c.m.map(x=>x.ci)).size>=2), small=cl.filter(c=>!big.includes(c));
    for(const c of small){ for(const x of [...c.m]){ let b1=null,d1=9,d2=9; for(const B of big){ const d=fDist(x.f._v,B.v); if(d<d1){ d2=d1; d1=d; b1=B; } else if(d<d2) d2=d; }
        if(b1&&d1<FACE_SAME&&d2-d1>=0.1&&x.f.s>=0.6&&!b1.m.some(m=>m.ci===x.ci&&m.f.t===x.f.t)){ b1.m.push(x); c.m.splice(c.m.indexOf(x),1); } } }
    big.forEach(cen); cl=cl.filter(c=>c.m.length); }
  // support: every face must closely match at least one face of the same person from a different clip; a stray lookalike (a drawing, a mask) doesn't
  for(const c of cl){ const keep=c.m.filter(x=>c.m.some(y=>y.ci!==x.ci&&fDist(x.f._v,y.f._v)<0.44)); if(keep.length>=2&&keep.length<c.m.length){ S._dropped=(S._dropped||0)+c.m.length-keep.length; c.m=keep; cen(c); } }
  // characters: people in at least two different clips, most frequent first
  const people=cl.map(c=>({c,clips:new Set(c.m.map(x=>x.ci))})).filter(p=>p.clips.size>=2).sort((a,b)=>b.clips.size-a.clips.size||b.c.m.length-a.c.m.length);
  const old=S.faceCast||[], used=new Set(), cast=[]; S.clips.forEach(c=>(c.faces||[]).forEach(f=>f.id=null));
  people.forEach((p,i)=>{ let keep=null,kd=0.45; for(const o of old){ if(used.has(o.id)||!o.c) continue; const d=fDist(p.c.v,fqDec(o.c)); if(d<kd){ kd=d; keep=o; } } // same person as before keeps their name
    const id=keep?keep.id:"p"+Date.now().toString(36).slice(-4)+i; used.add(id);
    const rep=p.c.m.reduce((a,x)=>q(x)>q(a)?x:a,p.c.m[0]); p.c.m.forEach(x=>x.f.id=id);
    cast.push({id,label:keep?keep.label:"Person "+(cast.length+1),name:keep?keep.name:null,desc:keep?keep.desc:null,type:keep?keep.type:null,n:p.clips.size,thumb:rep.f.th,c:fqEnc(p.c.v),face:true}); });
  // borrow a description from the AI reading where it agrees (e.g. "woman in red coat")
  cast.forEach(x=>{ if(x.name||x.desc||!/^Person \d+$/.test(x.label)) return; const votes=new Map(); let tot=0;
    S.clips.forEach(c=>(c.faces||[]).forEach(f=>{ if(f.id!==x.id) return; const tg=(c.tags||[]).find(t=>Math.abs(t.t-f.t)<1.2); const s=tg&&tg.subj; if(s){ votes.set(s,(votes.get(s)||0)+1); } tot++; }));
    let best=null; for(const [k,n] of votes) if(!best||n>best[1]) best=[k,n]; if(best&&best[1]>=Math.max(2,tot*0.5)) x.label=best[0]; });
  S.faceCast=cast; return cast; }
