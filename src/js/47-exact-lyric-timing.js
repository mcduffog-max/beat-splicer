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
async function lrclib(path){ const r=await Promise.race([fetch(LRCLIB+path),new Promise((_,j)=>setTimeout(()=>j(new Error("timeout")),7000))]); if(!r.ok) throw new Error("http "+r.status); return r.json(); }
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
    setLyrics(pick.syncedLyrics||pick.plainLyrics,"lrclib");
    let note=""; if(pick.syncedLyrics){ const d=lyricOffsetFromSections(), off=dur&&pick.duration?Math.abs(pick.duration-dur):0;
      if(d&&(off>1.5||Math.abs(d)>=1)){ S.lyrics.shift=d; S.lyrics.lines.forEach(l=>{ l.t+=d; if(l.end!=null) l.end+=d; }); S.lyrics._secFor=null; renderLyrics(); buildPlan(); note=` Shifted ${d>0?"later":"earlier"} by ${Math.abs(d).toFixed(1)} s to match this recording.`; } }
    status(`${pick.syncedLyrics?"Synced":"Unsynced"} lyrics found for “${pick.trackName||title}”${pick.artistName||artist?` by ${pick.artistName||artist}`:""}.${note}${pick.syncedLyrics?"":" Use Time by tapping for exact timing."}`); crumb("lyrics found ("+how+")"); return true; }
  catch(e){ if(auto) return false;
    const url="https://lrclib.net/search/"+encodeURIComponent([artist,title].filter(Boolean).join(" "));
    const a=document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove();
    $("lyricsInfo").textContent=`LRCLIB opened in a new tab, searched for “${[artist,title].filter(Boolean).join(" – ")}”. Pick the right version, download its .lrc file, then come back and press Add a lyrics file.`; return false; } }
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
