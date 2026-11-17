/* ---------------- Styles: current trends, and techniques of influential music-video directors ---------------- */
const FX_OFF={fxPulse:false,fxShake:false,fxGlitch:false,fxGrain:false,fxVignette:false,fxBars:false,kb:false,
  fxFisheye:false,fxSplit:false,fxMultiply:false,fxMirror:false,fxStrobe:false,fxHandheld:false,fxWash:false,fxDoodles:false,slowmo:"off",fit:"fill"};
const STYLES={
  "Hype edit":{d:"Fast cuts, punchy zooms and glitches on the drop, the current short-form look.",
    pace:1.5,trans:"auto",trLen:0.3,look:"vivid",fxPulse:true,fxShake:true,fxGlitch:true,fxVignette:true,space:"pingpong",spaceAmt:0.6},
  "Cinematic":{d:"Slow crossfades, teal and orange grade, film grain and widescreen bars.",
    pace:0.75,trans:"crossfade",trLen:0.7,look:"tealorange",fxGrain:true,fxVignette:true,fxBars:true,kb:true,space:"hall",spaceAmt:0.4},
  "Retro VHS":{d:"Scanlines, colour bleed and glitches, a nostalgic home-video feel.",
    pace:1,trans:"auto",trLen:0.4,look:"vhs",fxPulse:true,fxGlitch:true,fxGrain:true,fxVignette:true,space:"wide",spaceAmt:0.5},
  "8D dream":{d:"Soft and floating, with sound that circles your head. Use headphones.",
    pace:0.75,trans:"crossfade",trLen:0.9,look:"moody",fxPulse:true,fxGrain:true,fxVignette:true,kb:true,space:"8d",spaceAmt:0.7},
  "Clean":{d:"Hard cuts on the beat and natural colour. Nothing added.",
    pace:1,trans:"cut",trLen:0.4,look:"none",space:"off",spaceAmt:0.5}
};
const DSTYLES={
  "Fisheye glam":{d:"Inspired by Hype Williams: fisheye lens, saturated red and blue light, slow motion, and his split letterbox with extra copies of the shot in the bars.",
    pace:1,trans:"auto",trLen:0.4,look:"neon",fxFisheye:true,fxSplit:true,fxPulse:true,slowmo:"quiet",space:"wide",spaceAmt:0.5},
  "Glossy colour field":{d:"Inspired by Director X: glossy, graphic frames where colour sets the mood, shifting with each section rather than telling a story.",
    pace:1,trans:"cut",trLen:0.3,look:"glossy",fxWash:true,kb:true,space:"wide",spaceAmt:0.4},
  "Painterly surreal":{d:"Inspired by Dave Meyers: frames that look like paintings, blue-green and beige tones, bold zooms and whips.",
    pace:1.25,trans:"auto",trLen:0.4,look:"painterly",fxPulse:true,fxVignette:true,kb:true,space:"hall",spaceAmt:0.3},
  "Infinite loop":{d:"Inspired by Michel Gondry: images that multiply to the beat, in-camera trickery and a handmade warmth.",
    pace:1,trans:"cut",trLen:0.3,look:"warmfilm",fxMultiply:true,fxGrain:true,space:"pingpong",spaceAmt:0.4},
  "Playful one-take":{d:"Inspired by Spike Jonze: long handheld takes, natural light and very few cuts, letting the moment play out.",
    pace:0.5,trans:"crossfade",trLen:0.3,look:"warmfilm",fxHandheld:true,kb:true,space:"off",spaceAmt:0.5},
  "Dark precision":{d:"Inspired by David Fincher: dark, desaturated green-yellow grade, controlled push-ins and clean cuts.",
    pace:0.75,trans:"cut",trLen:0.3,look:"fincher",kb:true,fxVignette:true,fxGrain:true,space:"hall",spaceAmt:0.25},
  "Stark monochrome":{d:"Inspired by Anton Corbijn: grainy black and white, stark compositions and long, still holds.",
    pace:0.5,trans:"dip",trLen:0.6,look:"bw",fxGrain:true,fxVignette:true,slowmo:"quiet",space:"hall",spaceAmt:0.35},
  "Frantic strobe":{d:"Inspired by Jonas Åkerlund: frantic editing, strobes, flashes and shaking hits at full intensity.",
    pace:2,trans:"flash",trLen:0.2,look:"vivid",fxStrobe:true,fxShake:true,fxGlitch:true,space:"pingpong",spaceAmt:0.7},
  "Dreamlike calm":{d:"Inspired by Hiro Murai: unhurried long takes, slow motion, moody night tones and wide framing.",
    pace:0.5,trans:"crossfade",trLen:1.0,look:"moody",slowmo:"all",fxBars:true,fxVignette:true,space:"hall",spaceAmt:0.5},
  "Doodle pop":{d:"Inspired by Cole Bennett and Lyrical Lemonade: bright colour, quick zooms and hand-drawn doodles bursting on the beat.",
    pace:1.5,trans:"auto",trLen:0.3,look:"vivid",fxDoodles:true,fxPulse:true,space:"pingpong",spaceAmt:0.5},
  "Symmetry":{d:"Inspired by Mark Romanek: precise mirrored compositions, cool tones and slow, deliberate movement.",
    pace:0.75,trans:"crossfade",trLen:0.6,look:"cold",fxMirror:true,kb:true,fxVignette:true,space:"wide",spaceAmt:0.4},
  "Glitch nightmare":{d:"Inspired by Chris Cunningham: cold, unsettling, with stutters, strobes and violent glitches on the hits.",
    pace:1.5,trans:"cut",trLen:0.2,look:"cold",fxGlitch:true,fxStrobe:true,fxShake:true,fxGrain:true,space:"8d",spaceAmt:0.4}
};
/* How each director handles quiet, middle and loud sections: transition (t), pace multiplier (p) and effect overrides (fx). */
const DIRECT={
  "Fisheye glam":{eq:"Bass boost",txt:"bold",still:"bounce",q:{t:"crossfade",p:0.8,fx:{slowmo:"all"}},m:{t:"auto",p:1},l:{t:"flash",p:1.3,fx:{pulse:true,shake:true}}},
  "Glossy colour field":{eq:"Bass boost",txt:"caps",still:"zoomin",q:{t:"dip",p:0.7},m:{t:"cut",p:1},l:{t:"cut",p:1.4,fx:{pulse:true}}},
  "Painterly surreal":{eq:"Flat",txt:"serif",still:"parallax",q:{t:"crossfade",p:0.7,fx:{kb:true}},m:{t:"whip",p:1},l:{t:"zoom",p:1.3}},
  "Infinite loop":{eq:"Flat",txt:"hand",still:"bounce",q:{t:"cut",p:0.8,fx:{multiply:false}},m:{t:"cut",p:1},l:{t:"cut",p:1.2,fx:{multiply:true}}},
  "Playful one-take":{eq:"Flat",txt:"hand",still:"pan",q:{t:"crossfade",p:0.5},m:{t:"crossfade",p:0.7},l:{t:"whip",p:1}},
  "Dark precision":{eq:"Flat",txt:"caps",still:"zoomin",q:{t:"cut",p:0.7},m:{t:"cut",p:1},l:{t:"cut",p:1.25}},
  "Stark monochrome":{eq:"Vocal",txt:"serif",still:"drift",q:{t:"dip",p:0.6,fx:{slowmo:"all"}},m:{t:"dip",p:0.8},l:{t:"cut",p:1}},
  "Frantic strobe":{eq:"Loudness",txt:"outline",still:"bounce",q:{t:"cut",p:1,fx:{strobe:false,shake:false}},m:{t:"flash",p:1.3},l:{t:"flash",p:1.6,fx:{strobe:true,glitch:true}}},
  "Dreamlike calm":{eq:"Flat",txt:"serif",still:"drift",q:{t:"crossfade",p:0.5,fx:{slowmo:"all"}},m:{t:"crossfade",p:0.7},l:{t:"dip",p:0.9,fx:{slowmo:"off"}}},
  "Doodle pop":{eq:"Bass boost",txt:"hand",still:"bounce",q:{t:"crossfade",p:0.9,fx:{doodles:false}},m:{t:"auto",p:1.2},l:{t:"zoom",p:1.5,fx:{doodles:true,pulse:true}}},
  "Symmetry":{eq:"Treble boost",txt:"caps",still:"zoomout",q:{t:"crossfade",p:0.7},m:{t:"crossfade",p:0.9},l:{t:"cut",p:1.1}},
  "Glitch nightmare":{eq:"Loudness",txt:"outline",still:"bounce",q:{t:"dip",p:0.8,fx:{glitch:false,strobe:false}},m:{t:"cut",p:1.2,fx:{glitch:true}},l:{t:"flash",p:1.6,fx:{strobe:true,shake:true}}}
};
/* What suits each director: tempo range, song energy, footage motion and brightness, and tone (bass-heavy or bright). */
const DPROFILE={
  "Fisheye glam":{bpm:[80,105],energy:0.5,motion:0.5,bright:0.5,bass:1},
  "Glossy colour field":{bpm:[95,130],energy:0.5,motion:0.4,bright:0.75,bass:1},
  "Painterly surreal":{bpm:[90,130],energy:0.55,motion:0.5,bright:0.55,bass:0.5},
  "Infinite loop":{bpm:[110,135],energy:0.5,motion:0.5,bright:0.6,bass:0.4},
  "Playful one-take":{bpm:[90,125],energy:0.45,motion:0.2,bright:0.7,bass:0.4},
  "Dark precision":{bpm:[80,120],energy:0.4,motion:0.35,bright:0.2,bass:0.5},
  "Stark monochrome":{bpm:[60,95],energy:0.25,motion:0.2,bright:0.3,bass:0.4},
  "Frantic strobe":{bpm:[125,180],energy:0.85,motion:0.85,bright:0.5,bass:0.5},
  "Dreamlike calm":{bpm:[55,90],energy:0.2,motion:0.2,bright:0.3,bass:0.5},
  "Doodle pop":{bpm:[120,165],energy:0.75,motion:0.6,bright:0.8,bass:1},
  "Symmetry":{bpm:[70,110],energy:0.35,motion:0.25,bright:0.6,bass:0.2},
  "Glitch nightmare":{bpm:[125,180],energy:0.8,motion:0.7,bright:0.2,bass:0}
};
/* How each director cuts: the grid cuts land on, target shot length (s) for quiet, middle and loud sections, and how irregular it is. */
const DCUT={
  "Fisheye glam":{unit:"beat",q:2.6,m:1.6,l:0.8,v:0.3,how:"slow-motion holds in the verses, punchy cuts on every beat in the chorus"},
  "Glossy colour field":{unit:"bar",q:3,m:2.2,l:1.6,v:0.1,how:"clean cuts on the bar, each frame a composed tableau"},
  "Painterly surreal":{unit:"beat",q:2.6,m:1.7,l:1.0,v:0.25,how:"painterly holds broken by zooms and whips on the beat"},
  "Infinite loop":{unit:"bar",q:2.2,m:2,l:1.1,v:0,pattern:true,how:"rhythmic repetition, shots returning in an A-B-A-B pattern on the bar"},
  "Playful one-take":{unit:"phrase",q:9,m:7,l:4.5,v:0.2,how:"long takes that cut only at the end of a musical phrase"},
  "Dark precision":{unit:"bar",q:3.2,m:2.3,l:1.6,v:0.05,how:"precise, metronomic cuts on the bar line"},
  "Stark monochrome":{unit:"bar",q:6,m:4,l:2.6,v:0.15,how:"long, still holds that change on the bar"},
  "Frantic strobe":{unit:"half",q:0.9,m:0.55,l:0.3,v:0.5,how:"frantic cuts on beats and off-beats"},
  "Dreamlike calm":{unit:"phrase",q:10,m:7,l:4.5,v:0.25,how:"unhurried takes that breathe across whole phrases"},
  "Doodle pop":{unit:"beat",q:1.3,m:0.85,l:0.5,v:0.3,how:"bouncy cuts on the beat"},
  "Symmetry":{unit:"bar",q:4,m:3,l:2.2,v:0.05,how:"measured cuts on the bar, holding each symmetrical frame"},
  "Glitch nightmare":{unit:"half",q:1.6,m:0.7,l:0.35,v:0.6,how:"irregular stutter cuts that fight the beat"}
};
function dcut(){ return S.direct && DCUT[S.direct]; }

const FXKEY={pulse:"pulse",shake:"shake",glitch:"glitch",strobe:"strobe",slowmo:"slowmo",split:"split",multiply:"multiply",doodles:"doodles",wash:"wash",handheld:"handheld",fisheye:"fisheye",mirror:"mirror",bars:"bars",kb:"kb"};
const secOf=e=>e<0.35?"q":e>0.65?"l":"m";
function directOn(){ return S.direct && DIRECT[S.direct]; }
function fxFor(F,seg,idx){
  if(!seg) return F; let out=F;
  const D=directOn(), sec=D&&D[secOf(seg.e)];
  if(sec&&sec.fx){ seg._fx=seg._fx&&seg._fxBase===F?seg._fx:{...F,...sec.fx}; seg._fxBase=F; out=seg._fx; }
  return motifFx(out,seg);
}
function songFeatures(){
  const E=S.an.E, loudShare=E.filter(e=>e>0.65).length/E.length;
  const mots=[], brs=[]; S.clips.forEach(c=>(c.samples||[]).forEach(s=>{ if(!s.still) mots.push(s.motion); brs.push(s.bright); }));
  const med=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]:null;
  const m=med(mots), b=med(brs);
  return { bpm:S.an.bpm, energy:Math.min(1,0.35*loudShare/0.35+0.5*Math.min(1,Math.max(0,(S.an.bpm-70)/90))), motion:m==null?0.4:Math.min(1,m/12), bright:b==null?0.5:Math.min(1,b/200), bass:S.an.centroid<1400?1:S.an.centroid<2400?0.5:0 };
}
function pickDirector(){
  const f=songFeatures(); let best=null, bs=-1e9;
  for(const [name,p] of Object.entries(DPROFILE)){
    const mid=(p.bpm[0]+p.bpm[1])/2, half=(p.bpm[1]-p.bpm[0])/2;
    const tempo=Math.max(0,1-Math.max(0,Math.abs(f.bpm-mid)-half)/25);
    const sc=2*tempo+1.5*(1-Math.abs(f.energy-p.energy))+1.2*(1-Math.abs(f.motion-p.motion))+1*(1-Math.abs(f.bright-p.bright))+0.6*(1-Math.abs(f.bass-p.bass));
    if(sc>bs){ bs=sc; best=name; }
  }
  const why=[`${Math.round(f.bpm)} BPM`, f.energy>0.6?"high-energy song":f.energy<0.35?"calm song":"mid-energy song",
    f.motion>0.6?"busy footage":f.motion<0.3?"still footage":"moderate movement", f.bright>0.6?"bright shots":f.bright<0.35?"dark shots":"mixed light", f.bass?"bass-heavy mix":"bright, airy mix"];
  return {name:best, why:why.join(", ")};
}
function setDirect(name,why){
  S.direct=name||null;
  if(name){ applyStyle(name,true); $("directWhy").textContent=`Directing as “${name}”${why?" because: "+why:""}. ${DSTYLES[name].d}`; }
  else $("directWhy").textContent="";
  if(!S.running) buildPlan();
}
async function aiChooseDirector(){
  const id=[...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v]); if(!id||!S.plan) return;
  $("aiDirect").disabled=true; $("directWhy").textContent="Asking AI to choose a director…";
  try{
    const img=await buildReviewImages();
    const prompt=`You are a music-video creative director. Choose the single best directing approach for this edit from the list, based on the music data and the frames in image 1 (a contact sheet of the footage).
Music and footage data: ${JSON.stringify({...songFeatures(), file:S.audioName, clips:S.clips.length, photos:S.clips.filter(c=>c.kind==="image").length})}
Options:
${Object.entries(DSTYLES).map(([n,s])=>`- ${n}: ${s.d}`).join("\n")}
Reply with ONLY JSON: {"style":"exact option name","reason":"one plain sentence"}`;
    const r=await askAI(id,prompt,img.blobs.slice(0,1));
    if(!DSTYLES[r.style]) throw {code:"invalid_json"};
    $("direct").value=r.style; setDirect(r.style,String(r.reason||"").slice(0,200));
  }catch(e){ $("directWhy").textContent=aiErrorText(e); }
  finally{ $("aiDirect").disabled=false; }
}
function setControl(id,v){ const el=$(id); if(!el) return; if(el.type==="checkbox") el.checked=!!v; else el.value=v; }
function applyStyle(name,tied){
  const st=STYLES[name]||DSTYLES[name]; if(!st) return;
  if(!tied && S.direct){ S.direct=null; $("direct").value="off"; $("directWhy").textContent=""; }
  Object.entries({...FX_OFF,...st}).forEach(([k,v])=>{ if(k!=="d") setControl(k,v); });
  if(tied && DIRECT[name]){ const D=DIRECT[name]; setControl("textStyle",normStyle(D.txt)); setControl("stillMotion",D.still); setControl("trans","auto");
    if(PRESETS[D.eq]){ EQ.bands=[...PRESETS[D.eq].b]; EQ.bass=0; EQ.treble=0; EQ.preset=D.eq; syncEq(); applyEq(LIVE); } }
  document.querySelectorAll("#styles .chip,#dstyles .chip").forEach(c=>c.setAttribute("aria-pressed",String(c.textContent===name)));
  $("styleDesc").textContent=st.d;
  saveSettings(); if(!S.running) buildPlan();
  status(`${name} style applied.`);
}
function buildStyleUI(){
  for(const [boxId,set] of [["styles",STYLES],["dstyles",DSTYLES]]){
    const box=$(boxId);
    Object.keys(set).forEach(n=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent=n; b.title=set[n].d; b.onclick=()=>{ if(DSTYLES[n]){ $("direct").value=n; setDirect(n,""); } else applyStyle(n); }; box.appendChild(b); });
  }
}

