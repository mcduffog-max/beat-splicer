/* ---------------- Minimum footage per kind of video ---------------- */
function needFor(ep){ const w=windowFor(ep), len=w[1]-w[0];
  return ep.short ? {min:Math.max(4,Math.ceil(len/6)), rec:Math.max(6,Math.ceil(len/3)), footMin:len*0.8, len}
                  : {min:Math.max(6,Math.ceil(len/15)), rec:Math.max(10,Math.ceil(len/10)), footMin:len*0.5, len}; }
function library(){ const ok=S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)); return {items:ok.length, videos:ok.filter(c=>c.kind!=="image").length, photos:ok.filter(c=>c.kind==="image").length,
  footage:ok.reduce((a,c)=>a+(c.kind==="image"?3:c.dur),0)}; }
function gateProblems(){ const L=library(), out=[];
  for(const ep of S.eps.map(EP).filter(Boolean)){ const n=needFor(ep);
    if(L.items<n.min) out.push(`${ep.name} needs at least ${n.min} clips or photos for ${lenTag(n.len)} (you have ${L.items}).`);
    else if(L.footage<n.footMin) out.push(`${ep.name} needs at least ${Math.ceil(n.footMin)} s of footage in total (you have ${Math.floor(L.footage)} s; photos count as 3 s).`); }
  return out; }

