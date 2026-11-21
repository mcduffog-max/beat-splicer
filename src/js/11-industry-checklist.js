/* ---------------- Industry checklist ---------------- */
function evalExport(ep){
  const win=windowFor(ep), len=win[1]-win[0], plan=PRO()?makeExportPlan(ep,win):S.plan.filter(s=>s.end>win[0]&&s.start<win[1]);
  const lens=plan.map(s=>Math.min(s.end,win[1])-Math.max(s.start,win[0])), asl=len/plan.length;
  const bodyLens=plan.filter(s=>ep.short||s.end<=win[1]-20||len<25).map(s=>Math.min(s.end,win[1])-Math.max(s.start,win[0]));
  const longest=Math.max(...(bodyLens.length?bodyLens:lens));
  const B=S.an.beats, E=S.an.E, bi0=B.findIndex(b=>b>=win[0]-0.01); const open4=E.slice(bi0,bi0+4); const openE=open4.reduce((a,b)=>a+b,0)/(open4.length||1);
  const F=readFx(), it=[], ok=(c,t)=>it.push({k:c?"ok":"warn",t}), info=t=>it.push({k:"info",t}), must=(c,t)=>it.push({k:c?"ok":"fail",t});
  const TT=titleFor(ep), HK=TT.hook;
  { const n=needFor(ep), L=library();
    must(L.items>=n.min && L.footage>=n.footMin, L.items>=n.min && L.footage>=n.footMin ? `${L.items} clips and photos (minimum ${n.min}, ideally ${n.rec}).`
      : L.items<n.min ? `Needs at least ${n.min} clips or photos; you have ${L.items}. Export is blocked until you add more.` : `Needs ${Math.ceil(n.footMin)} s of footage in total; you have ${Math.floor(L.footage)} s.`);
    if(L.items>=n.min && L.items<n.rec) info(`Adding ${n.rec-L.items} more would give each shot fresh footage.`); }
  { const dc=dcut();
    if(dc){ let tw=0,tt=0; plan.forEach(s=>{ const d=Math.min(s.end,win[1])-Math.max(s.start,win[0]); tw+=d; tt+=d*dc[secOf(s.e)]; }); const tgt=tt/(tw||1);
      const close=ep.short ? true : Math.abs(asl-tgt)/tgt<0.45;
      if(ep.short && tgt>3) info(`Cutting follows ${S.direct}: ${dc.how}. Platform rules cap shots at 3 s here, so the long takes are shortened.`);
      else ok(close,`Cutting follows ${S.direct}: ${dc.how}, about ${asl.toFixed(1)} s per shot (aim ${tgt.toFixed(1)} s).`); } }
  if(ep.muted) ok(!!HK, HK?"Opening text set, which matters here because this feed autoplays muted.":"This feed autoplays muted. Add opening text so the video makes sense without sound.");
  let repeats=0; plan.forEach((s,i)=>{ if(s._loop||s._pattern) return; const a=s.src, b=s.src+(s.end-s.start);
    for(let j=0;j<i;j++){ const p=plan[j]; if(p.clip!==s.clip || s.start-p.end>=20) continue; const c=p.src, d=p.src+(p.end-p.start);
      if(S.clips[s.clip].kind==="image" || (a<d-0.2 && c<b-0.2)){ repeats++; break; } } });
  const uniq=new Set(plan.map(s=>s.clip)).size, perMin=uniq/(len/60);
  if(ep.short){
    ok(!ep.rec || len<=ep.rec*1.5, `${lenTag(len)} long (recommended for ${ep.name}: about ${ep.rec||60} s).`);
    ok(openE>=0.55, openE>=0.55?"Opens on the strongest part of the song.":"The song has no clear peak to open on. Try Best 15 seconds or a more energetic track.");
    ok(lens[0]<=1.6, `First cut at ${lens[0].toFixed(1)} s, inside the 3-second hook window.`);
    if(HK){ const w=wordCount(HK), used=titleHistory().map(x=>x.t), sim=used.length?Math.max(...used.map(u=>tSim(HK,u))):0;
      ok(w<=6 && !isCliche(HK), `Opening text “${HK}”: ${w} words, fully on screen from the first frame for ${hookDur(HK).toFixed(1)} s, top third of the safe zone.${w>6?" Shorten it to read at a glance.":""}${isCliche(HK)?" It’s an overused phrase; write something specific.":""}`);
      ok(sim<0.5, sim<0.5?"Opening text is new: nothing close to it in your earlier titles.":"Opening text is close to one you’ve used before. Press Write new titles.");
      if(!TT.manual && $("payoffOn").checked && TT.payoff) info(dropTime(win)>0?`“${TT.payoff}” lands on the biggest hit at ${lenTag(dropTime(win)-win[0])}.`:"No clear drop in this section, so the payoff word is skipped.");
    } else if(!TT.manual && S.titles[ep.id] && S.titles[ep.id].hook==="") info("No opening text, by choice. The first shot has to do all the work: open on movement and a face.");
    else ok(false,"Add opening text under Look. Many people scroll with the sound off, so text carries the hook.");
    ok(longest<=3.1, `Longest shot ${longest.toFixed(1)} s (fresh image at least every 3 s keeps attention).`);
    if(PRO()){ ok(true,"Ends on a bar line and runs straight back into the opening shot, so replays feel seamless. Every replay counts as a view on Shorts, Reels and TikTok.");
      ok(true,"No fade from black, no logo intro and no end card, which would break the loop. Put calls to action in the caption."); }
    ok(true,`Text, logos and watermark kept clear of the bottom ${Math.round(ep.safe.b*100)}% and the button column.`);
  } else {
    const firstBig=B.findIndex((b,i)=>b>=win[0] && E[i]>0.6), tBig=firstBig>=0?B[firstBig]-win[0]:len;
    if(tBig>8) info(`The song’s first big moment is at ${lenTag(tBig)}. About half of viewers can leave by 30 s, so the opening uses your strongest shots and quick cuts to carry the intro.`);
    else ok(true,`The song gets going within ${lenTag(Math.max(1,tBig))}.`);
    const cuts5=plan.filter(s=>s.start>win[0]+0.01 && s.start<win[0]+5).length;
    ok(cuts5>=1, cuts5>=1?`${cuts5} cut${cuts5===1?"":"s"} in the first 5 s.`:"No cut in the first 5 s. Raise Cut pace or turn on industry rules.");
    const aslMax=dcut()?Math.max(3.5,dcut().m*1.6):CALM_DIRECTORS.includes(S.direct)?6:3.5;
    ok(asl>=(dcut()?0.25:1.2) && asl<=aslMax, `Average shot ${asl.toFixed(1)} s (music videos typically run about 2 s, longer in calm styles).`);
    ok(longest<=(CALM_DIRECTORS.includes(S.direct)?10.1:6.1), `Longest shot before the ending ${longest.toFixed(1)} s.`);
    ok(repeats<=Math.max(1,plan.length*0.05), repeats?`${repeats} moment${repeats===1?"":"s"} of the same footage shown twice within 20 s. More clips would remove these.`:"No footage repeats within 20 s.");
    ok(perMin>=4, perMin>=4?`${uniq} different clips, about ${perMin.toFixed(0)} per minute.`:`Only ${uniq} clips for ${lenTag(len)}. Around ${Math.ceil(len/60*6)-uniq} more would give a fresh look throughout.`);
    if(ep.id==="youtube") ok(len>=25, len>=25?(S._endAtFull?"The song ends at full tilt, so the edit keeps its pace and only the final shot holds for YouTube end-screen buttons.":"Last 20 s kept calm with longer shots and a darker backdrop for YouTube end-screen buttons."):"Under 25 s, so YouTube won’t allow end screens.");
    if(ep.id==="youtube" && PRO()) ok(true,"A 1280×720 thumbnail is included with the export.");
  }
  { const pr=paceReport(plan,win);
    const evar=pr?Math.sqrt(pr.rows.reduce((a,x)=>a+(x.e-pr.rows.reduce((s,y)=>s+y.e,0)/pr.rows.length)**2,0)/pr.rows.length):0;
    if(pr && !dcut() && (evar<0.1 || ep.short)){ const rates=pr.rows.map(x=>x.rate), m=rates.reduce((a,b)=>a+b,0)/rates.length, cv=Math.sqrt(rates.reduce((a,b)=>a+(b-m)**2,0)/rates.length)/(m||1);
      ok(cv<0.6, cv<0.6?"The energy stays level in this section, and so does the pace: steady cuts with no lulls.":"The energy stays level here but the cutting speed jumps around. Try a lower Variety setting."); }
    else if(pr && !dcut()){
      ok(pr.r>=0.5, `Pace follows the music (match ${Math.round(Math.max(0,pr.r)*100)}%): cuts and movement rise and fall with the song’s energy.${pr.r<0.5?" Try Beat and energy matching, or more varied footage.":""}`);
      if(pr.quiet&&pr.loud) ok(pr.quiet/pr.loud>=1.8, `Quiet parts breathe, loud parts drive: about ${pr.quiet.toFixed(1)} s a shot when it’s calm and ${pr.loud.toFixed(1)} s at full energy.`);
      if(pr.drops) ok(pr.accelOk===pr.accel, `${pr.drops} drop${pr.drops===1?"":"s"} found; ${pr.accel?`${pr.accelOk} of ${pr.accel} build-ups speed up into the drop with a cut right on it`:"each gets a cut right on the beat"}.`);
      ok(pr.deadRun<=4, pr.deadRun<=4?"No static stretches in the energetic parts: still shots there get a slow push-in.":`${pr.deadRun.toFixed(1)} s of static footage in an energetic part. Add livelier clips.`);
    } }
  if(storyOn()){
    if(!hasTags()) info("Press “Read my footage with AI” under Story and pace so the story can follow shot sizes and faces. Until then it follows energy and filming order.");
    else {
      const sc=s=>{ const tg=tagAt(S.clips[s.clip],s.src); return tg?tg.scale+(s._focus?Math.log2(s._focus.z1)*2:0):null; };
      const first=plan.find(s=>s.end>win[0]), last=plan[plan.length-1], f0=first&&sc(first), fl=sc(last);
      if(!ep.short && f0!=null) ok(f0<=2.2, f0<=2.2?"Opens by setting the scene with a wide shot.":"Opens tight. A wider establishing shot first would set the scene.");
      if(ep.short && first){ const tg=tagAt(S.clips[first.clip],first.src); ok(!!(tg&&tg.faces), tg&&tg.faces?"Opens on a face: people stop scrolling for faces.":"No face in the opening shot. A face in the first second holds attention best."); }
      let rising=0, builds=0; for(let i=1;i<plan.length;i++){ if(plan[i].build && plan[i-1].build){ builds++; const a=sc(plan[i-1]), b=sc(plan[i]); if(a!=null&&b!=null&&b>=a-0.2) rising++; } }
      if(builds) ok(rising/builds>=0.6, `Shots tighten through the build-ups (${rising} of ${builds} steps push in).`);
      const peaks=plan.filter(s=>s.drop||s._beat==="climax"); const tightPeaks=peaks.filter(s=>{ const v=sc(s); return v!=null&&v>=3.5; }).length;
      if(peaks.length) ok(tightPeaks/peaks.length>=0.5, `${tightPeaks} of ${peaks.length} peak moments land on a close-up or the eyes.`);
      const hero=protagonist(); if(hero){ const secs=new Set(plan.map(s=>Math.floor((s.start-win[0])/20))), seen=new Set(); plan.forEach(s=>{ const tg=tagAt(S.clips[s.clip],s.src); if(tg&&isHeroTag(tg,hero)) seen.add(Math.floor((s.start-win[0])/20)); });
        ok(seen.size/secs.size>=0.5, `The main subject (“${hero}”) appears through ${Math.round(seen.size/secs.size*100)}% of the video, so the story connects.`); }
      if(!ep.short && fl!=null) ok(fl<=2.5 || last._bookend, last._bookend?"Ends where it began: the opening scene returns to close the story.":fl<=2.5?"Ends by pulling back wide to resolve.":"Ends tight. Pulling back wide would resolve the story.");
      const framed=plan.filter(s=>s._focus).length; if(framed) info(`${framed} shots are framed on a face${ep.h>ep.w?", keeping faces in the vertical crop":""}.`);
    } }
  if(!ep.short && !TT.manual) ok(!!TT.card, TT.card?`Title card “${TT.card}${TT.sub?" / "+TT.sub:""}” in the lower third from 1 s to 6 s.`:"Add a title card under Look.");
  if(TT.title) ok(TT.title.length<=TITLE_LIMIT(ep), `Upload title, ${TT.title.length} characters${TT.title.length>TITLE_LIMIT(ep)?`; trim to under ${TITLE_LIMIT(ep)} so it isn’t cut off`:""}: “${TT.title}”`);
  { const nC=S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)).length, dur=new Map(); plan.forEach(s=>{ const d=Math.min(s.end,win[1])-Math.max(s.start,win[0]); if(d>0) dur.set(s.clip,(dur.get(s.clip)||0)+d); });
    const top=[...dur.entries()].sort((a,b)=>b[1]-a[1])[0], share=top?top[1]/len:0, fair=1/Math.max(1,Math.min(nC,plan.length));
    if(nC>=3 && top) ok(share<=Math.max(2*fair,0.2), share<=Math.max(2*fair,0.2)?`Good variety: ${dur.size} of your ${nC} clips used, none on screen for more than ${Math.round(share*100)}% of the video.`:`“${S.clips[top[0]].name}” is on screen for ${Math.round(share*100)}% of the video. Press Remix, or add more clips like it.`); }
  { const ms=movingShare(plan,win), target=ep.short?0.6:0.4, moves=plan.filter(s=>s._move).length;
    const allStill=S.clips.filter((c,ci)=>c.samples&&!c.off&&!isExcluded(ci)).every(c=>c.kind==="image"||!c.samples.some(x=>(x.motion||0)>=2));
    if(allStill) ok(false,`Every clip is a still image or static video. Each shot gets camera moves and a punch on the beat, but real motion holds viewers far better: turn your best images into short AI video clips (image-to-video), or mix in filmed footage.`);
    else ok(ms>=target, ms>=target?`Real movement: ${Math.round(ms*100)}% of the video shows footage that’s moving${moves?`, and ${moves} still shot${moves===1?"":"s"} get a camera move`:""}.`
      :`Only ${Math.round(ms*100)}% of the video shows moving footage (aim for ${Math.round(target*100)}%+). Add clips with motion: walking, dancing, driving, panning shots.`); }
  if(HK){ const iss=hookIssues(HK); ok(!iss.length, iss.length?`Opening text “${HK}” ${iss.join(" and ")}. Press Write new titles, or edit it.`:"Opening text reads naturally and is about what’s on screen."); }
  if(ep.id==="youtube"||ep.id==="shorts"){
    const T2=titleFor(ep), d=T2.desc||"", nTags=(d.match(/#[\p{L}\p{N}_]+/gu)||[]).length;
    ok(!!d && (d.split("\n")[0]||"").length<=150, d?"Description starts with a plain sentence about what the video shows (indexed for search and suggestions).":"Add a description: Write new titles fills it in.");
    if(ep.short) ok(/#shorts/i.test(d) && nTags>=2 && nTags<=5, `Hashtags: #Shorts plus ${Math.max(0,nTags-1)} topic tag${nTags-1===1?"":"s"} in the description, not the title.`);
    ok(!!(T2.tags&&T2.tags.length>=5), T2.tags&&T2.tags.length>=5?`${T2.tags.length} search tags ready to paste.`:"Add search tags (Write new titles fills them in).");
    ok(!!(T2.pin&&/\?/.test(T2.pin)), "A question to pin as the first comment, to start replies.");
    if($("aiImagery").checked) info("Answer YES to “Altered or synthetic content” when uploading. The description already says so.");
  }
  ok(true,`Loudness set to ${ep.lufs} LUFS from the finished mix.`);
  return {ep,len,items:it};
}
