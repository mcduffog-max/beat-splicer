/* ---------------- Camera director: a camera language that follows the song ----------------
   Each section gets its own way of moving, the way a director would block it:
     verse      settle   a slow, steady drift in the direction the footage already moves; subjects framed on a third
     build      push     an accelerating push-in through the last bars before a chorus or drop
     chorus     punch    the first shot of a chorus or drop lands with a punch-in; then ride: a bigger, beat-driven move
     bridge     float    a weightless, slightly arcing drift
     ending     reveal   the last shot pulls back
   A shot that follows a punch or a fast push lands into its own frame (scale settling), so energy carries across cuts.
   Every move stays inside the picture: framing never shows past the edge of the footage.
   Lens character (the Lens setting) gives each section a look a cinematographer might choose: long lens with soft edges
   for verses, clean and wide for choruses with a rack focus at their entry, diffusion for the bridge. */
function camSection(t){ const AS=S.an&&S.an.sections; if(AS&&AS.length){ const s=AS.find(x=>t>=x.t0&&t<x.t1); if(s) return s.kind; } return null; }
function assignDirector(segs,short){ const mode=$("camMoves")?$("camMoves").value:"director"; if(mode!=="director") return;
  const n=segs.length, chorusStarts=new Set(); try{ songSections(); }catch(e){}
  const AS=(S.an&&S.an.sections)||[]; AS.forEach(s=>{ if(s.chorus) chorusStarts.add(s.t0); });
  let prevMove=null, side=1;
  segs.forEach((s,i)=>{ const c=S.clips[s.clip], D=s.end-s.start; s._dmove=null; s._rack=false; s._land=false;
    if(!c||s._focus&&s._focus.z1>s._focus.z0+0.02) { prevMove=null; return; }
    const sec=camSection(s.start+0.05), nextChorus=AS.find(x=>x.chorus&&x.t0>s.start), toChorus=nextChorus?nextChorus.t0-s.start:99;
    const sm=c.samples&&c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]);
    const dirx=sm&&Math.abs(sm.dx||0)>0.01?Math.sign(sm.dx):(i%2?1:-1), entry=s.drop||[...chorusStarts].some(t0=>Math.abs(t0-s.start)<0.15);
    let mv;
    if(s._endShot||(!short&&i===n-1)) mv="reveal";
    else if(entry) mv="punch";
    else if(s.build||(toChorus<Math.min(8,4*60/(S.an.bpm||120)*2)&&toChorus>0&&sec!=="chorus")) mv="push"; // the last two bars before a chorus
    else if(sec==="chorus"||(!AS.length&&s.e>0.75)) mv="ride";
    else if(sec==="bridge") mv="float";
    else mv="settle";
    s._dmove=mv; s._ddir=dirx; s._land=(prevMove==="punch"||prevMove==="push")&&!entry&&s.e>0.5&&D<2.2;
    // framing: verses place the subject on alternating thirds; choruses keep it central
    side=-side; s._third=(mv==="settle"||mv==="float")?side:0; s._fx=sm&&sm.fx!=null?sm.fx:0.5; s._fy=sm&&sm.fy!=null?sm.fy:0.5;
    s._rack=entry&&D>=0.9&&!short;
    prevMove=mv; });
}
/* the move itself, at time t; offsets are clamped to the slack the scale gives, so no black edges */
function directorMove(seg,t,W,H,bi){ const m=seg._dmove; if(!m) return null; if(seg._holdFrom!=null&&t>seg._holdFrom) t=seg._holdFrom; /* the camera stops when the footage does */ const D=Math.max(0.3,seg.end-seg.start), tl=Math.max(0,t-seg.start), p=Math.min(1,tl/D), d=seg._ddir||1, en={gentle:0.6,normal:1,bold:1.35}[$("camEnergy")?$("camEnergy").value:"normal"]||1, amp=(seg._amp?Math.min(1.4,seg._amp/2):1)*en;
  const beat=bi?Math.exp(-bi.ph*9)*(bi.down?1:0.45):0; let s=1, dx=0, dy=0, rot=0;
  switch(m){
    case "settle": s=1.07; dx=d*(p-0.5)*W*0.045*amp; break;
    case "push":   s=1.02+0.12*p*p*amp; break;                                    // accelerating into the chorus
    case "punch":  s=1.05+0.13*Math.exp(-tl*11)+0.025*beat*amp; break;           // lands hard, then breathes on the beat
    case "ride":   s=1.09+0.022*beat*amp; dx=d*(ease(p)-0.5)*W*0.07*amp; break;
    case "float":  s=1.08+0.02*Math.sin(p*Math.PI); dx=d*(p-0.5)*W*0.04; dy=-Math.sin(p*Math.PI)*H*0.015; rot=d*(p-0.5)*0.012; break;
    case "reveal": s=1.16-0.15*ease(p); break; }
  if(seg._land&&tl<0.45) s*=1+0.07*Math.pow(1-tl/0.45,2);                         // momentum from the cut before settles in
  if(seg._third){ const tx=0.5+seg._third*0.16; dx+=(tx-(seg._fx||0.5))*W*0.8; }
  const slackX=(s-1)*W/2*0.92, slackY=(s-1)*H/2*0.92; dx=Math.max(-slackX,Math.min(slackX,dx)); dy=Math.max(-slackY,Math.min(slackY,dy));
  return {s,dx,dy,rot}; }
/* lens character */
const LENS_INFO={natural:"Natural",telephoto:"Long lens: compressed, soft edges",anamorphic:"Anamorphic: streaked highlights, oval vignette",tiltshift:"Tilt-shift: miniature look",vintage:"Vintage glass: warm halation",dreamy:"Diffusion: soft glow"};
function lensFor(seg){ if(!has("lens")) return "natural"; const v=$("lens")?$("lens").value:"kit:cinema"; if(v==="tiltshift") return "tiltshift"; if(v==="none") return "natural"; const p=lensProfile(seg);
  return {modern:"natural",cooke:"telephoto",helios:"telephoto",petzval:"telephoto",anamorphic:"anamorphic",k35:"vintage",super8:"vintage",film16:"vintage",promist:"dreamy"}[p]||"natural"; } // the 2D look used when WebGL isn't available
let _lensC=null, _lensG=null;
function lensLayer(o,css){ const {W,H}=o, w=Math.max(16,Math.round(W/6)), h=Math.max(16,Math.round(H/6)); if(!_lensC){ _lensC=document.createElement("canvas"); _lensG=_lensC.getContext("2d"); }
  if(_lensC.width!==w||_lensC.height!==h){ _lensC.width=w; _lensC.height=h; } _lensG.filter=css||"none"; _lensG.clearRect(0,0,w,h); _lensG.drawImage(o.canvas,0,0,w,h); _lensG.filter="none"; return _lensC; }
function maskedLayer(o,layer,mask){ const {g,W,H}=o, w=layer.width, h=layer.height; // masked at a quarter size, so the full frame is touched once
  _lensG.globalCompositeOperation="destination-in"; _lensG.fillStyle=mask(_lensG,w,h); _lensG.fillRect(0,0,w,h); _lensG.globalCompositeOperation="source-over";
  g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high"; g.drawImage(layer,0,0,W,H); }
function lensFx(o,t,opts){ const seg=o._seg; if(!seg||!FILTER_OK) return; const lens=lensFor(seg), {g,W,H}=o, tl=t-seg.start;
  if(seg._rack&&tl>=0&&tl<0.4){ const a=Math.pow(1-tl/0.4,1.6); g.globalAlpha=a; g.imageSmoothingEnabled=true; g.drawImage(lensLayer(o,"blur(3.3px)"),0,0,W,H); g.globalAlpha=1; } // rack focus into the chorus
  if(opts&&opts.gpuDone&&lens!=="tiltshift") return;
  switch(lens){
    case "telephoto": maskedLayer(o,lensLayer(o,"blur(2px)"),(G,w,h)=>{ const gr=G.createRadialGradient(w/2,h*0.45,Math.min(w,h)*0.28,w/2,h*0.45,Math.hypot(w,h)*0.55); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,0.9)"); return gr; }); break;
    case "tiltshift": maskedLayer(o,lensLayer(o,"blur(2.6px) saturate(1.3)"),(G,w,h)=>{ const gr=G.createLinearGradient(0,0,0,h); gr.addColorStop(0,"rgba(0,0,0,1)"); gr.addColorStop(0.3,"rgba(0,0,0,0)"); gr.addColorStop(0.62,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,1)"); return gr; }); break;
    case "dreamy": g.globalCompositeOperation="screen"; g.globalAlpha=0.32; g.drawImage(lensLayer(o,"blur(4px)"),0,0,W,H); g.globalAlpha=1; g.globalCompositeOperation="source-over"; break;
    case "vintage": g.globalCompositeOperation="screen"; g.globalAlpha=0.22; g.drawImage(lensLayer(o,"blur(3.3px) sepia(0.8) saturate(2.4) hue-rotate(-18deg) brightness(0.9)"),0,0,W,H); g.globalAlpha=1; g.globalCompositeOperation="source-over"; break;
    case "streaks": case "anamorphic": { o._anaN=(o._anaN||0)+1; let keep=o._anaPts, w=o._anaW||1, h=o._anaH||1; // highlights found every fourth frame: streaks hold steady and cost little
      if(!keep||o._anaN%4===1||opts&&opts.still){ const L=lensLayer(o,"none"), lg=_lensG; w=L.width; h=L.height; const d=lg.getImageData(0,0,w,h).data, pts=[];
        for(let y=2;y<h-2;y+=2) for(let x=2;x<w-2;x+=2){ const i=(y*w+x)*4, l=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; if(l>242) pts.push([x,y,l]); }
        pts.sort((a,b)=>b[2]-a[2]); keep=[]; for(const p of pts){ if(keep.every(q=>Math.abs(q[1]-p[1])>3||Math.abs(q[0]-p[0])>w*0.2)) keep.push(p); if(keep.length>=5) break; } o._anaPts=keep; o._anaW=w; o._anaH=h; }
      g.globalCompositeOperation="screen"; for(const [x,y] of keep){ const X=x/w*W, Y=y/h*H, len=W*0.55, th=Math.max(2,H*0.004); const gr=g.createLinearGradient(X-len,0,X+len,0); gr.addColorStop(0,"rgba(90,150,255,0)"); gr.addColorStop(0.5,"rgba(150,200,255,0.55)"); gr.addColorStop(1,"rgba(90,150,255,0)"); g.fillStyle=gr; g.fillRect(X-len,Y-th/2,len*2,th); }
      g.globalCompositeOperation="source-over"; if(lens==="streaks") break; if(!o._oval){ const gr=g.createRadialGradient(0,0,0.55,0,0,1.05); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,0.45)"); o._oval=gr; }
      g.save(); g.translate(W/2,H/2); g.scale(W*0.62,H*0.5); g.fillStyle=o._oval; g.fillRect(-1,-1.2,2,2.4); g.restore(); break; } }
}
