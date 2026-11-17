/* ---------------- Exact lyric timing ----------------
   1. Synced lyrics from LRCLIB (fetched where the page may reach it; otherwise one tap opens LRCLIB's search for this song).
   2. Tap to time: the song plays and you tap as each line starts. Exact to your timing; missed lines are re-spread between taps.
   3. Nudge: shift every line earlier or later. */
function lySong(){ const m=S.meta||{}; return {title:(m.title?cleanTagTitle(m.title):cleanSongName(S.audioName||"")).trim(), artist:($("artistName").value.trim()||m.artist||"").trim()}; }
$("lyFind").onclick=async()=>{ const {title,artist}=lySong(); if(!title){ status("Add a song first.",true); return; }
  const b=$("lyFind"); b.disabled=true; b.textContent="Looking…";
  try{ const q=new URLSearchParams({track_name:title,artist_name:artist}); if(S.an) q.set("duration",String(Math.round(S.an.duration)));
    const r=await Promise.race([fetch("https://lrclib.net/api/get?"+q),new Promise((_,j)=>setTimeout(()=>j(new Error("timeout")),6000))]);
    if(!r.ok) throw new Error("not found"); const j=await r.json();
    if(j&&j.syncedLyrics){ setLyrics(j.syncedLyrics,"lrclib"); status(`Synced lyrics found for “${title}”${artist?` by ${artist}`:""}.`); }
    else if(j&&j.plainLyrics){ setLyrics(j.plainLyrics,"lrclib"); status("Only unsynced lyrics were found: use Time by tapping for exact timing."); }
    else throw new Error("not found"); }
  catch(e){ // inside claude.ai the page can't reach LRCLIB, so open its search for this song instead
    const url="https://lrclib.net/search/"+encodeURIComponent([artist,title].filter(Boolean).join(" "));
    const a=document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove();
    $("lyricsInfo").textContent=`LRCLIB opened in a new tab, searched for “${[artist,title].filter(Boolean).join(" – ")}”. Pick the right version, download its .lrc file, then come back and press Add a lyrics file.`; }
  finally{ b.disabled=false; b.textContent="Find synced lyrics"; } };
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
