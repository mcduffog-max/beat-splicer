/* ---------------- Thumbnail and cover images ---------------- */
function thumbTitle(o,title){
  const {g,W,H,ep}=o, s=ep.safe, m=Math.min(W,H), fs=Math.round(m*(W>=H?0.13:0.1));
  g.save(); g.font=`800 ${fs}px "Archivo", system-ui, sans-serif`; if("fontStretch" in g) g.fontStretch="expanded";
  const lines=wrapLines(g,title.toUpperCase(),W*(W>=H?0.6:0.84)).slice(0,3), lh=fs*1.02;
  const x=W>=H?W*0.06:W/2, y0=W>=H?H*0.94-lines.length*lh:H*Math.max(0.14,s.t)+fs*0.6;
  g.textAlign=W>=H?"left":"center"; g.textBaseline="top"; g.lineJoin="round";
  if(W>=H){ const gr=g.createLinearGradient(0,0,W*0.7,0); gr.addColorStop(0,"rgba(0,0,0,0.55)"); gr.addColorStop(1,"rgba(0,0,0,0)"); g.fillStyle=gr; g.fillRect(0,0,W*0.75,H); }
  lines.forEach((l,i)=>{ g.lineWidth=fs*0.18; g.strokeStyle="rgba(0,0,0,0.85)"; g.strokeText(l,x,y0+i*lh); g.fillStyle=i===0?"#FFE14D":"#fff"; g.fillText(l,x,y0+i*lh); });
  g.restore();
}
async function makeCoverImages(){
  const eps=S.eps.map(EP), out=[], F={...readFx(),hook:"",end:"",lower:"",brandOutro:false};
  let best=0,bs=-1; S.plan.forEach((s,i)=>{ const c=S.clips[s.clip]; const mot=c.kind==="image"?0.35:Math.max(...(c.samples||[{mN:0}]).map(x=>x.mN||0)); const sc=s.e*0.6+mot*0.4; if(sc>bs){ bs=sc; best=i; } });
  const seg=S.plan[best], t=seg.start+Math.min(0.5,(seg.end-seg.start)/2), title=smartTitle();
  const mk=async(w,hh,ep)=>{ const c=document.createElement("canvas"); c.width=w; c.height=hh; const o={ep:{...ep,w,h:hh},canvas:c,g:c.getContext("2d"),W:w,H:hh};
    await renderStill(o,best,t,{...F,_thumb:true,filter:FILTER_OK?(F.filter==="none"?"saturate(1.25) contrast(1.1)":F.filter+" saturate(1.15)"):F.filter},false); thumbTitle(o,title);
    return new Promise(r=>c.toBlob(r,"image/jpeg",0.9)); };
  if(eps.some(e=>e.id==="youtube")) out.push({name:safeName(`${title} - YouTube thumbnail 1280x720`,110)+".jpg", blob:await mk(1280,720,EP("youtube"))});
  if(eps.some(e=>e.short && e.h>e.w)) out.push({name:safeName(`${title} - Shorts Reels TikTok cover 1080x1920`,110)+".jpg", blob:await mk(1080,1920,EP("shorts"))});
  return out;
}

