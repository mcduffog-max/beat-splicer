/* ---------------- YouTube: results that teach the next edit, and uploads ----------------
   Every export writes a recipe (style, opening, pace, look...). Signed in to YouTube, the app reads each Short's
   analytics, links it to the recipe that made it, and works out which choices keep people watching; Do everything
   then leans towards them. Videos can also go straight up, now or scheduled. Needs the person's own Google OAuth
   client ID (a free Google Cloud project), and an address of its own: not available inside claude.ai. */
const YT={scopes:"https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.upload", token:null, exp:0, channel:null};
function ytClientId(){ try{ return localStorage.getItem("beatsplicerYTClient")||""; }catch(e){ return ""; } }
function ytAvailable(){ return !HOSTED; }
function loadGIS(){ if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve(); return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.onload=()=>res(); s.onerror=()=>rej(new Error("Couldn't reach Google sign-in")); document.head.appendChild(s); }); }
async function ytToken(interactive){ if(YT.token&&Date.now()<YT.exp-60000) return YT.token; const id=ytClientId(); if(!id) throw new Error("Add your Google client ID first");
  await loadGIS(); return new Promise((res,rej)=>{ const tc=google.accounts.oauth2.initTokenClient({client_id:id, scope:YT.scopes, callback:r=>{ if(r&&r.access_token){ YT.token=r.access_token; YT.exp=Date.now()+(+r.expires_in||3600)*1000; res(YT.token); } else rej(new Error(r&&r.error||"Sign-in was cancelled")); }, error_callback:e=>rej(new Error(e&&e.type||"Sign-in was cancelled"))});
    tc.requestAccessToken({prompt:YT.token?"":"consent"}); }); }
async function ytFetch(url,opt){ const t=await ytToken(true); const r=await fetch(url,{...(opt||{}),headers:{...((opt&&opt.headers)||{}),Authorization:"Bearer "+t}}); if(!r.ok){ let m=""; try{ const j=await r.json(); m=j.error&&j.error.message||""; }catch(e){} throw new Error(`YouTube said ${r.status}${m?": "+m:""}`); } return r; }
const isoDur=s=>{ const m=/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(s||""); return m?(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0):0; };
/* recipes: what each export was made with */
function recipes(){ try{ return JSON.parse(localStorage.getItem("beatsplicerRecipes")||"[]"); }catch(e){ return []; } }
function saveRecipes(a){ try{ localStorage.setItem("beatsplicerRecipes",JSON.stringify(a.slice(-600))); }catch(e){} }
function recipeFor(r){ const v=id=>$(id)?$(id).value:null; return {key:Math.random().toString(36).slice(2,10), at:Date.now(), ep:r.ep.id, file:resultName(r), song:songTitle(), artist:$("artistName").value.trim(),
  dur:+(r.win[1]-r.win[0]).toFixed(1), opening:/chorus/.test(S._hookWhy||"")?"chorus":/drop/.test(S._hookWhy||"")?"drop":S._hookWhy?"section":"strongest moment",
  style:S.style&&S.style.name||(v("direct")&&v("direct")!=="off"?v("direct"):"none"), motif:v("motif"), look:v("look"), pace:S._paceName||"set by hand", text:v("textStyle"), sig:v("sigTrans"), length:r.ep.short?(v("shortLen")==="rec"?"recommended":v("shortLen")+" s"):"full", title:($("hookText").value.trim()?"own title":"no title"), ytId:null}; }
function logRecipes(results){ const a=recipes(); results.forEach(r=>{ if(r._recipe) return; r._recipe=recipeFor(r); a.push(r._recipe); }); saveRecipes(a); }
/* read the channel: its Shorts, their numbers */
async function ytReadChannel(){ const ch=await (await ytFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true")).json(); const c=ch.items&&ch.items[0]; if(!c) throw new Error("No YouTube channel on this Google account");
  YT.channel={id:c.id,title:c.snippet.title}; const up=c.contentDetails.relatedPlaylists.uploads, vids=[]; let page="";
  for(let k=0;k<4;k++){ const j=await (await ytFetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&maxResults=50&playlistId=${up}${page?"&pageToken="+page:""}`)).json();
    (j.items||[]).forEach(it=>vids.push({id:it.contentDetails.videoId,title:it.snippet.title,at:Date.parse(it.contentDetails.videoPublishedAt||it.snippet.publishedAt)})); if(!j.nextPageToken) break; page=j.nextPageToken; }
  for(let i=0;i<vids.length;i+=50){ const part=vids.slice(i,i+50), j=await (await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${part.map(v=>v.id).join(",")}`)).json(); (j.items||[]).forEach(it=>{ const v=part.find(x=>x.id===it.id); if(v) v.dur=isoDur(it.contentDetails.duration); }); }
  const end=new Date().toISOString().slice(0,10), base=`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${end}&dimensions=video&sort=-views&maxResults=200&metrics=`;
  let rep; try{ rep=await (await ytFetch(base+"views,engagedViews,averageViewDuration,averageViewPercentage,likes,shares,subscribersGained")).json(); }catch(e){ rep=await (await ytFetch(base+"views,averageViewDuration,averageViewPercentage,likes,shares,subscribersGained")).json(); }
  const cols=(rep.columnHeaders||[]).map(h=>h.name); (rep.rows||[]).forEach(row=>{ const v=vids.find(x=>x.id===row[0]); if(!v) return; cols.forEach((n,i)=>{ if(i) v[n]=+row[i]; }); });
  return vids.filter(v=>v.dur&&v.dur<=180&&v.views>=20); }
/* which recipe made which Short: the upload id when the app uploaded it; otherwise the song's words in the title, a matching length, and timing */
const ytWords=t=>new Set(String(t||"").toLowerCase().replace(/[^a-z0-9' ]+/g," ").split(/\s+/).filter(w=>w.length>1&&!["the","and","of","a","official","video","shorts","fan","edit"].includes(w)));
function matchRecipes(vids){ const R=recipes(), used=new Set(), pairs=[];
  vids.forEach(v=>{ let r=R.find(x=>x.ytId===v.id); if(!r){ const tw=ytWords(v.title); let best=null;
      R.forEach(x=>{ if(used.has(x.key)||x.ytId) return; const sw=ytWords(x.song+" "+x.artist); if(!sw.size) return; let hit=0; sw.forEach(w=>{ if(tw.has(w)) hit++; }); const cover=hit/sw.size; if(cover<0.6) return;
        const dt=(v.at-x.at)/864e5; if(dt<-1||dt>14) return; if(Math.abs((v.dur||0)-x.dur)>2.5) return; const sc=cover-Math.abs(dt)*0.05-(dt<0?0.3:0); /* published after it was made, and soon after */ if(!best||sc>best.sc) best={x,sc}; }); r=best&&best.x; }
    if(r){ used.add(r.key); pairs.push({v,r}); } }); return pairs; }
/* what's working: each choice's effect on how many viewers stay, against the channel's own average */
const LEARN_KEYS={opening:"Opening",style:"Style",pace:"Rhythm",look:"Colour look",text:"Lettering",sig:"Signature transition",motif:"Visual idea",length:"Short length",title:"On-screen title"};
function ytScore(v){ const stay=v.engagedViews&&v.views?v.engagedViews/v.views:null, apv=v.averageViewPercentage!=null?v.averageViewPercentage/100:null; return stay!=null?stay+0.25*(apv||0):apv; }
function learnFrom(pairs){ const xs=pairs.map(p=>({...p,s:ytScore(p.v)})).filter(p=>p.s!=null); if(!xs.length) return null; const mean=xs.reduce((a,p)=>a+p.s,0)/xs.length;
  const eff={}; Object.keys(LEARN_KEYS).forEach(k=>{ const g={}; xs.forEach(p=>{ const val=p.r[k]; if(val==null) return; (g[val]=g[val]||[]).push(p.s-mean); });
    eff[k]={}; Object.entries(g).forEach(([val,a])=>{ const n=a.length; eff[k][val]={eff:+(a.reduce((x,y)=>x+y,0)/n*(n/(n+3))).toFixed(4),n}; }); });
  return {eff,n:xs.length,mean:+mean.toFixed(3),at:Date.now(),stay:xs.some(p=>p.v.engagedViews!=null)}; }
function learned(){ try{ return JSON.parse(localStorage.getItem("beatsplicerLearn")||"null"); }catch(e){ return null; } }
function learnW(k,val){ const L=learned(); if(!L||!$("learnOn")||!$("learnOn").checked) return 1; const e=L.eff&&L.eff[k]&&L.eff[k][val]; if(!e||e.n<2) return 1; return Math.max(0.6,Math.min(1.8,Math.exp(e.eff*8))); }
function learnSummary(L){ if(!L) return []; const all=[]; Object.entries(L.eff).forEach(([k,m])=>Object.entries(m).forEach(([val,e])=>{ if(e.n>=2) all.push({k,val,...e}); }));
  all.sort((a,b)=>b.eff-a.eff); const pct=x=>`${x>0?"+":""}${Math.round(x*100)} points`; const words=x=>`${LEARN_KEYS[x.k]}: ${x.val} (${pct(x.eff)} on ${x.n} Shorts)`;
  return [...all.filter(x=>x.eff>0.005).slice(0,3).map(x=>"Working: "+words(x)), ...all.filter(x=>x.eff<-0.005).slice(-2).reverse().map(x=>"Not working: "+words(x))]; }
async function ytLearn(){ const out=$("ytOut"); out.textContent="Reading your channel…";
  try{ const vids=await ytReadChannel(), pairs=matchRecipes(vids), L=learnFrom(pairs); if(L) try{ localStorage.setItem("beatsplicerLearn",JSON.stringify(L)); }catch(e){}
    const lines=[`${YT.channel.title}: ${vids.length} Shorts read, ${pairs.length} linked to the settings that made them.`];
    if(!pairs.length) lines.push("None of these were made with this version of the app yet, so there's nothing to learn from so far. Shorts you make from now on are tracked."); else lines.push(...learnSummary(L));
    if(L&&L.n<6) lines.push("Early days: the app leans on these only gently until more Shorts come in.");
    out.innerHTML=""; lines.forEach(t=>{ const d=document.createElement("div"); d.textContent=t; out.appendChild(d); }); renderYT(); }
  catch(e){ out.textContent="Couldn't read your channel: "+(e&&e.message||e); } }
/* upload, now or scheduled (YouTube publishes a scheduled video itself, so the phone can be off) */
async function ytUpload(r,{title,description,publishAt},onProg){ const meta={snippet:{title:title.slice(0,100),description:description||"",categoryId:"10"},status:publishAt?{privacyStatus:"private",publishAt,selfDeclaredMadeForKids:false}:{privacyStatus:"public",selfDeclaredMadeForKids:false}};
  const init=await ytFetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{method:"POST",headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":r.blob.type.split(";")[0]||"video/mp4","X-Upload-Content-Length":String(r.blob.size)},body:JSON.stringify(meta)});
  const loc=init.headers.get("Location"); if(!loc) throw new Error("YouTube didn't open an upload");
  const res=await new Promise((ok,bad)=>{ const x=new XMLHttpRequest(); x.open("PUT",loc); x.setRequestHeader("Authorization","Bearer "+YT.token); x.setRequestHeader("Content-Type",r.blob.type.split(";")[0]||"video/mp4");
    x.upload.onprogress=e=>{ if(e.lengthComputable&&onProg) onProg(e.loaded/e.total); }; x.onload=()=>x.status<300?ok(JSON.parse(x.responseText||"{}")):bad(new Error("Upload failed: "+x.status)); x.onerror=()=>bad(new Error("Upload failed: connection lost")); x.send(r.blob); });
  if(r._recipe){ const a=recipes(), k=a.find(x=>x.key===r._recipe.key); if(k){ k.ytId=res.id; saveRecipes(a); } } return res; }
function nextAt(h){ const d=new Date(); d.setHours(h,0,0,0); if(d<=new Date()) d.setDate(d.getDate()+1); return d; }
function ytUploadUI(r,row){ if(!ytAvailable()||!ytClientId()||!r.ep||!/^(shorts|youtube)$/.test(r.ep.id)) return;
  const wrap=document.createElement("div"); wrap.style.cssText="grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px";
  const t=document.createElement("input"); t.type="text"; t.maxLength=100; t.value=[songTitle(),$("artistName").value.trim()].filter(Boolean).join(" – ")||resultName(r).replace(/\.[^.]+$/,""); t.setAttribute("aria-label","YouTube title"); t.style.flex="1 1 160px";
  const when=document.createElement("select"); [["now","Publish now"],["19","Tonight 7 pm"],["12","Tomorrow 12 pm"]].forEach(([v,l])=>{ const o=document.createElement("option"); o.value=v; o.textContent=l; when.appendChild(o); });
  const b=document.createElement("button"); b.className="btn"; b.type="button"; b.textContent=r._yt?"On YouTube":"Upload to YouTube"; b.disabled=!!r._yt;
  b.onclick=async()=>{ b.disabled=true; try{ const at=when.value==="now"?null:(when.value==="12"?(()=>{ const d=nextAt(12); if(d.getDate()===new Date().getDate()) d.setDate(d.getDate()+1); return d; })():nextAt(+when.value)).toISOString();
      const res=await ytUpload(r,{title:t.value,description:captionFor(r.ep)||"",publishAt:at},q=>{ b.textContent=`Uploading ${Math.round(q*100)}%`; });
      r._yt=res.id; b.textContent=at?"Scheduled":"Uploaded"; status(at?`Scheduled on YouTube for ${new Date(at).toLocaleString()}.`:"Uploaded to YouTube."); }
    catch(e){ b.disabled=false; b.textContent="Upload to YouTube"; status(String(e&&e.message||e),true); } };
  wrap.append(t,when,b); row.appendChild(wrap); }
function renderYT(){ const box=$("ytBox"); if(!box) return; box.hidden=!ytAvailable(); if(box.hidden) return; const id=ytClientId();
  $("ytSetup").hidden=!!id; $("ytLive").hidden=!id; $("ytClient").value=id; $("ytWho").textContent=YT.channel?`Signed in: ${YT.channel.title}.`:"";
  const L=learned(); if(L&&!$("ytOut").textContent){ const s=learnSummary(L); $("ytOut").textContent=s.length?`From ${L.n} Shorts: `+s.join(" · "):""; } }
$("ytSave").onclick=()=>{ const v=$("ytClient").value.trim(); if(!/\.apps\.googleusercontent\.com$/.test(v)){ status("That doesn't look like a Google client ID: it ends in .apps.googleusercontent.com.",true); return; } try{ localStorage.setItem("beatsplicerYTClient",v); }catch(e){} YT.token=null; renderYT(); renderResults(); status("Client ID saved. Tap Read my results to sign in."); };
$("ytForget").onclick=()=>{ try{ localStorage.removeItem("beatsplicerYTClient"); }catch(e){} YT.token=null; YT.channel=null; renderYT(); renderResults(); };
$("ytRead").onclick=()=>ytLearn();
renderYT();
