/* ---------------- Exact lyric timing ----------------
   1. Synced lyrics from LRCLIB (fetched where the page may reach it; otherwise one tap opens LRCLIB's search for this song).
   2. Tap to time: the song plays and you tap as each line starts. Exact to your timing; missed lines are re-spread between taps.
   3. Nudge: shift every line earlier or later. */
/* what to search for: the song's tags first, else its file name ("Artist - Title (Official Video).mp3", "03 - Title.mp3") */
function lySong(){ const m=S.meta||{}; let title=(m.title?cleanTagTitle(m.title):"").trim(), artist=($("artistName").value.trim()||m.artist||"").trim();
  if(!title){ const raw=String(S.audioName||"").replace(/\.[^.]+$/,"").replace(/[_]+/g," ").replace(/\s*[\[(][^\])]*[\])]/g," ").replace(/\b(official|music|lyric|lyrics|video|audio|hd|hq|4k|remaster(ed)?|\d{4} remaster)\b/gi," ").replace(/^\s*\d{1,3}\s*[-.)]?\s+/,"");
    const parts=raw.split(/\s+-\s+|\s-|-\s/).map(x=>x.replace(/-+/g," ").replace(/\s{2,}/g," ").trim()).filter(Boolean);
    if(parts.length>=2&&!artist){ artist=parts[0]; title=parts.slice(1).join(" "); } else title=parts.join(" ")||cleanSongName(S.audioName||""); }
  return {title:title.trim(), artist:artist.trim()}; }
const LRCLIB="https://lrclib.net/api/";
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(new Error("timeout")),ms))]);
/* in the app, Android's own connection is the backup (no browser rules about which sites a page may ask) */
async function lrclib(path){ const url=LRCLIB+path;
  try{ const r=await withTimeout(fetch(url),12000); if(!r.ok) throw new Error("http "+r.status); return await r.json(); }
  catch(e){ const H=NP("CapacitorHttp"); if(!H) throw e; const r=await withTimeout(H.get({url,headers:{accept:"application/json"},responseType:"json"}),15000); if(r.status<200||r.status>=300) throw new Error("http "+r.status); return typeof r.data==="string"?JSON.parse(r.data):r.data; } }
/* the recording on LRCLIB may be a different cut (a video intro, a remaster): line the lyrics up with the song's own sections */
function lyricOffsetFromSections(){ const L=S.lyrics, AS=songSections(); if(!L||!L.lines||L.lines.length<6||AS.length<3) return 0;
  const LS=lyricSections(); if(LS.length<2) return 0; const at=AS.map(s=>s.t0).filter(t=>t>1), lt=LS.map(s=>s.t0);
  const score=d=>lt.reduce((a,t)=>{ let best=0; for(const x of at){ const e=Math.abs(t+d-x-0.3); if(e<1.5) best=Math.max(best,1-(e/1.5)**2); } return a+best; },0); // singers come in just after the bar line, as often as not
  const ds=[]; for(let d=-25;d<=25.001;d+=0.1) ds.push([+d.toFixed(1),score(d)]); const top=Math.max(...ds.map(x=>x[1])); if(top<score(0)+0.6) return 0;
  const near=ds.filter(x=>x[1]>=top-0.05), bd=near.reduce((a,x)=>a+x[0],0)/near.length; return Math.abs(bd)>=0.3?+bd.toFixed(1):0; }
async function findLyrics(auto){ const {title,artist}=lySong(); if(!title){ if(!auto) status("Add a song first.",true); return false; }
  const dur=S.an?S.an.duration:0; let pick=null, how="";
  try{ const q=new URLSearchParams({track_name:title,artist_name:artist}); if(dur) q.set("duration",String(Math.round(dur)));
    if(artist){ try{ const j=await lrclib("get?"+q); if(j&&(j.syncedLyrics||j.plainLyrics)) { pick=j; how="exact"; } }catch(e){} }
    if(!pick||!pick.syncedLyrics){ const tries=[artist?new URLSearchParams({track_name:title,artist_name:artist}):null,new URLSearchParams({q:[artist,title].filter(Boolean).join(" ")})].filter(Boolean);
      for(const t of tries){ let list=[]; try{ list=await lrclib("search?"+t); }catch(e){} if(!Array.isArray(list)||!list.length) continue;
        const syn=list.filter(x=>x.syncedLyrics&&!x.instrumental); const pool=syn.length?syn:list.filter(x=>x.plainLyrics);
        pool.sort((a,b)=>Math.abs((a.duration||0)-dur)-Math.abs((b.duration||0)-dur)); if(pool[0]&&(!pick||pool[0].syncedLyrics)){ pick=pool[0]; how="search"; break; } } }
    if(!pick) throw new Error("not found");
    useLyricsPick(pick,title,artist); crumb("lyrics found ("+how+")"); return true; }
  catch(e){ crumb("lyrics: none found automatically ("+(e&&e.message||e)+")"); if(auto){ S._lyMissed=true; return false; }
    await openLyricsSearch(artist,title,/timeout|fetch|network|http/i.test(String(e&&e.message))?"LRCLIB didn't answer. Check the connection, then search again.":"No exact match. Check the artist and title, or pick the right version below."); return false; } }
function useLyricsPick(pick,title,artist){ const dur=S.an?S.an.duration:0;
  setLyrics(pick.syncedLyrics||pick.plainLyrics,"lrclib");
  let note=""; if(pick.syncedLyrics){ const d=lyricOffsetFromSections(), off=dur&&pick.duration?Math.abs(pick.duration-dur):0;
    if(d&&(off>1.5||Math.abs(d)>=1)){ S.lyrics.shift=d; S.lyrics.lines.forEach(l=>{ l.t+=d; if(l.end!=null) l.end+=d; }); S.lyrics._secFor=null; renderLyrics(); buildPlan(); note=` Shifted ${d>0?"later":"earlier"} by ${Math.abs(d).toFixed(1)} s to match this recording.`; } }
  S._lyMissed=false; if($("lySearch")) $("lySearch").hidden=true;
  status(`${pick.syncedLyrics?"Synced":"Unsynced"} lyrics found for “${pick.trackName||title}”${pick.artistName||artist?` by ${pick.artistName||artist}`:""}.${note}${pick.syncedLyrics?"":" Use Time by tapping for exact timing."}`); }
/* searching inside the app: results from LRCLIB, closest to this song's length first, timed lyrics before plain ones */
async function openLyricsSearch(artist,title,msg){ const box=$("lySearch"); if(!box) return; box.hidden=false; $("lyricsBox").open=true;
  if(artist!=null) $("lyQArtist").value=artist||""; if(title!=null) $("lyQTitle").value=title||""; $("lySearchMsg").textContent=msg||""; await runLyricsSearch(); }
async function runLyricsSearch(){ const a=$("lyQArtist").value.trim(), t=$("lyQTitle").value.trim(), out=$("lyResults"), dur=S.an?S.an.duration:0; out.innerHTML=""; if(!t&&!a) return;
  const go=$("lyQGo"); go.disabled=true; go.textContent="Searching…"; const seen=new Map();
  try{ const qs=[a&&t?new URLSearchParams({track_name:t,artist_name:a}):null,new URLSearchParams({q:[a,t].filter(Boolean).join(" ")}),t?new URLSearchParams({q:t.replace(/\s*[\[(].*$/,"").replace(/\b(feat|ft)\.?\b.*$/i,"").trim()}):null].filter(Boolean);
    let err=null; for(const q of qs){ try{ const list=await lrclib("search?"+q); (Array.isArray(list)?list:[]).forEach(x=>{ if(!x.instrumental&&(x.syncedLyrics||x.plainLyrics)&&!seen.has(x.id)) seen.set(x.id,x); }); }catch(e){ err=e; } if(seen.size>=12) break; }
    const L=[...seen.values()].sort((x,y)=>(y.syncedLyrics?1:0)-(x.syncedLyrics?1:0)||Math.abs((x.duration||0)-dur)-Math.abs((y.duration||0)-dur)).slice(0,10);
    if(!L.length){ $("lySearchMsg").textContent=err?"LRCLIB didn't answer. Check the connection, then search again.":"Nothing found. Try fewer words, or just the song title."; return; }
    if(!$("lySearchMsg").textContent) $("lySearchMsg").textContent="Pick the version that matches your song.";
    L.forEach(x=>{ const row=document.createElement("div"); row.className="lyres"; const tx=document.createElement("div"); tx.className="t";
      const near=dur&&x.duration&&Math.abs(x.duration-dur)<=2.5, first=String(x.syncedLyrics||x.plainLyrics||"").split("\n").map(l=>l.replace(/^\[[^\]]*\]\s*/,"").trim()).filter(Boolean)[0]||"";
      const b=document.createElement("b"); b.textContent=`${x.trackName||"?"} – ${x.artistName||"?"}`; const sp=document.createElement("span"); sp.textContent=[x.albumName,x.duration?fmtTime(x.duration):"",x.syncedLyrics?"timed":"words only",near?"same length as your song":""].filter(Boolean).join(" · ");
      const i=document.createElement("i"); i.textContent=first?`“${first}”`:""; tx.append(b,sp,i);
      const u=document.createElement("button"); u.type="button"; u.className="btn"+(near&&x.syncedLyrics?" primary":""); u.textContent="Use"; u.onclick=()=>{ useLyricsPick(x,x.trackName,x.artistName); crumb("lyrics picked from search"); };
      row.append(tx,u); out.appendChild(row); }); }
  finally{ go.disabled=false; go.textContent="Search"; } }
$("lyQGo").onclick=runLyricsSearch; ["lyQArtist","lyQTitle"].forEach(id=>$(id).addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); runLyricsSearch(); } }));
/* opening Lyrics after the automatic look-up missed shows the search straight away */
$("lyricsBox").addEventListener("toggle",()=>{ if($("lyricsBox").open&&S._lyMissed&&!S.lyrics&&$("lySearch").hidden){ const {title,artist}=lySong(); openLyricsSearch(artist,title,"No exact match was found automatically. Check the artist and title, or pick the right version below."); } });
$("lyFind").onclick=async()=>{ const b=$("lyFind"); b.disabled=true; b.textContent="Looking…"; try{ await findLyrics(false); }finally{ b.disabled=false; b.textContent="Find synced lyrics"; } };
/* away from claude.ai the app can reach LRCLIB itself: every new song without lyrics gets them looked up */
function autoLyrics(){ if(HOSTED||S.lyrics||!S.an||S._autoLyFor===S.audioName) return; S._autoLyFor=S.audioName; findLyrics(true).catch(()=>{}); }
/* nudge every line */
document.querySelectorAll("#lyNudge [data-n]").forEach(btn=>btn.onclick=()=>{ const L=S.lyrics; if(!L) return; const d=+btn.dataset.n; L.shift=+((L.shift||0)+d).toFixed(2);
  L.lines.forEach(l=>{ l.t=+Math.max(0,l.t+d).toFixed(2); l.end=+Math.max(l.t+0.2,l.end+d).toFixed(2); }); renderLyrics(); saveProjectSoon(); if(!S.running) buildPlan(); });
/* tap to time */
var TAP=null;
function tapNow(){ return TAP?TAP.off+(TAP.ac.currentTime-TAP.t0)-(TAP.ac.outputLatency||TAP.ac.baseLatency||0):0; }
function tapShow(){ if(!TAP) return; const L=S.lyrics.lines, k=TAP.k; $("lyTapNow").textContent=k<L.length?L[k].text:"That’s every line."; $("lyTapNext").textContent=k+1<L.length?"Next: "+L[k+1].text:"";
  $("lyTapBtn").disabled=k>=L.length; $("lyTapBack").disabled=k===0; }
function tapPlay(from){ if(TAP.src){ try{ TAP.src.onended=null; TAP.src.stop(); }catch(e){} } const s=TAP.ac.createBufferSource(); s.buffer=S.audioBuf; s.connect(TAP.ac.destination);
  TAP.off=Math.max(0,from); TAP.t0=TAP.ac.currentTime+0.05; s.start(TAP.t0,TAP.off); s.onended=()=>{ if(TAP&&TAP.src===s) tapFinish(); }; TAP.src=s; }
function tapStart(){ if(!S.lyrics||!S.audioBuf) return; stopListen&&stopListen(); const ac=new (window.AudioContext||window.webkitAudioContext)();
  TAP={ac,k:0,taps:[],src:null,off:0,t0:0}; $("lyTap").hidden=false; $("lyTapStart").hidden=true; tapPlay(Math.max(0,S.lyrics.lines[0].t-6)); tapShow();
  TAP.tick=setInterval(()=>{ if(TAP) $("lyTapClock").textContent=fmtTenth(Math.max(0,tapNow())); },100); }
const TAP_REACT=0.12; // people tap a little after a line starts
function tapHit(){ if(!TAP) return; const L=S.lyrics.lines; if(TAP.k>=L.length) return; TAP.taps[TAP.k]=+Math.max(0,tapNow()-TAP_REACT).toFixed(2); TAP.k++; tapShow(); if(TAP.k>=L.length) setTimeout(tapFinish,1200); }
function tapBack(){ if(!TAP||TAP.k===0) return; TAP.k--; TAP.taps.length=TAP.k; const L=S.lyrics.lines, prev=TAP.k>0?TAP.taps[TAP.k-1]:null; tapPlay(Math.max(0,(prev!=null?prev:L[TAP.k].t)-2.5)); tapShow(); }
function tapFinish(){ if(!TAP) return; const T=TAP; TAP=null; clearInterval(T.tick); try{ T.src&&T.src.stop(); }catch(e){} try{ T.ac.close(); }catch(e){}
  $("lyTap").hidden=true; $("lyTapStart").hidden=false; const L=S.lyrics, n=T.taps.filter(v=>v!=null).length; if(!n){ status("No lines were timed."); return; }
  // tapped lines get their times; lines in between (or after the last tap) are spread between their neighbours
  const lines=L.lines, idx=lines.map((_,i)=>i).filter(i=>T.taps[i]!=null);
  idx.forEach(i=>lines[i].t=T.taps[i]);
  for(let a=0;a<idx.length;a++){ const i0=idx[a], i1=a+1<idx.length?idx[a+1]:null; if(i1==null||i1-i0<2) continue; const t0=lines[i0].t, t1=lines[i1].t; for(let i=i0+1;i<i1;i++) lines[i].t=+(t0+(t1-t0)*(i-i0)/(i1-i0)).toFixed(2); }
  for(let i=1;i<lines.length;i++) if(lines[i].t<=lines[i-1].t) lines[i].t=+(lines[i-1].t+0.3).toFixed(2);
  lines.forEach((l,i)=>{ const nx=lines[i+1]; l.end=+(nx?Math.min(nx.t,l.t+12):Math.min(S.an.duration,l.t+6)).toFixed(2); });
  L.src="tap"; L.exact=n>=lines.length*0.8; L.tapped=n; renderLyrics(); saveProjectSoon(); if(!S.running) buildPlan();
  status(`Timed ${n} of ${lines.length} lines by tapping${n<lines.length?"; the rest are spread between your taps":""}.`); }
$("lyTapStart").onclick=tapStart; $("lyTapBtn").onclick=tapHit; $("lyTapBack").onclick=tapBack; $("lyTapStop").onclick=tapFinish;
document.addEventListener("keydown",e=>{ if(!TAP) return; if(e.code==="Space"||e.key==="Enter"){ e.preventDefault(); tapHit(); } else if(e.key==="Backspace"){ e.preventDefault(); tapBack(); } else if(e.key==="Escape") tapFinish(); });
