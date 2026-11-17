/* ---------------- Reverse shots (rewind moments) ---------------- */
function assignReverse(segs,short){
  segs.forEach(s=>{ if(!s._manualRev) s._rev=false; });
  if(!$("fxReverse")||!$("fxReverse").checked||typeof VideoDecoder==="undefined"||$("clipSound").checked) return;
  const len=segs.length?segs[segs.length-1].end-segs[0].start:0, max=short?(len>20?2:1):Math.max(1,Math.round(len/30)), gap=short?6:20, r=rng((S.seed||1)*29+11); let last=-99, made=0;
  const cands=segs.map((s,i)=>[s,i]).filter(([s,i])=>{ const c=S.clips[s.clip], D=s.end-s.start; if(!c||c.kind==="image"||i===0||i===segs.length-1) return false;
    if(s._ramp||s._freeze||s._refrain||s._manual||s._loop||s._bookend||s._pattern||s.drop||D<0.8||D>2.4||s.src+D>c.dur-0.1) return false;
    const sm=c.samples&&c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]); return sm&&(sm.motion||0)>=1.2&&s.e>0.3&&s.e<0.85; })
    .map(([s,i])=>[s,i,r()]).sort((a,b)=>a[2]-b[2]);
  for(const [s] of cands){ if(made>=max) break; if(Math.abs(s.start-last)<gap) continue; s._rev=true; last=s.start; made++; }
}

function beatInfo(t){
  const B=S.an.beats; let lo=0,hi=B.length-1,i=-1;
  while(lo<=hi){ const m=(lo+hi)>>1; if(B[m]<=t){ i=m; lo=m+1; } else hi=m-1; }
  if(i<0) return {i:-1,ph:9,e:0,down:false,drop:false};
  const E=S.an.E;
  return {i, ph:t-B[i], e:E[i], down:isDownAt(S.an,i), drop:i>=4 && E[i]-E[i-4]>0.3};
}
function readFx(){
  const look=LOOKS[$("look").value]||LOOKS.none;
  return { fit:$("fit").value, zoom:+$("zoom").value, kb:$("kb").checked, filter:look.f, look,
    pulse:$("fxPulse").checked, shake:$("fxShake").checked, glitch:$("fxGlitch").checked,
    grain:$("fxGrain").checked, vignette:$("fxVignette").checked, bars:$("fxBars").checked,
    hook:$("hookText").value.trim(), end:$("endText").value.trim(),
    fisheye:$("fxFisheye").checked, split:$("fxSplit").checked, multiply:$("fxMultiply").checked, mirror:$("fxMirror").checked,
    strobe:$("fxStrobe").checked, handheld:$("fxHandheld").checked, wash:$("fxWash").checked, doodles:$("fxDoodles").checked,
    slowmo:$("slowmo").value, still:$("stillMotion").value, textStyle:$("textStyle").value,
    brand:$("brandMode").value, brandPos:$("brandPos").value, brandSize:+$("brandSize").value, brandOpacity:+$("brandOpacity").value,
    brandText:$("brandText").value.trim(), brandOutro:$("brandOutro").checked, brandSkipTv:$("brandSkipTv").checked,
    leaks:$("ovLeaks").checked, bokeh:$("ovBokeh").checked, dust:$("ovDust").checked, lower:$("ovLower").value.trim() };
}
let noiseCanvas=null;
function noise(){ if(noiseCanvas) return noiseCanvas; const c=document.createElement("canvas"); c.width=c.height=256; const g=c.getContext("2d");
  const d=g.createImageData(256,256); for(let i=0;i<d.data.length;i+=4){ const v=Math.random()*255; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; }
  g.putImageData(d,0,0); noiseCanvas=c; return c; }

function drawPicture(o,plan,cur,t,pool,F){
  const {g,W,H}=o, seg=plan[cur], clip=S.clips[seg.clip], tr=seg.tr, local=t-seg.start; let el=srcOf(pool,cur);
  const inTr=cur>0 && tr && tr.dur>0 && local<tr.dur;
  const prev=cur>0?plan[cur-1]:null, oel=cur>0?srcOf(pool,cur-1):null, oclip=prev?S.clips[prev.clip]:null;
  const thumbOf=c=>{ if(!c._ti){ c._ti=new Image(); c._ti.src=c.thumb; } return c._ti; };
  if(!ready(el) && clip.kind!=="image" && clip.thumb && ready(thumbOf(clip))) el=thumbOf(clip);
  if(!ready(el) && !(inTr && ready(oel))) return false;
  const bi=beatInfo(t);
  let ps=1, sx=0, sy=0;
  if(F.pulse) ps+=0.035*Math.exp(-bi.ph*10)*(0.4+0.6*bi.e)*(bi.down?1.4:1);
  if(F.handheld){ sx+=Math.sin(t*1.3)*W*0.007+Math.sin(t*3.1)*W*0.002; sy+=Math.cos(t*1.7)*H*0.007; ps+=0.03; }
  if(F.shake && bi.e>0.66 && bi.down){ const a=Math.min(W,H)*0.014*Math.exp(-bi.ph*9); sx+=a*Math.sin(t*93); sy+=a*Math.cos(t*71); ps+=0.02; }
  g.globalAlpha=1; g.globalCompositeOperation="source-over"; g.fillStyle="#000"; g.fillRect(0,0,W,H);
  let ks=kbScale(F,seg,t)*ps, ex=null, ox=0, oy=0;
  { const mv=moveOf(seg,t,W,H,bi); ks*=mv.s; ox+=mv.dx; oy+=mv.dy; }
  o._seg=seg; { const dm=clip.kind!=="image"&&directorMove(seg,t,W,H,bi); if(dm){ ks*=dm.s; ox+=dm.dx; oy+=dm.dy; if(dm.rot) ex={...(ex||{}),rot:dm.rot}; } }
  if(clip.kind==="image"){ const m=stillMotion(F,seg,cur,t,W,H); ks*=m.s; ox=m.dx||0; oy=m.dy||0; ex=m; }
  if(seg._focus){ ex={...(ex||{}),focus:seg._focus,prog:(t-seg.start)/Math.max(0.3,seg.end-seg.start)}; }
  const D=(o2,v2,c2,F2,sc,dx,dy)=>drawClip(o2,v2,c2,F2,sc,dx+ox,dy+oy,ex);
  if(!inTr) D(o,el,clip,F,ks,sx,sy);
  else {
    const p=ease(Math.min(1,local/tr.dur)); let oks=kbScale(F,prev,t)*ps, oex=null; const pdm=oclip.kind!=="image"&&directorMove(prev,t,W,H,bi); if(pdm){ oks*=pdm.s; oex={dx0:pdm.dx,dy0:pdm.dy}; }
    if(oclip.kind==="image"){ const m=stillMotion(F,prev,cur-1,t,W,H); oks*=m.s; oex={...m,dx0:m.dx||0,dy0:m.dy||0}; }
    if(prev._focus){ oex={...(oex||{dx0:0,dy0:0}),focus:prev._focus,prog:1}; }
    const OD=(sc,dx,dy)=>drawClip(o,oel,oclip,F,sc,dx+(oex?oex.dx0:0),dy+(oex?oex.dy0:0),oex);
    switch(tr.type){
      case "crossfade": OD(oks,sx,sy); g.globalAlpha=p; D(o,el,clip,F,ks,sx,sy); g.globalAlpha=1; break;
      case "dip": if(p<0.5){ OD(oks,sx,sy); g.fillStyle=`rgba(0,0,0,${p*2})`; } else { D(o,el,clip,F,ks,sx,sy); g.fillStyle=`rgba(0,0,0,${(1-p)*2})`; } g.fillRect(0,0,W,H); break;
      case "flash": D(o,el,clip,F,ks,sx,sy); g.fillStyle=`rgba(255,255,255,${(1-p)*0.9})`; g.fillRect(0,0,W,H); break;
      case "zoom": D(o,el,clip,F,ks*(1+0.22*(1-p)*(1-p)),sx,sy); break;
      case "zoomout": { const a=ease(p); D(o,el,clip,F,ks*(1.14-0.14*a),sx,sy); g.globalAlpha=Math.max(0,1-a*1.15); OD(oks*(1-0.42*a),sx,sy); g.globalAlpha=1; break; } // the old shot shrinks away, revealing the new one
      case "zoomthru": { // punch through the outgoing shot and land in the new one
        const ghosts=(drawFn,base,amt)=>{ for(let k=3;k>=1;k--){ g.globalAlpha=0.18; drawFn(base*(1+amt*k*0.06)); } g.globalAlpha=1; drawFn(base); };
        if(p<0.5){ const a=ease(p*2); ghosts(sc=>OD(oks*sc,sx,sy),1+0.9*a,a); }
        else { const a=ease((p-0.5)*2); ghosts(sc=>D(o,el,clip,F,ks*sc,sx,sy),1.6-0.6*a,1-a); }
        break; }
      case "spin": { const a=p<0.5?ease(p*2):ease((p-0.5)*2);
        g.save(); g.translate(W/2,H/2);
        if(p<0.5){ g.rotate(0.7*a); g.scale(1+0.35*a,1+0.35*a); g.translate(-W/2,-H/2); OD(oks,sx,sy); }
        else { g.rotate(-0.7*(1-a)); g.scale(1.35-0.35*a,1.35-0.35*a); g.translate(-W/2,-H/2); D(o,el,clip,F,ks,sx,sy); }
        g.restore(); break; }
      case "mask": { // an object sweeps across the lens, revealing the next shot behind it
        const edge=-0.2*W+1.4*W*ease(p);
        D(o,el,clip,F,ks,sx,sy);
        g.save(); g.beginPath(); g.rect(edge,0,W-edge+2,H); g.clip(); OD(oks,sx,sy); g.restore();
        const bw=W*0.28, gr=g.createLinearGradient(edge-bw/2,0,edge+bw/2,0);
        gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(0.35,"rgba(8,8,10,0.92)"); gr.addColorStop(0.65,"rgba(8,8,10,0.92)"); gr.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=gr; g.fillRect(edge-bw/2,0,bw,H); break; }
      case "whip":
        OD(oks,-p*W+sx,sy);
        g.globalAlpha=0.35; D(o,el,clip,F,ks,(1-p)*W+W*0.04+sx,sy); g.globalAlpha=1;
        D(o,el,clip,F,ks,(1-p)*W+sx,sy); break;
      default: D(o,el,clip,F,ks,sx,sy);
    }
  }
  return bi;
}

function scratch(o){ if(!o.sc){ o.sc=document.createElement("canvas"); o.sc.width=o.W; o.sc.height=o.H; o.scg=o.sc.getContext("2d"); } return o.sc; }
function snap(o){ const sc=scratch(o); o.scg.globalCompositeOperation="copy"; o.scg.drawImage(o.g.canvas,0,0); o.scg.globalCompositeOperation="source-over"; return sc; }
function fisheyeFx(o,amt){
  const {g,W,H}=o, N=24;
  let sc=snap(o); g.fillStyle="#000"; g.fillRect(0,0,W,H);
  for(let i=0;i<N;i++){ const y=i*H/N, c=((i+0.5)/N-0.5)*2, k=1+amt*(1-c*c), w=W*k; g.drawImage(sc,0,y,W,H/N+1,(W-w)/2,y,w,H/N+1); }
  sc=snap(o); g.fillRect(0,0,W,H);
  for(let i=0;i<N;i++){ const x=i*W/N, c=((i+0.5)/N-0.5)*2, k=1+amt*(1-c*c), hh=H*k; g.drawImage(sc,x,0,W/N+1,H,x,(H-hh)/2,W/N+1,hh); }
  const gr=g.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.hypot(W,H)*0.52); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,0.7)");
  g.fillStyle=gr; g.fillRect(0,0,W,H);
}
function mirrorFx(o){ const {g,W,H}=o, sc=snap(o); g.save(); g.translate(W,0); g.scale(-1,1); g.drawImage(sc,0,0,W/2,H,0,0,W/2,H); g.restore(); }
function multiplyFx(o,bi){
  if(!bi||bi.i<0||bi.e<0.45) return;
  const n=[1,2,3,2][((bi.i-S.an.down)%4+4)%4]; if(n<2) return;
  const {g,W,H}=o, sc=snap(o), w=W/n, hh=H/n;
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) g.drawImage(sc,0,0,W,H,c*w,r*hh,w+1,hh+1);
}
function splitFx(o,t){
  const {g,W,H}=o, bh=Math.round(H*0.16), sc=snap(o), mw=bh*W/H;
  g.fillStyle="#000"; g.fillRect(0,0,W,bh); g.fillRect(0,H-bh,W,bh);
  const off=(t*mw*0.25)%mw;
  for(let x=-mw+off;x<W;x+=mw+4){ g.drawImage(sc,x,2,mw,bh-4); g.drawImage(sc,W-x-mw,H-bh+2,mw,bh-4); }
}
function strobeFx(o,bi){ if(!bi||!(bi.e>0.7&&bi.down&&bi.ph<0.2)) return; const {g,W,H}=o, f=Math.floor(bi.ph*30)%2; g.fillStyle=f?"rgba(0,0,0,0.75)":"rgba(255,255,255,0.8)"; g.fillRect(0,0,W,H); }
function washFx(o,bi){ if(!bi||bi.i<0) return; const {g,W,H}=o, bar=Math.floor((bi.i-S.an.down)/4), hu=((bar*67)%360+360)%360;
  g.globalCompositeOperation="soft-light"; g.fillStyle=`hsla(${hu},85%,50%,0.45)`; g.fillRect(0,0,W,H); g.globalCompositeOperation="source-over"; }
const DOODLE_COLS=["#FFE14D","#FF4FA3","#4DE1FF","#7CFF4D","#FFFFFF","#FF8A3D"];
function doodleFx(o,t){
  const {g,W,H}=o, B=S.an.beats, bi=beatInfo(t); if(bi.i<0) return;
  const m=Math.min(W,H);
  for(const bIdx of [bi.i-1,bi.i]){
    if(bIdx<0||S.an.E[bIdx]<0.45) continue;
    const age=t-B[bIdx]; if(age>0.55) continue;
    const r=rng(bIdx*104729+7), life=1-age/0.55, pop=Math.min(1,age/0.08);
    g.save(); g.globalAlpha=life; g.lineCap="round"; g.lineJoin="round"; g.lineWidth=m*0.009;
    for(let k=0;k<3;k++){
      const side=Math.floor(r()*4), u=r(); let x,y;
      if(side===0){ x=u*W; y=H*(0.08+r()*0.12); } else if(side===1){ x=u*W; y=H*(0.8+r()*0.12); } else if(side===2){ x=W*(0.06+r()*0.12); y=u*H; } else { x=W*(0.82+r()*0.12); y=u*H; }
      const s=m*(0.035+r()*0.04)*pop, kind=Math.floor(r()*4); g.strokeStyle=DOODLE_COLS[Math.floor(r()*DOODLE_COLS.length)];
      g.beginPath();
      if(kind===0){ for(let p=0;p<=10;p++){ const a=-Math.PI/2+p*Math.PI/5, rr=p%2?s*0.45:s; g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); } }
      else if(kind===1){ for(let p=0;p<=40;p++){ const a=p*0.45, rr=s*p/40; g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); } }
      else if(kind===2){ for(let p=0;p<=16;p++){ g.lineTo(x-s+p*s/8,y+Math.sin(p*1.6)*s*0.35); } }
      else { for(let p=0;p<8;p++){ const a=p*Math.PI/4; g.moveTo(x+Math.cos(a)*s*0.35,y+Math.sin(a)*s*0.35); g.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s); } }
      g.stroke();
    }
    g.restore();
  }
}

/* Shorts progress border: a fine rounded outline that fills clockwise from the top as the video plays, finishing on the last frame */
function borderPost(o,t,win,F){
  const ep=o.ep, mode=$("progBorder")?$("progBorder").value:"off"; if(!ep||mode==="off"||F._thumb) return;
  if(!ep.short&&$("progScope")&&$("progScope").value!=="all") return;
  const {g,W,H}=o, u=Math.min(W,H), tall=H>W;
  // one inset on every side, so the line sits the same distance from the top as from the sides
  const m=Math.round(u*0.038), mx=m, my=m, r=u*0.055, lw=Math.max(2,u*0.0055), x=mx, y=my, w=W-2*mx, hh=H-2*my;
  const p=Math.max(0,Math.min(1,(t-win[0])/Math.max(0.1,win[1]-win[0]-1/30)));
  const rr=()=>{ g.moveTo(x+w/2,y); g.lineTo(x+w-r,y); g.arcTo(x+w,y,x+w,y+r,r); g.lineTo(x+w,y+hh-r); g.arcTo(x+w,y+hh,x+w-r,y+hh,r); g.lineTo(x+r,y+hh); g.arcTo(x,y+hh,x,y+hh-r,r); g.lineTo(x,y+r); g.arcTo(x,y,x+r,y,r); g.closePath(); };
  g.save();
  if(mode==="frame"){ g.beginPath(); g.rect(0,0,W,H); rr(); g.fillStyle="#000"; g.fill("evenodd"); }
  const op=Math.max(0.1,Math.min(1,+($("progOpacity")?$("progOpacity").value:0.8)||0.8)), over=mode!=="frame";
  const dark=$("progColor")&&$("progColor").value==="black", ink=dark?"#111":"#fff", rgb=dark?"0,0,0":"255,255,255", edge=dark?"255,255,255":"0,0,0";
  const drop=!$("progShadow")||$("progShadow").checked, drain=$("progDir")&&$("progDir").value==="drain";
  g.lineWidth=lw; g.lineJoin="round"; g.beginPath(); rr(); g.strokeStyle=`rgba(${rgb},${(over?0.22:0.2)*op})`; g.stroke();
  const P=2*(w-2*r)+2*(hh-2*r)+2*Math.PI*r, len=drain?P*(1-p):P*p;
  if(len>0.5){ g.setLineDash([len,P*2]); g.lineDashOffset=drain?-P*p:0; g.lineCap="round"; g.globalAlpha=op; // a countdown line is erased from its start, following the same direction
    if(over&&!drop){ g.strokeStyle=`rgba(${edge},0.35)`; g.shadowColor=`rgba(${edge},0.6)`; g.shadowBlur=lw*2; g.lineWidth=lw*1.6; g.beginPath(); rr(); g.stroke(); g.lineWidth=lw; } // a soft contrasting edge so the line reads over any footage
    g.strokeStyle=ink;
    if(drop){ g.shadowColor="rgba(0,0,0,0.8)"; g.shadowBlur=lw*1.4; g.shadowOffsetX=lw*1.2; g.shadowOffsetY=lw*1.8; } // drop shadow: lifted off the picture, light from top left
    else { g.shadowColor=`rgba(${rgb},0.7)`; g.shadowBlur=lw*2.5; }
    g.beginPath(); rr(); g.stroke(); }
  g.restore();
}
function postFx(o,t,win,F,bi,opts={}){
  const {g,W,H,ep}=o;
  lensFx(o,t,opts);
  if(F.fisheye) fisheyeFx(o,0.22);
  if(F.mirror) mirrorFx(o);
  motifPost(o,t,F,bi,opts,win);
  endingPost(o,t,win,F);
  if(F.multiply) multiplyFx(o,bi);
  if(F.look.grad) for(const [mode,col,cx,cy] of F.look.grad){ const gr=g.createRadialGradient(W*cx,H*cy,0,W*cx,H*cy,Math.hypot(W,H)*0.6); gr.addColorStop(0,col); gr.addColorStop(1,"rgba(0,0,0,0)"); g.globalCompositeOperation=mode; g.fillStyle=gr; g.fillRect(0,0,W,H); }
  g.globalCompositeOperation="source-over";
  if(F.wash) washFx(o,bi);
  if(F.look.over) for(const [mode,col] of F.look.over){ g.globalCompositeOperation=mode; g.fillStyle=col; g.fillRect(0,0,W,H); }
  g.globalCompositeOperation="source-over";
  if(F.glitch && !opts.still && bi && (bi.drop || (bi.down && bi.e>0.82)) && bi.ph<0.22){
    const r=rng(bi.i*7919+1), n=7;
    for(let k=0;k<n;k++){ const y=r()*H, hh=H*(0.02+r()*0.07), off=(r()-0.5)*W*0.08*(1-bi.ph/0.22);
      g.drawImage(g.canvas,0,y,W,hh,off,y,W,hh); }
    g.globalCompositeOperation="screen"; g.globalAlpha=0.25; g.drawImage(g.canvas,W*0.008,0); g.globalAlpha=1; g.globalCompositeOperation="source-over";
  }
  if(F.look.scan){ g.fillStyle="rgba(0,0,0,0.13)"; const step=Math.max(2,Math.round(H/360)); for(let y=0;y<H;y+=step*2) g.fillRect(0,y,W,step); }
  if(F.grain){ const pat=g.createPattern(noise(),"repeat"); const rx=(Math.random()*256)|0, ry=(Math.random()*256)|0;
    g.save(); g.globalCompositeOperation="overlay"; g.globalAlpha=0.12; g.translate(-rx,-ry); g.fillStyle=pat; g.fillRect(rx,ry,W,H); g.restore(); }
  if(F.vignette){ if(!o.vig){ const gr=g.createRadialGradient(W/2,H/2,Math.min(W,H)*0.42,W/2,H/2,Math.hypot(W,H)*0.55); gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,0.55)"); o.vig=gr; }
    g.fillStyle=o.vig; g.fillRect(0,0,W,H); }
  if(F.strobe && !opts.still) strobeFx(o,bi);
  if(F.split) splitFx(o,t);
  else if(F.bars && W>=H){ const bh=Math.max(0,(H-W/2.39)/2); g.fillStyle="#000"; g.fillRect(0,0,W,bh); g.fillRect(0,H-bh,W,bh); }
  if(F.doodles) doodleFx(o,opts.still?beatInfo(t).i>=0?S.an.beats[beatInfo(t).i]+0.12:t:t);
  { const len0=win[1]-win[0], lt0=t-win[0];
    if(PRO() && ep.id==="youtube" && len0>=25 && lt0>len0-20){ const a=Math.min(1,(lt0-(len0-20))/2)*0.32; g.fillStyle=`rgba(0,0,0,${a})`; g.fillRect(0,0,W,H); } }
  drawOverlays(o,t,win,F,opts.still);
  drawText(o,t,win,F,bi);
  drawLyric(o,t,F);
  drawBrand(o,t,win,F);
  borderPost(o,t,win,F);
  const len=win[1]-win[0], {fi,fo}=fadeTimes(len,ep), lt=t-win[0];
  let a=0; if(fi && lt<fi) a=1-lt/fi; if(fo && lt>len-fo) a=Math.max(a,(lt-(len-fo))/fo);
  if(a>0 && !opts.still){ g.fillStyle=`rgba(0,0,0,${Math.min(1,a)})`; g.fillRect(0,0,W,H); }
  if(opts.guides){ const s=ep.safe; g.save(); g.setLineDash([W*0.015,W*0.01]); g.lineWidth=Math.max(2,W/400); g.strokeStyle="rgba(255,214,90,0.9)";
    g.strokeRect(W*s.l,H*s.t,W*(1-s.l-s.r),H*(1-s.t-s.b)); g.restore(); }
}

S.overlays=[];
S.recLat=(()=>{ try{ const v=parseFloat(localStorage.getItem("beatsplicerRecLat")); return isFinite(v)?v:0.11; }catch(e){ return 0.11; } })();
S.recTail=(()=>{ try{ const v=parseFloat(localStorage.getItem("beatsplicerRecTail")); return isFinite(v)?v:0.2; }catch(e){ return 0.2; } })();
function saveCalib(){ try{ localStorage.setItem("beatsplicerRecLat",String(S.recLat)); localStorage.setItem("beatsplicerRecTail",String(S.recTail)); }catch(e){} }
S.brand={img:null,dataUrl:""};
function drawBrand(o,t,win,F){
  const {g,W,H,ep}=o, B=S.brand, hasLogo=!!(B.img&&B.img.complete&&B.img.naturalWidth), txt=F.brandText;
  if(F.brand==="off" || (!hasLogo && !txt) || (F.brandSkipTv && ep.id==="tv")) return;
  const lt=t-win[0], len=win[1]-win[0], m=Math.min(W,H), s=ep.safe;
  const outroOn=F.brandOutro && hasLogo && len>6 && !(PRO()&&ep.short), inOutro=outroOn && lt>len-3;
  const endZone=PRO() && ep.id==="youtube" && len>=25 && lt>len-20;
  if(endZone && !inOutro){ return; }
  g.save();
  if(F.brand==="tiled"||F.brand==="both"){
    g.globalAlpha=F.brand==="tiled"?Math.min(0.28,F.brandOpacity*0.35):0.08;
    g.translate(W/2,H/2); g.rotate(-Math.PI/7);
    const cell=m*0.42, diag=Math.hypot(W,H);
    g.font=`700 ${Math.round(m*0.035)}px "Archivo", system-ui, sans-serif`; g.fillStyle="#fff"; g.textAlign="center"; g.textBaseline="middle";
    let row=0;
    for(let y=-diag/2;y<diag/2;y+=cell*0.55,row++) for(let x=-diag/2+(row%2?cell/2:0);x<diag/2;x+=cell){
      if(hasLogo){ const lw=m*0.09, lh=lw*B.img.naturalHeight/B.img.naturalWidth; g.drawImage(B.img,x-lw/2,y-lh/2-(txt?m*0.025:0),lw,lh); if(txt) g.fillText(txt,x,y+lh/2); }
      else g.fillText(txt,x,y);
    }
    g.setTransform(1,0,0,1,0,0);
  }
  if((F.brand==="corner"||F.brand==="both") && !inOutro){
    g.globalAlpha=F.brandOpacity;
    const lw=hasLogo?m*F.brandSize:0, lh=hasLogo?lw*B.img.naturalHeight/B.img.naturalWidth:0, fs=Math.round(m*Math.max(0.022,F.brandSize*0.24));
    g.font=`700 ${fs}px "Archivo", system-ui, sans-serif`; const tw=txt?g.measureText(txt).width:0;
    const bw=Math.max(lw,tw), bh=lh+(txt?fs*1.3:0)+(hasLogo&&txt?fs*0.2:0);
    const right=F.brandPos[1]==="r", bottom=F.brandPos[0]==="b";
    const x=right?W*(1-s.r)-bw:W*s.l, y=bottom?H*(1-s.b)-bh:H*s.t;
    g.shadowColor="rgba(0,0,0,0.45)"; g.shadowBlur=m*0.01;
    if(hasLogo) g.drawImage(B.img,right?x+bw-lw:x,y,lw,lh);
    if(txt){ g.fillStyle="#fff"; g.textAlign=right?"right":"left"; g.textBaseline="top"; g.fillText(txt,right?x+bw:x,y+lh+(hasLogo?fs*0.2:0)); }
    g.shadowBlur=0;
  }
  if(inOutro){
    const k=Math.min(1,(lt-(len-3))/0.5); g.globalAlpha=ease(k);
    const lw=m*0.34, lh=lw*B.img.naturalHeight/B.img.naturalWidth, cy=F.end?H*0.3:H/2;
    const sc=0.9+0.1*ease(k); g.translate(W/2,cy); g.scale(sc,sc); g.drawImage(B.img,-lw/2,-lh/2,lw,lh);
    if(txt){ g.font=`700 ${Math.round(m*0.04)}px "Archivo", system-ui, sans-serif`; g.fillStyle="#fff"; g.textAlign="center"; g.textBaseline="top"; g.fillText(txt,0,lh/2+m*0.02); }
  }
  g.restore();
}
async function setBrandLogo(file){
  if(!file||!isImage(file)) return;
  const url=URL.createObjectURL(file), img=new Image(); img.src=url;
  try{ await img.decode(); }catch(e){ status("Couldn’t read that logo.",true); return; }
  const k=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
  c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k); c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  URL.revokeObjectURL(url);
  await useBrandData(c.toDataURL("image/png"));
  if($("brandMode").value==="off") $("brandMode").value="corner";
  saveBrand(); status("Logo set as your watermark.");
}
async function useBrandData(dataUrl){
  const img=new Image(); img.src=dataUrl; try{ await img.decode(); }catch(e){ return; }
  S.brand={img,dataUrl};
  const p=$("brandPreview"); p.innerHTML=""; const im=document.createElement("img"); im.src=dataUrl; im.alt="Your logo";
  im.style.cssText="height:44px;max-width:160px;object-fit:contain;vertical-align:middle;background:repeating-conic-gradient(#9993 0 25%,#0000 0 50%) 0 0/10px 10px;border-radius:6px";
  const rm=document.createElement("button"); rm.className="chip"; rm.type="button"; rm.textContent="Remove logo"; rm.style.marginLeft="8px";
  rm.onclick=()=>{ S.brand={img:null,dataUrl:""}; p.innerHTML=""; saveBrand(); };
  p.append(im,rm);
}
const BRAND_IDS=["brandText","brandMode","brandPos","brandSize","brandOpacity","brandOutro","brandSkipTv","brandKeep"];
function saveBrand(){ try{
  if(!$("brandKeep").checked){ localStorage.removeItem("beatsplicerBrand"); return; }
  const v={logo:S.brand.dataUrl}; BRAND_IDS.forEach(id=>{ const el=$(id); v[id]=el.type==="checkbox"?el.checked:el.value; });
  localStorage.setItem("beatsplicerBrand",JSON.stringify(v)); }catch(e){ status("Your logo is too large to remember on this device; it still works for this session."); } }
function loadBrand(){ try{ const v=JSON.parse(localStorage.getItem("beatsplicerBrand")||"null"); if(!v) return;
  BRAND_IDS.forEach(id=>{ if(id in v) setControl(id,v[id]); }); if(v.logo && /^data:image\/png;base64,/.test(v.logo)) useBrandData(v.logo); }catch(e){} }
function leaksFx(o,t){ const {g,W,H}=o; g.save(); g.globalCompositeOperation="screen";
  [[0.2,0.3,"255,150,60"],[0.8,0.6,"255,60,120"],[0.5,0.9,"255,220,120"]].forEach(([x,y,c],i)=>{
    const cx=W*(x+0.15*Math.sin(t*0.31+i*2)), cy=H*(y+0.12*Math.cos(t*0.23+i)), r=Math.max(W,H)*(0.45+0.1*Math.sin(t*0.5+i));
    const a=0.22+0.12*Math.sin(t*0.7+i*1.7);
    const gr=g.createRadialGradient(cx,cy,0,cx,cy,r); gr.addColorStop(0,`rgba(${c},${a})`); gr.addColorStop(1,`rgba(${c},0)`); g.fillStyle=gr; g.fillRect(0,0,W,H); });
  g.restore(); }
function bokehFx(o,t,bi){ const {g,W,H}=o, r=rng(42), m=Math.min(W,H), pulse=bi?1+0.6*Math.exp(-bi.ph*6)*(bi.e||0):1;
  g.save(); g.globalCompositeOperation="screen";
  for(let k=0;k<22;k++){ const x=r()*W, sp=0.02+r()*0.05, y=((r()-t*sp)%1+1)%1*H, rad=m*(0.01+r()*0.03)*pulse, a=0.12+r()*0.18;
    const gr=g.createRadialGradient(x,y,0,x,y,rad); gr.addColorStop(0,`rgba(255,240,210,${a})`); gr.addColorStop(0.7,`rgba(255,220,170,${a*0.6})`); gr.addColorStop(1,"rgba(255,220,170,0)");
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,rad,0,Math.PI*2); g.fill(); }
  g.restore(); }
function dustFx(o,t){ const {g,W,H}=o, f=Math.floor(t*24), r=rng(f*31+5), m=Math.min(W,H);
  g.save(); g.fillStyle="rgba(240,240,230,0.55)";
  for(let k=0;k<14;k++){ const s=m*(0.0015+r()*0.004); g.beginPath(); g.ellipse(r()*W,r()*H,s,s*(0.4+r()),r()*3,0,Math.PI*2); g.fill(); }
  if(r()<0.6){ g.strokeStyle="rgba(230,230,220,0.35)"; g.lineWidth=Math.max(1,m*0.0015); const x=r()*W; g.beginPath(); g.moveTo(x,0); g.lineTo(x+(r()-0.5)*W*0.02,H); g.stroke(); }
  g.restore(); }
function ovRect(o,ov,iw,ih){
  const {W,H,ep}=o, s=ep.safe, w=Math.min(W,H)*ov.size*(W>=H?1:1.3), h=w*ih/iw;
  const x0=W*s.l, x1=W*(1-s.r), y0=H*s.t, y1=H*(1-s.b);
  const pos={tl:[x0,y0],tr:[x1-w,y0],bl:[x0,y1-h],br:[x1-w,y1-h],c:[(W-w)/2,(H-h)/2],t:[(W-w)/2,y0],b:[(W-w)/2,y1-h]}[ov.pos]||[x1-w,y1-h];
  return [pos[0],pos[1],w,h];
}
function drawOverlays(o,t,win,F,still){
  const {g,W,H,ep}=o, lt=t-win[0], len=win[1]-win[0], bi=beatInfo(t);
  if(F.leaks) leaksFx(o,t);
  if(F.bokeh) bokehFx(o,t,bi);
  if(F.dust && !still) dustFx(o,t);
  for(const ov of S.overlays){
    if(!ov.img || !ov.img.complete) continue;
    let a=ov.opacity;
    if(ov.timing==="intro"){ if(lt>4.5) continue; a*=Math.min(1,(4.5-lt)/0.5); }
    else if(ov.timing==="outro"){ if(lt<len-4.5) continue; a*=Math.min(1,(lt-(len-4.5))/0.5); }
    else if(ov.timing==="beats"){ if(!(bi.e>0.45)) continue; a*=Math.exp(-bi.ph*5); }
    let [x,y,w,hh]=ovRect(o,ov,ov.img.naturalWidth||1,ov.img.naturalHeight||1), sc=1;
    if(ov.anim==="fade") a*=Math.min(1,lt/0.6,(len-lt)/0.6);
    if(ov.anim==="pop") sc=1+0.14*Math.exp(-bi.ph*8)*(bi.down?1.3:0.7);
    if(ov.anim==="float") y+=Math.sin(t*1.4)*H*0.008;
    if(a<=0.01) continue;
    g.save(); g.globalAlpha=Math.min(1,a); g.globalCompositeOperation=ov.blend;
    g.translate(x+w/2,y+hh/2); g.scale(sc,sc); g.drawImage(ov.img,-w/2,-hh/2,w,hh); g.restore();
  }
  if(F.lower && lt>1 && lt<6.5){
    const s=ep.safe, fs=Math.round(Math.min(W,H)*0.042), k=Math.min(1,(lt-1)/0.45), out=Math.min(1,(6.5-lt)/0.45), e=ease(Math.min(k,out));
    g.save(); g.font=`700 ${fs}px "Archivo", system-ui, sans-serif`; const tw=g.measureText(F.lower).width;
    const x=W*s.l, y=H*(1-s.b)-fs*2.2, pad=fs*0.6, bw=(tw+pad*2)*e;
    g.fillStyle="rgba(0,0,0,0.6)"; g.fillRect(x,y,bw,fs*1.7);
    g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--cobalt")||"#2B59D9"; g.fillRect(x,y,Math.max(4,fs*0.18),fs*1.7);
    g.beginPath(); g.rect(x,y,bw,fs*1.7); g.clip(); g.fillStyle="#fff"; g.textBaseline="middle"; g.fillText(F.lower,x+pad,y+fs*0.87); g.restore();
  }
}
function renderOverlays(){
  const box=$("ovList"); box.innerHTML="";
  S.overlays.forEach((ov,i)=>{
    const row=document.createElement("div"); row.className="ovrow";
    const im=document.createElement("img"); im.src=ov.url; im.alt=""; row.appendChild(im);
    const grid=document.createElement("div"); grid.className="grid2";
    const sel=(label,key,opts)=>{ const l=document.createElement("label"); l.textContent=label; const s=document.createElement("select");
      opts.forEach(([v,t])=>{ const o=document.createElement("option"); o.value=v; o.textContent=t; s.appendChild(o); }); s.value=ov[key];
      s.onchange=()=>{ ov[key]=s.value; }; l.appendChild(s); grid.appendChild(l); };
    const rng_=(label,key,min,max,step)=>{ const l=document.createElement("label"); l.textContent=label; const r=document.createElement("input"); r.type="range"; r.min=min; r.max=max; r.step=step; r.value=ov[key];
      r.oninput=()=>{ ov[key]=+r.value; }; l.appendChild(r); grid.appendChild(l); };
    sel("Position","pos",[["br","Bottom right"],["bl","Bottom left"],["tr","Top right"],["tl","Top left"],["c","Centre"],["t","Top centre"],["b","Bottom centre"]]);
    sel("When","timing",[["all","Whole video"],["intro","First seconds"],["outro","Last seconds"],["beats","Flash on beats"]]);
    sel("Motion","anim",[["none","Still"],["fade","Fade in and out"],["pop","Pop on the beat"],["float","Gentle float"]]);
    sel("Blend","blend",[["source-over","Normal"],["screen","Screen (for light effects)"],["multiply","Multiply (for textures)"],["overlay","Overlay"]]);
    rng_("Size","size",0.05,0.8,0.01); rng_("Opacity","opacity",0.1,1,0.05);
    row.appendChild(grid);
    const x=document.createElement("button"); x.className="x"; x.textContent="×"; x.setAttribute("aria-label","Remove "+ov.name);
    x.onclick=()=>{ URL.revokeObjectURL(ov.url); S.overlays.splice(i,1); renderOverlays(); }; row.appendChild(x);
    box.appendChild(row);
  });
}
async function addOverlays(files){
  for(const f of [...files].filter(isImage)){
    const url=URL.createObjectURL(f), img=new Image(); img.src=url;
    try{ await img.decode(); }catch(e){ status("Couldn’t read "+f.name+".",true); continue; }
    S.overlays.push({name:f.name,file:f,url,img,pos:"br",size:0.18,opacity:0.9,blend:"source-over",timing:"all",anim:"none"});
  }
  renderOverlays();
}
const FONT_DEF={
  clean:{w:"800",f:"Montserrat, 'Segoe UI', system-ui, sans-serif",k:1},
  box:{w:"700",f:"Montserrat, 'Segoe UI', system-ui, sans-serif",k:0.92},
  cinema:{w:"400",f:"'Bebas Neue', 'Arial Narrow', sans-serif",k:1.3,caps:true,ls:0.05},
  impact:{w:"400",f:"Anton, Impact, 'Arial Narrow', sans-serif",k:1.12,caps:true,ls:0.01},
  serif:{w:"italic 700",f:"'Playfair Display', Georgia, serif",k:1.05},
  hand:{w:"400",f:"'Permanent Marker', 'Segoe Print', cursive",k:1}
};
function normStyle(s){ return {bold:"clean",caps:"cinema",outline:"impact",serif:"serif",hand:"hand"}[s]||(FONT_DEF[s]?s:"clean"); }
async function ensureFonts(){ try{ const FD=FONT_DEF[normStyle($("textStyle").value)]; await Promise.race([document.fonts.load(`${FD.w} 40px ${FD.f.split(",")[0]}`), new Promise(r=>setTimeout(r,2500))]); }catch(e){} }
function wrapLines(g,text,maxW,maxLines){ const words=text.split(/\s+/), lines=[]; let line="";
  for(const w of words){ const tryL=line?line+" "+w:w; if(g.measureText(tryL).width>maxW && line){ lines.push(line); line=w; } else line=tryL; }
  if(line) lines.push(line); return lines.slice(0,maxLines||4); }
function drawText(o,t,win,F,bi){
  const {g,W,H,ep}=o, items=[], T=titleFor(ep), auto=!T.manual, lt=t-win[0];
  const hook=T.hook, hd=hook?hookDur(hook):0;
  if(hook && lt<hd) items.push({text:hook,k:lt/hd,dur:hd,kind:"hook"});
  if(auto && ep.short && $("payoffOn").checked && T.payoff){ const dt=dropTime(win); if(dt>0 && t>=dt && t<dt+1.5) items.push({text:T.payoff,k:(t-dt)/1.5,dur:1.5,kind:"payoff"}); }
  if(F.end && t>win[1]-3.4 && win[1]-win[0]>6 && !(PRO()&&ep.short)) items.push({text:F.end,k:(t-(win[1]-3.4))/3.4,dur:3.4,kind:"end"});
  if(auto && !ep.short && T.card && lt>=1 && lt<6) drawTitleCard(o,T,(lt-1)/5);
  for(const it of items){
    const s=ep.safe, x0=W*s.l, y0=H*s.t, y1=H*(1-s.b), aw=(W*(1-s.l-s.r));
    const w=wordCount(it.text), base=it.kind==="hook"?(w<=3?0.074:w<=5?0.066:0.058):it.kind==="payoff"?0.095:0.058; // readable, not shouty
    const fs=Math.round(Math.min(W,H)*base);
    g.save();
    const TS=normStyle(F.textStyle), FD=FONT_DEF[TS]; let txt=it.text;
    g.font=`${FD.w} ${Math.round(fs*FD.k)}px ${FD.f}`;
    if(FD.caps) txt=txt.toUpperCase();
    if("letterSpacing" in g) g.letterSpacing=FD.ls?Math.round(fs*FD.ls)+"px":"0px";
    g.textAlign="center"; g.textBaseline="middle";
    let lines=wrapLines(g,txt,aw*0.9,9);
    for(let k=0;k<6 && lines.length>2;k++){ const cur=parseFloat(g.font.match(/(\d+(?:\.\d+)?)px/)[1]), nf=Math.round(cur*0.88); g.font=g.font.replace(/\d+(?:\.\d+)?px/,nf+"px"); lines=wrapLines(g,txt,aw*0.9,9); } // shrink, never drop words
    const inRamp=(it.kind==="hook"&&PRO()&&ep.short)?0.0001:it.kind==="payoff"?0.08:0.35, el=it.k*it.dur;
    const appear=Math.min(1,el/inRamp), out=it.kind==="end"?1:Math.min(1,Math.max(0,(it.dur-el)/0.3));
    const pop=1+(it.kind==="payoff"?0.35:0.25)*(1-ease(appear))+(bi&&F.pulse?0.04*Math.exp(-bi.ph*10):0);
    // hooks sit in the top third of the safe zone on tall formats, where eyes land first
    const tall=H>=W, cx=x0+aw/2, cy=it.kind==="hook" ? y0+(y1-y0)*(tall?0.2:0.3) : (y0+y1)/2;
    g.translate(cx,cy); g.scale(pop,pop); g.globalAlpha=Math.min(appear,out);
    const lh=fs*1.08, top=-(lines.length-1)*lh/2;
    g.lineJoin="round"; g.fillStyle="#fff";
    if(TS==="box"){ // native caption look: white text on a soft dark box, one per line
      lines.forEach((l,i)=>{ const tw=g.measureText(l).width, ph=fs*0.32, pv=fs*0.16, y=top+i*lh, bh=fs*1.0+pv*2;
        g.fillStyle="rgba(10,10,12,0.72)"; g.beginPath(); if(g.roundRect) g.roundRect(-tw/2-ph,y-bh/2,tw+ph*2,bh,fs*0.22); else g.rect(-tw/2-ph,y-bh/2,tw+ph*2,bh); g.fill();
        g.fillStyle="#fff"; g.fillText(l,0,y+fs*0.03); }); }
    else {
      g.shadowColor="rgba(0,0,0,0.55)"; g.shadowBlur=fs*0.28; g.shadowOffsetY=fs*0.05;
      if(TS==="impact"){ g.lineWidth=fs*0.07; g.strokeStyle="rgba(0,0,0,0.85)"; lines.forEach((l,i)=>g.strokeText(l,0,top+i*lh)); g.shadowColor="transparent"; }
      if(TS==="clean"){ g.lineWidth=fs*0.045; g.strokeStyle="rgba(0,0,0,0.3)"; lines.forEach((l,i)=>g.strokeText(l,0,top+i*lh)); }
      if(TS==="hand") g.rotate(-0.03);
      lines.forEach((l,i)=>g.fillText(l,0,top+i*lh)); }
    g.restore();
  }
}
function drawTitleCard(o,T,k){
  const {g,W,H,ep}=o, s=ep.safe, m=Math.min(W,H), fs=Math.round(m*0.05), fs2=Math.round(fs*0.62);
  const a=Math.min(1,k*5/0.5,(1-k)*5/0.5), sl=ease(Math.min(1,k*5/0.6));
  g.save(); g.globalAlpha=Math.max(0,a);
  g.font=`800 ${fs}px "Archivo", system-ui, sans-serif`; if("fontStretch" in g) g.fontStretch="expanded";
  const tw=g.measureText(T.card).width; g.font=`600 ${fs2}px "Archivo", system-ui, sans-serif`; const tw2=T.sub?g.measureText(T.sub).width:0;
  const x=W*s.l+(1-sl)*-m*0.04, y=H*(1-s.b)-fs*(T.sub?2.6:1.7);
  g.fillStyle="rgba(0,0,0,0.45)"; g.fillRect(x-fs*0.5,y-fs*0.35,Math.max(tw,tw2)+fs*1.1,fs*(T.sub?2.45:1.55));
  g.fillStyle="#fff"; g.textBaseline="top"; g.font=`800 ${fs}px "Archivo", system-ui, sans-serif`; if("fontStretch" in g) g.fontStretch="expanded"; g.fillText(T.card,x,y);
  if(T.sub){ g.font=`600 ${fs2}px "Archivo", system-ui, sans-serif`; if("fontStretch" in g) g.fontStretch="normal"; g.fillStyle="rgba(255,255,255,0.85)"; g.fillText(T.sub,x,y+fs*1.2); }
  g.restore();
}

