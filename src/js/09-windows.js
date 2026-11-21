/* ---------------- Windows: which part of the song each export uses ---------------- */
function windowFor(ep){
  const D=S.an.duration; let L=Math.min(D,ep.max);
  const sl=$("shortLen").value;
  if(ep.short){ if(sl==="rec" && ep.rec) L=Math.min(L,ep.rec); else if(+sl>0) L=Math.min(L,+sl); }
  if(L>=D-0.05){ if(!ep.short&&$("endStyle")&&$("endStyle").checked&&S.audioBuf){ const e=songEndPoint(); if(e>D*0.5) return [0,Math.min(D,e)]; } return [0,D]; }
  if(ep.short&&S.an._shortAt!=null){ /* you picked the section a Short starts with: from its bar line, at the Short's length */
    const B=S.an.beats; let st=S.an._shortAt, bd=null, bb=null; for(let i=0;i<B.length;i++){ const d=Math.abs(B[i]-st); if(isDownAt(S.an,i)&&d<0.6&&(!bd||d<bd.d)) bd={d,t:B[i]}; if(!bb||d<bb.d) bb={d,t:B[i]}; } st=bd&&bd.d<0.12?bd.t:bb&&bb.d<0.25?bb.t:st; /* the section starts where it was heard to start: on its beat (a bar line if one is right there) */
    st=Math.max(0,Math.min(st,D-L)); S._hookWhy="the section you chose"; let end=Math.min(D,st+L);
    for(let i=B.length-1;i>=0;i--){ if(B[i]<=st+L+0.01&&isDownAt(S.an,i)){ if(B[i]-st>=L*0.6) end=B[i]; break; } } return [st,end]; }
  const B=S.an.beats, E=S.an.E; let best=0, bs=-1; const cands=[];
  // hooks: where a scrolling viewer recognises the song in the first second
  const hooks=[]; if(ep.short){ try{ const L0=S.lyrics; if(L0&&L0.exact!==false){ lyricSections().forEach(sec=>{ const ln=L0.lines.find(l=>l.t>=sec.t0-0.05); if(ln) hooks.push({t:ln.t,k:sec.chorus?1:0.2,why:sec.chorus?`the chorus: “${ln.text}”`:`a new section: “${ln.text}”`}); }); }
    if(!hooks.length){ const AS=songSections(); const nC=AS.filter(s=>s.chorus).length; AS.forEach(s=>{ if(s.chorus) hooks.push({t:s.t0,k:nC>=2?0.9:0.5,why:`the ${s.label.replace(/ \d+$/,"")} (heard in the music)`}); else if(s.kind!=="intro") hooks.push({t:s.t0,k:0.15,why:`the start of the ${s.label.replace(/ \d+$/,"")}`}); }); }
    const M=songMarks(); M.drops.forEach(t=>hooks.push({t,k:0.35,why:"the drop"})); M.entries.forEach(t=>hooks.push({t,k:0.2,why:"a section entry"})); }catch(e){} }
  const hookAt=st=>{ let b=null; for(const x of hooks){ const d=x.t-st; if(d>=-0.15&&d<=1.2){ const k=x.k*(1-Math.max(0,d-0.35)/1.2); if(!b||k>b.k) b={k,why:x.why}; } } return b; }; // a downbeat on, or just before, the hook (vocals often come in on a pickup)
  for(let i=0;i<B.length;i++){
    if(!isDownAt(S.an,i)) continue;
    const st=B[i]; if(st+L>D) break;
    let s=0,k=0,h=0,hk=0,h4=0,k4=0;
    for(let j=i;j<B.length && B[j]<st+L;j++){ s+=E[j]; k++; if(j<i+8){ h+=E[j]; hk++; } if(j<i+4){ h4+=E[j]; k4++; } }
    // the first 1 to 3 seconds decide whether people keep watching, so the opening beats weigh most
    const hk2=hooks.length?hookAt(st):null;
    const sc=s/k+(PRO()?1.0*(h4/(k4||1))+0.4*(h/(hk||1)):0.6*(h/(hk||1)))+(hk2?hk2.k:0);
    cands.push([sc,st,hk2]); if(sc>bs){ bs=sc; best=st; }
  }
  // each short platform gets its own strong section when the song has several (more original, and each upload is different)
  const shortIdx=ep.short?Math.max(0,S.eps.map(EP).filter(e=>e&&e.short&&e.id!=="igfeed"&&e.id!=="linkedin"&&e.id!=="square").findIndex(e=>e.id===ep.id)):0;
  const pickN=(S.winPick||0)+shortIdx;
  if(pickN){ cands.sort((a,b)=>b[0]-a[0]); const picks=[];
    for(const [sc,st] of cands){ if(sc<bs*0.85) break; if(picks.every(p=>Math.abs(p-st)>=L*0.9)) picks.push(st); }
    best=picks[pickN%picks.length]; }
  if(ep.short){ const c=cands.find(x=>x[1]===best); S._hookWhy=c&&c[2]?c[2].why:null; }
  let end=Math.min(D,best+L);
  if(PRO()||ep.short) for(let i=B.length-1;i>=0;i--){ if(B[i]<=best+L+0.01 && isDownAt(S.an,i)){ if(B[i]-best>=L*0.6) end=B[i]; break; } } // end on a bar line so the loop lands on the beat
  return [best, end];
}

