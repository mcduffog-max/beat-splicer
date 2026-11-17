/* ---------------- Automatic titles ----------------
   Research-based rules: the hook lands inside 1.5 s, reads in one glance (2 to 6 words, never more than 8), sits in the top third
   of the safe zone, stays up long enough to read twice, and pays off honestly. Upload titles stay under 60 characters with the
   key words first; music videos follow the "Artist - Song (Official Video)" convention. Every line must be new: no clichés,
   nothing close to titles used before, and a different opening for each platform. */
const CLICHES=["wait for it","wait for the drop","you won't believe","you wont believe","watch till the end","watch until the end","pov","this is your sign","not me","tell me why","no one","trust me","insane","crazy","vibes","mood","obsessed","goosebumps","on repeat","core memory","hits different","main character","rent free","it's giving","its giving","we need to talk","part 2","link in bio","follow for more","must watch","gone wrong","you need to see"];
const DANGLING=new Set("a an the of to in on at for and or but with by through from into over under about across your my our their its this that".split(" "));
const TSTOP=new Set("a an the of to in on at for and or but with by is it this that my your our its".split(" "));
function normT(s){ return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim(); }
function toks(s){ return normT(s).split(" ").filter(w=>w&&!TSTOP.has(w)); }
function tSim(a,b){ const A=new Set(toks(a)), B=new Set(toks(b)); if(!A.size||!B.size) return 0; let i=0; A.forEach(x=>{ if(B.has(x)) i++; }); return i/(A.size+B.size-i); }
function isCliche(s){ const n=" "+normT(s)+" "; return CLICHES.some(c=>n.includes(" "+normT(c)+" ")); }
function wordCount(s){ return String(s||"").trim().split(/\s+/).filter(Boolean).length; }
function titleHistory(){ try{ return JSON.parse(localStorage.getItem("beatsplicerTitles")||"[]"); }catch(e){ return []; } }
function saveTitleHistory(list){ try{ localStorage.setItem("beatsplicerTitles",JSON.stringify(titleHistory().concat(list).slice(-200))); }catch(e){} }
function hookDur(text){ return Math.max(2,Math.min(4,1+0.5*wordCount(text))); } // long enough to read twice, short enough to keep moving
function trimWords(s,maxChars){ s=String(s||"").replace(/\s+/g," ").trim(); if(s.length<=maxChars) return s; const cut=s.slice(0,maxChars+1); const i=cut.lastIndexOf(" "); return (i>maxChars*0.5?cut.slice(0,i):cut.slice(0,maxChars)).replace(/[\s,;:–-]+$/,""); }
const TITLE_LIMIT=ep=> ep.id==="youtube"?60 : ep.id==="shorts"?50 : ep.id==="tv"||ep.id==="mobile"?60 : 80;
const DIR_WORDS={"Fisheye glam":["neon","glossy","wide-eyed"],"Glossy colour field":["glossy","colour-soaked","bold"],"Painterly surreal":["painted","dreamlike","surreal"],
  "Infinite loop":["looping","handmade","repeating"],"Playful one-take":["unscripted","handheld","loose"],"Dark precision":["shadowed","precise","after-dark"],
  "Stark monochrome":["grainy","stark","monochrome"],"Frantic strobe":["strobe-lit","relentless","flat-out"],"Dreamlike calm":["weightless","slow","late-night"],
  "Doodle pop":["doodled","cartoon-bright","playful"],"Symmetry":["mirrored","symmetrical","cool"],"Glitch nightmare":["glitched","static-filled","restless"]};
function contentWords(){
  const song=songTitle(), topic=$("capTopic").value.trim(), art=$("artistName").value.trim(), proj=$("projName").value.trim();
  const shortPhrase=s=>{ let w=s.replace(/[.,!?;:]+$/,"").split(/\s+/).slice(0,4); while(w.length>1 && DANGLING.has(w[w.length-1].toLowerCase())) w.pop(); return titleCase(w.join(" ")); };
  const subject=proj||(topic?shortPhrase(topic):"")||song||"This Track";
  const adj=(S.direct&&DIR_WORDS[S.direct])||(S.an&&S.an.bpm>125?["fast","restless","loud"]:S.an&&S.an.bpm<90?["slow","unhurried","late-night"]:["bright","golden","restless"]);
  const keys=[...new Set([...toks(subject),...toks(song),...toks(art),...toks(topic)].filter(w=>w.length>2))];
  return {song,topic,art,subject,adj,keys,bpm:S.an?Math.round(S.an.bpm):0};
}
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* Built-in writer: many sentence shapes, and only claims that are true for this edit (a drop exists, slow motion is on, it loops...). */
function topSubjects(n){ const cnt=new Map(); S.clips.forEach(c=>(c.tags||[]).forEach(t=>{ const s=(t.subj||"").trim(); if(s && s.length>2 && !/^(none|unknown|n\/a)$/i.test(s)) cnt.set(s,(cnt.get(s)||0)+1); }));
  return [...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0]); }
function topSettings(n){ const cnt=new Map(); S.clips.forEach(c=>(c.tags||[]).forEach(t=>{ const s=(t.setting||"").trim().toLowerCase(); if(s.length>2) cnt.set(s,(cnt.get(s)||0)+1); })); return [...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0]); }
/* does a line read as something a person would say? flags filler numbers, file-name fragments and dangling words */
function hookIssues(h){
  const issues=[], s=String(h||"").trim(), w=s.split(/\s+/).filter(Boolean), last=normT(s).split(" ").pop();
  if(/_|\.(mp3|wav|m4a|mp4|mov)\b/i.test(s)) issues.push("looks like a file name");
  if(/\b\d+\b/.test(s) && !/\b\d+\s*(seconds?|secs?|bpm|cuts?|clips?|frames?|years?|days?|am|pm|%)\b/i.test(s) && !/^\d{4}$/.test((s.match(/\b\d+\b/)||[""])[0])) issues.push("has a number that means nothing to a viewer");
  if(DANGLING.has(last)) issues.push("ends mid-phrase");
  if(w.length<2) issues.push("too short to say anything");
  return issues;
}
function fallbackHooks(ep,seed){
  const c=contentWords(), r=rng(seed), pick=a=>a[Math.floor(r()*a.length)], Sx=c.subject, F=readFx();
  const win=S.an?windowFor(ep):[0,15], len=Math.round(win[1]-win[0]), plan=S.plan?(makeExportPlan(ep,win)||S.plan):[];
  const cuts=Math.max(1,plan.filter(p=>p.end>win[0]&&p.start<win[1]).length-1), clips=new Set(plan.map(p=>p.clip)).size||S.clips.length;
  const hasDrop=S.an?dropTime(win)>0:false, A=()=>pick(c.adj);
  const subs=topSubjects(3), set=topSettings(1)[0];
  const T=subs.length>=1 ? [ // when the footage has been read, hooks talk about what's on screen
    ...(subs.length>=2?[()=>`${cap1(subs[0])} vs ${subs[1]}`, ()=>`Who wins: ${subs[0]} or ${subs[1]}?`, ()=>`${cap1(subs[0])} meets ${subs[1]}`, ()=>`${cap1(subs[1])} never saw it coming`]:[]),
    ()=>`${cap1(subs[0])} isn’t backing down`, ()=>`Don’t blink: ${subs[0]}`, ()=>`Watch ${subs[0]} closely`, ()=>`${cap1(subs[0])}, one beat at a time`,
    ...(set?[()=>`${cap1(set)}, after dark`, ()=>`Nobody leaves ${set} unchanged`]:[]),
    ()=>`Wait until the last cut`, ()=>`Which frame is yours?`
  ] : [
    ()=>`${Sx}, ${A()}`, ()=>`Turn up ${Sx}`, ()=>`${Sx}, frame by frame`, ()=>`Sound on for this one`, ()=>`Every beat of ${Sx}`,
    ()=>`${Sx}, cut to the beat`, ()=>`Which frame is yours?`, ()=>`${cap1(A())} ${Sx}`, ()=>`Where does the beat land?`, ()=>`Pick your favourite frame`,
    ()=>`How ${Sx} looks out loud`, ()=>`${Sx}: the ${A()} cut`,
  ];
  if(hasDrop) T.push(()=>`${Sx} before the drop`,()=>`${Sx}, then the drop`,()=>`Listen for the ${pick(["drop","switch","lift"])}`,()=>`The drop lands at ${Math.round(dropTime(win)-win[0])} s`);
  if(ep.short && PRO()) T.push(()=>`It loops. Watch twice`,()=>`Ends where it starts`);
  if(F.slowmo!=="off") T.push(()=>`${Sx} in slow motion`);
  if(F.look.f && /grayscale/.test(F.filter)) T.push(()=>`${Sx} in black and white`);
  if(S.direct==="Playful one-take"||S.direct==="Dreamlike calm") T.push(()=>`${Sx}, barely a cut`);
  if(!S.direct && $("look").value==="none") T.push(()=>`${Sx}, no filter`);
  const out=[]; const start=Math.floor(r()*T.length);
  for(let k=0;k<T.length;k++) out.push(T[(start+k*7)%T.length]());
  return [...new Set(out.map(x=>x.replace(/\s+/g," ").trim()))];
}
const PAYOFFS=["Here it is","Now.","There.","Full volume","Drop.","This bit","Right here","And now"];
function hashtagify(s){ const t=String(s||"").replace(/[’']/g,"").replace(/[^\p{L}\p{N} ]/gu," ").split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join(""); return t.length>2?"#"+t.slice(0,28):""; }
function pinQuestion(subs){ return subs.length>=2?`${cap1(subs[0])} or ${subs[1]}: who takes it?`:subs.length?`What’s ${subs[0]} about to do? Wrong answers only.`:"Which cut hit hardest? Drop the timestamp."; }
function fallbackMeta(ep,T){
  const c=contentWords(), subs=topSubjects(3), song=c.song, art=c.art, style=S.direct||"";
  const subj=subs.length?subs.join(", "):(c.topic||"");
  const who=subs.length>1?`${cap1(subs.slice(0,-1).join(", "))} and ${subs[subs.length-1]}`:subs.length?cap1(subs[0]):(c.topic?cap1(c.topic):"");
  const lines=[trimWords(who?`${who}${set0()?` on a ${set0()}`:""}, cut to the beat of “${song||"this track"}”${art?` by ${art}`:""}.`:`A beat-synced edit of “${song||"this track"}”${art?` by ${art}`:""}.`,150)];
  if(style && DSTYLES[style]) lines.push(`A ${style.toLowerCase()} edit: ${DSTYLES[style].d.replace(/^Inspired by [^:]+:\s*/,"").replace(/\.$/,"")}.`);
  const pin=pinQuestion(subs); lines.push(pin);
  if(art&&song) lines.push(`Music: ${art} – ${song}`);
  if($("aiImagery").checked) lines.push("This video contains AI-generated imagery.");
  const tags=[...(ep.short?["#Shorts"]:[]),...[subs[0],song,style?style+" edit":"",set0()].map(hashtagify)].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,ep.short?4:3);
  lines.push(tags.join(" "));
  const kw=[song,art,art&&song?`${art} ${song}`:"",...subs,...topSettings(2),style?`${style.toLowerCase()} edit`:"",ep.short?"shorts edit":"music video","music video edit","beat sync edit",c.topic].filter(Boolean).map(x=>String(x).toLowerCase().trim());
  const out=[]; let n=0; for(const k of kw){ if(out.includes(k)) continue; if(n+k.length+1>480) break; out.push(k); n+=k.length+1; }
  return {desc:lines.join("\n\n"), tags:out.slice(0,15), pin};
}
function set0(){ return topSettings(1)[0]||""; }
function fallbackTitle(ep,hook){
  const c=contentWords(), song=c.song||c.subject;
  if(!ep.short){ if(c.art) return trimWords(`${c.art} - ${song} (${$("ownMusic").checked?"Official Video":"Fan Edit"})`,TITLE_LIMIT(ep)); return trimWords(`${song}${S.direct?" | "+S.direct+" music video":" | Music Video"}`,TITLE_LIMIT(ep)); }
  if(ep.id==="shorts"){ const k=topSubjects(1)[0]||c.song||c.subject; return trimWords(normT(hook).includes(normT(k))?hook:`${hook} | ${cap1(k)}`,50); } // keywords in the title; hashtags go in the description
  const tag=hashtagify(topSubjects(1)[0]||c.song||c.subject)||"#MusicVideo";
  return trimWords(`${hook} ${tag}`,TITLE_LIMIT(ep));
}
function scoreHook(hk,ctx){
  const w=wordCount(hk); let s=0;
  const last=normT(hk).split(" ").pop(); if(DANGLING.has(last)) s-=9;
  s-=8*hookIssues(hk).length;
  if(w>=2&&w<=6) s+=3; else if(w<=8) s+=1; else s-=6;
  if(hk.length>42) s-=2;
  if(isCliche(hk)) s-=7;
  if(ctx.keys.some(k=>normT(hk).includes(k))) s+=2;            // specific to this video
  { const subs=topSubjects(4); if(subs.length){ if(subs.some(su=>normT(hk).includes(normT(su)))) s+=3; else s-=2.5; } } // about what's actually on screen
  if(/\?|\b(until|before|then|but|vs|why|how|when|which)\b/i.test(hk)) s+=1.5; // opens a loop the video can pay off

  const maxPrev=ctx.used.length?Math.max(...ctx.used.map(u=>tSim(hk,u))):0;
  if(maxPrev>=0.5) s-=7; else s+=1-maxPrev;
  return {s,maxPrev,w};
}
S.titles={};
function titleFor(ep){ if($("autoTitles").checked && S.titles[ep.id]) return S.titles[ep.id]; return {hook:$("hookText").value.trim(), payoff:"", title:"", card:"", manual:true}; }
function titlePrompt(eps,used){
  const c=contentWords();
  return `You write on-screen titles for a music video edit. Use the frames in image 1 (a contact sheet of the footage) and these details:
${JSON.stringify({song:c.song||"(untitled)", artist:c.art||null, topic:c.topic||null, directingStyle:S.direct?`${S.direct}: ${DSTYLES[S.direct].d}`:null, bpm:c.bpm})}
Platforms: ${eps.map(e=>`${e.id} (${e.name}, ${e.short?"short-form":"long-form music video"}, ${lenTag(windowFor(e)[1]-windowFor(e)[0])})`).join("; ")}.

Rules, from current platform and creator guidance:
- "hooks" (short-form only): FIVE different options for the on-screen line shown from the first frame, best first. Each 3 to 7 words, sentence case, present tense. Write like a sharp human editor, not a marketer: name or describe what's visibly happening and hint at what comes next, so a viewer wants to see it through. Match the mood of the footage and music. Never use the song title, the platform name, numbers, emojis, hashtags, "POV", "wait for it", "watch till the end" or any generic line that could sit on any video. Different options for each platform.
- "payoff" (short-form only): 1 to 3 words shown at the drop.
- "card" (long-form only): the song title for a lower-third title card, plus "sub": the artist if given, otherwise "".
- "title": the upload title. YouTube under 60 characters with the key words first${c.art?`, and for the long-form music video use exactly "${c.art} - Song (${$("ownMusic").checked?"Official Video":"Fan Edit"})"`:""}; YouTube Shorts under 50 characters; other platforms the first caption line, under 80 characters, with at most two hashtags.
- "description" (youtube and shorts only): 3 to 5 short lines. Line 1 (under 150 characters) states plainly what the video shows, with the key words first. Then one line on the style, then ONE question that invites comments, ${c.art?`then "Music: ${c.art} – ${c.song||"Song"}", `:""}then a final line of hashtags: ${"#Shorts plus 2 or 3 topic hashtags for shorts, 3 topic hashtags for youtube"}. No hashtag walls.
- "tags" (youtube and shorts only): 8 to 15 search phrases a viewer might type, lowercase, under 480 characters in total.
- "pin" (youtube and shorts only): one question to pin as the first comment.
- Every line must read as natural English that relates to what's visible. Never include numbers that mean nothing to a viewer (like the video length or BPM), file names, or fragments.
- Honest: no clickbait, no claims the footage can't back up, no invented names, places or facts. Don't name real people even if someone looks familiar.
- Original: never quote or paraphrase song lyrics, never copy known slogans, avoid these overused phrases: ${CLICHES.slice(0,18).join(", ")}.
- Don't reuse or closely echo any of these earlier titles: ${JSON.stringify(used.slice(-30))}.
Footage notes from an earlier look at the clips: ${JSON.stringify({subjects:topSubjects(4),settings:topSettings(3)})}.
Reply with ONLY JSON: {"platforms":[{"id":"platform id","hooks":["","","","",""],"payoff":"","card":"","sub":"","title":"","description":"","tags":[],"pin":""}]}`;
}
async function writeTitles(useAI,onlyMissing){
  if(!S.plan||!S.an) return;
  const eps=S.eps.map(EP).filter(Boolean).filter(ep=>!onlyMissing||!S.titles[ep.id]), used=titleHistory().map(x=>x.t);
  if(!eps.length) return;
  if(!onlyMissing) S.titleSeed=(Math.random()*1e9)|0; else if(S.titleSeed==null) S.titleSeed=12345;
  let ai=null;
  if(useAI){
    const id=[...$("capWith").options].map(o=>o.value).find(v=>PROVIDERS[v]);
    if(id){ $("titleList").textContent="Writing titles…"; try{ const img=await buildReviewImages(); ai=await askAI(id,titlePrompt(eps,used),img.blobs.slice(0,1)); }catch(e){ status(aiErrorText(e)+" Using built-in titles instead."); } }
  }
  const c=contentWords(), ctx={keys:c.keys, used:[...used]}, aiFor=id=>ai&&Array.isArray(ai.platforms)?ai.platforms.find(p=>p&&p.id===id):null;
  const seed=S.titleSeed;
  for(const ep of S.eps.map(EP).filter(Boolean)){ if(S.titles[ep.id] && !eps.includes(ep)) ctx.used.push(S.titles[ep.id].hook||""); }
  for(const ep of eps){
    const a=aiFor(ep.id)||{}, T={src:a.hook||a.card?"ai":"auto"};
    if(ep.short){
      const aiHooks=(Array.isArray(a.hooks)?a.hooks:typeof a.hook==="string"?[a.hook]:[]).map(x=>trimWords(String(x),56)).filter(x=>x&&!hookIssues(x).length&&!isCliche(x)&&!(c.song&&normT(x).includes(normT(c.song))));
      const cands=[...aiHooks,...(aiHooks.length?[]:fallbackHooks(ep,seed+ep.w*13+ep.h))];
      let best=null, fallback=null;
      for(const hk of cands){ if(!hk) continue; const sc=scoreHook(hk,ctx); if(sc.w>8) continue;
        const clean=sc.w<=6 && !isCliche(hk) && sc.maxPrev<0.5 && !hookIssues(hk).length;
        if(clean && (!best||sc.s>best.sc.s)) best={hk,sc};
        if(!fallback||sc.maxPrev<fallback.sc.maxPrev||(sc.maxPrev===fallback.sc.maxPrev&&sc.s>fallback.sc.s)) fallback={hk,sc}; }
      best=best||fallback;
      // the AI ranks its own options; without AI or a read of the footage, no text beats a generic line built from the song name
      T.hook=aiHooks.length?aiHooks[0]:(topSubjects(1).length&&best?best.hk:songArtistLine());
      T.hookOpts=[...new Set([...(aiHooks.length?aiHooks:cands.filter(h=>!hookIssues(h).length)).slice(0,5),songArtistLine()].filter(Boolean))];
      const po=typeof a.payoff==="string"&&wordCount(a.payoff)<=3&&!isCliche(a.payoff)?a.payoff.trim():PAYOFFS[Math.floor(rng(seed+ep.h)()*PAYOFFS.length)];
      T.payoff=po; ctx.used.push(T.hook);
    } else {
      T.card=trimWords(typeof a.card==="string"&&a.card.trim()?a.card:(c.song||c.subject),40);
      T.sub=trimWords(typeof a.sub==="string"?a.sub:c.art,40); T.hook="";
    }
    let tt=typeof a.title==="string"?a.title.trim():"";
    if(!ep.short && c.art){ tt=`${c.art} - ${T.card||c.song||c.subject} (${$("ownMusic").checked?"Official Video":"Fan Edit"})`; }
    if(!tt || isCliche(tt) || tt.length>TITLE_LIMIT(ep)+20) tt=fallbackTitle(ep,T.hook||T.card);
    T.title=trimWords(tt,TITLE_LIMIT(ep));
    if(ep.id==="youtube"||ep.id==="shorts"){
      const fb=fallbackMeta(ep,T), d=typeof a.description==="string"?a.description.trim():"";
      T.desc=d && !hookIssues(d.split("\n")[0]).includes("has a number that means nothing to a viewer") ? d : fb.desc;
      if($("aiImagery").checked && !/AI-generated/i.test(T.desc)) T.desc=T.desc.replace(/(\n\n#[^\n]*)?$/,m=>"\n\nThis video contains AI-generated imagery."+(m||""));
      if(ep.short && !/#shorts/i.test(T.desc)) T.desc+=" #Shorts";
      T.tags=Array.isArray(a.tags)&&a.tags.length>=5?a.tags.map(x=>String(x).toLowerCase().trim()).filter(Boolean).slice(0,15):fb.tags;
      T.pin=typeof a.pin==="string"&&a.pin.trim()?a.pin.trim():fb.pin;
    }
    S.titles[ep.id]=T;
  }
  renderTitles(); scheduleChecklist();
  status(ai?"New titles written for each platform.":"New titles written for each platform (built-in writer).");
}
function renderTitles(){
  const box=$("titleList"); box.innerHTML="";
  if(!$("autoTitles").checked){ box.textContent="Automatic titles are off. The opening hook below is used on every platform."; return; }
  const used=titleHistory().map(x=>x.t);
  for(const ep of S.eps.map(EP).filter(Boolean)){
    const T=S.titles[ep.id]; if(!T) continue;
    const row=document.createElement("div"); row.className="trow";
    const b=document.createElement("b"); b.textContent=ep.name; row.appendChild(b);
    const field=(label,key,max,metaFn)=>{ const l=document.createElement("label"); l.textContent=label; const inp=document.createElement("input"); inp.type="text"; inp.maxLength=max; inp.value=T[key]||"";
      const meta=document.createElement("div"); meta.className="meta";
      const upd=()=>{ const m=metaFn(inp.value); meta.textContent=m.t; meta.classList.toggle("bad",!!m.bad); };
      inp.oninput=()=>{ T[key]=inp.value; T.src="edit"; upd(); scheduleChecklist(); };
      l.appendChild(inp); row.append(l,meta); upd(); };
    if(ep.short){
      { const opts=document.createElement("div"); opts.className="presets"; opts.style.margin="2px 0 4px 84px";
        [...(T.hookOpts||[]),""].forEach(o=>{ const b2=document.createElement("button"); b2.type="button"; b2.className="chip"; b2.textContent=o||"No text"; b2.setAttribute("aria-pressed",String((T.hook||"")===o));
          b2.onclick=()=>{ T.hook=o; T.src="edit"; renderTitles(); scheduleChecklist(); }; opts.appendChild(b2); });
        const lab=document.createElement("div"); lab.className="meta"; lab.textContent="Pick an opening line, or edit it below:"; row.append(lab,opts); }
      field("On screen","hook",60,v=>{ const w=wordCount(v), sim=used.length?Math.max(...used.map(u=>tSim(v,u))):0;
        const probs=[]; if(w>8) probs.push("too long to read at a glance"); else if(w>6) probs.push("a little long"); if(isCliche(v)) probs.push("overused phrase"); if(sim>=0.5) probs.push("close to a title you used before");
        return {t:`${w} word${w===1?"":"s"}, shown 0.1–${hookDur(v).toFixed(1)} s, top third${probs.length?". "+probs.join(", "):", fresh"}`, bad:w>8||isCliche(v)||sim>=0.5}; });
      if($("payoffOn").checked) field("At the drop","payoff",24,v=>({t:`${wordCount(v)} word${wordCount(v)===1?"":"s"}, about 1.5 s on the biggest hit`, bad:wordCount(v)>3}));
    } else {
      field("Title card","card",40,v=>({t:"Lower third, from 1 s to 6 s", bad:!v.trim()}));
      field("Second line","sub",40,v=>({t:v?"Under the title":"Optional, e.g. the artist", bad:false}));
    }
    field("Upload title","title",100,v=>({t:`${v.length} characters (keep under ${TITLE_LIMIT(ep)} so it isn’t cut off)${hookIssues(v).length?". "+hookIssues(v)[0]:""}`, bad:v.length>TITLE_LIMIT(ep)||!!hookIssues(v).length}));
    if(ep.id==="youtube"||ep.id==="shorts"){
      const area=(label,val,on,metaFn)=>{ const l=document.createElement("label"); l.textContent=label; const ta=document.createElement("textarea"); ta.value=val; ta.rows=label==="Description"?6:2;
        ta.style.cssText="font:inherit;font-size:13px;padding:6px 8px;border-radius:7px;border:1px solid var(--line);background:var(--bg);color:var(--ink);width:100%;resize:vertical";
        const meta=document.createElement("div"); meta.className="meta"; const cp=document.createElement("button"); cp.className="chip"; cp.type="button"; cp.textContent="Copy"; cp.style.marginLeft="84px";
        const upd=()=>{ const m=metaFn(ta.value); meta.textContent=m.t; meta.classList.toggle("bad",!!m.bad); };
        ta.oninput=()=>{ on(ta.value); T.src="edit"; upd(); scheduleChecklist(); };
        cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(ta.value); cp.textContent="Copied"; }catch(e){ ta.select(); cp.textContent="Selected, press Ctrl+C"; } };
        l.appendChild(ta); row.append(l,meta,cp); upd(); };
      area("Description",T.desc||"",v=>{ T.desc=v; },v=>{ const tags=(v.match(/#[\p{L}\p{N}_]+/gu)||[]).length, first=(v.split("\n")[0]||"").length;
        return {t:`First line ${first} characters${first>150?" (the search preview shows about 150)":""}, ${tags} hashtag${tags===1?"":"s"}${ep.short&&!/#shorts/i.test(v)?", add #Shorts":""}`, bad:first>150||tags>5||(ep.short&&!/#shorts/i.test(v))}; });
      area("Tags",(T.tags||[]).join(", "),v=>{ T.tags=v.split(",").map(x=>x.trim()).filter(Boolean); },v=>{ const n=v.length; return {t:`${v.split(",").filter(x=>x.trim()).length} tags, ${n} of 500 characters. Paste into YouTube Studio’s Tags box.`, bad:n>500}; });
      area("Pin a comment",T.pin||"",v=>{ T.pin=v; },v=>({t:"Post this as your first comment and pin it. Questions get replies, and replies count as engagement.", bad:!/\?/.test(v)}));
    }
    box.appendChild(row);
  }
}
function dropTime(win){
  const B=S.an.beats, E=S.an.E; let best=-1, bs=0.25;
  for(let i=4;i<B.length;i++){ if(B[i]<win[0]+3 || B[i]>win[1]-2) continue; const d=E[i]-E[i-4]; if(d>bs && E[i]>0.6){ bs=d; best=B[i]; } }
  return best;
}

function paceReport(plan,win){
  const an=S.an, B=an.beats, rows=[];
  for(let i=0;i+4<B.length;i+=4){ const a=B[i], b=B[i+4]; if(b<=win[0]||a>=win[1]) continue;
    const e=an.E.slice(i,i+4).reduce((x,y)=>x+y,0)/4;
    const cuts=plan.filter(s=>s.start>a+0.01&&s.start<b-0.01).length;
    let mot=0,w=0; for(const s of plan){ const o=Math.min(s.end,b)-Math.max(s.start,a); if(o>0){ mot+=o*((s._mN!=null?s._mN:0.5)+(s._assist?0.25:0)); w+=o; } }
    rows.push({a,b,e,rate:cuts/((b-a)||1),mot:w?mot/w:0.5}); }
  if(rows.length<4) return null;
  const mr=Math.max(...rows.map(r=>r.rate))||1;
  rows.forEach(r=>{ r.dyn=0.65*(r.rate/mr)+0.35*r.mot; });
  const corr=(x,y)=>{ const n=x.length, mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n; let s=0,sx=0,sy=0; for(let i=0;i<n;i++){ s+=(x[i]-mx)*(y[i]-my); sx+=(x[i]-mx)**2; sy+=(y[i]-my)**2; } return s/Math.sqrt(sx*sy+1e-9); };
  const r=corr(rows.map(x=>x.e),rows.map(x=>x.dyn));
  const segLen=f=>{ const L=plan.filter(s=>s.start>=win[0]&&s.end<=win[1]&&f(s.e)).map(s=>s.end-s.start); return L.length?L.reduce((a,b)=>a+b,0)/L.length:null; };
  const quiet=segLen(e=>e<0.35), loud=segLen(e=>e>0.7);
  let deadRun=0, run=0; for(const s of plan){ if(s.e>0.5 && s.end-s.start>2.2 && (s._mN??0.5)<0.25 && !s._assist){ run+=s.end-s.start; deadRun=Math.max(deadRun,run); } else run=0; }
  const drops=plan.filter(s=>s.drop && s.start>=win[0] && s.start<win[1]);
  let accel=0, accelOk=0; for(const d of drops){ const pre=plan.filter(s=>s.end<=d.start+0.01 && s.start>=d.start-8*60/an.bpm-0.01); if(pre.length>=2){ accel++; const L=pre.map(s=>s.end-s.start); if(L[L.length-1]<=L[0]) accelOk++; } }
  return {r,quiet,loud,deadRun,drops:drops.length,accel,accelOk,rows};
}
