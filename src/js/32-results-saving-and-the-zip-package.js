/* ---------------- Results, saving and the ZIP package ---------------- */
const JUNK=/\b(final|master(ed)?|remaster(ed)?|mixdown|mix|bounce|export(ed)?|render|copy|edit|untitled|new|track|audio|recording|wav|mp3|m4a|stereo|demo|take\s*\d*|ver(sion)?\s*\d*|v\d+|\d{2,3}k(bps)?|\d+bpm)\b/gi;
function safeName(s,max=70){ return String(s||"").replace(/[\u0000-\u001f<>:"/\\|?*\u007f]+/g," ").replace(/[.\s]+$/,"").replace(/^\.+/,"").replace(/\s{2,}/g," ").trim().slice(0,max).trim(); }
function titleCase(s){ const small=/^(a|an|and|at|but|by|for|in|of|on|or|the|to|with)$/i;
  return s.toLowerCase().split(" ").map((w,i)=>i&&small.test(w)?w:w.charAt(0).toUpperCase()+w.slice(1)).join(" "); }
