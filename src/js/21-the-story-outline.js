/* ---------------- The story outline: five acts laid over the song ----------------
   Exposition (the setup), rising action (the conflict), climax (the turning point), falling action (the aftermath),
   resolution (the new normal). Each act names who and where it is about; clip choice follows it. */
const ACTS=[["setup","Exposition: the setup","Introduce the world and the main character before anything disrupts it."],["rising","Rising action: the conflict","Something breaks the status quo; challenges and tension escalate."],["climax","Climax: the turning point","The peak of tension: the main character faces the conflict head-on."],["falling","Falling action: the aftermath","The fallout of the climax; loose ends start to wrap up."],["resolution","Resolution: the new normal","The world settles into a changed reality."]];
/* where each act falls in a stretch of the song: the climax lands on the strongest sustained section late in the window */
function actsFor(win){ if(!S.an) return null; const [w0,w1]=win, L=w1-w0, B=S.an.beats, E=S.an.E;
  const key=w0.toFixed(2)+"-"+w1.toFixed(2)+"|"+(S.lyrics?S.lyrics.lines.length+":"+S.lyrics.lines[0].t+":"+(S.lyrics.shift||0)+":"+S.lyrics.src:""); S._actsC=S._actsC||{}; if(S._actsC.k===S.an&&S._actsC[key]) return S._actsC[key]; if(S._actsC.k!==S.an) S._actsC={k:S.an};
  const ix=B.map((b,i)=>i).filter(i=>B[i]>=w0&&B[i]<w1); let best=null;
  for(let a=0;a<ix.length;a++){ const t=B[ix[a]], rel=(t-w0)/L; if(rel<0.45||rel>0.72) continue; let s=0,n=0; for(let k=a;k<Math.min(ix.length,a+16);k++){ s+=E[ix[k]]; n++; } const sc=s/n+0.15*(1-Math.abs(rel-0.62)/0.2); if(!best||sc>best.sc) best={sc,t}; }
  const cS=best?best.t:w0+L*0.62, cE=Math.min(w1-L*0.18,cS+Math.max(L*0.14,Math.min(L*0.22,(60/(S.an.bpm||120))*16)));
  let sE=w0+L*0.18; const en=ix.find(i=>B[i]>w0+L*0.1&&B[i]<w0+L*0.3&&E[i]>=0.62); if(en!=null) sE=B[en]; sE=Math.min(sE,cS-L*0.1);
  const rS=Math.max(cE+L*0.05,w1-Math.max(L*0.1,Math.min(12,L*0.15)));
  let bounds=[sE,cS,cE,rS], by="energy";
  const LS=lyricSections(), fromLyrics=!!(S.lyrics&&LS.length>=3), SEC=fromLyrics?LS:songSections().map(s=>({t0:s.t0,t1:s.t1,chorus:s.chorus,name:s.label}));
  if(SEC.length>=3&&SEC.some(s=>s.chorus)&&L>=S.an.duration*0.85){ // the setup runs to the first chorus, the climax is the last big chorus, the outro is the new normal
    const inW=SEC.filter(s=>s.t0>=w0-0.5&&s.t1<=w1+0.5), ch=inW.filter(s=>s.chorus);
    const first=ch.find(s=>(s.t0-w0)/L>=0.08&&(s.t0-w0)/L<=0.45); const sE2=first?first.t0:inW[0]?Math.min(inW[0].t1,w0+L*0.3):null;
    const lastC=[...ch].reverse().find(s=>(s.t0-w0)/L>=0.45&&(s.t0-w0)/L<=0.85);
    const lastLine=Math.max(...inW.map(s=>s.t1)), rS2=lastLine+0.5<w1-4?Math.max(lastLine+0.5,0):null;
    if(sE2&&lastC){ const after=SEC.filter(s=>s.t0>lastC.t0+0.5&&s.t0<w1-1), out=after.length?after[after.length-1].t0:Math.min(lastC.t1+L*0.06,w1-L*0.06);
      let rS3=Math.min(Math.max(out,lastC.t0+L*0.14),w1-L*0.05), cE3=Math.min(lastC.t1,rS3-L*0.05); if(cE3<lastC.t0+L*0.06) cE3=lastC.t0+L*0.06;
      let b2=[sE2,lastC.t0,cE3,rS3];
      const ok=b2.every((x,i)=>x>(i?b2[i-1]:w0)+L*0.03)&&b2[3]<w1-L*0.03; if(ok){ bounds=b2; by=fromLyrics?"lyrics":"song"; } } }
  const r=[[w0,bounds[0]],[bounds[0],bounds[1]],[bounds[1],bounds[2]],[bounds[2],bounds[3]],[bounds[3],w1]].map(([a,b],i)=>({key:ACTS[i][0],t0:a,t1:Math.max(a+0.01,b),by})); S._actsC[key]=r; return r; }
/* the song's lyric structure: lines that come back are the chorus; lines are grouped into sections by the pauses between them */
const lyKey=t=>String(t||"").toLowerCase().replace(/[^a-z0-9' ]/g,"").replace(/\s+/g," ").trim();
function lyricSections(){ const L=S.lyrics; if(!L||!L.lines.length) return []; if(L._secFor===L.lines.length+":"+L.lines[0].t+":"+L.lines[L.lines.length-1].t) return L._sec;
  const cnt=new Map(); L.lines.forEach(l=>{ const k=lyKey(l.text); cnt.set(k,(cnt.get(k)||0)+1); }); const rep=l=>cnt.get(lyKey(l.text))>=2;
  const out=[]; let cur=null;
  L.lines.forEach((l,i)=>{ const prev=L.lines[i-1], gap=prev?l.t-prev.end:99, flip=cur&&cur.lines.length>=2&&rep(l)!==rep(cur.lines[cur.lines.length-1]);
    if(!cur||gap>3.5||flip){ cur={t0:l.t,t1:l.end,lines:[]}; out.push(cur); } cur.lines.push(l); cur.t1=l.end; });
  out.forEach(s=>{ s.chorus=s.lines.filter(rep).length>=s.lines.length*0.5; });
  let v=0,c=0; out.forEach(s=>{ s.name=s.chorus?`chorus ${++c}`:`verse ${++v}`; });
  L._sec=out; L._secFor=L.lines.length+":"+L.lines[0].t+":"+L.lines[L.lines.length-1].t; return out; }
function outlineOn(){ return !!(S.outline&&$("outlineOn")&&$("outlineOn").checked); }
function actIndexAt(t,acts){ if(!acts) return -1; for(let i=0;i<acts.length;i++) if(t>=acts[i].t0-1e-6&&t<acts[i].t1) return i; return acts.length-1; }
const SHOT_SCALE={wide:1,medium:2.5,close:4};
function outlineCost(seg,clip,ci,s,ctx){
  if(!outlineOn()||!ctx.acts) return 0; const i=actIndexAt(seg.start,ctx.acts), A=S.outline.acts[i]; if(!A) return 0; let cost=0;
  const ly=S.lyrics&&S.outline.board?lyricAt(seg.start+Math.min(0.4,(seg.end-seg.start)/2)):null, Bd=ly?S.outline.board[lyKey(ly.text)]:null, k=Bd?1.25:1; // a line's own casting is stronger than its act's
  const who=charsAt(clip,s.t), want=Bd&&Bd.chars&&Bd.chars.length?Bd.chars:(A.chars||[]), shot=(Bd&&Bd.shot)||A.shot;
  if(want.length){ if(who.some(x=>want.includes(x))) cost-=1.0*k; else if(who.length) cost+=0.75*k; else cost+=shot==="wide"?0.1:0.35; }
  else if(A.noPeople&&who.length) cost+=0.4;
  const sc=scenesAt(clip,s.t), ws=Bd&&Bd.scenes&&Bd.scenes.length?Bd.scenes:(A.scenes||[]); if(ws.length&&sc.length) cost+=sc.some(x=>ws.includes(x))?-0.6*k:0.55*k;
  const tg=tagAt(clip,s.t); if(shot&&tg&&tg.scale!=null&&Math.abs(tg.t-s.t)<2.5) cost+=0.18*Math.abs(tg.scale-SHOT_SCALE[shot]);
  return cost; }
/* the cast and places the outline can draw on */
function storyCatalogue(){ const L=CAST().filter(x=>x.n>=2).slice(0,10), sc=new Map(); S.clips.forEach(c=>{ if(c.samples&&!c.off) clipScenes(c).forEach((n,k)=>sc.set(k,(sc.get(k)||0)+1)); });
  const where=id=>{ const m=new Map(); S.clips.forEach(c=>{ if((c.chars||[]).includes(id)) clipScenes(c).forEach((n,k)=>m.set(k,(m.get(k)||0)+1)); }); return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]); };
  return {chars:L.map(x=>({id:x.id,name:charName(x),type:x.type||"",clips:x.n,where:where(x.id)})), scenes:[...sc.entries()].sort((a,b)=>b[1]-a[1]).map(([k,n])=>({id:k,clips:n}))}; }
/* each distinct lyric line once, with its first time, section and how often it's sung */
function lyricLinesForStory(){ if(!S.lyrics) return []; const SEC=lyricSections(), seen=new Map();
  for(const s of SEC) for(const l of s.lines){ const k=lyKey(l.text); if(!seen.has(k)) seen.set(k,{text:l.text,t:l.t,sec:s.name,n:0}); seen.get(k).n++; }
  return [...seen.values()].slice(0,70); }
function templateBoard(o){ const acts=actsFor([0,S.an.duration]), L=CAST(), board={}, scs=new Set(storyCatalogue().scenes.map(x=>x.id));
  for(const x of lyricLinesForStory()){ const l=S.lyrics.lines.find(q=>lyKey(q.text)===lyKey(x.text)), A=o.acts[actIndexAt(x.t,acts)]||{}, I=(l&&l.img)||{};
    const byType=(I.types||[]).flatMap(t=>L.filter(c=>c.type===t&&c.n>=2).map(c=>c.id)), sc=(I.scenes||[]).filter(v=>scs.has(v));
    board[lyKey(x.text)]={chars:byType.length?[...new Set(byType)].slice(0,2):(A.chars||[]).slice(0,2),scenes:sc.length?sc:(A.scenes||[]),shot:I.shot||A.shot||null}; }
  return board; }
function templateOutline(){ const C=storyCatalogue(), hero=heroId()||(C.chars[0]&&C.chars[0].id)||null;
  const foe=(C.chars.find(x=>x.id!==hero&&/villain|cyborg|robot|gangster|alien|monster|soldier|enemy/.test(x.type))||C.chars.find(x=>x.id!==hero)||{}).id||null;
  const third=C.chars.filter(x=>x.id!==hero&&x.id!==foe).map(x=>x.id).slice(0,2), heroW=hero?(C.chars.find(x=>x.id===hero)||{}).where||[]:[], top=C.scenes.map(x=>x.id);
  const home=heroW[0]||top[0]||null, other=top.find(x=>x!==home)||null, nm=id=>{ const x=C.chars.find(k=>k.id===id); return x?x.name:"the main character"; };
  const acts=[{chars:hero?[hero]:[],scenes:home?[home]:[],shot:"wide",summary:`${cap(nm(hero))}'s world${home?`, ${sceneLabel(home).toLowerCase()}`:""}, before anything goes wrong.`},
    {chars:[hero,foe,...third].filter(Boolean),scenes:[home,other].filter(Boolean),shot:"medium",summary:foe?`${cap(nm(foe))} arrives and the pressure builds on ${nm(hero)}.`:`The pressure builds and the world starts to crack.`},
    {chars:[hero,foe].filter(Boolean),scenes:other?[other]:[],shot:"close",summary:foe?`${cap(nm(hero))} and ${nm(foe)} face off: the highest-stakes moment.`:`${cap(nm(hero))} faces it head-on.`},
    {chars:[hero,...third].filter(Boolean),scenes:[],shot:"medium",summary:`The dust settles and the fallout plays out.`},
    {chars:hero?[hero]:[],scenes:home?[home]:[],shot:"wide",summary:`Back where it began, but changed: the new normal.`}];
  return {logline:hero?`${cap(nm(hero))}'s world is upended${foe?` by ${nm(foe)}`:""}, and nothing ends quite the same.`:"",acts,src:"template"}; }
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
async function writeOutline(){ const btn=$("outlineWrite"); btn.disabled=true; $("outlineInfo").textContent="Writing the outline…";
  try{ const C=storyCatalogue(), id=aiProvider(); let o=null;
    if(id&&(C.chars.length||C.scenes.length)){ try{
      const acts=actsFor([0,S.an.duration]), song=songArtistLine(), LY=lyricLinesForStory();
      const prompt=`You are outlining the story of a music video cut from a library of clips${song?` for “${song}”`:""}. Use the five-act arc: setup (introduce the world and main characters, status quo), rising action (an inciting incident breaks the status quo; tension escalates), climax (peak of tension; the protagonist faces the conflict head-on), falling action (the aftermath), resolution (the new normal).
Act timings in the song: ${acts.map((a,i)=>`${ACTS[i][0]} ${fmtTime(a.t0)}–${fmtTime(a.t1)}`).join(", ")}.
Characters available (id: description, type, number of clips, where they appear): ${C.chars.map(x=>`${x.id}: ${x.name}, ${x.type||"?"}, ${x.clips} clips, in ${x.where.join("/")||"various"}`).join("; ")||"none identified"}.
${S.mainChar?`The user chose ${S.mainChar} as the main character.`:""}
Backgrounds available (id: clips): ${C.scenes.map(x=>`${x.id}: ${x.clips}`).join(", ")||"unknown"}.
${LY.length?`The song's lyrics, numbered, with when they're first sung and their section (choruses repeat):
${LY.map((x,i)=>`${i+1}. [${fmtTime(x.t)} ${x.sec}${x.n>1?`, sung ${x.n}×`:""}] ${x.text}`).join("\n")}
Let the story come from the lyrics: what they're about shapes the arc, and each act should fit the lines sung in it.`:""}
Only use the ids listed. Keep each act to characters and backgrounds that actually have clips${C.chars.length?"; give the most screen time to characters with the most clips":""}.
Reply with ONLY JSON: {"logline":"one sentence","acts":[{"act":"setup","summary":"one or two vivid sentences","characters":["id"],"backgrounds":["id"],"shot":"wide|medium|close"}]${LY.length?`,"board":[{"line":1,"characters":["id"],"backgrounds":["id"],"shot":"wide|medium|close"}]`:""}} with exactly five acts in order${LY.length?`, and one board entry per numbered lyric line saying who and where to show while it's sung (a repeated chorus line keeps the same casting)`:""}.`;
      const r=await askAI(id,prompt,[]); const ok=new Set(C.chars.map(x=>x.id)), okS=new Set(C.scenes.map(x=>x.id));
      if(r&&Array.isArray(r.acts)&&r.acts.length>=5&&Array.isArray(r.board)&&LY.length){ var board={}; r.board.forEach(b=>{ const x=LY[(+b.line)-1]; if(!x) return; board[lyKey(x.text)]={chars:(b.characters||[]).filter(v=>ok.has(v)),scenes:(b.backgrounds||[]).filter(v=>okS.has(v)),shot:SHOT_SCALE[b.shot]?b.shot:null}; }); }
      if(r&&Array.isArray(r.acts)&&r.acts.length>=5) o={board:typeof board!=="undefined"?board:null,logline:String(r.logline||"").slice(0,200),src:"ai",acts:r.acts.slice(0,5).map(a=>({chars:(a.characters||[]).filter(x=>ok.has(x)),scenes:(a.backgrounds||[]).filter(x=>okS.has(x)),shot:SHOT_SCALE[a.shot]?a.shot:"medium",summary:String(a.summary||"").slice(0,240)}))}; }
      catch(e){ crumb("outline AI failed: "+(e&&e.message||e)); } }
    if(!o) o=templateOutline();
    if(!o.board&&S.lyrics) o.board=templateBoard(o); // no AI storyboard: cast each line from its act and what it's about
    S.outline=o; $("outlineOn").checked=true; renderOutline(); saveProjectSoon(); if(!S.running) buildPlan();
    $("outlineInfo").textContent=o.src==="ai"?"Written by the AI from your characters and backgrounds. Edit anything below.":C.chars.length||C.scenes.length?"Written from your characters and backgrounds. Edit anything below.":"Find characters by face or read your footage with AI first for a richer outline. Edit anything below."; }
  catch(e){ $("outlineInfo").textContent="Couldn’t write the outline."; }
  finally{ btn.disabled=!S.an||!S.clips.some(c=>c.samples); } }
let _olT=0; function outlineEdited(){ S.outline.src="edited"; saveProjectSoon(); clearTimeout(_olT); _olT=setTimeout(()=>{ if(!S.running) buildPlan(); },600); }
function renderOutline(){ const box=$("outlineActs"); if(!box) return; box.innerHTML=""; const o=S.outline; $("outlineWrite").textContent=o?"Rewrite the outline":"Write the outline"; if(!o) return;
  const acts=S.an?actsFor([0,S.an.duration]):null, L=CAST().filter(x=>x.n>=1), scs=storyCatalogue().scenes;
  if(o.logline){ const p=document.createElement("p"); p.className="small"; p.style.cssText="margin:6px 0;font-style:italic"; p.textContent=o.logline; box.appendChild(p); }
  o.acts.forEach((A,i)=>{ const d=document.createElement("div"); d.style.cssText="border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:6px 0";
    const hd=document.createElement("div"); hd.style.cssText="font-weight:600;margin-bottom:4px"; hd.textContent=`${i+1}. ${ACTS[i][1]}${acts?`  ·  ${fmtTime(acts[i].t0)}–${fmtTime(acts[i].t1)}`:""}`; d.appendChild(hd);
    if(i===0&&acts&&(acts[0].by==="lyrics"||acts[0].by==="song")){ const nb=document.createElement("div"); nb.className="small"; nb.style.margin="-2px 0 6px"; nb.textContent=`Acts follow the ${acts[0].by==="lyrics"?"lyrics":"song's sections"}: the setup runs to the first chorus and the climax lands on the last big chorus.`; d.appendChild(nb); }
    const ta=document.createElement("textarea"); ta.value=A.summary||""; ta.rows=2; ta.placeholder=ACTS[i][2]; ta.style.cssText="width:100%;box-sizing:border-box;font:inherit;padding:6px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink)"; ta.oninput=()=>{ A.summary=ta.value; outlineEdited(); }; d.appendChild(ta);
    const row=(label,items,has,toggle)=>{ if(!items.length) return; const r=document.createElement("div"); r.className="small"; r.style.cssText="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:4px"; const l=document.createElement("span"); l.textContent=label; l.style.marginRight="4px"; r.appendChild(l);
      items.forEach(([k,t])=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent=t; b.setAttribute("aria-pressed",String(has(k))); b.onclick=()=>{ toggle(k); outlineEdited(); renderOutline(); }; r.appendChild(b); }); d.appendChild(r); };
    const unboard=f=>{ if(!o.board||!S.lyrics||!acts) return; S.lyrics.lines.filter(l=>l.t>=acts[i].t0-0.01&&l.t<acts[i].t1).forEach(l=>{ const B=o.board[lyKey(l.text)]; if(B) B[f]=[]; }); }; // changing an act re-casts its lines
    row("Who:",L.map(x=>[x.id,charName(x)]),k=>(A.chars||[]).includes(k),k=>{ A.chars=(A.chars||[]).includes(k)?A.chars.filter(x=>x!==k):[...(A.chars||[]),k]; unboard("chars"); });
    row("Where:",scs.map(x=>[x.id,sceneLabel(x.id)]),k=>(A.scenes||[]).includes(k),k=>{ A.scenes=(A.scenes||[]).includes(k)?A.scenes.filter(x=>x!==k):[...(A.scenes||[]),k]; unboard("scenes"); });
    row("Shots:",[["wide","Wide"],["medium","Medium"],["close","Close-up"]],k=>A.shot===k,k=>{ A.shot=A.shot===k?null:k; });
    { const vids=S.clips.filter((c,ci)=>c.samples&&!c.off), has=c=>(A.chars||[]).some(x=>(c.chars||[]).includes(x)), inS=c=>(A.scenes||[]).some(x=>clipScenes(c).has(x));
      const nW=(A.chars||[]).length?vids.filter(has).length:null, nS=(A.scenes||[]).length?vids.filter(inS).length:null, span=acts?acts[i].t1-acts[i].t0:0, need=Math.max(2,Math.round(span/12));
      const warn=[]; if(nW!=null&&nW<need) warn.push(`only ${nW} clip${nW===1?"":"s"} show ${(A.chars||[]).map(castLabel).join(" or ")}`); if(nS!=null&&nS<need) warn.push(`only ${nS} clip${nS===1?"":"s"} are set in ${(A.scenes||[]).map(sceneLabel).join(" or ").toLowerCase()}`);
      if(warn.length){ const w=document.createElement("div"); w.className="small"; w.style.cssText="margin-top:6px;color:var(--danger)"; w.textContent=`For ${span>0?fmtTime(span):"this act"} of story, ${warn.join(" and ")}: they’ll repeat, or other footage fills in.`; d.appendChild(w); } }
    if(S.lyrics&&acts){ const ln=S.lyrics.lines.filter(l=>l.t>=acts[i].t0-0.01&&l.t<acts[i].t1), seen=new Set(), uniq=ln.filter(l=>{ const k=lyKey(l.text); if(seen.has(k)) return false; seen.add(k); return true; });
      if(uniq.length){ const box2=document.createElement("div"); box2.className="small actly"; uniq.slice(0,6).forEach(l=>{ const B=o.board&&o.board[lyKey(l.text)], r=document.createElement("div");
          const who=B&&B.chars&&B.chars.length?B.chars.map(castLabel).join(", "):"", where=B&&B.scenes&&B.scenes.length?B.scenes.map(sceneLabel).join(", ").toLowerCase():"";
          r.textContent=`♪ ${l.text}${who||where?`  →  ${[who,where].filter(Boolean).join(", ")}`:""}`; box2.appendChild(r); });
        if(uniq.length>6){ const m=document.createElement("div"); m.textContent=`and ${uniq.length-6} more line${uniq.length-6===1?"":"s"}`; box2.appendChild(m); } d.appendChild(box2); } }
    box.appendChild(d); }); }
function storyCost(seg,clip,ci,sample,ctx){
  if(!storyOn()) return 0;
  let cost=0; const shape=$("storyShape").value;
  if(shape==="journey" && ctx.order){ const rank=ctx.order.get(ci); if(rank!=null){ const rel=seg.start/(S.an?S.an.duration:1); cost+=0.7*Math.max(0,Math.abs(rank-rel)-0.12); } } // the story moves through the day, not through the folder one file at a time
  const tg=tagAt(clip,sample.t); if(!tg) return cost;
  const beat=seg._beat||"introduce", want=wantScale(seg,beat);
  let reach=tg.scale; if(tg.box && $("faceFrame").checked && want>tg.scale) reach=Math.min(want,tg.scale+1.5); // a face can be punched in on
  cost+=0.6*Math.abs(reach-want);
  if(want>=3.5) cost+= tg.faces>0 ? -0.1 : (ctx.short?0.1:0.6);        // emotional peaks need a face (less strictly in fast short-form)
  if(tg.faces>0) cost+=0.5*Math.abs((+tg.inten||0)-seg.e);
  const hero=protagonist();
  if(hero && ["introduce","develop","peak","climax","resolve"].includes(beat)) cost+= isHeroTag(tg,hero) ? -0.35 : 0.15;
  if(shape==="portrait" && hero) cost+= isHeroTag(tg,hero) ? -0.3 : 0.25;
  if(beat==="establish" && (tg.role==="establishing"||tg.scale<=1)) cost-=0.3;
  if(ctx.matchTo && tg.box && ctx.matchTo.box){ cost+=0.8*(Math.abs(tg.box.cx-ctx.matchTo.box.cx)+Math.abs(tg.box.cy-ctx.matchTo.box.cy)); } // match cuts line faces up
  return cost;
}
