/* ---------------- Collections: a catalogue of the clip library, and casting a video from it ----------------
   Every clip is placed in one category from a fixed list (the same list every time, so the labels are dependable) by the
   picture-and-word model: People, City, Water, Night… Clips of the same category shot on the same day form a collection
   ("Beach · 12 Oct"); a clip in one of your own subfolders belongs to that folder's collection instead. You can rename
   collections, move clips between them and make your own; those choices are kept on this device and always win.
   Before an edit picks any shot, it casts the video: it chooses the few collections that fit the song (its sections,
   energy, title, lyrics and your direction note) and gives each section one to draw from, so a video is about
   something, choruses return to the same world, and drops change it. Every shot can say which collection it came from. */
const CATS=[["people","People"],["crowd","Crowds & events"],["city","City & streets"],["nature","Nature"],["water","Water & beach"],["sky","Sky & sunsets"],["indoors","Indoors"],["vehicles","Cars & travel"],["animals","Animals"],["food","Food & drink"],["music","Music & dance"],["night","Night & lights"],["sport","Sport & action"],["screens","Screens & text"]];
const CAT_NAME=Object.fromEntries(CATS), CAT_IDS=CATS.map(c=>c[0]);
/* [what the model is asked, the name a collection gets, its category] */
const COLL_LABELS=[
  ["a close-up portrait of a person's face","Portraits","people"],["a person posing for the camera","People","people"],["a group of friends together","Friends","people"],["children playing","Kids","people"],["a couple together","Couple","people"],["a selfie","Selfies","people"],
  ["a big crowd of people at an event","Crowd","crowd"],["people at a party","Party","crowd"],["a wedding","Wedding","crowd"],["an outdoor festival","Festival","crowd"],
  ["a busy city street","Street","city"],["tall city buildings and a skyline","Skyline","city"],["a shop or market","Market","city"],["old buildings and architecture","Architecture","city"],
  ["mountains and hills","Mountains","nature"],["a forest with trees","Forest","nature"],["green fields and countryside","Countryside","nature"],["a garden with flowers","Garden","nature"],["a desert with sand","Desert","nature"],["snow and ice","Snow","nature"],
  ["a beach with waves and sand","Beach","water"],["the open sea","Sea","water"],["a lake or a river","River","water"],["a swimming pool","Pool","water"],["people swimming","Swimming","water"],
  ["a sunset sky","Sunset","sky"],["blue sky and clouds","Sky","sky"],["the view from an aeroplane window","Flight","sky"],
  ["a living room at home","Home","indoors"],["a kitchen","Kitchen","indoors"],["an office","Work","indoors"],["a restaurant or a cafe","Cafe","indoors"],["a bedroom","Bedroom","indoors"],
  ["a car","Cars","vehicles"],["a road seen through a car windscreen","Road trip","vehicles"],["a motorbike","Bikes","vehicles"],["a boat on the water","Boat","vehicles"],["an airport or an aeroplane","Airport","vehicles"],["a train","Train","vehicles"],
  ["a dog","Dog","animals"],["a cat","Cat","animals"],["a horse","Horses","animals"],["birds","Birds","animals"],["wild animals","Wildlife","animals"],
  ["food on a plate","Food","food"],["drinks in glasses","Drinks","food"],["someone cooking","Cooking","food"],
  ["a concert stage with lights","Concert","music"],["someone playing a guitar","Playing music","music"],["a DJ playing music","DJ","music"],["people dancing","Dancing","music"],
  ["city lights at night","Night city","night"],["neon lights","Neon","night"],["fireworks","Fireworks","night"],["a campfire","Fire","night"],
  ["people playing a sport","Sport","sport"],["a gym workout","Gym","sport"],["skateboarding or surfing","Board sports","sport"],["someone running","Running","sport"],["a sports stadium","Stadium","sport"],
  ["a phone or computer screen","Screens","screens"],["a sign with text","Signs","screens"],["a video game","Gaming","screens"]];
const COLL_ATTR=["a scene at night","a scene in daylight","inside a room","outdoors in the open air"];
const COLL_VER=1;
/* ---- what you've decided: kept on this device, across projects ---- */
function collUser(){ if(S._collUser) return S._collUser; let u=null; try{ u=JSON.parse(localStorage.getItem("beatsplicerColls")||"null"); }catch(e){}
  u=u&&typeof u==="object"?u:{}; u.names=u.names||{}; u.moves=u.moves||{}; u.made=u.made||[]; u.n=u.n||0; return (S._collUser=u); }
function saveCollUser(){ try{ localStorage.setItem("beatsplicerColls",JSON.stringify(collUser())); }catch(e){} }
/* ---- the catalogue: each clip's category, kept by file so a clip added again is known straight away ---- */
function catalogStore(){ if(S._catalog) return S._catalog; let m=null; try{ m=JSON.parse(localStorage.getItem("beatsplicerCatalog")||"null"); }catch(e){} return (S._catalog=(m&&m.v===COLL_VER&&m.k)?m:{v:COLL_VER,k:{}}); }
let _catSaveT=0; function saveCatalogSoon(){ clearTimeout(_catSaveT); _catSaveT=setTimeout(()=>{ try{ const m=catalogStore(), keys=Object.keys(m.k); if(keys.length>6000) keys.slice(0,keys.length-6000).forEach(k=>delete m.k[k]); localStorage.setItem("beatsplicerCatalog",JSON.stringify(m)); }catch(e){} },1500); }
let _labVecs=null, _labLoading=null;
function labelVecsSaved(){ if(_labVecs) return true; try{ const v=JSON.parse(localStorage.getItem("beatsplicerLabelVecs")||"null"); if(v&&v.n===COLL_LABELS.length+COLL_ATTR.length&&v.ver===COLL_VER){ _labVecs=v.p.map(unpackVec); return true; } }catch(e){} return false; }
async function labelVecs(){ if(labelVecsSaved()) return _labVecs; if(_labLoading) return _labLoading;
  _labLoading=(async()=>{ const v=await embedTexts(COLL_LABELS.map(x=>x[0]).concat(COLL_ATTR)); _labVecs=v; try{ localStorage.setItem("beatsplicerLabelVecs",JSON.stringify({n:v.length,ver:COLL_VER,p:v.map(packVec)})); }catch(e){} return v; })();
  try{ return await _labLoading; } finally{ _labLoading=null; } }
/* one clip: the average of what its moments show, against every label */
function classifyClip(c){ const V=_labVecs; if(!V) return null; const vs=(c.samples||[]).map(sampleVec).filter(Boolean); if(!vs.length) return null;
  const m=new Float32Array(vs[0].length); vs.forEach(v=>{ for(let i=0;i<m.length;i++) m[i]+=v[i]; }); const v=unitVec(m), nL=COLL_LABELS.length;
  const p=softmax(V.slice(0,nL).map(q=>100*dotV(q,v))), cat={}; p.forEach((x,i)=>{ const k=COLL_LABELS[i][2]; cat[k]=(cat[k]||0)+x; });
  const best=CAT_IDS.reduce((a,k)=>(cat[k]||0)>(cat[a]||0)?k:a,CAT_IDS[0]), top=p.map((x,i)=>[i,x]).sort((a,b)=>b[1]-a[1]).slice(0,3).filter(x=>x[1]>=0.06).map(x=>[x[0],+x[1].toFixed(2)]);
  const night=softmax([100*dotV(V[nL],v),100*dotV(V[nL+1],v)])[0], indoor=softmax([100*dotV(V[nL+2],v),100*dotV(V[nL+3],v)])[0];
  return {c:best, p:+(cat[best]||0).toFixed(2), l:top, n:+night.toFixed(2), i:+indoor.toFixed(2)}; }
function catOf(c){ if(!c) return null; if(c._catG===S._catGen&&c._cat!==undefined) return c._cat; const k=c.name+"|"+(c.file?c.file.size:0), st=catalogStore();
  let r=null; if(_labVecs&&c.samples&&c.samples.some(s=>s.ce)){ const fresh=c._catN===c.samples.filter(s=>s.ce).length&&c._cat; r=fresh||classifyClip(c); if(r&&!fresh){ c._catN=c.samples.filter(s=>s.ce).length; st.k[k]=r; saveCatalogSoon(); } }
  if(!r) r=st.k[k]||null; c._cat=r; c._catG=S._catGen; return r; }
/* ---- collections ---- */
function shootDay(c){ const t=c.file&&c.file.lastModified; if(!t||t<9e11) return ""; const d=new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dayLabel(day){ if(!day) return ""; const [y,m,d]=day.split("-").map(Number), dt=new Date(y,m-1,d); try{ return dt.toLocaleDateString(I18N&&I18N.lang&&I18N.lang!=="en"?I18N.lang:undefined,{day:"numeric",month:"short",...(y!==new Date().getFullYear()?{year:"numeric"}:{})}).replace(/\./g,"").replace(/\s+/g," ").trim(); }catch(e){ return day; } } // no full stops: "14. Nov." would read as the end of a sentence
function autoCollId(c){ if(c.folder) return "f:"+c.folder; const r=catOf(c); return "a:"+(r?r.c:"any")+":"+shootDay(c); }
function collIdOf(c){ const k=c.name+"|"+(c.file?c.file.size:0), mv=collUser().moves[k]; return mv&&collExists(mv)?mv:autoCollId(c); }
function collExists(id){ return !/^u:/.test(id)||collUser().made.some(x=>x.id===id); }
function collOf(ci){ return S._colls&&S._colls.byClip?S._colls.byClip[ci]:null; }
/* the whole library as collections, rebuilt when clips change; deterministic, so names and moves stick */
function buildCollections(){ S._catGen=(S._catGen||0)+1; labelVecsSaved(); const U=collUser(), map=new Map(), byClip=[];
  S.clips.forEach((c,ci)=>{ if(!c.samples) return; const id=collIdOf(c); byClip[ci]=id; if(!map.has(id)) map.set(id,{id,clips:[],cats:{},labs:{},mot:0,vec:null}); const g=map.get(id); g.clips.push(ci);
    const r=catOf(c); if(r){ g.cats[r.c]=(g.cats[r.c]||0)+1; (r.l||[]).slice(0,1).forEach(([li])=>{ g.labs[li]=(g.labs[li]||0)+1; }); }
    let m=0; (c.samples||[]).forEach(s=>m+=s.mN!=null?s.mN:Math.min(1,(s.motion||0)/12)); g.mot+=m/Math.max(1,c.samples.length); });
  U.made.forEach(x=>{ if(!map.has(x.id)) map.set(x.id,{id:x.id,clips:[],cats:{},labs:{},mot:0}); });
  const list=[...map.values()]; list.forEach(g=>{ g.n=g.clips.length; g.mot=g.n?g.mot/g.n:0; g.cat=Object.keys(g.cats).sort((a,b)=>g.cats[b]-g.cats[a])[0]||(/^a:([^:]+)/.exec(g.id)||[])[1]||null; if(g.cat==="any") g.cat=null;
    const li=Object.keys(g.labs).sort((a,b)=>g.labs[b]-g.labs[a])[0], day=/^a:[^:]*:(.+)$/.exec(g.id);
    g.auto=g.id.startsWith("a:")?((li!=null?COLL_LABELS[li][1]:g.cat?CAT_NAME[g.cat]:"Clips")+(day&&day[1]?" · "+dayLabel(day[1]):"")):g.id.startsWith("f:")?g.id.slice(2).split("/").filter(Boolean).pop():(U.made.find(x=>x.id===g.id)||{}).name||"Collection";
    g.name=U.names[g.id]||g.auto; g.own=g.id.startsWith("u:")||g.id.startsWith("f:")||!!U.names[g.id]; });
  list.sort((a,b)=>(CAT_IDS.indexOf(a.cat)+1||99)-(CAT_IDS.indexOf(b.cat)+1||99)||b.n-a.n||a.name.localeCompare(b.name));
  S._colls={list, byId:new Map(list.map(g=>[g.id,g])), byClip}; return S._colls; }
function collVec(g){ if(g.vec!==null&&g.vec!==undefined) return g.vec; const vs=g.clips.map(ci=>placeVec(S.clips[ci])).filter(Boolean); if(!vs.length) return (g.vec=false); const m=new Float32Array(vs[0].length); vs.forEach(v=>{ for(let i=0;i<m.length;i++) m[i]+=v[i]; }); return (g.vec=unitVec(m)); }
function collName(id){ const g=S._colls&&S._colls.byId.get(id); return g?g.name:""; }
/* ---- what the song is about, in the same terms: its title, your direction note, each section's words ---- */
async function themeVecs(){ if(!seeAvailable()||!S.clips.some(c=>c.samples&&c.samples.some(s=>s.ce))) return null;
  const st=typeof songTitle==="function"?songTitle():"", dir=typeof noteText==="function"?noteText():"", key=[st,dir,S.lyrics?S.lyrics.lines.length:0,S.an?S.an.duration:0].join("|");
  if(S._theme&&S._theme.key===key) return S._theme; const texts=[st,dir].filter(t=>t&&t.length>2);
  const bySec=new Map(); if(S.lyrics&&S.an&&S.an.sections) S.lyrics.lines.forEach(l=>{ if(!l.text) return; const i=secIdx(l.t||l.start||0); if(!bySec.has(i)) bySec.set(i,[]); bySec.get(i).push(l.text); });
  const all=[...texts,...[...bySec.values()].flat()]; if(!all.length){ S._theme={key,v:null,sec:new Map()}; return S._theme; }
  try{ const vs=await embedTexts([...new Set(all)]), get=t=>vs[[...new Set(all)].indexOf(t)], mean=arr=>{ const a=arr.filter(Boolean); if(!a.length) return null; const m=new Float32Array(a[0].length); a.forEach(v=>{ for(let i=0;i<m.length;i++) m[i]+=v[i]; }); return unitVec(m); };
    const sec=new Map(); bySec.forEach((ls,i)=>sec.set(i,mean(ls.map(get))));
    S._theme={key, v:mean(texts.map(get)), sec}; return S._theme; }catch(e){ return null; } }
function themeSoon(){ clearTimeout(S._themeT); S._themeT=setTimeout(async()=>{ const k=S._theme&&S._theme.key; const t=await themeVecs(); if(t&&t.key!==k&&!S.running&&S.an) buildPlan(); },1200); }
/* ---- casting: which collections this video draws from, and which one each section leans on ---- */
function castVideo(segs){ S._cast=null; S._castPool=null; const C=S._colls||buildCollections(); if(!C.list.length) return null;
  const usable=g=>g.clips.filter(ci=>{ const c=S.clips[ci]; return c&&c.samples&&!c.off&&!isExcluded(ci); });
  const pool=C.list.map(g=>({g,cl:usable(g)})).filter(x=>x.cl.length);
  if(!pool.length) return null;
  const sel=S.collSel&&S.collSel.size?pool.filter(x=>S.collSel.has(x.g.id)):null;
  const nShots=segs.length, total=pool.reduce((a,x)=>a+x.cl.length,0), shortForm=(S.an?S.an.duration:60)<=75;
  if(!sel&&(pool.length<2||total<10)) return null; // a small library is one collection already
  const T=S._theme&&S._theme.key?S._theme:null, theme=T&&T.v, r=rng(9173+(S._castSeed||0)*131+Math.round((S.an?S.an.duration:0)*10));
  const fitOf=x=>{ let f=Math.log(1+x.cl.length)*0.6; const v=collVec(x.g); if(theme&&v) x.th=dotV(theme,v); return f; };
  pool.forEach(x=>{ x.fit=fitOf(x); });
  if(theme){ const ths=pool.filter(x=>x.th!=null).map(x=>x.th), m=ths.reduce((a,b)=>a+b,0)/Math.max(1,ths.length), sd=Math.sqrt(ths.reduce((a,b)=>a+(b-m)*(b-m),0)/Math.max(1,ths.length))||0.02; pool.forEach(x=>{ if(x.th!=null) x.fit+=0.9*Math.max(-2,Math.min(3,(x.th-m)/sd)); }); }
  pool.forEach(x=>{ x.fit+=-Math.log(-Math.log(Math.max(1e-6,r())))*0.55; }); // a different, still sensible cast for each new idea
  let cast;
  if(sel&&sel.length) cast=sel;
  else { const want=Math.max(2,Math.min(shortForm?3:5,Math.round(nShots/9))), need=Math.min(total,Math.max(8,Math.round(nShots*(shortForm?1:0.6)))); cast=[];
    const left=[...pool]; while(left.length&&(cast.length<want||cast.reduce((a,x)=>a+x.cl.length,0)<need)&&cast.length<8){
      left.forEach(x=>{ let s=x.fit; const v=collVec(x.g); cast.forEach(y=>{ const w=collVec(y.g); if(v&&w){ const d=dotV(v,w); s+=d>0.93?-0.6:d>0.72?0.35:0; } if(x.g.cat&&x.g.cat===y.g.cat) s-=0.25; const dx=/:(\d{4}-\d\d-\d\d)$/.exec(x.g.id), dy=/:(\d{4}-\d\d-\d\d)$/.exec(y.g.id); if(dx&&dy&&dx[1]===dy[1]) s+=0.5; }); x._s=s; }); // a cast that belongs together: same day, related places, not five of the same thing
      left.sort((a,b)=>b._s-a._s); cast.push(left.shift()); } }
  if(!cast.length) return null;
  /* sections: each part of the song gets its own world. Parts are grouped as the song repeats them (every chorus is one
     part), ordered by loudness, and dealt out over the cast ordered by liveliness, so every collection leads somewhere,
     the loudest part gets the liveliest one and a repeated part always returns to its collection. Words win when a part has them. */
  const AS=(S.an&&S.an.sections&&S.an.sections.length)?S.an.sections:null, secs=AS?AS.map((x,i)=>({i,e:x.energy!=null?x.energy:0.5,kind:x.kind,g:x.group!=null?x.group:"s"+i})):[...new Set(segs.map(s=>secIdx(s.start)))].map(i=>{ const ss=segs.filter(s=>secIdx(s.start)===i); return {i,g:"s"+i,e:ss.reduce((a,s)=>a+(s.e||0),0)/Math.max(1,ss.length)}; });
  const parts=new Map(); secs.forEach(x=>{ const k=x.kind==="chorus"?"chorus":x.g; if(!parts.has(k)) parts.set(k,{k,e:0,n:0,secs:[]}); const P=parts.get(k); P.e+=x.e; P.n++; P.secs.push(x.i); });
  const PL=[...parts.values()].map(P=>({...P,e:P.e/P.n})).sort((a,b)=>a.e-b.e), byE=[...cast].sort((a,b)=>a.g.mot-b.g.mot), bySec=new Map(), used=new Set();
  PL.forEach((P,k)=>{ let pick=null; const words=P.secs.map(i=>T&&T.sec&&T.sec.get(i)).filter(Boolean)[0];
    if(words){ pick=[...cast].sort((a,b)=>{ const va=collVec(a.g), vb=collVec(b.g); return (vb?dotV(words,vb):0)-(va?dotV(words,va):0); })[0]; }
    else if(P.k==="chorus") pick=byE[byE.length-1];
    else { const q=PL.length>1?k/(PL.length-1):0.5; pick=byE[Math.min(byE.length-1,Math.round(q*(byE.length-1)))]; if(used.has(pick.g.id)){ const free=byE.filter(x=>!used.has(x.g.id)&&x!==byE[byE.length-1]); if(free.length) pick=free.reduce((a,x)=>Math.abs(byE.indexOf(x)-q*(byE.length-1))<Math.abs(byE.indexOf(a)-q*(byE.length-1))?x:a,free[0]); } }
    used.add(pick.g.id); P.secs.forEach(i=>bySec.set(i,pick.g.id)); });
  const set=new Set(cast.map(x=>x.g.id)), clips=new Set(cast.flatMap(x=>x.cl));
  S._cast={ids:cast.map(x=>x.g.id), set, bySec, manual:!!(sel&&sel.length)};
  if(clips.size>=Math.max(10,Math.min(nShots,total))*0.8||S._cast.manual) S._castPool=clips; // big libraries: judge the cast's clips properly instead of skimming everything
  return S._cast; }
/* the cost term: this section's collection first, the rest of the cast next, everything else only when it must */
function castCost(seg,ci){ const C=S._cast; if(!C) return 0; const id=collOf(ci); if(id==null) return 0; const prim=C.bySec.get(secIdx(seg.start));
  if(id===prim) return -1.2; if(C.set.has(id)) return seg.drop?-0.6:-0.25; return C.manual?3:0.9; }
/* neighbouring shots relate in what they show: not the same shot again, not a random leap mid-phrase */
function meaningCost(seg,s,ctx){ const p=ctx.prevSm, pv=p&&sampleVec(p), v=sampleVec(s); if(!pv||!v) return 0; const d=dotV(pv,v);
  if(d>0.95) return 0.35; if(seg.drop||seg._newSection) return d>0.86?0.15:-0.1; return d>=0.78?-0.2:d<0.6?0.12:0; }
/* ---- the clip library's Collections bar and the Organise sheet ---- */
function renderCollBar(){ const box=$("collBar"); if(!box) return; const C=S._colls; box.innerHTML="";
  if(!C||!C.list.length||!S.clips.some(c=>c.samples)){ box.hidden=true; box.style.display="none"; return; } box.hidden=false; box.style.display="flex";
  const lab=document.createElement("span"); lab.textContent="Collections:"; lab.style.marginRight="4px"; box.appendChild(lab);
  const cast=S._cast, shown=C.list.filter(g=>g.n).slice(0,S._collAll?999:12);
  shown.forEach(g=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"+(cast&&cast.set.has(g.id)?" in-cast":""); b.textContent=`${g.name} (${g.n})`; b.setAttribute("aria-pressed",String(!!(S.collSel&&S.collSel.has(g.id))));
    b.title=cast&&cast.set.has(g.id)?"This video draws from it. Tap to choose the collections yourself":"Tap to make the video draw from this collection (choose several to combine)";
    b.onclick=()=>{ S.collSel=S.collSel||new Set(); S.collSel.has(g.id)?S.collSel.delete(g.id):S.collSel.add(g.id); collChanged(); }; box.appendChild(b); });
  if(C.list.filter(g=>g.n).length>12){ const m=document.createElement("button"); m.type="button"; m.className="chip"; m.textContent=S._collAll?"Fewer":`Show all ${C.list.filter(g=>g.n).length}`; m.onclick=()=>{ S._collAll=!S._collAll; renderCollBar(); }; box.appendChild(m); }
  if(S.collSel&&S.collSel.size){ const cl=document.createElement("button"); cl.type="button"; cl.className="chip"; cl.textContent="Let the app choose"; cl.onclick=()=>{ S.collSel.clear(); collChanged(); }; box.appendChild(cl); }
  const org=document.createElement("button"); org.type="button"; org.className="chip"; org.textContent="Organise…"; org.onclick=openCollections; box.appendChild(org);
  const info=$("collInfo"); if(info){ info.hidden=!cast; if(cast){ info.innerHTML=""; const a=document.createElement("span"); a.textContent=cast.manual?"Drawing from:":"This video draws from:"; const b=document.createElement("b"); b.setAttribute("data-noi18n",""); b.textContent=" "+cast.ids.map(id=>t(collName(id))).join(", "); info.append(a,b); } } }
function collChanged(){ saveProjectSoon(); _rcT=0; if(!S.running&&S.an) buildPlan(); else renderCollBar(); }
function openCollections(){ $("collSheet").hidden=false; S._collPick=new Set(); renderCollSheet(); crumb("collections"); }
function renderCollSheet(){ const box=$("collBody"); if(!box) return; const C=buildCollections(); box.innerHTML=""; const U=collUser(); S._collPick=S._collPick||new Set();
  const learned=S.clips.filter(c=>c.samples&&catOf(c)).length, all=S.clips.filter(c=>c.samples).length;
  const st=document.createElement("p"); st.className="small"; st.textContent=learned>=all?`All ${all} clips are catalogued.`:seeAvailable()?`${learned} of ${all} clips catalogued so far. The rest are sorted as the app learns what's in them.`:`Collections here follow when clips were shot and your folders.`; box.appendChild(st);
  let cat=undefined;
  C.list.forEach(g=>{ if(g.cat!==cat){ cat=g.cat; const h=document.createElement("h3"); h.className="coll-cat"; h.textContent=cat?CAT_NAME[cat]:"Other"; box.appendChild(h); }
    const row=document.createElement("div"); row.className="coll-row";
    const top=document.createElement("div"); top.className="coll-top"; const nm=document.createElement("input"); nm.type="text"; nm.value=g.name; nm.maxLength=40; nm.setAttribute("aria-label","Collection name"); nm.setAttribute("data-noi18n","");
    nm.onchange=()=>{ const v=nm.value.trim(); if(!v||v===g.auto) delete U.names[g.id]; else U.names[g.id]=v; if(g.id.startsWith("u:")){ const m=U.made.find(x=>x.id===g.id); if(m) m.name=v||m.name; } saveCollUser(); buildCollections(); renderCollBar(); };
    const n=document.createElement("span"); n.className="small coll-n"; n.textContent=String(g.n); n.title=n.ariaLabel=`${g.n}`; top.append(nm,n);
    if(g.id.startsWith("u:")&&!g.n){ const del=document.createElement("button"); del.type="button"; del.className="chip"; del.textContent="Remove"; del.onclick=()=>{ U.made=U.made.filter(x=>x.id!==g.id); delete U.names[g.id]; saveCollUser(); renderCollSheet(); renderCollBar(); }; top.appendChild(del); }
    row.appendChild(top);
    const strip=document.createElement("div"); strip.className="coll-strip"; const lim=g._open?g.n:12;
    g.clips.slice(0,lim).forEach(ci=>{ const c=S.clips[ci], k=clipKey(ci), im=document.createElement("button"); im.type="button"; im.className="coll-th"; im.title=c.name; im.setAttribute("aria-pressed",String(S._collPick.has(k)));
      if(c.thumb) im.style.backgroundImage=`url(${c.thumb})`; im.onclick=()=>{ S._collPick.has(k)?S._collPick.delete(k):S._collPick.add(k); im.setAttribute("aria-pressed",String(S._collPick.has(k))); renderCollMove(); }; strip.appendChild(im); });
    if(g.n>lim){ const more=document.createElement("button"); more.type="button"; more.className="chip"; more.textContent=`+${g.n-lim} more`; more.onclick=()=>{ g._open=true; S._collOpen=(S._collOpen||new Set()).add(g.id); renderCollSheet(); }; strip.appendChild(more); }
    row.appendChild(strip); box.appendChild(row); });
  (S._collOpen||new Set()).forEach(id=>{ const g=C.byId.get(id); if(g) g._open=true; });
  renderCollMove(); }
function renderCollMove(){ const bar=$("collMove"); if(!bar) return; const n=(S._collPick||new Set()).size; bar.hidden=!n; if(!n) return; const C=S._colls;
  $("collMoveN").textContent=`${n} clip${n===1?"":"s"} selected`; const sel=$("collTo"); sel.innerHTML="";
  C.list.forEach(g=>{ const o=document.createElement("option"); o.value=g.id; o.textContent=g.name; sel.appendChild(o); }); const o=document.createElement("option"); o.value="new"; o.textContent="New collection…"; sel.appendChild(o); $("collNew").hidden=sel.value!=="new"; }
function moveToCollection(){ const U=collUser(), to=$("collTo").value; let id=to;
  if(to==="new"){ const name=($("collNew").value||"").trim()||`Collection ${U.n+1}`; U.n++; id="u:"+U.n+"-"+Date.now().toString(36); U.made.push({id,name}); $("collNew").value=""; }
  const keys=[...S._collPick]; S.clips.forEach((c,ci)=>{ const k=clipKey(ci); if(keys.includes(k)){ const auto=autoCollId(c); if(id===auto) delete U.moves[k]; else U.moves[k]=id; } });
  saveCollUser(); S._collPick=new Set(); buildCollections(); renderCollSheet(); renderCollBar(); status(`Moved ${keys.length} clip${keys.length===1?"":"s"} to “${collName(id)}”.`); if(!S.running&&S.an) buildPlan(); }
/* learning what's in the clips runs by itself once clips are in (not on mobile data: the model is 150 MB) */
function autoLearnOk(){ const c=navigator.connection; if(c&&(c.saveData||c.type==="cellular")) return false; let off=false; try{ off=localStorage.getItem("beatsplicerAutoLearn")==="0"; }catch(e){} return !off; }
function learnSoon(){ if(!seeAvailable()||!autoLearnOk()||S._seeBusy) return; clearTimeout(S._learnT); S._learnT=setTimeout(()=>{ if(!S.running&&S.clips.some(c=>c.samples&&c.samples.some(s=>!s.ce))) seeAll(); },2500); }
