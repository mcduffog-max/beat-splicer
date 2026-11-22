/* ---------------- Audio chain: EQ → 3D space → fades ---------------- */
/* landmarks the effects follow: drops, big entries (a chorus arriving), and the ends of loud sections */
function songMarks(){ const an=S.an; if(!an) return {drops:[],entries:[],secEnds:[]}; if(an._marks) return an._marks;
  const B=an.beats, E=an.E, drops=[], entries=[], secEnds=[]; let lastD=-99, lastE=-99;
  if(!(an.feel&&an.feel.free)){
    for(let i=8;i<B.length;i++){ if(!isDownAt(an,i)) continue; let m=0; for(let k=i-8;k<i;k++) m+=E[k]; m/=8; if(E[i]>=0.6&&E[i]-m>=0.25&&i-lastD>=16){ drops.push(B[i]); lastD=i; } }
    for(let i=4;i<B.length;i++){ if(!isDownAt(an,i)) continue; let lo=1; for(let k=Math.max(0,i-24);k<i;k++) lo=Math.min(lo,E[k]); if(E[i]>=0.65&&E[i]-lo>=0.15&&B[i]-lastE>=10){ entries.push(B[i]); lastE=B[i]; } }
    for(let i=8;i+8<B.length;i++){ if(!isDownAt(an,i)) continue; let a=0,b=0; for(let k=i-8;k<i;k++) a+=E[k]; for(let k=i;k<i+8;k++) b+=E[k]; a/=8; b/=8; if(a>=0.55&&a-b>=0.22&&(!secEnds.length||B[i]-secEnds[secEnds.length-1]>=12)) secEnds.push(B[i]); } }
  /* songs without EDM-style drops (rock, pop) use their biggest arrivals instead, spaced out */
  let hits=drops.slice(); if(!hits.length){ const sc=x=>{ const i=B.findIndex(b=>b>=x-1e-3); return i<0?0:E[i]; }; for(const x of entries.slice().sort((p,q)=>sc(q)-sc(p))) if(hits.every(y=>Math.abs(y-x)>=24)) hits.push(x); hits.sort((p,q)=>p-q); }
  an._marks={drops:hits,realDrops:drops,entries,secEnds}; return an._marks; }
function satCurve(k){ const n=1024, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(k*x)/Math.tanh(k); } return c; }
function svfSweep(n,sr,f0,f1,q,env,seed){ const out=new Float32Array(n); let low=0,band=0,s=seed||1; const rnd=()=>{ s=(s*16807)%2147483647; return s/1073741823.5-1; };
  for(let i=0;i<n;i++){ const u=i/n, fc=f0*Math.pow(f1/f0,u), f=2*Math.sin(Math.PI*Math.min(fc,sr*0.2)/sr); const x=rnd(); low+=f*band; const high=x-low-q*band; band+=f*high; out[i]=band*env(u); } return out; }
function sfxBuf(kind,sr,len){ S._sfx=S._sfx||new Map(); const key=kind+sr+(len||0); if(S._sfx.has(key)) return S._sfx.get(key);
  let L,R;
  if(kind==="whoosh"){ const n=Math.round(0.45*sr); const m=svfSweep(n,sr,450,5200,0.55,u=>u<0.66?Math.pow(u/0.66,2):Math.exp(-(u-0.66)*14),7); L=new Float32Array(n); R=new Float32Array(n); for(let i=0;i<n;i++){ const th=(0.15+0.7*i/n)*Math.PI/2; L[i]=m[i]*Math.cos(th)*1.6; R[i]=m[i]*Math.sin(th)*1.6; } }
  else if(kind==="impact"){ const n=Math.round(1.4*sr); L=new Float32Array(n); let ph=0, lp=0, s=3; for(let i=0;i<n;i++){ const t=i/sr, f=38+62*Math.exp(-t*9); ph+=2*Math.PI*f/sr; s=(s*16807)%2147483647; const nz=s/1073741823.5-1; lp+=0.25*(nz-lp);
      L[i]=Math.tanh(1.5*(Math.sin(ph)*Math.exp(-t*2.8)+lp*0.9*Math.exp(-t*38))); } R=L; }
  else { const n=Math.round((len||3)*sr); const m=svfSweep(n,sr,250,7000,0.5,u=>Math.pow(u,2.2)*(u>0.985?(1-u)/0.015:1),11); L=m; R=new Float32Array(n); for(let i=0;i<n;i++) R[i]=m[n-1-i<0?0:i]*0.9; }
  const b=new AudioBuffer({length:L.length,numberOfChannels:2,sampleRate:sr}); b.copyToChannel(L,0); b.copyToChannel(R,1); S._sfx.set(key,b); return b; }
function crackleBuf(sr,lofi){ const n=sr*4, b=new AudioBuffer({length:n,numberOfChannels:2,sampleRate:sr}); let s=5;
  for(let c=0;c<2;c++){ const d=b.getChannelData(c); let lp=0; for(let i=0;i<n;i++){ s=(s*16807)%2147483647; const x=s/1073741823.5-1; lp+=0.08*(x-lp); d[i]=lp*(lofi?0.25:0.12); }
    const pops=Math.round((lofi?9:1.5)*4); for(let k=0;k<pops;k++){ s=(s*16807)%2147483647; const at=s%n, a=0.25+0.6*((s>>8)%1000)/1000; for(let j=0;j<sr*0.002&&at+j<n;j++) d[at+j]+=a*Math.exp(-j/(sr*0.0004))*(j%2?-1:1); } }
  return b; }
const WHOOSH_T=new Set(["whip","zoomthru","spin","mask","zoom","zoomout","flash"]);
function buildSongFx(actx,input,o){
  const win=o.win||[0,S.an?S.an.duration:0], t0=o.t0||0, T=x=>t0+(x-win[0]), inWin=x=>x>=win[0]-1e-6&&x<=win[1]+1e-6, now=actx.currentTime, ok=x=>inWin(x)&&T(x)>=now-0.005;
  const L=S.an?60/S.an.bpm:0.5, M=S.an?songMarks():{drops:[],entries:[],secEnds:[]}, top=Math.min(20000,actx.sampleRate*0.45), sum=actx.createGain();
  const bq=(type,f,q)=>{ const b=actx.createBiquadFilter(); b.type=type; b.frequency.value=f; if(q!=null) b.Q.value=q; return b; };
  let n=input;
  const tex=$("audTexture").value;
  if(tex!=="none"){ const lo=tex==="lofi", hp=bq("highpass",lo?140:40), lp=bq("lowpass",lo?4200:9500), sh=actx.createWaveShaper(); sh.curve=satCurve(lo?2.2:1.4); sh.oversample="2x";
    const dl=actx.createDelay(0.05); dl.delayTime.value=0.006; const lfo=actx.createOscillator(); lfo.frequency.value=lo?0.55:0.35; const lg=actx.createGain(); lg.gain.value=lo?0.0016:0.0007; lfo.connect(lg); lg.connect(dl.delayTime);
    const st=Math.max(now,T(win[0])); lfo.start(st); lfo.stop(T(win[1])+0.1);
    n.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(dl); n=dl;
    const ns=actx.createBufferSource(); ns.buffer=crackleBuf(actx.sampleRate,lo); ns.loop=true; const ng=actx.createGain(); ng.gain.value=lo?0.035:0.012; ns.connect(ng); ng.connect(sum); ns.start(st); ns.stop(T(win[1])+0.1); }
  const lp=bq("lowpass",top,0.7); n.connect(lp); n=lp;
  if($("audFilterDrop").checked) for(const d of M.drops){ const a=d-2*L; if(!ok(a)||!inWin(d)) continue; lp.frequency.setValueAtTime(top,T(a)); lp.frequency.exponentialRampToValueAtTime(420,T(a+0.3*L)); lp.frequency.setValueAtTime(420,T(d)-0.003); lp.frequency.setValueAtTime(top,T(d)); }
  if($("audRadio").checked){ const op=radioOpen(win,o.ep); if(op&&ok(op)){ const dry=actx.createGain(), wet=actx.createGain(), hp=bq("highpass",500,0.7), lr=bq("lowpass",3200,0.9), sh=actx.createWaveShaper(); sh.curve=satCurve(2.5); const pad=actx.createGain(); pad.gain.value=0.35;
      const mix=actx.createGain(); n.connect(dry); n.connect(hp); hp.connect(lr); lr.connect(pad); pad.connect(sh); sh.connect(wet); dry.connect(mix); wet.connect(mix);
      const st=Math.max(now,T(win[0])); dry.gain.setValueAtTime(0,st); wet.gain.setValueAtTime(0.55,st); dry.gain.setValueAtTime(0,T(op)-0.03); dry.gain.linearRampToValueAtTime(1,T(op)); wet.gain.setValueAtTime(0.55,T(op)-0.03); wet.gain.linearRampToValueAtTime(0,T(op)); n=mix; } }
  if($("audEcho").checked&&M.secEnds.some(e=>ok(e-L))){ const send=actx.createGain(); send.gain.value=0; const dl=actx.createDelay(2); dl.delayTime.value=Math.min(1.9,0.75*L); const fb=actx.createGain(); fb.gain.value=0.42; const le=bq("lowpass",3200); const ret=actx.createGain(); ret.gain.value=0.6;
    n.connect(send); send.connect(dl); dl.connect(le); le.connect(fb); fb.connect(dl); le.connect(ret); const mix=actx.createGain(); n.connect(mix); ret.connect(mix);
    for(const e of M.secEnds){ const a=e-L; if(!ok(a)||!inWin(e)) continue; send.gain.setValueAtTime(0,T(a)); send.gain.linearRampToValueAtTime(0.8,T(a)+0.02); send.gain.setValueAtTime(0.8,T(e)-0.02); send.gain.linearRampToValueAtTime(0,T(e)); }
    n=mix; }
  if($("audStutter").checked&&o.entry&&o.pre&&S.audioBuf) for(const d of M.drops){ const a=d-L; if(!ok(a)||!inWin(d)) continue;
    const g=o.entry.gain; g.setValueAtTime(1,T(a)-0.006); g.linearRampToValueAtTime(0,T(a)); g.setValueAtTime(0,T(d)-0.006); g.linearRampToValueAtTime(1,T(d));
    let at=a; for(const ln of [L/4,L/4,L/8,L/8,L/8,L/8]){ const s=actx.createBufferSource(); s.buffer=S.audioBuf; const sg=actx.createGain(); sg.gain.setValueAtTime(0,T(at)); sg.gain.linearRampToValueAtTime(1,T(at)+0.004); sg.gain.setValueAtTime(1,T(at+ln)-0.006); sg.gain.linearRampToValueAtTime(0,T(at+ln)); s.connect(sg); sg.connect(o.pre); s.start(T(at),a,ln+0.01); at+=ln; } }
  // tape stop ending: the song winds down like a stopped turntable
  const EN=o.ep&&!o.ep.short?endingFor(win):(!o.ep&&$("songEnd").value==="tape"?endingFor([0,songEndPoint()]):null);
  if(EN&&EN.type==="tape"&&o.src&&ok(EN.tapeAt)){ const r=o.src.playbackRate; r.setValueAtTime(1,T(EN.tapeAt)); r.exponentialRampToValueAtTime(0.06,T(EN.tapeAt+0.85)); const tg=actx.createGain(); n.connect(tg); tg.gain.setValueAtTime(1,T(EN.tapeAt+0.8)); tg.gain.linearRampToValueAtTime(0,T(EN.tapeAt+0.88)); n=tg; }
  n.connect(sum); return sum;
}
function radioOpen(win,ep){ const M=songMarks(), short=!!(ep&&ep.short), len=win[1]-win[0], cap=short?Math.min(4,len*0.3):16, B=S.an.beats;
  const cand=[...M.entries,...M.drops].filter(x=>x>win[0]+1.5&&x<=win[0]+cap).sort((a,b)=>a-b)[0]; if(cand) return cand;
  const want=win[0]+(short?Math.min(3,len*0.2):8); let best=null; B.forEach((b,i)=>{ if(b>=want&&best==null&&isDownAt(S.an,i)) best=b; }); return best&&best<win[1]-2?best:null; }
function buildSfx(actx,o){ if(!$("sfxWhoosh").checked&&!$("sfxImpact").checked&&!$("sfxRiser").checked) return null;
  const win=o.win||[0,S.an?S.an.duration:0], t0=o.t0||0, T=x=>t0+(x-win[0]), inWin=x=>x>=win[0]-1e-6&&x<=win[1]+1e-6, sr=actx.sampleRate, L=S.an?60/S.an.bpm:0.5, M=songMarks();
  const bus=actx.createGain(); bus.gain.value=0.5;
  const play=(buf,at,gain)=>{ if(T(at)<actx.currentTime-0.005) return; const s=actx.createBufferSource(); s.buffer=buf; const g=actx.createGain(); g.gain.value=gain; s.connect(g); g.connect(bus); s.start(T(at)); };
  if($("sfxImpact").checked) for(const d of M.drops) if(inWin(d)) play(sfxBuf("impact",sr),d,0.85);
  if($("sfxRiser").checked) for(const d of M.drops){ const a=d-8*L; if(inWin(d)&&a>=win[0]) play(sfxBuf("riser",sr,+(8*L).toFixed(3)),a,0.5); }
  if($("sfxWhoosh").checked&&o.plan) for(const s of o.plan){ if(!s.tr||!WHOOSH_T.has(s.tr.type)) continue; const pk=s.start+Math.max(0.05,(s.tr.dur||0.3)*0.5), a=pk-0.3; if(a>=win[0]&&pk<=win[1]) play(sfxBuf("whoosh",sr),a,0.55); }
  return bus; }
function buildChain(actx, opts={}){
  const entry=actx.createGain(), pre=actx.createGain(); entry.connect(pre);
  const ls=actx.createBiquadFilter(); ls.type="lowshelf"; ls.frequency.value=100;
  const bands=FREQS.map(f=>{ const b=actx.createBiquadFilter(); b.type="peaking"; b.frequency.value=Math.min(f,actx.sampleRate*0.45); b.Q.value=1.41; return b; });
  const hs=actx.createBiquadFilter(); hs.type="highshelf"; hs.frequency.value=8000;
  const master=actx.createGain();
  let n=pre; [ls,...bands,hs].forEach(x=>{ n.connect(x); n=x; });
  const space=build3D(actx,$("space").value,+$("spaceAmt").value,opts.win||[0,S.an?S.an.duration:0],opts.t0||actx.currentTime);
  const fxOut=buildSongFx(actx,hs,{...opts,entry,pre}); fxOut.connect(space.input); space.output.connect(master);
  const sfx=buildSfx(actx,opts); if(sfx) sfx.connect(master);
  const nodes={entry,pre,ls,bands,hs,master}; applyEq(nodes); return nodes;
}
function applyEq(n){
  if(!n) return;
  n.ls.gain.value=EQ.bass; n.hs.gain.value=EQ.treble;
  n.bands.forEach((b,i)=>b.gain.value=EQ.bands[i]);
  const maxBoost=Math.max(0,EQ.bass,EQ.treble,...EQ.bands);
  n.pre.gain.value=Math.pow(10,-maxBoost/20)*EQ.vol;
}
const PRO=()=>{ const el=document.getElementById("proRules"); return !el || el.checked; };
/* How the song really ends: a fade, a final hit that stops dead, or a last chord that rings out. Measured on the audio. */
function songEnding(){
  if(!S.audioBuf||!S.an) return null; if(S._endingFor===S.audioBuf) return S._ending;
  const buf=S.audioBuf, sr=buf.sampleRate, ch=[...Array(buf.numberOfChannels)].map((_,c)=>buf.getChannelData(c)), dur=buf.duration, hop=0.05;
  const from=Math.max(0,dur-60), n=Math.max(1,Math.floor((dur-from)/hop)), db=new Float32Array(n), w=Math.round(sr*hop);
  for(let k=0;k<n;k++){ const a=Math.floor((from+k*hop)*sr); let s=0,c=0; for(let i=a;i<a+w&&i<buf.length;i+=4){ for(const d of ch){ s+=d[i]*d[i]; c++; } } db[k]=10*Math.log10(s/(c||1)+1e-12); }
  const body=[...db.slice(0,Math.max(20,Math.floor(n*0.5)))].sort((a,b)=>a-b), ref=body[Math.floor(body.length*0.6)];
  let last=n-1; while(last>0&&db[last]<ref-40) last--;
  let hit=last; while(hit>0&&db[hit]<ref-6) hit--;
  const hitT=from+hit*hop, lastT=from+last*hop, tail=lastT-hitT, drop=db[hit]-db[Math.min(last,hit+6)];
  const type=drop>=15&&tail<1.5?"stop":tail>=4?"fade":"ring";
  const endAt=Math.min(dur,lastT+0.35), tapeAt=Math.min(type==="fade"?hitT+1:hitT+0.15,dur-3.9);
  S._ending={type,hit:hitT,fadeStart:hitT,endAt,tapeAt,tapeEnd:Math.min(dur,tapeAt+0.9+3)}; S._endingFor=buf; return S._ending;
}
function songEndPoint(){ const EN=songEnding(); if(!EN) return S.an?S.an.duration:0; return $("songEnd").value==="tape"?EN.tapeEnd:EN.endAt; }
/* the picture's ending for a full-length export: where the final shot starts, when it freezes, darkens and shows the end card */
function endingFor(win){
  if(!$("endStyle")||!$("endStyle").checked) return null; const EN=songEnding(); if(!EN) return null; const end=win[1]; if(end<songEndPoint()-0.5) return null;
  const r={type:$("songEnd").value==="tape"?"tape":EN.type, hit:EN.hit, end, fadeStart:EN.fadeStart};
  if(r.type==="tape"){ r.tapeAt=EN.tapeAt; r.freezeAt=EN.tapeAt; r.cardAt=EN.tapeAt+0.9; r.fade0=end-1.2; r.shotFrom=EN.tapeAt-2.5; }
  else if(r.type==="stop"){ r.freezeAt=EN.hit+0.25; r.cardAt=end-EN.hit>=1.2?EN.hit+0.3:null; r.fade0=Math.max(EN.hit+0.4,end-0.8); r.shotFrom=EN.hit; }
  else if(r.type==="ring"){ r.cardAt=EN.hit+0.5<end-1?EN.hit+0.5:null; r.fade0=EN.hit+(end-EN.hit)*0.5; r.shotFrom=EN.hit-2.5; }
  else { r.cardAt=Math.max(EN.fadeStart,end-12); if(end-r.cardAt<5) r.cardAt=Math.max(win[0],end-5); r.fade0=EN.fadeStart+(end-EN.fadeStart)*0.35; r.shotFrom=EN.fadeStart-1; }
  return r;
}
function endingPost(o,t,win,F){
  const ep=o.ep; if(!ep||ep.short) return; const EN=endingFor(win); if(!EN) return; const {g,W,H}=o;
  let dark=0; if(EN.cardAt!=null&&t>=EN.cardAt) dark=Math.min(0.45,(t-EN.cardAt)/1.2*0.45);
  if(t>=EN.fade0) dark=Math.max(dark,Math.min(1,(t-EN.fade0)/Math.max(0.25,EN.end-EN.fade0)));
  if(dark>0){ g.fillStyle=`rgba(0,0,0,${dark})`; g.fillRect(0,0,W,H); }
  if(EN.cardAt==null||t<EN.cardAt||!$("endCard").checked) return; const title=songTitle(); if(!title) return;
  const a=Math.min(1,(t-EN.cardAt)/0.8), FD=FONT_DEF[normStyle(F.textStyle)]||FONT_DEF.clean, art=$("artistName").value.trim(), m=S.meta||{};
  let fs=Math.round(Math.min(W,H)*0.085), x=W*0.07, y=H*0.26, txt=FD.caps?title.toUpperCase():title;
  g.save(); g.globalAlpha=a; g.fillStyle="#fff"; g.textAlign="left"; g.textBaseline="alphabetic"; g.shadowColor="rgba(0,0,0,0.55)"; g.shadowBlur=fs*0.3;
  for(let k=0;k<8;k++){ g.font=`${FD.w} ${Math.round(fs*FD.k)}px ${FD.f}`; if(g.measureText(txt).width<=W*0.56) break; fs=Math.round(fs*0.9); }
  g.fillText(txt,x,y);
  if(art){ g.font=`600 ${Math.round(fs*0.5)}px Montserrat, system-ui, sans-serif`; g.globalAlpha=a*0.92; g.fillText(art,x,y+fs*0.85); }
  const meta=[m.album?cleanTagTitle(m.album):"",m.year||""].filter(Boolean).join(" · "); if(meta){ g.font=`500 ${Math.round(fs*0.32)}px Montserrat, system-ui, sans-serif`; g.globalAlpha=a*0.7; g.fillText(meta,x,y+fs*(art?1.42:0.8)); }
  g.globalAlpha=a; g.shadowBlur=0; g.fillRect(x,y+fs*(art?1.72:1.1),fs*1.2,Math.max(2,fs*0.05)); g.restore();
}
function fadeTimes(len,ep){
  let fi=$("fadeIn").checked?Math.min(1.5,len/4):0, fo=$("fadeOut").checked?Math.min(2.5,len/4):0;
  if(ep && ep.short) return {fi:0,fo:0}; // short-form loops: no fade in or out, the last frame runs straight into the first
  if(ep && PRO()){ { fi=Math.min(fi,0.5);
    const w=windowFor(ep), EN=Math.abs((w[1]-w[0])-len)<0.05?endingFor(w):null; // finishing with the song: the music's own ending decides the fade
    if(EN) fo=EN.type==="tape"?0.12:EN.type==="stop"?Math.min(fo,0.35):EN.type==="ring"?Math.min(fo,Math.max(0.5,(EN.end-EN.hit)*0.6)):Math.min(fo,0.8); } }
  return {fi,fo};
}
function fadeEnvelope(param,t0,len,ep){
  const {fi,fo}=fadeTimes(len,ep), a=Math.max(fi,0.015), b=Math.max(fo,0.02); // tiny ramps stop clicks at a hard start or loop point
  param.setValueAtTime(0,t0); param.linearRampToValueAtTime(1,t0+a);
  param.setValueAtTime(1,t0+len-b); param.linearRampToValueAtTime(0,t0+len);
}
function reverb(actx,secs,wet){
  const len=Math.floor(actx.sampleRate*secs), ir=actx.createBuffer(2,len,actx.sampleRate);
  for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); }
  const conv=actx.createConvolver(); conv.buffer=ir; const g=actx.createGain(); g.gain.value=wet; conv.connect(g);
  return {input:conv, output:g};
}
function build3D(actx,mode,amt,win,t0){
  const inp=actx.createGain(), out=actx.createGain();
  inp.channelCount=2; inp.channelCountMode="explicit"; inp.channelInterpretation="speakers";
  if(mode==="wide"){
    const sp=actx.createChannelSplitter(2), mg=actx.createChannelMerger(2);
    const w=1+amt*1.2, a=(1+w)/2, b=(1-w)/2;
    const LL=actx.createGain(), LR=actx.createGain(), RL=actx.createGain(), RR=actx.createGain();
    LL.gain.value=a; RR.gain.value=a; LR.gain.value=b; RL.gain.value=b;
    inp.connect(sp); sp.connect(LL,0); sp.connect(LR,0); sp.connect(RL,1); sp.connect(RR,1);
    LL.connect(mg,0,0); RL.connect(mg,0,0); LR.connect(mg,0,1); RR.connect(mg,0,1);
    const trim=actx.createGain(); trim.gain.value=1/(1+amt*0.35); mg.connect(trim); trim.connect(out);
  } else if(mode==="8d"){
    const pan=actx.createPanner(); pan.panningModel="HRTF"; pan.distanceModel="linear"; pan.refDistance=1; pan.maxDistance=10000; pan.rolloffFactor=0;
    const period=Math.max(3,11-amt*7);
    const sinW=actx.createPeriodicWave(new Float32Array([0,0]),new Float32Array([0,1]));
    const cosW=actx.createPeriodicWave(new Float32Array([0,1]),new Float32Array([0,0]));
    const ox=actx.createOscillator(), oz=actx.createOscillator(); ox.setPeriodicWave(sinW); oz.setPeriodicWave(cosW);
    ox.frequency.value=1/period; oz.frequency.value=1/period;
    const gx=actx.createGain(), gz=actx.createGain(); gx.gain.value=2; gz.gain.value=2;
    if(pan.positionX){ pan.positionX.value=0; pan.positionY.value=0; pan.positionZ.value=0; ox.connect(gx); gx.connect(pan.positionX); oz.connect(gz); gz.connect(pan.positionZ); }
    ox.start(); oz.start();
    const dry=actx.createGain(); dry.gain.value=1-amt*0.85;
    const wet=actx.createGain(); wet.gain.value=0.4+amt*0.7;
    inp.connect(dry); dry.connect(out); inp.connect(pan); pan.connect(wet); wet.connect(out);
    const rv=reverb(actx,1.6,0.12*amt+0.03); inp.connect(rv.input); rv.output.connect(out);
  } else if(mode==="hall"){
    inp.connect(out); const rv=reverb(actx,2.8,0.15+0.45*amt); inp.connect(rv.input); rv.output.connect(out);
  } else if(mode==="pingpong"){
    const p=actx.createStereoPanner(); inp.connect(p); p.connect(out);
    let side=1;
    if(curPlan()) curPlan().forEach(s=>{ if(s.start<win[0]||s.start>=win[1]) return; side=-side; p.pan.setTargetAtTime(side*amt*0.75, t0+(s.start-win[0]), 0.03); });
  } else inp.connect(out);
  return {input:inp, output:out};
}
function limiter(actx){ const c=actx.createDynamicsCompressor(); c.threshold.value=-1.5; c.knee.value=0; c.ratio.value=20; c.attack.value=0.002; c.release.value=0.12; return c; }
function loudnessGain(ep){ if(!S.an||!isFinite(S.an.lufs)) return 1; const d=Math.max(-20,Math.min(12,ep.lufs-S.an.lufs)); return Math.pow(10,d/20); }

/* approximate integrated loudness (EBU R128 style gating, K-weighted) */
function biquadRun(x,b0,b1,b2,a1,a2){ const y=new Float32Array(x.length); let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){ const v=x[i], o=b0*v+b1*x1+b2*x2-a1*y1-a2*y2; x2=x1; x1=v; y2=y1; y1=o; y[i]=o; } return y; }
function measureLufs(x,sr,ch){
  let A=Math.pow(10,4/40), w0=2*Math.PI*1681.97/sr, cs=Math.cos(w0), al=Math.sin(w0)/(2*0.7071), sa=2*Math.sqrt(A)*al;
  let a0=(A+1)-(A-1)*cs+sa;
  let y=biquadRun(x, A*((A+1)+(A-1)*cs+sa)/a0, -2*A*((A-1)+(A+1)*cs)/a0, A*((A+1)+(A-1)*cs-sa)/a0, 2*((A-1)-(A+1)*cs)/a0, ((A+1)-(A-1)*cs-sa)/a0);
  w0=2*Math.PI*38.13/sr; cs=Math.cos(w0); al=Math.sin(w0)/(2*0.5); a0=1+al;
  y=biquadRun(y,(1+cs)/2/a0,-(1+cs)/a0,(1+cs)/2/a0,-2*cs/a0,(1-al)/a0);
  const blk=Math.floor(0.4*sr), hop=Math.floor(0.1*sr), ms=[];
  for(let s=0;s+blk<=y.length;s+=hop){ let e=0; for(let i=s;i<s+blk;i++) e+=y[i]*y[i]; ms.push(e/blk); }
  const L=m=>-0.691+10*Math.log10(m+1e-12)+10*Math.log10(ch>=2?2:1);
  const g1=ms.filter(m=>L(m)>-70); if(!g1.length) return -70;
  const rel=L(g1.reduce((a,b)=>a+b,0)/g1.length)-10;
  const g2=g1.filter(m=>L(m)>rel); return L(g2.reduce((a,b)=>a+b,0)/(g2.length||1));
}

function status(msg, err){ const s=$("status"); S._statusEn=msg||""; s.textContent=msg||""; s.classList.toggle("err",!!err); }
const tick = () => new Promise(r=>setTimeout(r,0));
function fmtTime(s){ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
function hue(i){ return `hsl(${(i*137.5+205)%360} 68% 56%)`; }
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

