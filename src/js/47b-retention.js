/* ---------------- Learning from the moment viewers leave ----------------
   Each Short's recipe now keeps its shot list: when each shot starts and ends, and what kind of shot it is (how much
   movement, video or photo, shot size, the transition into it, the camera move, cut on the action, match cut).
   YouTube's audience retention report gives the share of viewers still watching at every 1% of a video. Laid over the
   shot list, it shows which shots people leave during and which ones hold them. Across all your Shorts, each kind of
   shot gets a measured effect against the channel's own typical drop-off, and the opening shot (the swipe-away moment)
   is learned on its own. With "Learn from my results" on, Shorts favour the footage that holds your viewers. */
function shotDigest(r){ if(!r.plan||!r.win) return null; const w0=r.win[0], w1=r.win[1], out=[];
  r.plan.forEach(s=>{ if(s.end<=w0+0.01||s.start>=w1-0.01) return; const c=S.clips[s.clip]; if(!c) return;
    const sm=c.samples&&c.samples.length?c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]):null, mo=c.kind==="image"?0:(sm&&sm.motion||0), tg=tagAt(c,s.src||0);
    out.push({a:+(Math.max(s.start,w0)-w0).toFixed(2), b:+(Math.min(s.end,w1)-w0).toFixed(2), m:mo<1.2?0:mo<5?1:2, k:c.kind==="image"?"i":"v", sc:tg&&tg.scale!=null?Math.round(tg.scale):-1, tr:s.tr&&s.tr.type||"cut", cam:s._dmove||"", act:s._act?1:0, mc:s._mcut?1:0}); });
  return out.length?out:null; }
/* the retention curve of one video: [share of the video, share of viewers still watching] at every 1% */
function retCache(){ try{ return JSON.parse(localStorage.getItem("beatsplicerRet")||"{}"); }catch(e){ return {}; } }
function saveRetCache(c){ try{ const k=Object.keys(c).sort((a,b)=>c[b].at-c[a].at).slice(0,300), o={}; k.forEach(x=>o[x]=c[x]); localStorage.setItem("beatsplicerRet",JSON.stringify(o)); }catch(e){} }
async function ytRetention(v){ const cache=retCache(), h=cache[v.id]; if(h&&(h.final||Date.now()-h.at<2*864e5)) return h.r;
  const end=new Date().toISOString().slice(0,10), url=`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${end}&dimensions=elapsedVideoTimeRatio&metrics=audienceWatchRatio,relativeRetentionPerformance&filters=video==${v.id}`;
  let j; try{ j=await (await ytFetch(url)).json(); }catch(e){ j=await (await ytFetch(url.replace(",relativeRetentionPerformance",""))).json(); }
  const r=(j.rows||[]).map(x=>[+x[0],+x[1]]).filter(x=>isFinite(x[0])&&isFinite(x[1])).sort((a,b)=>a[0]-b[0]);
  cache[v.id]={at:Date.now(), r, final:Date.now()-(v.at||0)>30*864e5}; saveRetCache(cache); return r; }
function retAt(R,dur,t){ const x=Math.max(R[0][0],Math.min(1,t/dur)); let i=0; while(i<R.length-2&&R[i+1][0]<x) i++; const [x0,y0]=R[i], [x1,y1]=R[i+1]||R[i]; return x1>x0?y0+(y1-y0)*(x-x0)/(x1-x0):y0; }
const SHOT_FEATS={
  m:["Movement",{0:"still or slow footage",1:"some movement",2:"lots of movement"}], k:["Footage",{v:"video footage",i:"photos"}],
  sz:["Shot size",{wide:"wide shots",medium:"medium shots",close:"close-ups"}], len:["Shot length",{short:"quick shots (under 0.8 s)",mid:"shots of 0.8 to 1.6 s",long:"shots of 1.6 to 3 s",hold:"shots held over 3 s"}],
  tr:["Transition",null], cam:["Camera move",{settle:"steady drifts",push:"push-ins",punch:"punch-ins",ride:"moves on the beat",float:"floating drifts",reveal:"pull-backs"}], act:["Cut on the action",{1:"shots cut on the action"}], mc:["Match cut",{1:"match cuts"}]};
function featsOf(sh){ const L=sh.b-sh.a; return {m:sh.m, k:sh.k, sz:sh.sc<0?null:sh.sc<=1?"wide":sh.sc<=3?"medium":"close", len:L<0.8?"short":L<1.6?"mid":L<3?"long":"hold", tr:sh.tr, cam:sh.cam||null, act:sh.act?1:null, mc:sh.mc?1:null}; }
/* per shot: the share of the viewers still there who leave each second, against the video's typical rate */
function learnShots(items){ const body={}, open={}; let nv=0, worst=null; const latestAt=Math.max(0,...items.filter(i=>i.v&&i.R&&i.shots).map(i=>i.v.at||0));
  const add=(T,k,v,x)=>{ if(v==null||v==="") return; const g=(T[k]=T[k]||{}), e=(g[v]=g[v]||{s:0,n:0}); e.s+=x; e.n++; };
  items.forEach(({shots,R,dur,v})=>{ if(!R||R.length<20||!shots||!dur) return; nv++;
    const rows=shots.map((sh,i)=>{ const a=Math.max(0,sh.a), b=Math.min(dur,sh.b); if(b-a<0.4) return null; const r0=retAt(R,dur,a), r1=retAt(R,dur,b); if(r0<=0.02) return null; return {sh,i,rate:(r0-r1)/r0/(b-a)}; }).filter(Boolean);
    const mid=rows.filter(x=>x.sh.a>=1.5).map(x=>x.rate).sort((a,b)=>a-b), med=mid.length?mid[mid.length>>1]:0;
    rows.forEach(x=>{ const f=featsOf(x.sh); if(x.sh.a<1.5) Object.entries(f).forEach(([k,val])=>add(open,k,val,x.rate)); else { const d=x.rate-med; Object.entries(f).forEach(([k,val])=>add(body,k,val,d)); if(v&&(v.at||0)===latestAt&&(!worst||d>worst.d)) worst={title:v.title,d,i:x.i,sh:x.sh}; } }); });
  const fin=(T,centre)=>{ const out={}; Object.entries(T).forEach(([k,g])=>{ let m=0, N=0; if(centre){ Object.values(g).forEach(e=>{ m+=e.s; N+=e.n; }); m=N?m/N:0; }
      out[k]={}; Object.entries(g).forEach(([val,e])=>{ out[k][val]={eff:+((e.s/e.n-m)*(e.n/(e.n+8))).toFixed(4),n:e.n}; }); }); return out; };
  return {nv, body:fin(body,false), open:fin(open,true), worst}; }
function shotLabel(k,val){ const F=SHOT_FEATS[k]; if(!F) return null; if(!F[1]) return `${val} transitions`; return F[1][val]||null; }
function shotSummary(SL){ if(!SL||!SL.nv) return []; const all=[]; Object.entries(SL.body).forEach(([k,g])=>Object.entries(g).forEach(([val,e])=>{ const t=shotLabel(k,val); if(t&&e.n>=8) all.push({t,...e}); }));
  all.sort((a,b)=>a.eff-b.eff); const pct=x=>`${Math.abs(x*100).toFixed(1)}% ${x<0?"fewer":"more"} leave each second`, out=[];
  const hold=all.filter(x=>x.eff<-0.002).slice(0,3), lose=all.filter(x=>x.eff>0.002).slice(-3).reverse();
  if(hold.length) out.push("Viewers stay through "+hold.map(x=>`${x.t} (${pct(x.eff)})`).join(", ")+".");
  if(lose.length) out.push("Viewers leave during "+lose.map(x=>`${x.t} (${pct(x.eff)})`).join(", ")+".");
  if(SL.worst&&SL.worst.d>0.01){ const w=SL.worst, f=featsOf(w.sh); out.push(`Biggest drop in your latest: shot ${w.i+1} at ${fmtTime(w.sh.a)} (${[shotLabel("k",f.k),shotLabel("m",f.m),shotLabel("len",f.len)].filter(Boolean).join(", ")}) in “${String(w.title).slice(0,50)}”.`); }
  return out; }
/* the planning term: in Shorts, footage like what held your viewers is preferred */
function retentionCost(seg,clip,s,ctx){ if(!has("youtubeLearn")) return 0; if(!ctx.short||!optV("learnOn")) return 0; const L=learned(), SL=L&&L.shots; if(!SL||!SL.nv) return 0;
  const first=ctx.win&&seg.start-ctx.win[0]<1.5, T=first?SL.open:SL.body; if(!T) return 0; const mo=clip.kind==="image"?0:(s.motion||0), tg=tagAt(clip,s.t);
  const f={m:mo<1.2?0:mo<5?1:2, k:clip.kind==="image"?"i":"v", sz:tg&&tg.scale!=null?(tg.scale<=1.5?"wide":tg.scale<=3.5?"medium":"close"):null};
  let c=0; Object.entries(f).forEach(([k,val])=>{ const e=val!=null&&T[k]&&T[k][val]; if(e&&e.n>=(first?5:8)) c+=Math.max(-0.35,Math.min(0.35,e.eff*(first?40:25))); }); return c; }
