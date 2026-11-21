/* ---------------- Watermarks: logos, channel names and app badges burned into the footage ----------------
   They are the edges that stay put while everything else moves. Each sampled frame's edges are compared; edges present
   in every frame, packed into a small cluster near an edge or corner of the picture, are a watermark. The first and second
   halves are also checked on their own, because some apps move their badge part-way through. */
function wmCanvas(v){ const vw=v.videoWidth||16, vh=v.videoHeight||9, c=document.createElement("canvas"); c.width=vw>=vh?160:Math.round(160*vw/vh); c.height=vw>=vh?Math.round(160*vh/vw):160;
  return {c,g:c.getContext("2d",{willReadFrequently:true}),w:c.width,h:c.height}; }
function wmGrab(m,v){ m.g.drawImage(v,0,0,m.w,m.h); const d=m.g.getImageData(0,0,m.w,m.h).data, L=new Uint8Array(m.w*m.h); for(let i=0;i<L.length;i++) L[i]=(77*d[i*4]+150*d[i*4+1]+29*d[i*4+2])>>8; return L; }
function detectWatermarks(fr,w,h,times,dur){
  const n=fr.length; if(n<4) return []; const N=w*h, T=22;
  // signed gradients: a watermark's edges keep the same direction in every frame (light text on its surroundings), chance detail doesn't
  const GX=fr.map(L=>{ const e=new Int16Array(N); for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; e[i]=L[i+1]-L[i-1]; } return e; }),
        GY=fr.map(L=>{ const e=new Int16Array(N); for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; e[i]=L[i+w]-L[i-w]; } return e; });
  const same=(A,G,i)=>{ const s=A[G[0]][i]; if(Math.abs(s)<T) return false; for(const k of G){ const v=A[k][i]; if(Math.abs(v)<T||(v>0)!==(s>0)) return false; } return true; };
  const groups=[[...Array(n).keys()]]; if(n>=10){ const hf=Math.floor(n/2); groups.push([...Array(hf).keys()],[...Array(n-hf).keys()].map(k=>k+hf)); }
  // when each find is on screen: from the sample before its group to the sample after it (a badge that jumps corners is only avoided while it's there)
  const span=G=>{ if(!times||G.length===n) return [0,1e9]; const i0=G[0], i1=G[G.length-1]; return [i0>0?times[i0-1]:0, i1<n-1?times[i1+1]:(dur||1e9)]; };
  let out=[];
  for(const G of groups){
    let mot=0; for(let k=1;k<G.length;k++){ const a=fr[G[k-1]], b=fr[G[k]]; let s=0; for(let i=0;i<N;i+=3) s+=Math.abs(a[i]-b[i]); mot+=s/(N/3); } mot/=G.length-1;
    if(mot<4) continue; // footage that barely changes can't be told apart from a logo
    const P=new Uint8Array(N); let pc=0; for(let i=0;i<N;i++){ if(same(GX,G,i)||same(GY,G,i)){ P[i]=1; pc++; } }
    if(pc<6||pc>N*0.05) continue; // too much stays put: a locked-off shot of a still background, not a watermark
    const D=new Uint8Array(N), R=3; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ if(!P[y*w+x]) continue; for(let yy=Math.max(0,y-R);yy<=Math.min(h-1,y+R);yy++) for(let xx=Math.max(0,x-R);xx<=Math.min(w-1,x+R);xx++) D[yy*w+xx]=1; }
    const seen=new Uint8Array(N);
    for(let s0=0;s0<N;s0++){ if(!D[s0]||seen[s0]) continue; const q=[s0]; seen[s0]=1; let x0=w,y0=h,x1=-1,y1=-1,cnt=0;
      while(q.length){ const i=q.pop(), x=i%w, y=(i/w)|0; if(P[i]){ cnt++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
        if(x>0&&D[i-1]&&!seen[i-1]){ seen[i-1]=1; q.push(i-1); } if(x<w-1&&D[i+1]&&!seen[i+1]){ seen[i+1]=1; q.push(i+1); }
        if(y>0&&D[i-w]&&!seen[i-w]){ seen[i-w]=1; q.push(i-w); } if(y<h-1&&D[i+w]&&!seen[i+w]){ seen[i+w]=1; q.push(i+w); } }
      if(cnt<6) continue;
      const bw=(x1-x0+1)/w, bh=(y1-y0+1)/h; if(bw>0.45||bh>0.22||bw*bh>0.06) continue;
      if(cnt/((x1-x0+1)*(y1-y0+1))<0.08) continue; // text and logos are dense with edges
      const cx=(x0+x1+1)/2/w, cy=(y0+y1+1)/2/h; if(!(cx<0.34||cx>0.66||cy<0.24||cy>0.76)) continue; // watermarks sit near edges and corners
      // grow to take in the rest of the mark: nearby edges that stay put in every frame, whichever way they face
      for(let grow=0;grow<6;grow++){ let gx0=x0,gx1=x1,gy0=y0,gy1=y1; const M=5;
        for(let y=Math.max(1,y0-M);y<=Math.min(h-2,y1+M);y++) for(let x=Math.max(1,x0-M);x<=Math.min(w-2,x1+M);x++){ if(x>=x0&&x<=x1&&y>=y0&&y<=y1) continue; const i=y*w+x; let miss=0; const allow=G.length>=5?1:0; // one frame where the background matches the mark's colour is forgiven
          for(const k of G){ if(Math.max(Math.abs(GX[k][i]),Math.abs(GY[k][i]))<T*0.8&&++miss>allow) break; } const ok=miss<=allow; if(ok){ if(x<gx0)gx0=x; if(x>gx1)gx1=x; if(y<gy0)gy0=y; if(y>gy1)gy1=y; } }
        if(gx0===x0&&gx1===x1&&gy0===y0&&gy1===y1) break; if((gx1-gx0+1)/w>0.45||(gy1-gy0+1)/h>0.22) break; x0=gx0; x1=gx1; y0=gy0; y1=gy1; }
      if(x1-x0+1<5||y1-y0+1<3) continue; // a one- or two-pixel line is a fixed edge in the scene (a door frame, a horizon), not a mark
      const p=0.02, sp=span(G); out.push({x0:Math.max(0,x0/w-p),y0:Math.max(0,y0/h-p),x1:Math.min(1,(x1+1)/w+p),y1:Math.min(1,(y1+1)/h+p),a:sp[0],b:sp[1]}); } }
  for(let changed=true;changed;){ changed=false; // merge overlapping finds
    for(let a=0;a<out.length&&!changed;a++) for(let b=a+1;b<out.length;b++){ const A=out[a],B=out[b]; if(A.x0<=B.x1&&B.x0<=A.x1&&A.y0<=B.y1&&B.y0<=A.y1&&A.a<=B.b&&B.a<=A.b){ out[a]={x0:Math.min(A.x0,B.x0),y0:Math.min(A.y0,B.y0),x1:Math.max(A.x1,B.x1),y1:Math.max(A.y1,B.y1),a:Math.min(A.a,B.a),b:Math.max(A.b,B.b)}; out.splice(b,1); changed=true; break; } } }
  return out.slice(0,4).map(b=>({x0:+b.x0.toFixed(4),y0:+b.y0.toFixed(4),x1:+b.x1.toFixed(4),y1:+b.y1.toFixed(4),a:+b.a.toFixed(2),b:+Math.min(b.b,1e6).toFixed(2)}));
}
/* the crop actually used for a clip in a given format: the clip's own crop, plus just enough extra to push any watermark out
   of what that format shows. A corner logo on landscape footage is already outside a 9:16 crop, so it costs nothing there. */
const ZCROP={t:0,b:0,l:0,r:0};
function viewCrop(clip,W,H,F,st){
  const base=clip.crop||ZCROP; if(!clip.wm||!clip.wm.length||clip.kind==="image"||!optV("wmAvoid")) return base;
  const on=clip.wm.filter(b=>st==null||b.a==null||(st>=b.a-0.05&&st<=b.b+0.05)); if(!on.length) return base;
  const key=(W/H).toFixed(3)+F.fit+base.t+","+base.b+","+base.l+","+base.r+"|"+on.map(b=>clip.wm.indexOf(b)).join(","); clip._wmcs=clip._wmcs||new Map(); const hit=clip._wmcs.get(key); if(hit){ clip._wmc=hit; return hit.cr; }
  const vw=clip.w||16, vh=clip.h||9, A=W/H, fill=F.fit==="fill";
  const view=cr=>{ const rw=(1-cr.l-cr.r)*vw, rh=(1-cr.t-cr.b)*vh; let x0=cr.l,x1=1-cr.r,y0=cr.t,y1=1-cr.b; const k=fill?Math.max(W/rw,H/rh):Math.min(W/rw,H/rh);
    if(fill){ if(rw/rh>A){ const s=rh*A/vw, c=(x0+x1)/2; x0=c-s/2; x1=c+s/2; } else { const s=rw/A/vh, c=(y0+y1)/2; y0=c-s/2; y1=c+s/2; } } return {x0,x1,y0,y1,k}; };
  const hits=(b,v)=>Math.min(b.x1,v.x1)-Math.max(b.x0,v.x0)>0.004&&Math.min(b.y1,v.y1)-Math.max(b.y0,v.y0)>0.004;
  let cr={...base}; const k0=view(cr).k, left=[];
  // the picture itself is never altered: a mark is framed out (a tighter crop on its side), or the shot avoids it
  for(const b of on){ if(!hits(b,view(cr))) continue; const cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2, cand=[]; let best=null;
    const vy=cy<0.5?{t:Math.max(cr.t,b.y1)}:{b:Math.max(cr.b,1-b.y0)}, hx=cx<0.5?{l:Math.max(cr.l,b.x1)}:{r:Math.max(cr.r,1-b.x0)};
    cand.push({...cr,...vy},{...cr,...hx},{...cr,...vy,...hx});
    for(const lim of [1.45,1.9]){ for(const c of cand){ if(1-c.l-c.r<0.3||1-c.t-c.b<0.3) continue; const v=view(c); if(hits(b,v)) continue; const cost=v.k/k0; if(cost<=lim&&(!best||cost<best.cost)) best={c,cost}; } if(best) break; } // a closer crop first; a tighter one if that's what it takes
    if(best) cr=best.c; else left.push(b); } // in the middle of the picture: no crop can lose it, so the shot planner steers clear of this moment
  clip._wmc={key,cr,blur:[],left}; if(clip._wmcs.size>24) clip._wmcs.clear(); clip._wmcs.set(key,clip._wmc); return cr;
}
/* does a watermark stay in view anywhere in [start, start+D] for this format? Then that moment of the clip isn't used. */
function wmBlocked(clip,start,D,ep){ if(!clip.wm||!clip.wm.length||clip.kind==="image"||!optV("wmAvoid")) return false; ep=ep||EP(S.eps[0])||EP("shorts"); if(!ep) return false;
  const F={fit:optV("fit")||"fill"}, ts=[start,start+D/2,Math.max(start,start+D-0.05)];
  for(const t of ts){ if(!clip.wm.some(b=>b.a==null||(t>=b.a-0.05&&t<=b.b+0.05))) continue; viewCrop(clip,ep.w,ep.h,F,t); if(clip._wmc&&clip._wmc.left&&clip._wmc.left.length) return true; } return false; }
async function wmScan(c){ const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.preload="auto"; v.src=c.url; try{ await waitEvent(v,"loadeddata",20000); const dur=v.duration, m=wmCanvas(v), fr=[], n=Math.max(3,Math.min(12,Math.ceil(dur/1.5)));
    const ts=[]; for(let i=0;i<n;i++){ const t=Math.max(0,(dur-0.3)*(i+0.5)/n); ts.push(t); await seekTo(v,t); fr.push(wmGrab(m,v)); } c.wm=detectWatermarks(fr,m.w,m.h,ts,dur); c._wmc=null; c._wmcs=null; }
  catch(e){ c.wm=[]; } finally{ v.removeAttribute("src"); v.load(); } }
function wmCatchUp(){ if(S._wmQ||!$("wmAvoid").checked) return; const todo=S.clips.filter(c=>c.samples&&c.kind!=="image"&&c.wm===undefined); if(!todo.length) return; S._wmQ=true;
  heavy("Checking clips for watermarks",async()=>{ try{ for(let k=0;k<todo.length;k++){ status(`Checking clips for watermarks (${k+1} of ${todo.length})…`); await wmScan(todo[k]); }
    const f=todo.filter(c=>c.wm&&c.wm.length).length; status(f?`Found watermarks in ${f} clip${f===1?"":"s"}; they’ll be kept out of frame.`:"No watermarks found."); renderClips(); saveProjectSoon(); } finally{ S._wmQ=false; } }); }

/* per-frame features: average colour, sharpness (how much fine detail), and a fingerprint (a 12×7 colour grid plus a
   64-bit structure hash) used to spot near-duplicate clips such as variants of one AI prompt */
function frameFeatures(d,L,w,h){
  let r=0,g=0,b=0; for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; } const n=d.length/4; const col=[Math.round(r/n),Math.round(g/n),Math.round(b/n)];
  let lap=0,cnt=0; for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; lap+=Math.abs(4*L[i]-L[i-1]-L[i+1]-L[i-w]-L[i+w]); cnt++; }
  const grid=[]; for(let gy=0;gy<7;gy++) for(let gx=0;gx<12;gx++){ let R=0,G=0,B=0,k=0; for(let y=Math.floor(gy*h/7);y<Math.floor((gy+1)*h/7);y++) for(let x=Math.floor(gx*w/12);x<Math.floor((gx+1)*w/12);x++){ const i=(y*w+x)*4; R+=d[i]; G+=d[i+1]; B+=d[i+2]; k++; } grid.push(Math.round(R/k),Math.round(G/k),Math.round(B/k)); }
  const s=[]; for(let gy=0;gy<8;gy++) for(let gx=0;gx<9;gx++){ let v=0,k=0; for(let y=Math.floor(gy*h/8);y<Math.floor((gy+1)*h/8);y++) for(let x=Math.floor(gx*w/9);x<Math.floor((gx+1)*w/9);x++){ v+=L[y*w+x]; k++; } s.push(v/k); }
  let hash=""; for(let gy=0;gy<8;gy++) for(let gx=0;gx<8;gx++) hash+=s[gy*9+gx]<s[gy*9+gx+1]?"1":"0";
  return {col, sharp:lap/cnt, fp:{grid,hash}};
}
async function analyzeImage(file){
  const url=URL.createObjectURL(file), img=new Image(); img.decoding="async"; img.src=url;
  try{ await img.decode(); }catch(e){ throw new Error("This image format can’t be read in this browser"); }
  const vw=img.naturalWidth, vh=img.naturalHeight, tc=document.createElement("canvas");
  if(vw>=vh){ tc.width=480; tc.height=Math.round(480*vh/vw); } else { tc.height=480; tc.width=Math.round(480*vw/vh); }
  const tg=tc.getContext("2d",{willReadFrequently:true}); tg.drawImage(img,0,0,tc.width,tc.height);
  const d=tg.getImageData(0,0,tc.width,tc.height).data; let b=0; for(let i=0;i<d.length;i+=16) b+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
  const bright=b/(d.length/16);
  const sc=document.createElement("canvas"); sc.width=96; sc.height=54; const sgx=sc.getContext("2d",{willReadFrequently:true}); sgx.drawImage(img,0,0,96,54);
  const sd=sgx.getImageData(0,0,96,54).data, SL=new Float32Array(96*54); for(let i=0;i<SL.length;i++) SL[i]=0.299*sd[i*4]+0.587*sd[i*4+1]+0.114*sd[i*4+2]; const ff=frameFeatures(sd,SL,96,54);
  return { name:file.name, url, kind:"image", img, dur:3600, samples:[{t:0,motion:null,bright,col:ff.col,sharp:ff.sharp}], thumb:tc.toDataURL("image/jpeg",0.72), w:vw, h:vh, crop:{t:0,b:0,l:0,r:0}, fp:[ff.fp] };
}
function normaliseClips(){
  const all=[]; S.clips.forEach(c=>c.samples&&c.samples.forEach(s=>all.push(s)));
  if(!all.length) return;
  const vm=all.filter(s=>s.motion!=null).map(s=>s.motion).sort((a,b)=>a-b);
  const med=vm.length?vm[Math.floor(vm.length/2)]:3;
  all.forEach(s=>{ if(s.motion==null || s.still) { s.motion=med; s.still=true; } }); // photos move with our motion effects, so they sit mid-energy
  const rank=(key,out)=>{ const s=[...all].sort((a,b)=>a[key]-b[key]); s.forEach((x,i)=>x[out]=s.length>1?i/(s.length-1):0.5); };
  rank("motion","mN"); rank("bright","bN");
}

