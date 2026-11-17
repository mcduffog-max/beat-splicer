/* ---------------- Your own look: a grade built from this footage and this song ----------------
   Instead of a preset everyone uses, the look leans into what is already in the footage and the music:
     shadows and highlights  the colour your darkest moments already lean towards tints the shadows, the colour of your
                             brightest moments tints the highlights (a split-tone no other library would produce)
     contrast and colour     a loud, bright-sounding song gets more contrast and colour; a soft, dark-sounding one gets
                             lifted blacks and gentler colour
     the director's note     "cold", "golden", "night" and the like push it further
   Every video gets a grade of its own, and the same footage with a different song looks different. */
function ownLook(){ const note=typeof notePhases==="function"?noteText():"", key=`${S.clips.length}|${S.an?S.an.duration.toFixed(1):0}|${note}`; if(S._ownLook&&S._ownLook.key===key) return S._ownLook.look;
  const sm=[]; S.clips.forEach((c,ci)=>{ if(!c.samples||c.off||isExcluded(ci)) return; c.samples.forEach(s=>{ if(s.col&&!s.dark) sm.push(s); }); });
  const look={f:"none", over:[], own:true};
  if(sm.length>=6&&S.an){ const L=s=>0.299*s.col[0]+0.587*s.col[1]+0.114*s.col[2]; sm.sort((a,b)=>L(a)-L(b)); const k=Math.max(2,Math.floor(sm.length*0.3));
    const mean=a=>[0,1,2].map(j=>a.reduce((x,s)=>x+s.col[j],0)/a.length), chroma=c=>{ const m=(c[0]+c[1]+c[2])/3; return c.map(v=>v-m); };
    const sh=chroma(mean(sm.slice(0,k))), hi=chroma(mean(sm.slice(-k))), E=S.an.E, e=E.reduce((a,b)=>a+b,0)/E.length, bright=Math.max(0,Math.min(1,((S.an.centroid||2000)-1200)/2600));
    const a=noteAttrs?noteAttrs(note):{}; const warm=(a.w||0)*18;
    const tint=(c,base,amp)=>{ const n=Math.hypot(...c)||1, g=Math.min(1,n/22); return c.map((v,j)=>Math.round(Math.max(0,Math.min(255,base+v/n*amp*g+(j===0?warm:j===2?-warm:0))))); }; // a weak cast stays weak
    const s=tint(sh,60,50), h=tint(hi,200,45), con=+(1+0.06+0.12*e+0.05*bright-(a.b!=null&&a.b<0.35?0:0)).toFixed(3), sat=+(0.92+0.22*e+(a.b!=null&&a.b<0.3?-0.12:0)).toFixed(3), br=+(a.b!=null?0.94+0.12*a.b:1).toFixed(3);
    look.f=`contrast(${con}) saturate(${sat}) brightness(${br})`;
    look.over=[["multiply",`rgba(${s.join(",")},${(0.12+0.08*(1-e)).toFixed(3)})`],["screen",`rgba(${h.join(",")},${(0.05+0.05*bright).toFixed(3)})`]];
    look.desc={shadow:s, high:h, con, sat}; }
  S._ownLook={key,look}; return look; }
function ownLookWords(){ const L=ownLook(); if(!L.desc) return "natural"; const name=c=>{ const [r,g,b]=c, m=Math.max(r,g,b); return m-Math.min(r,g,b)<14?"neutral":r===m?(g>b+10?"amber":"red"):g===m?(b>r?"teal":"green"):(r>g?"violet":"blue"); };
  return `${name(L.desc.shadow)} shadows, ${name(L.desc.high)} highlights, ${L.desc.con>1.14?"punchy":"gentle"} contrast`; }
