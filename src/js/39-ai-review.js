/* ---------------- AI review ---------------- */
function projectSig(){ const look={}; LOOK_IDS.forEach(id=>{ const el=$(id); if(el) look[id]=el.type==="checkbox"?el.checked:el.value; });
  return JSON.stringify({look,EQ,eps:S.eps,plan:S.plan&&S.plan.map(s=>[s.clip,+s.src.toFixed(2)]),crops:S.clips.map(c=>c.crop)}); }

function projectSummary(){
  const P=S.plan, lens=P.map(s=>s.end-s.start), loud=P.filter(s=>s.e>0.6), quiet=P.filter(s=>s.e<0.35);
  const avg=a=>a.length?+(a.reduce((x,s)=>x+(s.end-s.start),0)/a.length).toFixed(2):null;
  const trc={}; P.forEach(s=>{ trc[s.tr.type]=(trc[s.tr.type]||0)+1; });
  let repeats=0; P.forEach((s,i)=>{ if(i&&P[i-1].clip===s.clip) repeats++; });
  const used=new Set(P.map(s=>s.clip)).size;
  const F=readFx();
  return {
    audio:{ file:S.audioName, lengthSec:+S.an.duration.toFixed(1), bpm:Math.round(S.an.bpm), approxLufs:+S.an.lufs.toFixed(1) },
    edit:{ cuts:P.length, avgCutSec:+(lens.reduce((a,b)=>a+b,0)/lens.length).toFixed(2), avgCutLoudSec:avg(loud), avgCutQuietSec:avg(quiet),
      transitions:trc, clipsAvailable:S.clips.length, clipsUsed:used, backToBackRepeats:repeats,
      croppedClips:S.clips.filter(c=>c.crop&&(c.crop.t||c.crop.b||c.crop.l||c.crop.r)).length },
    settings:{ matchTo:$("mode").value, pace:+$("pace").value, variety:+$("variety").value, transitions:$("trans").value, transitionLength:+$("trLen").value,
      framing:F.fit, zoom:F.zoom, pushIn:F.kb, look:$("look").value,
      effects:{beatPulse:F.pulse,shake:F.shake,glitch:F.glitch,grain:F.grain,vignette:F.vignette,cinematicBars:F.bars,
        fisheye:F.fisheye,splitLetterbox:F.split,multiplyOnBeat:F.multiply,mirror:F.mirror,strobe:F.strobe,handheld:F.handheld,colourWash:F.wash,doodles:F.doodles,slowMotion:F.slowmo},
      styleChosen:($("styleDesc").textContent||"").slice(0,160), autoDirector:S.direct||"off", industryRules:PRO(),
      industryChecklist:(S.checklist||[]).map(c=>({platform:c.platform,warnings:c.warnings})),
      photos:S.clips.filter(c=>c.kind==="image").length, clipSound:$("clipSound").checked?{volume:+$("clipVol").value,mutedClips:S.clips.filter(c=>c.mute).length}:"off",
      brandWatermark:{style:$("brandMode").value, hasLogo:!!S.brand.img, text:$("brandText").value, position:$("brandPos").value, opacity:+$("brandOpacity").value}, photoMotion:F.still, textStyle:F.textStyle,
      overlays:{logosOrGraphics:S.overlays.map(o=>({position:o.pos,size:o.size,when:o.timing})),lightLeaks:F.leaks,bokeh:F.bokeh,dust:F.dust,lowerThird:F.lower},
      hookText:F.hook, endText:F.end,
      sound:{ eqPreset:EQ.preset||"custom", bass:EQ.bass, treble:EQ.treble, bands:EQ.bands, volumePct:Math.round(EQ.vol*100), fadeIn:$("fadeIn").checked, fadeOut:$("fadeOut").checked, space3d:$("space").value, spaceAmount:+$("spaceAmt").value },
      shortFormLength:$("shortLen").value },
    exports:S.eps.map(EP).map(ep=>{ const w=windowFor(ep); return { platform:ep.name, size:`${ep.w}x${ep.h}`, fps:ep.fps, startSec:+w[0].toFixed(1), lengthSec:+(w[1]-w[0]).toFixed(1), loudnessTarget:ep.lufs }; })
  };
}

const FIXES={
  pace:{id:"pace",min:0.5,max:2}, variety:{id:"variety",min:0,max:1}, matchTo:{id:"mode"}, transitions:{id:"trans"},
  transitionLength:{id:"trLen",min:0.1,max:1.2}, framing:{id:"fit"}, zoom:{id:"zoom",min:1,max:1.5}, pushIn:{id:"kb",bool:true},
  look:{id:"look"}, beatPulse:{id:"fxPulse",bool:true}, shake:{id:"fxShake",bool:true}, glitch:{id:"fxGlitch",bool:true},
  grain:{id:"fxGrain",bool:true}, vignette:{id:"fxVignette",bool:true}, cinematicBars:{id:"fxBars",bool:true},
  hookText:{id:"hookText",text:true}, endText:{id:"endText",text:true}, space3d:{id:"space"}, spaceAmount:{id:"spaceAmt",min:0,max:1},
  shortFormLength:{id:"shortLen"}, eqPreset:{preset:true}, volumePct:{vol:true},
  fisheye:{id:"fxFisheye",bool:true}, splitLetterbox:{id:"fxSplit",bool:true}, multiplyOnBeat:{id:"fxMultiply",bool:true},
  mirror:{id:"fxMirror",bool:true}, strobe:{id:"fxStrobe",bool:true}, handheld:{id:"fxHandheld",bool:true},
  colourWash:{id:"fxWash",bool:true}, doodles:{id:"fxDoodles",bool:true}, slowMotion:{id:"slowmo"},
  photoMotion:{id:"stillMotion"}, textStyle:{id:"textStyle"}, lightLeaks:{id:"ovLeaks",bool:true}, bokeh:{id:"ovBokeh",bool:true},
  dustAndScratches:{id:"ovDust",bool:true}, lowerThird:{id:"ovLower",text:true},
  watermarkStyle:{id:"brandMode"}, watermarkOpacity:{id:"brandOpacity",min:0.15,max:1}, watermarkSize:{id:"brandSize",min:0.05,max:0.3},
  clipSound:{id:"clipSound",bool:true}, clipVolume:{id:"clipVol",min:0,max:1.5}
};
function optionValues(id){ const el=$(id); return el && el.tagName==="SELECT" ? [...el.options].map(o=>o.value) : null; }
function fixGuide(){
  return Object.entries(FIXES).map(([k,f])=>{
    if(f.preset) return `${k}: one of ${Object.keys(PRESETS).map(p=>JSON.stringify(p)).join(", ")}`;
    if(f.vol) return `${k}: number 0 to 150`;
    if(f.bool) return `${k}: true or false`;
    if(f.text) return `${k}: short string (max 40 characters), or "" to remove`;
    const ov=optionValues(f.id); if(ov) return `${k}: one of ${ov.map(v=>JSON.stringify(v)).join(", ")}`;
    return `${k}: number ${f.min} to ${f.max}`;
  }).join("\n");
}
function validFix(fix){
  if(!fix||typeof fix!=="object"||!(fix.setting in FIXES)) return null;
  const f=FIXES[fix.setting], v=fix.value;
  if(f.preset) return PRESETS[v]?fix:null;
  if(f.vol) return typeof v==="number"&&v>=0&&v<=150?fix:null;
  if(f.bool) return typeof v==="boolean"?fix:null;
  if(f.text) return typeof v==="string"&&v.length<=60?fix:null;
  const ov=optionValues(f.id); if(ov) return ov.includes(String(v))?fix:null;
  return typeof v==="number"&&v>=f.min&&v<=f.max?fix:null;
}
function applyFix(fix){
  const f=FIXES[fix.setting];
  if(f.preset){ EQ.bands=[...PRESETS[fix.value].b]; EQ.bass=0; EQ.treble=0; EQ.preset=fix.value; syncEq(); }
  else if(f.vol){ EQ.vol=fix.value/100; syncEq(); }
  else setControl(f.id,fix.value);
  saveSettings();
  if(["pace","variety","matchTo"].includes(fix.setting)) buildPlan(); else { assignTransitions(); drawTimeline(); }
}

async function renderStill(o,segIdx,t,F,guides){
  const seg=curPlan()[segIdx], clip=S.clips[seg.clip]; F=fxFor(F,seg,segIdx);
  const {g,W,H}=o; g.fillStyle="#000"; g.fillRect(0,0,W,H); o._seg=seg;
  if(clip.kind==="image"){
    const m=stillMotion(F,seg,segIdx,t,W,H); if(seg._focus){ m.focus=seg._focus; m.prog=(t-seg.start)/Math.max(0.3,seg.end-seg.start); } drawClip(o,clip.img,clip,F,kbScale(F,seg,t)*m.s,m.dx||0,m.dy||0,m);
    postFx(o,t,windowFor(o.ep),F,beatInfo(t),{still:true,guides}); return;
  }
  const v=document.createElement("video"); v.muted=true; v.playsInline=true; v.preload="auto"; v.src=clip.url;
  try{ await waitEvent(v,"loadeddata",8000); }catch(e){ return; }
  await seekTo(v,Math.min(clip.dur-0.1,srcTimeAt(seg,Math.max(seg.start,t),F)));
  { const mv=moveOf(seg,t,W,H,beatInfo(t)), dm=directorMove(seg,t,W,H,beatInfo(t))||{s:1,dx:0,dy:0,rot:0}; const ex=seg._focus?{focus:seg._focus,prog:(t-seg.start)/Math.max(0.3,seg.end-seg.start)}:{}; if(dm.rot) ex.rot=dm.rot;
    drawClip(o,v,clip,F,kbScale(F,seg,t)*mv.s*dm.s,mv.dx+dm.dx,mv.dy+dm.dy,ex); } // reference frames use the same framing and camera moves as the export
  postFx(o,t,windowFor(o.ep),F,beatInfo(t),{still:true,guides});
  v.removeAttribute("src"); v.load();
}
const toJpeg=c=>new Promise(r=>c.toBlob(r,"image/jpeg",0.8));
async function buildReviewImages(){
  const F=readFx(), ep=previewEp(), win=windowFor(ep);
  // 1) contact sheet: eight moments across the main export, in order
  const tw=ep.w>=ep.h?320:180, th=Math.round(tw*ep.h/ep.w), cols=4, rows=2;
  const sheet=document.createElement("canvas"); sheet.width=tw*cols; sheet.height=th*rows; const sg=sheet.getContext("2d");
  const segs=S.plan.map((s,i)=>i).filter(i=>S.plan[i].end>win[0]&&S.plan[i].start<win[1]);
  const pick=[]; for(let k=0;k<8;k++) pick.push(segs[Math.min(segs.length-1,Math.floor(k*segs.length/8))]);
  const times=[];
  for(let k=0;k<8;k++){
    const i=pick[k]; if(i==null) continue; const seg=S.plan[i];
    const t=Math.max(win[0],seg.start)+Math.min(0.6,(seg.end-seg.start)/2);
    const c=document.createElement("canvas"); c.width=tw; c.height=th;
    const o={ep:{...ep,w:tw,h:th},canvas:c,g:c.getContext("2d"),W:tw,H:th};
    await renderStill(o,i,t,F,false);
    sg.drawImage(c,(k%cols)*tw,Math.floor(k/cols)*th); times.push(+(t).toFixed(1));
  }
  // 2) one frame per export, at the hook, with the safe zone drawn as a dashed line
  const eps=S.eps.map(EP).slice(0,6), H2=320, widths=eps.map(e=>Math.round(H2*e.w/e.h));
  const strip=document.createElement("canvas"); strip.width=Math.max(1,widths.reduce((a,b)=>a+b+8,0)); strip.height=H2; const stg=strip.getContext("2d");
  let x=0;
  for(let k=0;k<eps.length;k++){
    const e=eps[k], w=windowFor(e), t=w[0]+1.2, idx=Math.max(0,S.plan.findIndex(s=>t>=s.start&&t<s.end));
    const c=document.createElement("canvas"); c.width=widths[k]; c.height=H2;
    const o={ep:{...e,w:widths[k],h:H2},canvas:c,g:c.getContext("2d"),W:widths[k],H:H2};
    await renderStill(o,idx,t,F,true); stg.drawImage(c,x,0); x+=widths[k]+8;
  }
  return {blobs:[await toJpeg(sheet), await toJpeg(strip)], times, epNames:eps.map(e=>e.name), mainEp:ep.name};
}

function reviewPrompt(sum,img){
  return `You are a senior music-video and social-media editor. An automatic beat-synced edit is about to be exported. Review it frankly and practically for the platforms listed, using current short-form and broadcast editing practice.

${img?`Image 1 is a contact sheet of 8 frames from the ${img.mainEp} version, in time order, at ${img.times.join(", ")} seconds into the song.
Image 2 shows one frame from each export (${img.epNames.join(", ")}, left to right) at the moment the opening text appears. The dashed yellow line marks the platform safe zone and is NOT part of the export.
`:"No images are available, so judge from the data alone.\n"}
Project data (JSON):
${JSON.stringify(sum,null,1)}

Check things like: is the opening strong enough to hold viewers in the first 2 seconds, are cuts paced well for the music and each platform, does text sit inside the safe zones and read clearly, are effects tasteful or overdone, is the framing right for each aspect ratio, is footage repeated too often, and is the sound set well (loudness, EQ, 3D effect suits phones and TV).

Reply with ONLY a JSON object, no other text:
{"score": integer 1-10, "verdict": "one or two plain sentences", "strengths": ["up to 3 short points"], "issues": [{"title": "short", "detail": "one or two sentences of practical advice", "fix": null or {"setting": name, "value": value}}]}
Give at most 6 issues, most important first. Only use a fix when one setting change clearly helps. Allowed fix settings and values:
${fixGuide()}`;
}

const HOSTED = !!(window.claude && window.claude.use) || /claude\.ai$|claudeusercontent/.test(location.hostname);
const PROVIDERS={
  claude:{name:"Claude", cb:"rvClaude"},
  openai:{name:"ChatGPT", cb:"rvOpenai", key:"keyOpenai", model:"modelOpenai"},
  gemini:{name:"Gemini", cb:"rvGemini", key:"keyGemini", model:"modelGemini"},
  grok:{name:"Grok", cb:"rvGrok", key:"keyGrok", model:"modelGrok"}
};
async function providerReady(id){
  if(id==="claude") return !!(await sampleP);
  if(HOSTED) return false;
  return !!$(PROVIDERS[id].key).value.trim();
}
function parseLoose(text){
  const t=String(text||"").slice(0,60000).replace(/```(?:json)?/g,""); const a=t.indexOf("{"), b=t.lastIndexOf("}");
  if(a<0||b<a) throw {code:"invalid_json"}; return JSON.parse(t.slice(a,b+1));
}
const blobToB64=b=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(",")[1]); r.onerror=rej; r.readAsDataURL(b); });
async function httpJson(url,opts){
  const r=await fetch(url,opts); const txt=await r.text();
  if(!r.ok){ let m=txt; try{ const j=JSON.parse(txt); m=(j.error&&(j.error.message||j.error))||txt; }catch(e){} throw {code:"http_"+r.status, message:String(m).slice(0,220)}; }
  return JSON.parse(txt);
}
var _aiN=0;
async function askAI(id,prompt,imgs,signal){ _aiN++; try{ return await askAI0(id,prompt,imgs,signal); } finally{ _aiN--; } }
async function askAI0(id,prompt,imgs,signal){
  if(id==="claude"){
    const sample=await sampleP; const opts={modelTier:"default",signal};
    if(imgs&&imgs.length){ const lim=await sample.limits().catch(()=>null); if(lim&&lim.images) opts.images=imgs.slice(0,lim.images.maxCount||2); }
    return sample.json(prompt,opts);
  }
  const P=PROVIDERS[id], key=$(P.key).value.trim(), model=$(P.model).value.trim();
  const b64=imgs&&imgs.length?await Promise.all(imgs.map(blobToB64)):[];
  const once=async withImages=>{
    if(id==="gemini"){
      const parts=[{text:prompt},...(withImages?b64.map(d=>({inline_data:{mime_type:"image/jpeg",data:d}})):[])];
      const j=await httpJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {method:"POST",signal,headers:{"Content-Type":"application/json","x-goog-api-key":key},
         body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{responseMimeType:"application/json"}})});
      return parseLoose(((j.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||"").join(""));
    }
    const base=id==="openai"?"https://api.openai.com/v1":"https://api.x.ai/v1";
    const content=[{type:"text",text:prompt},...(withImages?b64.map(d=>({type:"image_url",image_url:{url:"data:image/jpeg;base64,"+d}})):[])];
    const j=await httpJson(base+"/chat/completions",{method:"POST",signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({model,messages:[{role:"user",content}],response_format:{type:"json_object"}})});
    return parseLoose(j.choices?.[0]?.message?.content);
  };
  try{ return await once(true); }
  catch(e){ if(b64.length && String(e.code||"").startsWith("http_4")) return once(false); throw e; } // retry without images if the model can't see them
}
function aiErrorText(e){
  const c=e&&e.code||"";
  if(c==="not_granted") return "Permission wasn’t given for this review.";
  if(c==="rate_limited") return "Too many requests right now. Wait a minute, then try again.";
  if(c==="cancelled"||(e&&e.name==="AbortError")) return "Review stopped.";
  if(c==="invalid_json") return "The reply came back in an unexpected shape. Try again.";
  if(c==="http_401"||c==="http_403") return "The API key was rejected. Check it and try again.";
  if(c==="http_404") return "That model name wasn’t found. Edit the model name and try again.";
  if(c==="http_429") return "That account is out of credit or rate-limited.";
  if(c.startsWith("http_")) return "The service returned an error: "+(e.message||c);
  if(e instanceof TypeError) return "Couldn’t reach the service. This works only in the saved copy of the app, opened in Chrome or Edge.";
  return "This reviewer isn’t available right now.";
}

let reviewCtl=null;
async function runReview(gate){
  if(!S.plan) return;
  const ids=[]; for(const id of Object.keys(PROVIDERS)) if($(PROVIDERS[id].cb).checked && await providerReady(id)) ids.push(id);
  const out=$("aiOut"); out.hidden=false; out.innerHTML="";
  if(!ids.length){
    const p=document.createElement("p"); p.className="small";
    p.textContent=HOSTED?"Tick Claude to review here. ChatGPT, Gemini and Grok work in the saved copy of the app.":"Tick a reviewer and add its API key under Connect ChatGPT, Gemini or Grok.";
    out.appendChild(p);
    if(gate){ const b=document.createElement("button"); b.className="btn primary"; b.textContent="Export without review"; b.onclick=()=>makeVideos(true); out.appendChild(b); }
    return;
  }
  const third=ids.filter(i=>i!=="claude");
  if(third.length && !S.thirdOk){
    const ok=window.confirm(`Send 2 images of still frames and your edit settings to ${third.map(i=>PROVIDERS[i].name).join(", ")}? They’ll be processed under each company’s API terms and billed to your keys.`);
    if(!ok){ out.textContent="Review cancelled. Nothing was sent."; return; } S.thirdOk=true;
  }
  const p=document.createElement("p"); p.className="small"; p.textContent="Preparing frames for the review…"; out.appendChild(p);
  $("aiBtn").disabled=true;
  const img=await buildReviewImages();
  const prompt=reviewPrompt(projectSummary(),img), sig=projectSig();
  p.textContent=`Asking ${ids.map(i=>PROVIDERS[i].name).join(", ")}… this usually takes under a minute.`;
  reviewCtl=new AbortController();
  const results=await Promise.all(ids.map(id=>askAI(id,prompt,img.blobs,reviewCtl.signal).then(r=>({id,r}),e=>({id,err:aiErrorText(e)}))));
  S.review=results.find(x=>x.r)?.r||null; S.reviews=results; S.reviewedSig=sig;
  renderReviews(results,gate);
  $("aiBtn").disabled=!S.plan;
}
function renderReviews(results,gate){
  const out=$("aiOut"); out.innerHTML="";
  const ok=results.filter(x=>x.r && isFinite(+x.r.score));
  if(ok.length>1){ const avg=ok.reduce((a,x)=>a+(+x.r.score),0)/ok.length;
    const head=document.createElement("div"); head.className="ai-head";
    const sc=document.createElement("b"); sc.className="ai-score"; sc.textContent=avg.toFixed(1)+"/10";
    const p=document.createElement("p"); p.textContent=`Average across ${ok.length} reviewers. Points raised by more than one are worth acting on first.`;
    head.append(sc,p); out.appendChild(head); }
  const allFixes=[];
  for(const x of results){
    const card=document.createElement("div"); card.className="rev-card";
    const h4=document.createElement("h4"); h4.textContent=PROVIDERS[x.id].name+(x.r&&isFinite(+x.r.score)?`  ${+x.r.score}/10`:""); card.appendChild(h4);
    if(x.err){ const p=document.createElement("p"); p.className="small"; p.textContent=x.err; card.appendChild(p); out.appendChild(card); continue; }
    const r=x.r;
    const vd=document.createElement("p"); vd.style.margin="0 0 6px"; vd.textContent=String(r.verdict||""); card.appendChild(vd);
    if(Array.isArray(r.strengths)&&r.strengths.length){ const ul=document.createElement("ul"); ul.className="ai-good"; r.strengths.slice(0,3).forEach(s=>{ const li=document.createElement("li"); li.textContent=String(s); ul.appendChild(li); }); card.appendChild(ul); }
    (Array.isArray(r.issues)?r.issues:[]).slice(0,6).forEach(it=>{
      const d=document.createElement("div"); d.className="ai-issue";
      const t=document.createElement("b"); t.textContent=String(it.title||""); const p=document.createElement("p"); p.textContent=String(it.detail||"");
      d.append(t,p);
      const fx=validFix(it.fix);
      if(fx){ allFixes.push(fx); const b=document.createElement("button"); b.className="chip"; b.type="button";
        b.textContent=`Apply: ${fx.setting} → ${typeof fx.value==="boolean"?(fx.value?"on":"off"):JSON.stringify(fx.value)}`;
        b.onclick=()=>{ applyFix(fx); b.disabled=true; b.textContent="Applied"; }; d.appendChild(b); }
      card.appendChild(d);
    });
    out.appendChild(card);
  }
  const btns=document.createElement("div"); btns.className="btns";
  if(allFixes.length>1){ const all=document.createElement("button"); all.className="btn"; all.textContent="Apply all suggestions";
    all.onclick=()=>{ allFixes.forEach(applyFix); all.disabled=true; all.textContent="All applied"; out.querySelectorAll(".ai-issue .chip").forEach(c=>{ c.disabled=true; c.textContent="Applied"; }); }; btns.appendChild(all); }
  if(gate){ const go=document.createElement("button"); go.className="btn primary"; go.textContent="Export now";
    go.onclick=()=>{ S.reviewedSig=projectSig(); makeVideos(true); }; btns.appendChild(go); }
  out.appendChild(btns);
}

