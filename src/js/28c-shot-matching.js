/* ---------------- Shot matching: one film, not a pile of clips ----------------
   Clips come from different phones, cameras and times of day. Before the colour look is applied, each shot is nudged
   towards the edit's own middle ground, the way a colourist does a shot-match pass:
     white balance  the colour cast (red/green and blue/green balance of the shot) moves towards the edit's typical balance;
                    a strongly coloured scene (a green forest, a blue sea) is mostly left alone, since that colour is the subject
     exposure       brightness moves towards the edit's typical level; night shots stay dark, bright beaches stay bright
     contrast       flat footage gains a little punch, harsh footage softens a little
   Strength never reaches 100%: a sunset still looks like a sunset. The correction is one colour matrix per shot (an SVG
   filter the canvas applies along with the look), so it costs almost nothing. */
const MATCH_STRENGTH={gentle:0.55,strong:0.85};
function clipSpread(c){ if(c._spread!=null) return c._spread; const fps=(c.fp||[]).filter(f=>f&&f.grid); if(!fps.length) return (c._spread=0);
  let s=0; fps.forEach(f=>{ const L=[]; for(let i=0;i<f.grid.length;i+=3) L.push(0.299*f.grid[i]+0.587*f.grid[i+1]+0.114*f.grid[i+2]); const m=L.reduce((a,b)=>a+b,0)/L.length; s+=Math.sqrt(L.reduce((a,b)=>a+(b-m)*(b-m),0)/L.length); });
  return (c._spread=s/fps.length); }
/* what a shot looks like: the samples it covers, averaged */
function shotStats(seg){ const c=S.clips[seg.clip]; if(!c||!c.samples||!c.samples.length) return null;
  const a=seg.src||0, b=a+Math.max(0.3,seg.end-seg.start); let sm=c.samples.filter(s=>s.col&&s.t>=a-0.4&&s.t<=b+0.4);
  if(!sm.length){ const n=c.samples.filter(s=>s.col).reduce((x,s)=>!x||Math.abs(s.t-a)<Math.abs(x.t-a)?s:x,null); if(!n) return null; sm=[n]; }
  let r=0,g=0,bl=0; sm.forEach(s=>{ r+=s.col[0]; g+=s.col[1]; bl+=s.col[2]; }); r/=sm.length; g/=sm.length; bl/=sm.length;
  const L=0.299*r+0.587*g+0.114*bl, mx=Math.max(r,g,bl), mn=Math.min(r,g,bl);
  return {r,g,b:bl,L, rg:Math.log((r+4)/(g+4)), bg:Math.log((bl+4)/(g+4)), sat:mx>8?(mx-mn)/mx:0, sp:clipSpread(c)}; }
function wMedian(pairs){ pairs=pairs.filter(p=>isFinite(p[0])).sort((x,y)=>x[0]-y[0]); const tot=pairs.reduce((a,p)=>a+p[1],0); let acc=0; for(const p of pairs){ acc+=p[1]; if(acc>=tot/2) return p[0]; } return pairs.length?pairs[pairs.length-1][0]:0; }
/* the edit's middle ground, from every shot, weighted by how long it's on screen */
function matchRef(plan){ if(plan._cmRef) return plan._cmRef; const st=plan.map(s=>[s,shotStats(s)]).filter(x=>x[1]&&S.clips[x[0].clip]&&S.clips[x[0].clip].kind!=="title");
  if(st.length<3) return (plan._cmRef={none:true}); const w=x=>Math.max(0.2,x[0].end-x[0].start);
  const ref={rg:wMedian(st.map(x=>[x[1].rg,w(x)])), bg:wMedian(st.map(x=>[x[1].bg,w(x)])), L:wMedian(st.map(x=>[x[1].L,w(x)])), sp:wMedian(st.filter(x=>x[1].sp>0).map(x=>[x[1].sp,w(x)]))};
  return (plan._cmRef=ref); }
/* the correction for one shot: channel gains, exposure and contrast, as numbers the shot info panel can describe */
function shotCorrection(seg,plan){ const mode=$("colMatch")?$("colMatch").value:"gentle", k=MATCH_STRENGTH[mode]; if(!k) return null;
  const st=shotStats(seg), ref=matchRef(plan||curPlan()||[]); if(!st||ref.none) return null; const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  const castW=k*cl(1-(st.sat-0.18)/0.3,0.25,1);                                        // a deeply coloured scene keeps most of its colour
  const dR=cl((ref.rg-st.rg)*castW,-0.14,0.14), dB=cl((ref.bg-st.bg)*castW,-0.14,0.14);
  let gr=Math.exp(dR), gb=Math.exp(dB), gg=1; const lum=0.299*gr+0.587*gg+0.114*gb; gr/=lum; gg/=lum; gb/=lum; // white balance without changing brightness
  let e=Math.pow(Math.max(8,ref.L)/Math.max(8,st.L),k); e=cl(e,0.8,1.35); if(st.L<50) e=Math.min(e,1.12); if(st.L>190) e=Math.max(e,0.92); // night stays night
  let c=st.sp>0&&ref.sp>0?Math.pow(ref.sp/st.sp,k*0.6):1; c=cl(c,0.88,1.2);
  const p=cl(st.L*e,20,235)/255, q=v=>Math.round(v*100)/100;
  return {gr:q(gr*e*c), gg:q(gg*e*c), gb:q(gb*e*c), off:q(p*(1-c)), e:q(e), c:q(c), warm:q(dR-dB), st}; }
let _cmSvg=null; const _cmIds=new Map();
function cmFilterId(m){ const key=[m.gr,m.gg,m.gb,m.off].join(","); if(_cmIds.has(key)) return _cmIds.get(key);
  if(!_cmSvg){ const NS="http://www.w3.org/2000/svg"; _cmSvg=document.createElementNS(NS,"svg"); _cmSvg.setAttribute("width","0"); _cmSvg.setAttribute("height","0"); _cmSvg.setAttribute("aria-hidden","true"); _cmSvg.style.cssText="position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(_cmSvg); }
  const NS="http://www.w3.org/2000/svg", id="bscm"+_cmIds.size, f=document.createElementNS(NS,"filter"), cm=document.createElementNS(NS,"feColorMatrix");
  f.setAttribute("id",id); f.setAttribute("color-interpolation-filters","sRGB"); cm.setAttribute("type","matrix");
  cm.setAttribute("values",`${m.gr} 0 0 0 ${m.off}  0 ${m.gg} 0 0 ${m.off}  0 0 ${m.gb} 0 ${m.off}  0 0 0 1 0`); f.appendChild(cm); _cmSvg.appendChild(f); _cmIds.set(key,id); return id; }
/* the filter drawClip uses: the shot's correction first, then the look */
function matchFilter(o,clip,base){ const seg=o._cm||o._seg; if(!seg||S.clips[seg.clip]!==clip||clip.kind==="title") return base;
  const mode=$("colMatch")?$("colMatch").value:"gentle"; if(!MATCH_STRENGTH[mode]) return base; const plan=curPlan(); if(!plan) return base;
  const key=`${mode}|${seg.clip}|${(seg.src||0).toFixed(2)}`; if(!seg._cmF||seg._cmF.key!==key||seg._cmF.plan!==plan){
    const m=shotCorrection(seg,plan); let id=null;
    if(m&&(Math.abs(m.gr-1)>0.015||Math.abs(m.gg-1)>0.015||Math.abs(m.gb-1)>0.015||Math.abs(m.off)>0.01)) id=cmFilterId(m);
    seg._cmF={key,plan,id,m}; }
  const id=seg._cmF.id; if(!id) return base; return `url(#${id})`+(base&&base!=="none"?" "+base:""); }
function matchNote(seg){ const m=seg&&shotCorrection(seg); if(!m) return ""; const bits=[];
  if(Math.abs(m.e-1)>=0.04) bits.push(m.e>1?`brighter ${Math.round((m.e-1)*100)}%`:`darker ${Math.round((1-m.e)*100)}%`);
  if(Math.abs(m.warm)>=0.03) bits.push(m.warm>0?"warmer":"cooler");
  if(Math.abs(m.c-1)>=0.04) bits.push(m.c>1?"more contrast":"softer contrast");
  return bits.length?bits.join(", "):"already matches"; }
