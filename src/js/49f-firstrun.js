/* ---------------- Watching it being built, and the first run ----------------
   While the clips are read, their pictures fill the screen one by one; while the cut is made, shots drop onto the beats
   of the song. On the very first visit, three short cards explain the idea and offer the sample clips. */
const _thumbImg=new Map(); function thumbImg(c){ let im=_thumbImg.get(c.thumb); if(!im&&c.thumb){ im=new Image(); im.src=c.thumb; _thumbImg.set(c.thumb,im); } return im; }
let _bv={k:null,t0:0};
function drawBuild(){ const st=flowState(), cv=$("buildViz"), on=(st.k==="study"&&/clip/i.test(st.label)&&S.clips.some(c=>c.thumb))||st.k==="cutting";
  document.body.classList.toggle("s-building",on); cv.hidden=!on; if(!on){ _bv.k=null; return; }
  if(_bv.k!==st.k){ _bv={k:st.k,t0:performance.now()}; } const box=$("stageBox").getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1), W=Math.max(10,Math.round(box.width*dpr)), H=Math.max(10,Math.round(box.height*dpr));
  if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; } const g=cv.getContext("2d"), t=(performance.now()-_bv.t0)/1000; g.fillStyle="#0b0b10"; g.fillRect(0,0,W,H);
  const ink="rgba(255,255,255,0.9)", dim="rgba(255,255,255,0.35)"; g.font=`600 ${Math.round(14*dpr)}px system-ui,sans-serif`; g.textAlign="center";
  if(st.k==="study"){ const cs=S.clips.filter(c=>c.thumb), n=Math.max(4,cs.length), cols=Math.ceil(Math.sqrt(n*W/H)), rows=Math.ceil(n/cols), cw=W/cols, ch=H/rows;
    cs.forEach((c,i)=>{ const im=thumbImg(c); if(!im||!im.complete) return; const x=(i%cols)*cw, y=Math.floor(i/cols)*ch; g.globalAlpha=Math.min(1,(t*3-i*0.05)+1); const s=Math.max(cw/im.width,ch/im.height); g.save(); g.beginPath(); g.rect(x+1,y+1,cw-2,ch-2); g.clip(); g.drawImage(im,x+cw/2-im.width*s/2,y+ch/2-im.height*s/2,im.width*s,im.height*s); g.restore(); });
    g.globalAlpha=1; g.fillStyle="rgba(0,0,0,0.45)"; g.fillRect(0,H/2-22*dpr,W,44*dpr); g.fillStyle=ink; g.fillText(t("Looking at your clips"),W/2,H/2+5*dpr); return; }
  /* cutting: the song's beats across the middle; shots fall onto them, left to right */
  const an=S.an, P=S.plan; if(!an||!P||!P.length){ g.fillStyle=ink; g.fillText(t("Making your cut"),W/2,H/2); return; }
  const w=windowFor(previewEp()), a0=w[0], a1=w[1], X=x=>(x-a0)/(a1-a0)*W, base=H*0.62, th=H*0.22;
  g.strokeStyle=dim; g.lineWidth=1*dpr; an.beats.forEach((b,i)=>{ if(b<a0||b>a1) return; const x=X(b), hh=isDownAt(an,i)?14*dpr:7*dpr; g.beginPath(); g.moveTo(x,base+6*dpr); g.lineTo(x,base+6*dpr+hh); g.stroke(); });
  const shots=P.filter(s=>s.end>a0&&s.start<a1), shown=Math.min(shots.length,Math.floor(t*14));
  shots.forEach((s,i)=>{ if(i>shown) return; const k=Math.min(1,(t*14-i)/2.2), e=1-Math.pow(1-Math.max(0,k),3), x0=X(Math.max(a0,s.start)), x1=X(Math.min(a1,s.end)), y=base-th-(1-e)*H*0.35; const c=S.clips[s.clip], im=c&&thumbImg(c);
    g.globalAlpha=Math.max(0,e); g.save(); g.beginPath(); g.rect(x0+1,y,Math.max(1,x1-x0-2),th); g.clip(); if(im&&im.complete){ const sc=Math.max((x1-x0)/im.width,th/im.height); g.drawImage(im,(x0+x1)/2-im.width*sc/2,y+th/2-im.height*sc/2,im.width*sc,im.height*sc); } else { g.fillStyle="#334"; g.fillRect(x0,y,x1-x0,th); } g.restore();
    if(e>0.98){ g.strokeStyle="#FF9F0A"; g.lineWidth=1.25*dpr; g.beginPath(); g.moveTo(x0,base-th); g.lineTo(x0,base+6*dpr); g.stroke(); } });
  g.globalAlpha=1; g.fillStyle=ink; g.fillText(t("Every cut lands on a beat"),W/2,H*0.16); }
(function loop(){ try{ drawBuild(); }catch(e){} requestAnimationFrame(loop); })();
/* first run */
function introStep(){ const tr=$("introTrack"), i=Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth)); [...$("introDots").children].forEach((d,k)=>d.classList.toggle("on",k===i)); const last=i>=2; $("introEnd").hidden=!last; $("introNext").parentElement.hidden=last; return i; }
function closeIntro(){ $("introSheet").hidden=true; try{ localStorage.setItem("beatsplicerIntro","1"); }catch(e){} }
function drawIntroArt(){ const W=240, wave=[...Array(48)].map((_,i)=>{ const h=10+Math.abs(Math.sin(i*0.9)*26+Math.sin(i*0.37)*14)+(i%4===0?18:0); return `<rect x="${i*5}" y="${60-h/2}" width="3" height="${h}" rx="1.5" fill="currentColor" opacity="${i%4===0?0.9:0.45}"/>`; }).join("");
  document.querySelector("#introSheet .iw").innerHTML=wave;
  const cols=["#0A84FF","#FF9F0A","#30D158","#BF5AF2","#FF375F","#64D2FF"]; document.querySelector("#introSheet .it").innerHTML=cols.map((c,i)=>`<rect x="${12+(i%3)*76}" y="${8+Math.floor(i/3)*56}" width="68" height="48" rx="8" fill="${c}" opacity="0.85"/>`).join("");
  const cuts=[0,40,60,100,140,160,200,240]; document.querySelector("#introSheet .ic").innerHTML=wave.replace(/opacity="0\.(9|45)"/g,'opacity="0.25"')+cuts.slice(0,-1).map((x,i)=>`<rect x="${x+1}" y="18" width="${cuts[i+1]-x-2}" height="26" rx="5" fill="${cols[i%6]}"/>${i?`<line x1="${x}" x2="${x}" y1="14" y2="104" stroke="currentColor" stroke-width="2"/>`:""}`).join(""); }
function maybeIntro(){ let seen=false; try{ seen=localStorage.getItem("beatsplicerIntro")==="1"; }catch(e){} if(seen||navigator.webdriver&&!window.BS_INTRO||S.an||S.clips.length) return; drawIntroArt(); $("introSheet").hidden=false; introStep(); }
$("introTrack").addEventListener("scroll",()=>introStep(),{passive:true});
$("introNext").onclick=()=>{ const tr=$("introTrack"); tr.scrollTo({left:(introStep()+1)*tr.clientWidth,behavior:"smooth"}); };
$("introSkip").onclick=closeIntro; $("introOwn").onclick=closeIntro; $("introSample").onclick=()=>{ closeIntro(); $("trySample").click(); };
setTimeout(maybeIntro,600);
