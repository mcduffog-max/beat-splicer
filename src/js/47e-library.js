/* ---------------- Library: every video made, how it did, and what gets views ----------------
   Every export is already a recipe (47a). The library shows them with a thumbnail, their structure and their numbers.
   Numbers come from YouTube by themselves where the channel is connected (a computer), or are typed in from any
   platform's own stats (views, likes, average % watched). From those, the app works out which structure gets views:
   each choice's views against the platform's usual (log2, so +1 is double), shrunk while there are few videos.
   Do everything leans on it through learnW, and the clearest wins come with a one-tap suggestion. */
const LIB_KEYS={...LEARN_KEYS, mood:"Mood", cutPace:"Cut pace", hookLen:"Opening title", peak:"First big moment", lenB:"Length", ep:"Platform"};
delete LIB_KEYS.title; delete LIB_KEYS.length;
const LIB_VALS={cutPace:{fast:"Quick cuts (under 0.8 s)",medium:"Medium cuts (0.8–1.5 s)",slow:"Long shots (over 1.5 s)"},
  hookLen:{none:"No title",short:"1–3 words",medium:"4–6 words",long:"7 words or more"},
  peak:{early:"In the first 3 s",soon:"3–8 s in",late:"After 8 s"},
  lenB:{u15:"Up to 15 s",u30:"16–30 s",u60:"31–60 s",long:"Over 60 s"}};
const libLabel=(k,v)=>LIB_VALS[k]&&LIB_VALS[k][v]||(k==="ep"?(EP(v)&&EP(v).name||v):k==="mood"?((MOODS.find(m=>m.k===v)||{}).name||v):v);
/* the structure of one export, measured from its plan */
{ const _rf=recipeFor; recipeFor=function(r){ const x=_rf(r);
    try{ const w0=r.win[0], w1=r.win[1], P=(r.plan||[]).filter(s=>s.end>w0+0.01&&s.start<w1-0.01); x.nShots=P.length;
      let pk=null; for(const b of (S.an&&S.an.beats||[])){ if(b<w0) continue; if(b>w1) break; const bi=beatInfo(b); if(bi&&(bi.drop||bi.e>0.82)){ pk=b-w0; break; } } x.peakAt=pk==null?null:+pk.toFixed(1);
      const T=titleFor(r.ep); x.hookWords=T.hook?wordCount(T.hook):0; x.mood=S._mood||null; x.fold=$("textFold").checked?1:0; }catch(e){}
    return x; }; }
function libFeat(r){ const f={}; ["opening","style","pace","look","text","sig","motif","lensKit","camEnergy"].forEach(k=>{ if(r[k]!=null&&r[k]!=="") f[k]=r[k]; });
  if(r.mood) f.mood=r.mood; const n=r.nShots||(r.shots&&r.shots.length), avg=n?r.dur/n:null;
  if(avg) f.cutPace=avg<0.8?"fast":avg<1.5?"medium":"slow";
  const hw=r.hookWords!=null?r.hookWords:(r.title==="no title"?0:null); if(hw!=null) f.hookLen=hw===0?"none":hw<=3?"short":hw<=6?"medium":"long";
  if(r.peakAt!=null) f.peak=r.peakAt<3?"early":r.peakAt<8?"soon":"late";
  if(r.dur) f.lenB=r.dur<=15.5?"u15":r.dur<=30.5?"u30":r.dur<=60.5?"u60":"long"; f.ep=r.ep; return f; }
/* what gets views */
const libMed=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[Math.floor(s.length/2)]:0; };
function libLearn(){ const R=recipes().filter(r=>r.stats&&r.stats.views!=null); if(R.length<2){ try{ localStorage.removeItem("beatsplicerLearnLib"); }catch(e){} return null; }
  const byEp={}; R.forEach(r=>{ (byEp[r.ep]=byEp[r.ep]||[]).push(r); }); const allMed=libMed(R.map(r=>r.stats.views));
  const xs=R.map(r=>{ const g=byEp[r.ep], med=g.length>=3?libMed(g.map(x=>x.stats.views)):allMed; let s=Math.log2((r.stats.views+1)/(med+1));
    const ws=g.filter(x=>x.stats.watch!=null); if(r.stats.watch!=null&&ws.length>=3){ const mw=ws.reduce((a,x)=>a+x.stats.watch,0)/ws.length; s+=(r.stats.watch-mw)/25; } // 25 points more of the video watched counts like double the views
    return {r,s,f:libFeat(r)}; });
  const mean=xs.reduce((a,x)=>a+x.s,0)/xs.length, eff={};
  Object.keys(LIB_KEYS).forEach(k=>{ const g={}; xs.forEach(x=>{ const v=x.f[k]; if(v==null) return; (g[v]=g[v]||[]).push(x.s-mean); }); eff[k]={};
    Object.entries(g).forEach(([v,a])=>{ const n=a.length; eff[k][v]={eff:+(a.reduce((p,q)=>p+q,0)/n*(n/(n+3))).toFixed(3),n}; }); });
  const L={eff,n:xs.length,at:Date.now()}; try{ localStorage.setItem("beatsplicerLearnLib",JSON.stringify(L)); }catch(e){} return L; }
function libLearned(){ try{ return JSON.parse(localStorage.getItem("beatsplicerLearnLib")||"null"); }catch(e){ return null; } }
/* Do everything's weights: YouTube's retention learning and the library's views learning together */
{ const _lw=learnW; learnW=function(k,val){ let w=_lw(k,val); if(!has("youtubeLearn")||!$("learnOn")||!$("learnOn").checked) return w;
    const L=libLearned(), e=L&&L.eff&&L.eff[k]&&L.eff[k][val]; if(e&&e.n>=2) w*=Math.exp(e.eff*0.7);
    if(k==="pace"&&L&&L.eff.cutPace){ const c=L.eff.cutPace[{tight:"fast",classic:"medium",spacious:"slow"}[val]]; if(c&&c.n>=2) w*=Math.exp(c.eff*0.7); } /* the measured cut pace of what got views steers the rhythm Do everything picks */ return Math.max(0.6,Math.min(1.8,w)); }; }
function libInsights(L){ if(!L||L.n<4) return {lines:[],tips:[]}; const all=[];
  Object.entries(L.eff).forEach(([k,m])=>{ if(k==="ep") return; Object.entries(m).forEach(([v,e])=>{ if(e.n>=2) all.push({k,v,...e}); }); });
  all.sort((a,b)=>b.eff-a.eff); const x=e=>{ const f=Math.pow(2,e); return f>=10?Math.round(f):f.toFixed(1); };
  const say=e=>`${LIB_KEYS[e.k]}: ${libLabel(e.k,e.v)}, about ${x(e.eff)}× your usual views (${e.n} videos)`;
  const good=all.filter(e=>e.eff>=0.15).slice(0,3), bad=all.filter(e=>e.eff<=-0.15).slice(-2).reverse(), lines=[...good.map(e=>({up:true,t:say(e)})),...bad.map(e=>({up:false,t:say(e)}))], tips=[];
  const len=good.find(e=>e.k==="lenB"&&e.v!=="long"), lv={u15:"15",u30:"30",u60:"60"}[len&&len.v];
  if(lv&&$("shortLen").value!==lv) tips.push({t:`Make Shorts ${lv} s from now on`,go:()=>{ setControl("shortLen",lv); saveSettings(); }});
  const nt=all.find(e=>e.k==="hookLen"&&e.v==="none");
  if(nt&&nt.eff<=-0.15&&!$("autoTitles").checked) tips.push({t:"Turn automatic titles on",go:()=>{ setControl("autoTitles",true); $("autoTitles").dispatchEvent(new Event("change")); }});
  if(nt&&nt.eff>=0.15&&$("autoTitles").checked) tips.push({t:"Turn automatic titles off",go:()=>{ setControl("autoTitles",false); $("autoTitles").dispatchEvent(new Event("change")); }});
  return {lines,tips}; }
/* numbers from YouTube land on the recipes too */
function libFromYT(pairs){ const a=recipes(); let n=0; pairs.forEach(({v,r})=>{ const x=a.find(y=>y.key===r.key); if(!x) return; n++; x.ytId=x.ytId||v.id;
    x.stats={views:v.views||0,likes:v.likes!=null?v.likes:null,watch:v.averageViewPercentage!=null?+v.averageViewPercentage.toFixed(1):null,at:Date.now(),src:"youtube"};
    x.hist=(x.hist||[]).concat([{at:Date.now(),views:v.views||0}]).slice(-30); x.posts=x.posts||[]; if(!x.posts.some(p=>/youtu/.test(p.url||""))) x.posts.push({url:"https://youtube.com/shorts/"+v.id,at:v.at||Date.now()}); });
  if(n){ saveRecipes(a); libLearn(); } }
/* thumbnails, kept in IndexedDB so localStorage stays small */
function libDB(){ return new Promise((ok,bad)=>{ const q=indexedDB.open("beatsplicer-lib",1); q.onupgradeneeded=()=>q.result.createObjectStore("thumbs"); q.onsuccess=()=>ok(q.result); q.onerror=()=>bad(q.error); }); }
async function libThumbPut(key,url){ try{ const db=await libDB(); await new Promise(ok=>{ const t=db.transaction("thumbs","readwrite"); t.objectStore("thumbs").put(url,key); t.oncomplete=ok; t.onerror=ok; }); }catch(e){} }
async function libThumbGet(key){ try{ const db=await libDB(); return await new Promise(ok=>{ const q=db.transaction("thumbs").objectStore("thumbs").get(key); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>ok(null); }); }catch(e){ return null; } }
async function libThumbOf(blob){ const v=document.createElement("video"); v.muted=true; v.playsInline=true; const u=URL.createObjectURL(blob); v.src=u;
  try{ await new Promise((ok,bad)=>{ v.onloadedmetadata=ok; v.onerror=bad; setTimeout(bad,8000); }); v.currentTime=Math.min(1.5,(v.duration||3)*0.3); await new Promise(ok=>{ v.onseeked=ok; setTimeout(ok,4000); });
    const h=170, w=Math.round(h*(v.videoWidth||9)/(v.videoHeight||16)), c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(v,0,0,w,h); return c.toDataURL("image/jpeg",0.7); }
  catch(e){ return null; } finally{ URL.revokeObjectURL(u); } }
{ const _lr=logRecipes; logRecipes=function(results){ _lr(results); setTimeout(async()=>{ for(const r of results){ if(!r._recipe||!r.blob||r._thumbed) continue; r._thumbed=true; const u=await libThumbOf(r.blob); if(u) await libThumbPut(r._recipe.key,u); } },300); }; }
/* the library sheet */
const libNum=n=>{ try{ return new Intl.NumberFormat(document.documentElement.lang||undefined).format(n); }catch(e){ return String(n); } };
const libDate=t=>{ try{ return new Date(t).toLocaleDateString(document.documentElement.lang||undefined,{day:"numeric",month:"short"}); }catch(e){ return new Date(t).toDateString(); } };
const libClock=s=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;
let _libFilter="all";
function libEl(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function openLibrary(){ $("libSheet").hidden=false; renderLibrary(); crumb("library"); }
function renderLibrary(){ const R=recipes().slice().reverse(), L=libLearn(), box=$("libBody"); box.innerHTML="";
  const withS=R.filter(r=>r.stats&&r.stats.views!=null), total=withS.reduce((a,r)=>a+r.stats.views,0), best=withS.slice().sort((a,b)=>b.stats.views-a.stats.views)[0];
  /* totals */
  const tiles=libEl("div","lib-tiles"); [[libNum(R.length),"Videos made"],[libNum(withS.length),"With numbers"],[libNum(total),"Total views"],[withS.length?libNum(libMed(withS.map(r=>r.stats.views))):"–","Typical views"]].forEach(([n,l])=>{ const d=libEl("div","lib-tile"); d.append(libEl("b",null,n),libEl("span",null,l)); tiles.appendChild(d); }); box.appendChild(tiles);
  if(best&&withS.length>1) box.appendChild(libEl("p","small lib-best",`Best so far: ${best.song||best.file} (${libNum(best.stats.views)} views)`));
  /* views per video, oldest to newest */
  const ch=withS.slice(0,24).reverse(); if(ch.length>=2){ const W=640,H=120,max=Math.max(...ch.map(r=>r.stats.views),1),bw=W/ch.length, ns="http://www.w3.org/2000/svg", svg=document.createElementNS(ns,"svg"); svg.setAttribute("viewBox",`0 0 ${W} ${H+18}`); svg.setAttribute("class","lib-chart"); svg.setAttribute("role","img"); svg.setAttribute("aria-label","Views per video, oldest to newest");
    ch.forEach((r,i)=>{ const h=Math.max(2,(r.stats.views/max)*H), rc=document.createElementNS(ns,"rect"); rc.setAttribute("x",(i*bw+bw*0.15).toFixed(1)); rc.setAttribute("y",(H-h).toFixed(1)); rc.setAttribute("width",(bw*0.7).toFixed(1)); rc.setAttribute("height",h.toFixed(1)); rc.setAttribute("rx","3"); rc.setAttribute("class",r===best?"best":"");
      const tt=document.createElementNS(ns,"title"); tt.textContent=`${r.song||r.file}: ${libNum(r.stats.views)}`; rc.appendChild(tt); svg.appendChild(rc); });
    const lab=(x,t,a)=>{ const e=document.createElementNS(ns,"text"); e.setAttribute("x",x); e.setAttribute("y",H+14); e.setAttribute("text-anchor",a); e.textContent=t; svg.appendChild(e); }; lab(2,libDate(ch[0].at),"start"); lab(W-2,libDate(ch[ch.length-1].at),"end");
    const wrap=libEl("div","lib-chartwrap"); wrap.append(libEl("h3","sub","Views per video"),svg); box.appendChild(wrap); }
  /* what gets views */
  const ins=libEl("div","lib-learn"); ins.appendChild(libEl("h3","sub","What gets views")); const I=libInsights(L);
  if(!I.lines.length) ins.appendChild(libEl("p","small",withS.length<4?`Add the numbers for at least 4 posted videos and the app starts spotting what works (${withS.length} so far).`:"No clear pattern yet: your videos are doing about the same whatever the structure."));
  I.lines.forEach(l=>{ const p=libEl("p",l.up?"lib-up":"lib-down"); p.append(libEl("span","lib-arrow",l.up?"▲":"▼"),libEl("span",null,l.t)); ins.appendChild(p); });
  if(I.tips.length){ const b=libEl("div","btns"); I.tips.forEach(tp=>{ const x=libEl("button","btn",tp.t); x.type="button"; x.onclick=()=>{ tp.go(); x.disabled=true; x.textContent="Done"; status(`Applied: ${tp.t}.`); }; b.appendChild(x); }); ins.appendChild(b); }
  if(L&&L.n>=4) ins.appendChild(libEl("p","small",$("learnOn")&&$("learnOn").checked&&has("youtubeLearn")?"Do everything leans towards what's getting views.":"Do everything isn't using this yet: switch on “Do everything leans towards what keeps your viewers” under Where it’s going."));
  box.appendChild(ins);
  /* YouTube */
  if(ytAvailable()&&ytClientId()){ const b=libEl("button","btn","Update numbers from YouTube"); b.type="button"; b.onclick=async()=>{ b.disabled=true; b.textContent="Reading your channel…"; try{ await ytLearn(); }finally{ renderLibrary(); } }; box.appendChild(b); }
  else box.appendChild(libEl("p","small","Type each video’s numbers from the platform’s own stats. With your YouTube channel connected (on a computer), YouTube’s fill in by themselves."));
  /* the list */
  const fl=libEl("div","chips lib-filter"); [["all","All"],["nums","With numbers"],["need","Needs numbers"]].forEach(([k,l])=>{ const c=libEl("button","chip",l); c.type="button"; c.setAttribute("aria-pressed",String(_libFilter===k)); c.onclick=()=>{ _libFilter=k; renderLibrary(); }; fl.appendChild(c); }); box.appendChild(fl);
  const list=libEl("ul","lib-list"), show=R.filter(r=>_libFilter==="all"||(_libFilter==="nums")===!!(r.stats&&r.stats.views!=null));
  if(!R.length) box.appendChild(libEl("p","small","Videos you make appear here, with what they were made with."));
  show.slice(0,120).forEach(r=>list.appendChild(libItem(r))); box.appendChild(list); }
function libItem(r){ const li=libEl("li","lib-item"), th=libEl("div","lib-thumb"), img=document.createElement("img"); img.alt=""; img.loading="lazy"; th.appendChild(img); libThumbGet(r.key).then(u=>{ if(u) img.src=u; else th.classList.add("none"); });
  const body=libEl("div","lib-main"); body.appendChild(libEl("b",null,r.song||r.file||"Untitled"));
  body.appendChild(libEl("span","small",[libDate(r.at),EP(r.ep)&&EP(r.ep).name||r.ep,libClock(r.dur||0)].join(" · ")));
  const f=libFeat(r), chips=libEl("div","lib-chips"); ["mood","style","cutPace","hookLen","peak"].forEach(k=>{ if(f[k]!=null&&!(k==="style"&&f.mood)) chips.appendChild(libEl("span","lib-chip",libLabel(k,f[k]))); }); body.appendChild(chips);
  const st=r.stats, line=libEl("div","lib-nums");
  if(st&&st.views!=null){ const parts=[`${libNum(st.views)} views`]; if(st.likes!=null) parts.push(`${libNum(st.likes)} likes`); if(st.watch!=null) parts.push(`${st.watch}% watched`); line.append(libEl("b",null,parts.join(" · ")));
    const h=(r.hist||[]).filter(x=>x.views!=null); if(h.length>=2){ const d=h[h.length-1].views-h[h.length-2].views; if(d>0) line.append(libEl("span","lib-gain",` +${libNum(d)}`)); }
    line.append(libEl("span","small",st.src==="youtube"?`From YouTube, ${libDate(st.at)}`:`Typed in, ${libDate(st.at)}`)); }
  else line.append(libEl("span","small","No numbers yet")); body.appendChild(line);
  const posted=(r.posts||[]).filter(p=>p.url); if(posted.length){ const pl=libEl("div","lib-links"); posted.forEach(p=>{ const a=libEl("a",null,libHost(p.url)); a.href=p.url; a.target="_blank"; a.rel="noopener"; pl.appendChild(a); }); body.appendChild(pl); }
  const act=libEl("div","btns lib-act"), ed=libEl("button","btn quiet",st&&st.views!=null?"Update numbers":"Add numbers"); ed.type="button"; const rm=libEl("button","btn quiet","Remove"); rm.type="button";
  rm.onclick=()=>{ if(rm.dataset.sure){ saveRecipes(recipes().filter(x=>x.key!==r.key)); renderLibrary(); } else { rm.dataset.sure="1"; rm.textContent="Tap again to remove"; } };
  act.append(ed,rm); body.appendChild(act); const form=libForm(r); form.hidden=true; ed.onclick=()=>{ form.hidden=!form.hidden; if(!form.hidden) form.querySelector("input").focus(); }; body.appendChild(form);
  li.append(th,body); return li; }
const libHost=u=>{ try{ const h=new URL(u).hostname.replace(/^www\.|^m\./,""); return /youtu/.test(h)?"YouTube":/tiktok/.test(h)?"TikTok":/instagram/.test(h)?"Instagram":/facebook|fb\./.test(h)?"Facebook":h; }catch(e){ return "Link"; } };
function libForm(r){ const f=libEl("form","lib-form"), st=r.stats||{}, row=(lab,name,type,val,ph)=>{ const l=libEl("label",null); l.append(libEl("span","small",lab)); const i=document.createElement("input"); i.name=name; i.type=type; if(type==="number"){ i.min="0"; i.inputMode="numeric"; } if(val!=null) i.value=val; if(ph) i.placeholder=ph; l.appendChild(i); f.appendChild(l); return i; };
  const url=row("Link (optional)","url","url",(r.posts||[]).map(p=>p.url).filter(Boolean).slice(-1)[0]||"","https://…"), v=row("Views","views","number",st.views), lk=row("Likes","likes","number",st.likes), w=row("Average % watched (optional)","watch","number",st.watch);
  w.max="200"; const sv=libEl("button","btn primary","Save"); sv.type="submit"; f.appendChild(sv);
  f.onsubmit=e=>{ e.preventDefault(); const a=recipes(), x=a.find(y=>y.key===r.key); if(!x) return; const num=i=>i.value.trim()===""?null:Math.max(0,+i.value);
    if(num(v)==null){ v.focus(); status("Add the views first.",true); return; }
    x.stats={views:Math.round(num(v)),likes:num(lk)==null?null:Math.round(num(lk)),watch:num(w),at:Date.now(),src:"manual"}; x.hist=(x.hist||[]).concat([{at:Date.now(),views:x.stats.views}]).slice(-30);
    const u=url.value.trim(); if(u){ x.posts=(x.posts||[]).filter(p=>p.url!==u); x.posts.push({url:u,at:Date.now()}); const id=ytIdOf(u); if(id) x.ytId=id; }
    saveRecipes(a); status("Saved. The library has learned from it."); renderLibrary(); };
  return f; }
$("libBtn").onclick=openLibrary; $("libClose").onclick=()=>{ $("libSheet").hidden=true; };
$("libSheet").addEventListener("click",e=>{ if(e.target===$("libSheet")) $("libSheet").hidden=true; });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("libSheet").hidden) $("libSheet").hidden=true; });
if($("finLib")) $("finLib").onclick=()=>{ $("finSheet").hidden=true; openLibrary(); };
