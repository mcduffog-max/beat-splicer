/* ---------------- Edit like this: a style learned from a video you admire ----------------
   Give the app a music video whose editing you like. It listens to its song (beats, energy) and watches its first two
   minutes at double speed for cuts, then measures how that editor works:
     pace         average shot length in the quiet, middle and loud parts of the song
     timing       how many cuts land on the beat, on the downbeat, or off the beat
     long takes   how often a shot runs past four seconds
     movement     how lively the footage inside the shots is
   With "Edit like my reference" on, your edit borrows those habits (as tendencies, not a template): its pace follows
   the reference's curve, off-beat cuts and long takes come as often as the reference uses them, and footage of a
   similar liveliness is preferred. Nothing of the reference's pictures or sound is used. */
function refLoad(){ try{ return JSON.parse(localStorage.getItem("beatsplicerRef")||"null"); }catch(e){ return null; } }
let REF=refLoad();
function refOn(){ return has("reference")&&!!(REF&&REF.stats&&$("refOn")&&$("refOn").checked); }
async function watchCuts(file,limit,onProg){ const v=document.createElement("video"), url=URL.createObjectURL(file); v.muted=true; v.playsInline=true; v.src=url;
  try{ await waitEvent(v,"loadeddata",20000); const end=Math.min(v.duration||0,limit), W=32, H=18, cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d",{willReadFrequently:true});
    const fr=[]; let prev=null;
    const grab=t=>{ g.drawImage(v,0,0,W,H); const d=g.getImageData(0,0,W,H).data, L=new Uint8Array(W*H), hist=new Float32Array(16); for(let i=0;i<L.length;i++){ L[i]=(77*d[i*4]+150*d[i*4+1]+29*d[i*4+2])>>8; hist[L[i]>>4]++; }
      let diff=0, hd=0; if(prev){ for(let i=0;i<L.length;i++) diff+=Math.abs(L[i]-prev.L[i]); diff/=L.length; for(let k=0;k<16;k++) hd+=Math.abs(hist[k]-prev.hist[k]); hd/=L.length; }
      fr.push({t,diff,hd}); prev={L,hist}; };
    if("requestVideoFrameCallback" in v){ await new Promise(res=>{ let done=false; const fin=()=>{ if(!done){ done=true; v.pause(); res(); } };
        const cb=(now,meta)=>{ const t=meta.mediaTime; grab(t); if(onProg) onProg(t/end); if(t>=end-0.05||v.ended) fin(); else v.requestVideoFrameCallback(cb); };
        v.requestVideoFrameCallback(cb); v.playbackRate=2; v.onended=fin; v.play().catch(fin); setTimeout(fin,(end/2+20)*1000); }); }
    else { for(let t=0;t<end;t+=0.1){ await seekTo(v,t); grab(t); if(onProg) onProg(t/end); } }
    const ds=fr.map(f=>f.diff+40*f.hd).sort((a,b)=>a-b), med=ds[ds.length>>1]||1, thr=Math.max(22,med*4), cuts=[];
    fr.forEach((f,i)=>{ const s=f.diff+40*f.hd; if(i&&s>thr&&(!cuts.length||f.t-cuts[cuts.length-1]>0.25)) cuts.push(f.t); });
    return {cuts, end, frames:fr}; }
  finally{ v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); } }
async function learnReference(file){ const out=$("refInfo"); out.textContent="Listening to the reference's song…";
  try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const buf=await ac.decodeAudioData(await file.arrayBuffer()); ac.close();
    const an=await analyzeAudio(buf,q=>{ out.textContent=`Listening to the reference's song… ${Math.round(q*100)}%`; });
    out.textContent="Watching for cuts (first two minutes, at double speed)…"; const W=await watchCuts(file,120,q=>{ out.textContent=`Watching for cuts… ${Math.round(q*100)}%`; });
    const B=an.beats, P=60/an.bpm, cuts=W.cuts.filter(t=>t>0.3), near=(t,list,tol)=>list.some(b=>Math.abs(b-t)<=tol);
    const downs=B.filter((b,i)=>isDownAt(an,i)), onBeat=cuts.filter(t=>near(t,B,0.07)).length/Math.max(1,cuts.length), onDown=cuts.filter(t=>near(t,downs,0.07)).length/Math.max(1,cuts.length);
    const offs=B.slice(0,-1).map((b,i)=>b+(an.swing||0.5)*(B[i+1]-b)), offBeat=cuts.filter(t=>!near(t,B,0.07)&&near(t,offs,0.07)).length/Math.max(1,cuts.length);
    const bounds=[0,...cuts,W.end], shots=[]; for(let i=1;i<bounds.length;i++){ const a=bounds[i-1], b=bounds[i]; if(b-a<0.15) continue; const bi=Math.max(0,B.findIndex(x=>x>=(a+b)/2)), e=an.E[Math.min(an.E.length-1,bi)]||0.5;
      const mv=W.frames.filter(f=>f.t>a+0.1&&f.t<b-0.1).map(f=>f.diff); shots.push({len:b-a,e,mv:mv.length?mv.reduce((x,y)=>x+y,0)/mv.length:0}); }
    if(shots.length<6) throw new Error("couldn't find enough cuts in it (is it a single long take or a still?)");
    const band=(lo,hi)=>{ const s=shots.filter(x=>x.e>=lo&&x.e<hi); return s.length>=3?s.reduce((a,x)=>a+x.len,0)/s.length:null; };
    const asl=shots.reduce((a,x)=>a+x.len,0)/shots.length, mvs=shots.map(x=>x.mv).sort((a,b)=>a-b);
    const stats={asl:+asl.toFixed(2), quiet:band(0,0.4), mid:band(0.4,0.7), loud:band(0.7,1.01), onBeat:+onBeat.toFixed(2), onDown:+onDown.toFixed(2), offBeat:+offBeat.toFixed(2),
      takes:+(shots.filter(x=>x.len>4).length/(W.end/60)).toFixed(2), motion:+(mvs[mvs.length>>1]).toFixed(2), bpm:Math.round(an.bpm), cuts:cuts.length, secs:Math.round(W.end)};
    REF={name:file.name.replace(/\.[^.]+$/,"").slice(0,60), stats, at:Date.now()}; try{ localStorage.setItem("beatsplicerRef",JSON.stringify(REF)); }catch(e){}
    $("refOn").checked=true; saveSettings(); renderRef(); if(!S.running&&S.plan) buildPlan(); }
  catch(e){ out.textContent="Couldn't learn from that video: "+(e&&e.message||e); } }
function refWords(){ if(!REF||!REF.stats) return ""; const s=REF.stats, f=x=>x==null?"–":x.toFixed(1)+" s";
  return `“${REF.name}”: ${s.asl.toFixed(1)} s average shot (quiet ${f(s.quiet)}, middle ${f(s.mid)}, loud ${f(s.loud)}); ${Math.round(s.onBeat*100)}% of cuts on the beat, ${Math.round(s.onDown*100)}% on the downbeat, ${Math.round(s.offBeat*100)}% off the beat; ${s.takes.toFixed(1)} long takes a minute; ${s.motion>8?"lively":s.motion>3?"steady":"calm"} footage.`; }
function renderRef(){ const el=$("refInfo"); if(el) el.textContent=REF?refWords():"No reference yet."; }
/* the borrowed habits */
function refPaceK(e,ours){ if(!refOn()) return 1; const s=REF.stats, theirs=e<0.4?(s.quiet??s.asl):e<0.7?(s.mid??s.asl):(s.loud??s.asl); return Math.max(0.45,Math.min(2.2,theirs/ours)); }
function refSyncGap(){ if(!refOn()) return 12; const o=REF.stats.offBeat; return o>0.3?4:o>0.15?7:o<0.05?999:12; }
function refTakes(dur){ if(!refOn()) return null; return Math.max(0,Math.min(4,Math.round(REF.stats.takes*dur/60))); }
function refMotionCost(clip,s){ if(!refOn()) return 0; const want=Math.max(0,Math.min(1,REF.stats.motion/12)), have=clip.kind==="image"?0.05:Math.max(0,Math.min(1,(s.motion||0)/12)); return 0.4*Math.abs(want-have); }
$("refFile").addEventListener("change",e=>{ const f=e.target.files&&e.target.files[0]; if(f&&needTier("reference")) learnReference(f); e.target.value=""; });
$("refOn").addEventListener("change",()=>{ saveSettings(); if(!S.running) buildPlan(); }); renderRef();
