/* ---------------- Uniqueness ----------------
   Platforms penalise videos that look templated, with little variation between uploads (YouTube "inauthentic content"),
   and reposts without meaningful creative change (Instagram, TikTok). So each version is fingerprinted by what is on screen
   moment to moment (which footage, which part of it) and by its look, and compared with earlier versions and exports. */
function clipKey(ci){ const c=S.clips[ci]; return c? c.name+"|"+(c.file?c.file.size:0) : "?"; }
function planPrint(plan,win,step=0.5){ const out=[]; let k=0;
  for(let t=win[0]+0.01;t<win[1];t+=step){ while(k<plan.length-1 && t>=plan[k].end) k++; const s=plan[k]; out.push(clipKey(s.clip)+"@"+Math.floor((s.src+Math.max(0,t-s.start))/1.5)); }
  return out; }
const FX_IDS=["fxPulse","fxShake","fxGlitch","fxGrain","fxVignette","fxBars","kb","fxFisheye","fxSplit","fxMultiply","fxMirror","fxStrobe","fxHandheld","fxWash","fxDoodles"];
function styleSig(){ const v=id=>$(id)?($(id).type==="checkbox"?String($(id).checked):$(id).value):""; return {look:$("look").value, dir:S.direct||"", trans:$("trans").value, fx:FX_IDS.filter(id=>$(id).checked).join(","), more:[v("lens"),v("camEnergy"),v("motif"),v("sigTrans"),v("textStyle"),S._paceName||""].join("|")}; }
function currentPrint(){ if(!S.plan) return null; const ep=EP(S.eps[0])||ENDPOINTS[0], w=windowFor(ep), plan=makeExportPlan(ep,w)||S.plan;
  return {shots:planPrint(plan,w,1), style:styleSig(), ep:ep.id, title:smartTitle(), date:today()}; }
function printSim(a,b){
  if(!a||!b) return 0;
  const n=Math.min(a.shots.length,b.shots.length); let same=0;
  for(let i=0;i<n;i++){ if(a.shots[i]===b.shots[i]) same++; else if(a.shots[i].split("@")[0]===b.shots[i].split("@")[0]) same+=0.25; }
  const shot=n?same/n:0, A=new Set(a.shots), B=new Set(b.shots); let inter=0; A.forEach(x=>{ if(B.has(x)) inter++; });
  const jac=inter/Math.max(1,A.size+B.size-inter);
  const fa=new Set(a.style.fx.split(",").filter(Boolean)), fb=new Set(b.style.fx.split(",").filter(Boolean)); let fi=0; fa.forEach(x=>{ if(fb.has(x)) fi++; });
  const fx=(fa.size+fb.size)?fi/(fa.size+fb.size-fi):1;
  const ma=(a.style.more||"").split("|"), mb=(b.style.more||"").split("|"), mo=ma.length===mb.length&&ma.length>1?ma.filter((x,i)=>x&&x===mb[i]).length/ma.length:0.5;
  const st=((a.style.look===b.style.look&&a.style.look!=="own")+(a.style.dir===b.style.dir)+(a.style.trans===b.style.trans)+fx+2*mo)/6; /* "own" differs every video */
  return 0.45*shot+0.25*jac+0.30*st;
}
function loadHistory(){ try{ return JSON.parse(localStorage.getItem("beatsplicerHistory")||"[]"); }catch(e){ return []; } }
function saveHistory(entries){ try{ const h=loadHistory().concat(entries).slice(-40); localStorage.setItem("beatsplicerHistory",JSON.stringify(h)); }catch(e){} }
function closestTo(p,refs){ let best=null; for(const r of refs){ const s=printSim(p,r); if(!best||s>best.sim) best={sim:s,ref:r}; } return best; }
S.versions=[]; S.verIdx=-1;
function snapshot(){ const look={}; LOOK_IDS.forEach(id=>{ const el=$(id); if(el) look[id]=el.type==="checkbox"?el.checked:el.value; });
  return {seed:S.seed, winPick:S.winPick||0, direct:S.direct||null, directSel:$("direct").value, look, eq:JSON.parse(JSON.stringify(EQ))}; }
function restore(v){
  S.seed=v.seed; S.winPick=v.winPick; S.direct=v.direct; $("direct").value=v.directSel;
  Object.entries(v.look).forEach(([id,val])=>setControl(id,val)); Object.assign(EQ,JSON.parse(JSON.stringify(v.eq))); syncEq();
  $("directWhy").textContent=v.direct?`Directing as “${v.direct}”. ${DSTYLES[v.direct].d}`:"";
  buildPlan();
}
function renderVersions(note){
  const n=S.versions.length; $("verPrev").disabled=S.verIdx<=0; $("verNext").disabled=S.verIdx>=n-1;
  if(!n){ $("verInfo").textContent=""; return; }
  const v=S.versions[S.verIdx], others=S.versions.filter((_,i)=>i!==S.verIdx).map(x=>x.print).concat(loadHistory());
  const c=closestTo(v.print,others), diff=c?Math.round((1-c.sim)*100):100;
  $("verInfo").textContent=`Version ${S.verIdx+1} of ${n}${c?`, ${diff}% different from the closest other version`:""}${v.direct?` (${v.direct})`:""}.${note?" "+note:""}`;
}
async function remix(){ if(S.plan) recordUsage(S.plan); refreshExclusion(true);
  if(!S.plan || S.running) return;
  if(!S.versions.length){ S.versions.push({...snapshot(),print:currentPrint()}); S.verIdx=0; }
  const refs=S.versions.map(v=>v.print).concat(loadHistory());
  const autoDir=$("direct").value==="auto" && S.an && S.clips.length;
  const ranked=autoDir?rankDirectors():[];
  const keep=snapshot(); let best=null;
  for(let k=0;k<12;k++){
    restore(keep);
    S.seed=(Math.random()*1e9)|0; S.winPick=(keep.winPick+1+k)%3;
    if(autoDir && k%3===2 && ranked.length>1){ const alt=ranked[1+(Math.floor(k/3)%Math.min(2,ranked.length-1))]; setDirect(alt.name,alt.why+" (remix)"); }
    else buildPlan();
    const p=currentPrint(), c=closestTo(p,refs), sim=c?c.sim:0;
    if(!best||sim<best.sim) best={snap:snapshot(),print:p,sim};
    if(sim<0.4) break;
  }
  restore(best.snap);
  S.versions.push({...best.snap,print:best.print}); S.verIdx=S.versions.length-1;
  renderVersions(best.sim>0.6?"Your footage is limiting how different a remix can be. Add more clips for fresher versions.":"");
  status("Remixed: a new cut, opening and shot order.");
}
function rankDirectors(){ const f=songFeatures(); const out=[];
  for(const [name,p] of Object.entries(DPROFILE)){ const mid=(p.bpm[0]+p.bpm[1])/2, half=(p.bpm[1]-p.bpm[0])/2, tempo=Math.max(0,1-Math.max(0,Math.abs(f.bpm-mid)-half)/25);
    const fe=S.an&&S.an.feel||{}, calm=["Dreamlike calm","Stark monochrome","Playful one-take","Symmetry"].includes(name), hype=["Fisheye glam","Glossy colour field","Painterly surreal","Frantic strobe"].includes(name);
    const feelFit=(fe.free?(calm?1.5:-1):0)+(fe.four?(hype?0.6:calm?-0.4:0):0)+(fe.halftime?(["Dark precision","Fisheye glam","Glitch nightmare"].includes(name)?0.5:0):0)+(fe.swing>0.5?(["Playful one-take","Doodle pop","Fisheye glam"].includes(name)?0.4:0):0)+(fe.meter===3?(calm?0.6:0):0);
    out.push({name, sc:2*tempo+1.5*(1-Math.abs(f.energy-p.energy))+1.2*(1-Math.abs(f.motion-p.motion))+1*(1-Math.abs(f.bright-p.bright))+0.6*(1-Math.abs(f.bass-p.bass))+feelFit, why:"also suits this song"}); }
  return out.sort((a,b)=>b.sc-a.sc); }


/* house style: the lettering and ending that make the channel recognisable, kept while everything else varies */
function houseStyle(){ try{ return JSON.parse(localStorage.getItem("beatsplicerHouse")||"null"); }catch(e){ return null; } }
function saveHouseStyle(){ const h={text:$("textStyle").value, end:$("endStyle")?$("endStyle").checked:null, at:Date.now()}; try{ localStorage.setItem("beatsplicerHouse",JSON.stringify(h)); }catch(e){}
  $("houseOn").checked=true; saveSettings(); renderHouse(); status(`House style kept: ${$("textStyle").selectedOptions[0].textContent.toLowerCase()} lettering and ${h.end?"finishing with the song":"your own ending"}. Do everything keeps these and varies the rest.`); }
function renderHouse(){ const h=houseStyle(), el=$("houseInfo"); if(!el) return; el.textContent=h?`Kept: ${h.text} lettering, ${h.end?"finishing with the song":"your own ending"}.`:"Nothing kept yet."; }
