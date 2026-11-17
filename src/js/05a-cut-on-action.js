/* ---------------- Cut on the action: movement that lands on the music ----------------
   Cuts already fall on beats. This decides where inside each clip a shot starts, so that what moves in the picture
   moves with the song: a head turn, a wave breaking or a car passing starts on a beat, and the shot opens while
   something is already moving (an editor's "cut on action", which hides the cut and carries energy across it).
   How: for each shot in the edit, the app measures movement six times a second around its chosen moment, then
   slides the start up to two-thirds of a second either way to the position where movement starts land on beats,
   downbeats counting most. It never slides through a cut in the source, into another use of the same footage, or
   past the clip's ends, and leaves alone shots placed by hand, locked, reversed, ramped, frozen or repeated on purpose.
   Measuring runs in the background after the edit is built and keeps its results, so rebuilding is instant. */
const ACT_FPS=6, ACT_SLIDE=4, ACT_FINE=2; // measured every 1/6 s; slides in steps of 1/12 s, up to 0.67 s either way
function actSkip(s,c){ return !c||c.kind==="image"||s._manual||s._lock||s._rev||s._ramp||s._freeze||s._refrain||s._bookend||s._loop||s._pattern||s._endShot||(s.end-s.start)<0.45||(s.end-s.start)>4; }
function actWindow(s,c){ const r=s._rate||1, D=(s.end-s.start)*r, b=s._actBase!=null&&s._actBaseClip===s.clip?s._actBase:(s.src||0), k0=Math.max(0,Math.floor((b-ACT_SLIDE/ACT_FPS)*ACT_FPS)-2), k1=Math.min(Math.floor((c.dur-0.05)*ACT_FPS)-1,Math.ceil((b+D+ACT_SLIDE/ACT_FPS)*ACT_FPS)+2); return [k0,k1]; }
function actMissing(s,c){ const m=c._act; if(!m) return true; const [k0,k1]=actWindow(s,c); for(let k=k0;k<=k1;k++) if(!m.has(k)) return true; return false; }
/* the score of a start point: movement starting (or surging) on the beats inside the shot, and movement at the cut */
function actScore(s,c,src){ const m=c._act, r=s._rate||1, D=s.end-s.start; const at=t=>{ const x=t*ACT_FPS-0.5, k=Math.floor(x), f=x-k, a=m.get(k), b=m.get(k+1); return a==null||b==null?(a??b??null):a+(b-a)*f; }; // between measurements, interpolated
  const on=t=>{ const a=at(t), b=at(t-1/ACT_FPS); return a==null||b==null?null:Math.max(0,a-b)+0.35*a; };
  let sc=0, n=0; const B=S.an.beats;
  for(let i=0;i<B.length;i++){ const b=B[i]; if(b<=s.start+0.05) continue; if(b>=s.end-0.05) break; const v=on(src+(b-s.start)*r); if(v==null) return -1; sc+=v*(isDownAt(S.an,i)?1:0.5); n++; }
  const c0=at(src); if(c0==null) return -1; sc+=0.8*c0; // something already moving as the shot opens
  return sc/(n*0.75+0.8); }
function actCutInside(c,a,b){ const m=c._act; for(let k=Math.floor(a*ACT_FPS);k<Math.ceil(b*ACT_FPS);k++){ const v=m.get(k); if(v!=null&&v>34) return true; } return false; }
/* slide each shot's start to where its movement meets the music (uses only what has been measured) */
function actionAlign(plan){ if(!plan||!S.an||!S.an.beats||!$("cutAction")||!$("cutAction").checked) return 0; let moved=0;
  plan.forEach((s,i)=>{ const c=S.clips[s.clip]; s._act=null; if(actSkip(s,c)||actMissing(s,c)) return;
    const r=s._rate||1, D=(s.end-s.start)*r, base=s._actBase!=null&&s._actBaseClip===s.clip?s._actBase:s.src||0; s._actBase=base; s._actBaseClip=s.clip;
    const span=x=>(x.end-x.start)*Math.max(1,x._rate||1), others=plan.filter((x,j)=>j!==i&&x.clip===s.clip).map(x=>[x.src||0,(x.src||0)+span(x)]); // generous spans: slow motion is counted at full length
    const s0=actScore(s,c,base); if(s0<0) return; let best=base, bs=s0;
    for(let d=-ACT_SLIDE*ACT_FINE;d<=ACT_SLIDE*ACT_FINE;d++){ if(!d) continue; const src=base+d/(ACT_FPS*ACT_FINE); if(src<0.05||src+D>c.dur-0.1) continue;
      if(others.some(([a,b])=>src<b+0.05&&src+span(s)>a-0.05)) continue; if(actCutInside(c,Math.min(src,base),Math.max(src,base)+D)) continue;
      const v=actScore(s,c,src)-0.02*Math.abs(d)*Math.max(0.5,s0); if(v>bs){ bs=v; best=src; } }
    if(best!==base&&bs>s0*1.15+0.3){ s.src=+best.toFixed(3); s._act={from:base,by:+(best-base).toFixed(2),gain:+(bs/Math.max(0.1,s0)).toFixed(2)}; moved++; } else s.src=base; });
  return moved; }
/* background measuring: movement six times a second around each shot of the current edit */
async function measureAction(){ if(S._actBusy||!S.plan||!$("cutAction")||!$("cutAction").checked) return; const plan=S.plan;
  const need=plan.filter(s=>{ const c=S.clips[s.clip]; return !actSkip(s,c)&&c.file&&actMissing(s,c); }); if(!need.length) return; S._actBusy=true;
  try{ await heavy("Timing movement to the music",async()=>{ const v=analysisPlayer(), W=64, H=36, cv=document.createElement("canvas"); cv.width=W; cv.height=H; const g=cv.getContext("2d",{willReadFrequently:true});
      const grab=async t=>{ await seekTo(v,t); g.drawImage(v,0,0,W,H); const d=g.getImageData(0,0,W,H).data, L=new Uint8Array(W*H); for(let i=0;i<L.length;i++) L[i]=(77*d[i*4]+150*d[i*4+1]+29*d[i*4+2])>>8; return L; };
      const byClip=new Map(); need.forEach(s=>{ const c=S.clips[s.clip]; if(!byClip.has(c)) byClip.set(c,[]); byClip.get(c).push(s); }); let n=0;
      for(const [c,segs] of byClip){ while(S.running) await new Promise(r=>setTimeout(r,2000)); if(S.plan!==plan) break; if(!S.clips.includes(c)) continue; c._act=c._act||new Map();
        const url=URL.createObjectURL(c.file); try{ v.src=url; await waitEvent(v,"loadeddata",15000);
          for(const s of segs){ const [k0,k1]=actWindow(s,c); let prev=null, pk=-9;
            for(let k=k0;k<=k1+1;k++){ const want=(k<=k1&&!c._act.has(k))||(k-1>=k0&&!c._act.has(k-1)); if(!want){ prev=null; continue; } const L=await grab(k/ACT_FPS);
              if(prev&&pk===k-1&&!c._act.has(k-1)){ let m=0; for(let i=0;i<L.length;i++) m+=Math.abs(L[i]-prev[i]); c._act.set(k-1,+(m/L.length).toFixed(2)); }
              prev=L; pk=k; } } }
        catch(e){} finally{ v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); }
        n++; if(n%4===0||n===byClip.size) status(`Timing movement to the music: ${n} of ${byClip.size} clips (in the background). You can keep working.`); }
      if(S.plan===plan&&!S.running){ const k=actionAlign(plan); if(k){ status(`Movement timed to the music: ${k} shots now start where their action lands on the beat.`); if(typeof renderTimeline==="function") try{ renderTimeline(); }catch(e){} } } }); }
  finally{ S._actBusy=false; } }
