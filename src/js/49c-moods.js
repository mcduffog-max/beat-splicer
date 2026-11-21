/* ---------------- Mood cards ----------------
   Seven moods instead of a page of settings. Each card shows your own clips in that mood's colour, cutting at that mood's
   pace, so you can see the difference before you tap. A tap remakes the cut in that mood and plays it. "Yours" is the
   app's own choice for this song and footage (Do everything). */
const MOODS=[
  {k:"yours",name:"Yours",d:"Chosen for this song",style:null,look:"own",ms:850},
  {k:"hype",name:"Hype",d:"Fast, punchy",style:"Hype edit",look:"vivid",ms:260},
  {k:"cine",name:"Cinematic",d:"Slow and wide",style:"Cinematic",look:"tealorange",ms:1300,bars:true},
  {k:"dream",name:"Dreamy",d:"Soft, floating",style:"8D dream",look:"moody",ms:1500},
  {k:"retro",name:"Retro",d:"Home-video",style:"Retro VHS",look:"vhs",ms:700,grain:true},
  {k:"raw",name:"Raw",d:"Hard cuts, real colour",style:"Clean",look:"none",ms:600},
  {k:"dark",name:"Dark",d:"Tense and controlled",style:"Dark precision",look:"fincher",ms:1000,grain:true},
  {k:"mono",name:"Mono",d:"Black and white",style:"Stark monochrome",look:"bw",ms:1400,grain:true}];
function moodFilter(m){ if(m.look==="own") return "saturate(1.15) contrast(1.06)"; const L=LOOKS[m.look]; return L&&L.f&&L.f!=="none"?L.f:"none"; }
let _moodT=null, _moodTick=0;
function renderMoods(){ const box=$("moods"); if(!box) return; const thumbs=S.clips.filter(c=>c.thumb&&!c.off).map(c=>c.thumb); if(!thumbs.length){ box.innerHTML=""; return; }
  if(!box.children.length){ MOODS.forEach(m=>{ const b=document.createElement("button"); b.type="button"; b.className="mood"; b.dataset.k=m.k; b.setAttribute("aria-pressed","false");
      const v=document.createElement("span"); v.className="mv"; v.style.filter=moodFilter(m); if(m.bars){ ["t","b"].forEach(x=>{ const i=document.createElement("i"); i.className="bars "+x; v.appendChild(i); }); } if(m.grain){ const g=document.createElement("i"); g.className="grain"; v.appendChild(g); }
      const n=document.createElement("b"); n.textContent=m.name; const d=document.createElement("small"); d.textContent=m.d; b.append(v,n,d); b.onclick=()=>pickMood(m); box.appendChild(b); }); }
  const cur=S._mood||null; box.querySelectorAll(".mood").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.k===cur)));
  box.querySelectorAll(".mood").forEach((b,i)=>{ const v=b.querySelector(".mv"); if(!v.style.backgroundImage) v.style.backgroundImage=`url(${thumbs[i%thumbs.length]})`; }); }
/* each card cuts between your clips at its own pace (only while on screen, and not for people who prefer less motion) */
function moodLoop(){ const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches, box=$("moods"); if(!box||reduce) return; const thumbs=S.clips.filter(c=>c.thumb&&!c.off).map(c=>c.thumb); if(thumbs.length<2) return;
  _moodTick+=100; const vis=box.getBoundingClientRect(); if(vis.bottom<0||vis.top>innerHeight||$("mainAct").hidden) return;
  box.querySelectorAll(".mood").forEach((b,i)=>{ const m=MOODS[i]; if(_moodTick%m.ms<100){ const v=b.querySelector(".mv"), k=((_moodTick/m.ms|0)+i*3)%thumbs.length; v.style.backgroundImage=`url(${thumbs[k]})`; } }); }
setInterval(moodLoop,100);
async function pickMood(m){ if(S.running) $("preview").click(); if(S.running||S._auto) return; S._mood=m.k; renderMoods(); crumb("mood: "+m.name);
  if(m.style){ if(DSTYLES[m.style]){ $("direct").value=m.style; setDirect(m.style,""); } else applyStyle(m.style); }
  else { try{ await autopilot(); }catch(e){} }
  status(`${m.name}: ${m.d.toLowerCase()}. Playing it now.`); setTimeout(()=>{ if(!S.running&&S.plan) $("preview").click(); },350); }
setInterval(renderMoods,1000);
