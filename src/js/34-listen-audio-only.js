/* ---------------- Listen (audio only) ---------------- */
let LISTEN=null;
function stopListen(){ if(!LISTEN) return; try{ LISTEN.src.stop(); }catch(e){} LISTEN.actx.close(); LISTEN=null; LIVE=null; $("listen").textContent="Listen"; }
$("listen").onclick=async()=>{
  if(LISTEN){ stopListen(); return; }
  if(!S.audioBuf || S.running) return;
  const actx=new (window.AudioContext||window.webkitAudioContext)(); await actx.resume();
  const src=actx.createBufferSource(); src.buffer=S.audioBuf;
  const nodes=buildChain(actx,{win:[0,S.an.duration],t0:actx.currentTime,plan:S.plan,src}); src.connect(nodes.entry); const lg=actx.createGain(); lg.gain.value=loudnessGain(EP("youtube")); const lim=limiter(actx); nodes.master.connect(lg); lg.connect(lim); lim.connect(actx.destination);
  src.onended=()=>{ if(LISTEN && LISTEN.src===src) stopListen(); };
  src.start(); LISTEN={actx,src}; LIVE=nodes; $("listen").textContent="Stop listening";
};

