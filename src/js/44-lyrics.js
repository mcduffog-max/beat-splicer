/* ---------------- Lyrics: shots follow the words ----------------
   Lyrics come from a .lrc file (timed to the line), from inside the song file, or pasted. Untimed lyrics are spread across
   the sung part of the song, weighted by how long each line is. Each line is then read for imagery: places, character
   types and things named, the mood and the shot size, and clips that show those win the shots under that line. */
const LY_STOP=new Set("the and you your you're i'm i'll i've it's that this with for from into onto over under just like when then than what where who why how all are was were been be is am can can't don't won't will would could should have has had not but our out its his her him she they them their there here oh ooh yeah hey baby gonna wanna gotta got get let make made come came go going gone know see say said tell told feel take took give gave every ever never one two away down back still only cause ‘cause 'cause".split(" "));
function parseLyrics(text){
  const out=[]; let timed=0;
  for(const raw of String(text||"").replace(/\r/g,"").split("\n")){ const tags=[...raw.matchAll(/\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/g)]; let line=raw.replace(/\[[^\]]*\]/g,"").replace(/<\d{1,2}:\d{2}[.:]\d{1,3}>/g,"").trim();
    if(/^\s*\[(ar|ti|al|by|offset|length|re|ve):/i.test(raw)) continue;
    if(!line||/^\(?(x\d+|repeat|instrumental|chorus|verse|bridge|intro|outro|pre-chorus|hook)[^a-z]*\)?:?$/i.test(line)){ if(tags.length&&!line) tags.forEach(m=>out.push({t:+m[1]*60+parseFloat(m[2].replace(":",".")),text:"",gap:true})); continue; }
    if(tags.length){ timed++; tags.forEach(m=>out.push({t:+m[1]*60+parseFloat(m[2].replace(":",".")),text:line})); } else out.push({t:null,text:line}); }
  return {lines:out, timed:timed>0&&out.filter(l=>l.t!=null).length>=out.length*0.8}; }
/* untimed lyrics: spread over the sung stretch (after the intro, before the outro), longer lines get longer */
function spreadLyrics(lines){ const an=S.an, B=an.beats, E=an.E, D=an.duration; let a=0;
  for(let i=0;i+8<B.length;i++){ let m=0; for(let k=i;k<i+8;k++) m+=E[k]; if(m/8>=0.3&&B[i]>=2){ a=B[i]; break; } }
  const EN=songEnding(), z=Math.max(a+10,Math.min(D-4,(EN&&EN.type==="fade"?EN.fadeStart:D)-Math.max(4,D*0.06)));
  const w=lines.map(l=>1.5+l.text.split(/\s+/).length), tot=w.reduce((x,y)=>x+y,0); let t=a;
  lines.forEach((l,i)=>{ l.t=t; t+=(z-a)*w[i]/tot; }); return lines; }
function setLyrics(text,src){
  if(!S.an){ S._pendingLyrics={text,src}; return; }
  const P=parseLyrics(text); let L=P.lines.filter(l=>P.timed?l.t!=null:true);
  if(!L.filter(l=>!l.gap).length){ status("No lyric lines found in that text.",true); return; }
  if(!P.timed){ L=spreadLyrics(L.filter(l=>!l.gap)); }
  L.sort((x,y)=>x.t-y.t); L.forEach((l,i)=>{ const nx=L[i+1]; l.end=nx?(P.timed?Math.min(nx.t,l.t+12):nx.t):Math.min(S.an.duration,l.t+(P.timed?6:(l.t-(L[i-1]||{t:l.t-6}).t))); });
  L=L.filter(l=>!l.gap&&l.end>l.t+0.2);
  S.lyrics={lines:L.map(l=>({t:+l.t.toFixed(2),end:+l.end.toFixed(2),text:l.text.slice(0,140),img:localImagery(l.text)})),src,exact:P.timed,song:S.audioName};
  renderLyrics(); if(S.outline){ if(!S.outline.board||S.outline.src!=="ai") S.outline.board=templateBoard(S.outline); renderOutline(); } saveProjectSoon(); if(!S.running) buildPlan(); if(S.clips.some(c=>c.samples&&c.samples.some(s=>s.ce))) seeReady();
  if(aiProvider()) aiLyrics().catch(e=>crumb("lyrics AI failed: "+(e&&e.message||e))); }
function localImagery(text){ const s=" "+text.toLowerCase()+" "; const scenes=[]; for(const [k,re] of SCENE_WORDS) if(re.test(s)&&!scenes.includes(k)) scenes.push(k);
  const words=[...new Set(s.replace(/[^a-z' ]/g," ").split(/\s+/).filter(w=>w.length>=4&&!LY_STOP.has(w)))].slice(0,6); return {scenes:scenes.slice(0,2),words,types:[],shot:null}; }
async function aiLyrics(){ const id=aiProvider(); if(!id||!S.lyrics) return; const L=S.lyrics, uniq=[...new Set(L.lines.map(l=>l.text))].slice(0,80); $("lyricsInfo").textContent="Reading the lyrics for imagery…";
  const C=storyCatalogue(), prompt=`These are the lyrics of a song being cut into a music video${songArtistLine()?` (“${songArtistLine()}”)`:""}. For EACH numbered line, say what the video could show while it is sung.
Lines:
${uniq.map((t,i)=>`${i+1}. ${t}`).join("\n")}
Backgrounds available: ${SCENES.map(s=>s[0]).join(", ")}.
Character types in the footage: ${[...new Set(C.chars.map(x=>x.type).filter(Boolean))].join(", ")||"unknown"}.
Reply with ONLY JSON: {"lines":[{"n":1,"scenes":["one or two background ids from the list, or []"],"types":["character types from the list that fit, or []"],"words":["2-4 concrete visual nouns or actions sung about"],"shot":"wide|medium|close","mood":"one word"}]}`;
  const r=await askAI(id,prompt,[]); if(!r||!Array.isArray(r.lines)||S.lyrics!==L) return;
  const byText=new Map(); r.lines.forEach(x=>{ const t=uniq[(+x.n)-1]; if(!t) return; byText.set(t,{scenes:(x.scenes||[]).map(v=>String(v).toLowerCase()).filter(v=>SCENE_IDS.has(v)).slice(0,2),types:(x.types||[]).map(v=>String(v).toLowerCase()).slice(0,3),words:(x.words||[]).map(v=>String(v).toLowerCase()).slice(0,4),shot:SHOT_SCALE[x.shot]?x.shot:null,mood:String(x.mood||"").slice(0,16)}); });
  L.lines.forEach(l=>{ const m=byText.get(l.text); if(m) l.img={...m,words:[...new Set([...m.words,...l.img.words])].slice(0,6)}; }); L.ai=true; renderLyrics(); saveProjectSoon(); if(!S.running) buildPlan(); }
function lyricAt(t){ const L=S.lyrics; if(!L) return null; let lo=0,hi=L.lines.length-1,f=-1; while(lo<=hi){ const m=(lo+hi)>>1; if(L.lines[m].t<=t){ f=m; lo=m+1; } else hi=m-1; } const l=f>=0?L.lines[f]:null; return l&&t<l.end?l:null; }
function lyricCost(seg,clip,ci,s){
  if(!S.lyrics||!$("lyricMatch").checked) return 0; const l=lyricAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)); if(!l||!l.img) return 0; const I=l.img; let cost=0;
  const boarded=outlineOn()&&S.outline.board&&S.outline.board[lyKey(l.text)]; if(boarded) return 0.5*lyricCostBase(I,clip,s);
  return lyricCostBase(I,clip,s); }
function lyricCostBase(I,clip,s){ let cost=0;
  const sc=scenesAt(clip,s.t); if(I.scenes&&I.scenes.length&&sc.length) cost+=sc.some(x=>I.scenes.includes(x))?-0.55:0.25;
  if(I.types&&I.types.length){ const L=CAST(), ty=charsAt(clip,s.t).map(id=>{ const x=L.find(k=>k.id===id); return x&&x.type; }).filter(Boolean); if(ty.some(x=>I.types.includes(x))) cost-=0.6; }
  if(I.words&&I.words.length){ const tg=tagAt(clip,s.t), txt=((tg&&Math.abs(tg.t-s.t)<2.5)?`${tg.subj||""} ${tg.setting||""} ${(tg.chars||[]).map(castLabel).join(" ")}`:"")+" "+charsAt(clip,s.t).map(castLabel).join(" ");
    if(txt.trim()){ const T=txt.toLowerCase(); if(I.words.some(w=>T.includes(w)||(w.length>5&&T.includes(w.slice(0,-1))))) cost-=0.45; } }
  if(I.shot){ const tg=tagAt(clip,s.t); if(tg&&tg.scale!=null&&Math.abs(tg.t-s.t)<2.5) cost+=0.12*Math.abs(tg.scale-SHOT_SCALE[I.shot]); }
  return cost; }
/* compact layout: one step open at a time, closed steps say where things stand, the preview screen shows a frame of the edit */
function STEPS(){ return [...document.querySelectorAll("details.step")]; }
function stepNamed(n){ return STEPS().find(d=>(d.querySelector("h2")||{}).textContent===n); }
STEPS().forEach(d=>{ const sm=d.querySelector("summary small"); if(sm) sm.dataset.def=sm.textContent;
  d.querySelector("summary").addEventListener("click",()=>{ if(d.open) return; STEPS().forEach(o=>{ if(o!==d) o.open=false; }); d._touched=true;
    setTimeout(()=>{ const r=d.getBoundingClientRect(); if(r.top<0||r.top>innerHeight*0.6) d.scrollIntoView({block:"start",behavior:"smooth"}); },30); }); });
function stepStatus(){ try{
  const set=(n,txt)=>{ const d=stepNamed(n); if(!d) return; const sm=d.querySelector("summary small"); if(!sm) return; sm.textContent=txt||sm.dataset.def; sm.classList.toggle("live",!!txt); };
  set("Your song",S.an?`${(S.meta&&S.meta.title)||S.audioName.replace(/\.[^.]+$/,"")} · ${S.an.feel&&S.an.feel.free?"free time":Math.round(S.an.bpm)+" BPM"} · ${fmtTime(S.an.duration)}${S.lyrics?" · lyrics":""}`:"");
  const ready=S.clips.filter(c=>c.samples).length, inE=S.clips.filter((c,i)=>c.samples&&!c.off&&!isExcluded(i)).length, nc=typeof CAST==="function"?CAST().filter(x=>x.n>=2).length:0;
  set("Video clips",S.clips.length?(ready<S.clips.length?`Reading clips: ${ready} of ${S.clips.length}`:`${ready} clips · ${inE} in the edit${nc?` · ${nc} characters`:""}`):"");
  set("Story and pace",S.plan&&S.plan.length?`${S.plan.length} cuts · about ${((S.plan[S.plan.length-1].end-S.plan[0].start)/S.plan.length).toFixed(1)} s each${S.outline?" · story outline":""}`:"");
  set("Look",S.style&&S.style.name?`Style: ${S.style.name}${S.style.custom?" (changed)":""}`:"");
  set("Where it’s going",S.eps.length?S.eps.map(e=>(EP(e)||{}).name||e).join(", "):"");
}catch(e){} }
var _posterPlan=null, _posterT=0;
function posterSoon(){ if(!S.plan||S.running||S._auto||S.plan===_posterPlan) return; clearTimeout(_posterT); _posterT=setTimeout(async()=>{ if(!S.plan||S.running||S.plan===_posterPlan) return; _posterPlan=S.plan;
  const keep=S.scrubT; try{ const w=windowFor(previewEp()); await showFrameAt(Math.min(w[1]-0.05,w[0]+Math.min(2,(w[1]-w[0])/3))); }catch(e){} S.scrubT=keep; drawTimeline(); },450); }
function foldAfter(n,next){ const d=stepNamed(n); if(!d||d._touched) return; d.open=false; const nx=next&&stepNamed(next); if(nx&&!nx._touched&&!STEPS().some(o=>o.open)) nx.open=true; }
{ const box=$("stageBox"), cv=$("stage"), work=box.closest(".work"); const upd=()=>{ const ar=parseFloat(box.style.getPropertyValue("--ar"))||1.78; work.classList.toggle("portrait",!cv.hidden&&ar<0.9); };
  new MutationObserver(upd).observe(box,{attributes:true,attributeFilter:["style"]}); new MutationObserver(upd).observe(cv,{attributes:true,attributeFilter:["hidden"]}); upd(); }
{ const q=$("quickTitle"), hk=$("hookText"), syncQ=()=>{ q.value=$("autoTitles").checked?"":hk.value; q.placeholder=$("autoTitles").checked?"Titles are written automatically (type to use your own)":"Add a title (optional)"; };
  q.addEventListener("input",()=>{ if($("autoTitles").checked){ $("autoTitles").checked=false; renderTitles(); } hk.value=q.value; updateNamePreview(); });
  q.addEventListener("change",()=>{ saveSettings(); renderTitles(); posterRefresh(); });
  hk.addEventListener("input",syncQ); $("autoTitles").addEventListener("change",syncQ); setTimeout(syncQ,0); }
function posterRefresh(){ _posterPlan=null; posterSoon(); }
$("makeNow").onclick=()=>{ if(!S.running&&!S.eps.length){ S.eps=["shorts"]; buildEndpointUI(); saveSettings(); updateButtons(); } $("render").click(); };
$("foldAll").onclick=()=>{ STEPS().forEach(d=>{ d.open=false; d._touched=true; }); };
$("clipMore").onclick=()=>{ S.clipsAll=!S.clipsAll; renderClips(); };
$("epsMore").onclick=()=>{ S.epsAll=!S.epsAll; buildEndpointUI(); };
function songInfoText(){ const v=$("songVer").value; return `${S.audioName}${v!=="orig"?SONG_VER_SUFFIX[v]:""}, ${fmtTime(S.an.duration)}${S.an.feel&&S.an.feel.free==="beatless"?"":` at about ${Math.round(S.an.bpm)} BPM`}. Feel: ${S.an.feel?S.an.feel.label:"4/4"}`; }
let SECPLAY=null;
function stopSection(){ if(!SECPLAY) return; try{ SECPLAY.src.stop(); }catch(e){} try{ SECPLAY.actx.close(); }catch(e){} SECPLAY=null; renderSections(); }
async function playSection(i){ const AS=songSections(), s=AS[i]; if(!s||!S.audioBuf) return; const was=SECPLAY&&SECPLAY.i; stopSection(); if(was===i) return; stopListen&&stopListen();
  const actx=new (window.AudioContext||window.webkitAudioContext)(); await actx.resume(); const src=actx.createBufferSource(); src.buffer=S.audioBuf; src.connect(actx.destination);
  src.start(0,s.t0,Math.min(s.t1-s.t0,30)); src.onended=()=>{ if(SECPLAY&&SECPLAY.src===src) stopSection(); }; SECPLAY={actx,src,i}; renderSections(); }
function markChorus(i,yes){ const AS=songSections(), g=AS[i]&&AS[i].group; if(g==null) return;
  AS.forEach(s=>{ if(yes){ if(s.group===g) s.chorus=true; else if(s.chorus) s.chorus=false; } else if(s.group===g) s.chorus=false; s.kind=s.chorus?"chorus":(s.kind==="chorus"?"verse":s.kind); });
  let nC=0,nV=0; AS.forEach(s=>{ if(s.chorus) s.label=`chorus ${++nC}`; else if(s.kind==="verse") s.label=`verse ${++nV}`; else s.label=s.kind; }); S.an._secByHand=true;
  S._actsC={}; buildPlan(); saveProjectSoon&&saveProjectSoon(); renderSections(); status(yes?"Marked as the chorus. Shorts and the story now use your choice.":"Not the chorus: noted."); }
function renderSections(){ const el=$("songSecs"); if(!el) return; const AS=S.an?songSections():[]; el.hidden=!AS.length; if(!AS.length) return; el.innerHTML="";
  const lead=document.createElement("div"); const ch=AS.filter(s=>s.chorus);
  lead.textContent=ch.length?`Sections${S.an._secByHand?" (corrected by you)":""}. First chorus at ${fmtTime(ch[0].t0)}. Tap one to hear it.`:"Sections. No chorus found that comes back, so Shorts open on the strongest moment. Tap one to hear it."; el.appendChild(lead);
  const row=document.createElement("div"); row.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px";
  AS.forEach((s,i)=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; const on=SECPLAY&&SECPLAY.i===i; if(s.chorus){ b.style.fontWeight="700"; b.style.boxShadow="inset 0 0 0 1.5px var(--ink)"; } b.setAttribute("aria-pressed",String(on));
    b.textContent=`${on?"■ ":""}${s.label.replace(/^./,c=>c.toUpperCase())} ${fmtTime(s.t0)}${S.an._shortAt!=null&&Math.abs(S.an._shortAt-s.t0)<0.05?" · Shorts":""}`; b.title=on?"Stop":"Play this section"; b.onclick=()=>playSection(i); row.appendChild(b); }); el.appendChild(row);
  if(SECPLAY){ const s=AS[SECPLAY.i], fx=document.createElement("div"); fx.style.cssText="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"; const t=document.createElement("span"); t.textContent=`Playing ${s.label}.`; fx.appendChild(t);
    const y=document.createElement("button"); y.type="button"; y.className="chip"; y.textContent=s.chorus?"Not the chorus":"This is the chorus"; y.onclick=()=>markChorus(SECPLAY.i,!s.chorus); fx.appendChild(y);
    const mine=S.an._shortAt!=null&&Math.abs(S.an._shortAt-s.t0)<0.05, z=document.createElement("button"); z.type="button"; z.className="chip"; z.textContent=mine?"Shorts start here ✓ (tap for automatic)":"Start Shorts here"; z.onclick=()=>setShortStart(mine?null:s.t0); fx.appendChild(z); el.appendChild(fx); }
  if(S.an._shortAt!=null){ const a=document.createElement("div"); a.style.cssText="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px"; const t=document.createElement("span"); t.textContent=`Shorts start at ${fmtTime(S.an._shortAt)} (your choice).`; a.appendChild(t);
    const z=document.createElement("button"); z.type="button"; z.className="chip"; z.textContent="Back to automatic"; z.onclick=()=>setShortStart(null); a.appendChild(z); el.appendChild(a); } }
/* the section a Short starts with: chosen by you, or (null) found automatically */
function setShortStart(t){ if(!S.an) return; if(t==null) delete S.an._shortAt; else S.an._shortAt=t; buildPlan(); saveProjectSoon&&saveProjectSoon(); renderSections();
  status(t==null?"Shorts pick their own starting point again.":`Shorts now start at ${fmtTime(t)}. Full-length videos are unchanged.`); }
function renderTempo(){ renderSections(); const r=$("tempoRow"); if(!r) return; const an=S.an, show=!!an&&!(an.feel&&an.feel.free); r.hidden=!show; if(!show) return;
  const x=an.tempoX||1, base=an.bpm/x; r.querySelectorAll("[data-x]").forEach(b=>{ const bx=+b.dataset.x; b.classList.toggle("on",bx===x); b.setAttribute("aria-pressed",bx===x); b.textContent=bx===1?`As found (${Math.round(base)})`:bx===2?`Double (${Math.round(base*2)})`:`Half (${Math.round(base/2)})`; b.hidden=bx!==x&&(bx===2&&base*2>210||bx===0.5&&base/2<45); });
  $("tempoNote").textContent=x===1?"If the cuts feel too slow or too busy, try another speed.":""; }
async function setTempo(x){ if(!S.audioBuf||!S.an||S.running||(S.an.tempoX||1)===x) return; $("prog").hidden=false;
  try{ S.an=await analyzeAudio(S.audioBuf,q=>{ $("prog").value=q; status(`Re-counting the beat… ${Math.round(q*100)}%`); },{x}); S._endingFor=null; S.titles={};
    $("audioInfo").textContent=songInfoText(); renderTempo(); buildPlan(); crumb(`tempo ×${x}`); status(`Beat set to ${Math.round(S.an.bpm)} BPM. The edit has been rebuilt.`); }
  catch(e){ status("Couldn’t re-count the beat.",true); } finally{ $("prog").hidden=true; } }
document.querySelectorAll("#tempoRow [data-x]").forEach(b=>b.onclick=()=>setTempo(+b.dataset.x));
function renderLyrics(){ const L=S.lyrics, has=!!L; $("lyricsClear").hidden=!has; if($("lyTapStart")){ $("lyTapStart").hidden=!has||!!TAP; $("lyNudge").hidden=!has; $("lyNudgeVal").textContent=has&&L.shift?`shifted ${L.shift>0?"+":""}${L.shift.toFixed(2)} s`:""; } $("lyricsAI").hidden=!has||!aiProvider(); const list=$("lyricsList"); list.innerHTML="";
  if(!has){ $("lyricsInfo").textContent="Add the lyrics and shots follow the words: what’s sung about shows up as it’s sung. A .lrc file is timed to the line; plain lyrics are spread across the sung parts of the song."; return; }
  const src={file:"a lyrics file",song:"the song file",paste:"pasted text",lrclib:"LRCLIB",tap:"your tapping"}[L.src]||"lyrics";
  $("lyricsInfo").textContent=`${L.lines.length} lines from ${src}, ${L.src==="tap"?(L.exact?`timed by your taps (${L.tapped} lines)`:`${L.tapped} lines tapped, the rest spread between them`):L.exact?"timed to the line":"timing approximate: press Time by tapping, or Find synced lyrics, for exact timing"}${L.ai?", imagery read by the AI":aiProvider()?"":", imagery from the words themselves"}.`;
  L.lines.slice(0,120).forEach(l=>{ const d=document.createElement("div"); d.className="ly"; const b=document.createElement("b"); b.textContent=fmtTime(l.t); const sp=document.createElement("span"); sp.textContent=l.text;
    const im=l.img||{}, tags=[...(im.scenes||[]).map(sceneLabel),...(im.types||[]),...(im.words||[]).slice(0,3)]; if(tags.length){ const it=document.createElement("i"); it.textContent=" · "+tags.join(", "); sp.appendChild(it); } d.append(b,sp); list.appendChild(d); }); }
/* the words on screen, inside the safe zone */
function drawLyric(o,t,F){ if(!S.lyrics||!$("lyricShow").checked||F._thumb) return; const l=lyricAt(t); if(!l) return; const {g,W,H,ep}=o; if(!ep) return;
  const a=Math.min(1,(t-l.t)/0.18,(l.end-t)/0.18); if(a<=0) return; const sf=ep.safe||{l:0.05,r:0.05,t:0.05,b:0.1}, maxW=W*(1-sf.l-sf.r)*0.92, fs=Math.round(Math.min(W,H)*(W<H?0.052:0.045));
  g.save(); g.globalAlpha=a; g.font=`700 ${fs}px Inter, -apple-system, system-ui, sans-serif`; g.textAlign="center"; g.textBaseline="alphabetic";
  const lines=wrapLines(g,l.text,maxW).slice(0,2), lh=fs*1.18, y0=H*(1-sf.b)-fs*0.6-(lines.length-1)*lh, x=W*(sf.l+(1-sf.l-sf.r)/2);
  g.shadowColor="rgba(0,0,0,.75)"; g.shadowBlur=fs*0.35; g.lineJoin="round"; g.lineWidth=fs*0.14; g.strokeStyle="rgba(0,0,0,.55)"; g.fillStyle="#fff";
  lines.forEach((ln,i)=>{ g.strokeText(ln,x,y0+i*lh); g.fillText(ln,x,y0+i*lh); }); g.restore(); }
$("lyricsFile").onchange=async e=>{ const f=e.target.files[0]; e.target.value=""; if(!f) return; try{ setLyrics(await f.text(),"file"); }catch(err){ status("Couldn’t read that lyrics file.",true); } };
async function lyricsFromClipboard(quiet){ const m=$("lyricsClipMsg"), t=await readClipboard();
  if(t&&t.trim()){ $("lyricsPaste").value=t.replace(/\r\n?/g,"\n").trim(); m.textContent=`Pasted ${t.trim().split("\n").length} lines from your clipboard. Check them, then tap Use these lyrics.`; return true; }
  if(!quiet) m.textContent=t==null?"Couldn't read the clipboard here. Long-press in the box and choose Paste.":"The clipboard is empty: copy the lyrics first, then tap Paste from clipboard."; return false; }
$("lyricsPasteBtn").onclick=async()=>{ const box=$("lyricsPasteBox"); box.hidden=!box.hidden; if(box.hidden) return; $("lyricsClipMsg").textContent="";
  if(!$("lyricsPaste").value.trim()) await lyricsFromClipboard(true); $("lyricsPaste").focus(); };
$("lyricsClip").onclick=()=>lyricsFromClipboard(false);
$("lyricsUse").onclick=()=>{ const v=$("lyricsPaste").value; if(!v.trim()) return; setLyrics(v,"paste"); $("lyricsPasteBox").hidden=true; };
$("lyricsClear").onclick=()=>{ S.lyrics=null; renderLyrics(); saveProjectSoon(); if(!S.running) buildPlan(); };
$("lyricsAI").onclick=()=>aiLyrics().catch(e=>{ $("lyricsInfo").textContent=aiErrorText(e); });
["lyricMatch","lyricShow"].forEach(id=>$(id).addEventListener("change",()=>{ saveSettings(); if(id==="lyricMatch"&&!S.running) buildPlan(); }));

