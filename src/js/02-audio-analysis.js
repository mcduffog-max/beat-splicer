/* ---------------- Audio analysis ---------------- */
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit;
    if(i<j){ let t=re[i];re[i]=re[j];re[j]=t; t=im[i];im[i]=im[j];im[j]=t; } }
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang), half=len>>1;
    for(let i=0;i<n;i+=len){ let cr=1,ci=0;
      for(let k=0;k<half;k++){ const a=i+k,b=a+half;
        const tr=re[b]*cr-im[b]*ci, ti=re[b]*ci+im[b]*cr;
        re[b]=re[a]-tr; im[b]=im[a]-ti; re[a]+=tr; im[a]+=ti;
        const nc=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nc; } } }
}

async function analyzeAudio(buf, onProg, opt){ opt=opt||{};
  const sr0=buf.sampleRate, ch=buf.numberOfChannels;
  const step=sr0>=44100?2:1, sr=sr0/step, n=Math.floor(buf.length/step);
  const chans=[]; for(let c=0;c<ch;c++) chans.push(buf.getChannelData(c));
  const x=new Float32Array(n);
  for(let i=0;i<n;i++){ let s=0; for(const c of chans){ s+=c[i*step]; if(step===2) s+=c[i*step+1]||0; } x[i]=s/(ch*step); }

  const N=1024,H=512,T=Math.max(1,Math.floor((n-N)/H)+1);
  const win=new Float32Array(N); for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
  const re=new Float64Array(N), im=new Float64Array(N), prev=new Float32Array(N/2);
  const flux=new Float32Array(T), rms=new Float32Array(T), cent=new Float32Array(T), lowF=new Float32Array(T), midF=new Float32Array(T), bodyF=new Float32Array(T), hiF=new Float32Array(T);
  const kLow=Math.max(2,Math.round(130*N/sr)), kMid0=Math.round(170*N/sr), kMid1=Math.round(2000*N/sr), kB0=Math.round(150*N/sr), kB1=Math.round(400*N/sr), kH0=Math.round(5000*N/sr);
  for(let f=0;f<T;f++){
    const o=f*H; let e=0;
    for(let k=0;k<N;k++){ const v=x[o+k]||0; e+=v*v; re[k]=v*win[k]; im[k]=0; }
    rms[f]=Math.sqrt(e/N);
    fft(re,im);
    let fl=0, num=0, den=0;
    for(let k=1;k<N/2;k++){ const m=Math.hypot(re[k],im[k]); const lm=Math.log(1+10*m);
      const d=lm-prev[k]; if(d>0){ fl+=d; if(k<=kLow) lowF[f]+=d; else if(k>=kMid0&&k<=kMid1) midF[f]+=d; if(k>=kB0&&k<=kB1) bodyF[f]+=d; if(k>=kH0) hiF[f]+=d; } prev[k]=lm; num+=k*m; den+=m; }
    flux[f]=fl; cent[f]=den>0? (num/den)*sr/N : 0;
    if((f&2047)===0){ onProg && onProg(f/T); await tick(); }
  }
  // onset envelope: local-mean removed, normalised
  const fr=sr/H, on=new Float32Array(T), W=Math.round(fr*0.4);
  const onsetOf=(src,raw)=>{ const o=new Float32Array(T), pre=new Float64Array(T+1); for(let i=0;i<T;i++) pre[i+1]=pre[i]+src[i];
    for(let i=0;i<T;i++){ const a=Math.max(0,i-W), b=Math.min(T,i+W+1); o[i]=Math.max(0,src[i]-(pre[b]-pre[a])/(b-a)); }
    if(raw) return o;
    let sd=0; for(let i=0;i<T;i++) sd+=o[i]*o[i]; sd=Math.sqrt(sd/T)||1; for(let i=0;i<T;i++) o[i]/=sd; return o; };
  const onAll=onsetOf(flux), onLow=onsetOf(lowF), onMid=onsetOf(midF), onBody=onsetOf(bodyF), onHi=onsetOf(hiF);
  // the rhythm section (kick and snare) defines the beat; hi-hats and cymbals often run at double or triplet rates
  for(let i=0;i<T;i++) on[i]=onLow[i]+onMid[i]+0.3*onAll[i];
  { let sd=0; for(let i=0;i<T;i++) sd+=on[i]*on[i]; sd=Math.sqrt(sd/T)||1; for(let i=0;i<T;i++) on[i]/=sd; }

  // tempo by autocorrelation with a preference around 120 BPM
  const minL=Math.max(2,Math.floor(fr*60/185)), maxL=Math.ceil(fr*60/58);
  let bestL=Math.round(fr*0.5), bestV=-1; const ac=new Float32Array(4*maxL+3);
  for(let L=minL;L<=Math.min(4*maxL+2,T-1);L++){ let s=0; for(let t=L;t<T;t++) s+=on[t]*on[t-L]; ac[L]=s/(T-L); }
  for(let L=minL;L<=maxL;L++){ const bpm=60*fr/L, w=Math.exp(-0.5*Math.pow(Math.log2(bpm/112)/1.1,2));
    const v=(ac[L]+0.25*Math.min(ac[2*L]||0,ac[L])+0.15*Math.min(ac[4*L]||0,ac[L])-0.25*(ac[Math.round(1.5*L)]||0))*w; if(v>bestV){bestV=v;bestL=L;} }
  let P=bestL; { const a=ac[bestL-1]||0,b=ac[bestL],c=ac[bestL+1]||0, d=a-2*b+c; if(d<0) P=bestL+0.5*(a-c)/d; }
  const rL=onsetOf(lowF,true), rB=onsetOf(bodyF,true), rhy=new Float32Array(T); for(let i=0;i<T;i++) rhy[i]=rL[i]+rB[i]; // unscaled kick and snare body: hi-hat noise stays small
  let bpm=60*fr/P;
  { // a kick drum can pulse at 2/3 or 3/4 of the real tempo. The real tempo's half-beats also line up with the music
    // (hats and snares on the "and"), an impostor's fall between notes: measure how much rhythm lands on each grid versus chance.
    let total=0; for(let i=0;i<T;i++) total+=onAll[i];
    const lift=b=>{ const L=fr*60/b/2; let best=0;
      for(let ph=0;ph<L;ph+=0.5){ let cap=0,n=0; for(let t=ph;t<T-2;t+=L){ const f=Math.round(t); cap+=Math.max(onAll[f],onAll[f+1]||0,f>0?onAll[f-1]:0); n++; }
        const cov=n*3/T; if(cov>0) best=Math.max(best,(cap/(total||1))/cov); } return best; };
    let best=bpm, bl=lift(bpm);
    for(const r of [1.5,2/3,4/3,3/4]){ const b=bpm*r; if(b<58||b>190) continue; const l=lift(b); if(l>bl*1.15){ bl=l; best=b; } }
    if(best!==bpm){ bpm=best; P=60*fr/bpm; }
  }
  /* Every tempo from 55 to 190 BPM is scored by how much of the music lands on its beats and half-beats, compared with chance.
     The winner fixes the tempo family (syncopated styles like dembow or funk fool simpler methods); the octave stays with the
     tracking above. How far the winner stands above the field says how sure we can be that there's a steady beat at all. */
  let beatConf=3, scanFixed=false;
  { // scanned over three 90-second stretches (opening, middle, late) and the steadiest one decides: a quiet intro shouldn't make a song look beatless
    const scan=(a0,lim)=>{ let tot=0; for(let i=a0;i<lim;i++) tot+=onAll[i]; const span=lim-a0;
      const lift=(b,sub)=>{ const L=fr*60/b/sub; let best=0; for(let ph=0;ph<L;ph+=0.5){ let cap=0,n=0; for(let t=a0+ph;t<lim-2;t+=L){ const f=Math.round(t); cap+=Math.max(onAll[f],onAll[f+1]||0,f>0?onAll[f-1]:0); n++; } const cov=n*3/span; if(cov>0) best=Math.max(best,(cap/(tot||1))/cov); } return best; };
      const sc=[]; for(let b=55;b<=190;b+=0.5){ const pr=Math.exp(-0.5*Math.log2(b/110)**2); sc.push([b,(0.5*lift(b,1)+0.5*lift(b,2))*(0.6+0.4*pr)]); }
      const top=sc.reduce((a,x)=>x[1]>a[1]?x:a), med=sc.map(x=>x[1]).sort((a,b)=>a-b)[sc.length>>1]; return {top, conf:top[1]/(med||1)}; };
    const W90=Math.round(fr*90), starts=T>W90*1.5?[0,Math.round(T*0.5-W90/2),Math.round(T*0.75-W90/2)]:[0];
    let pick=null; const rs=[]; for(const a0 of starts){ const r=scan(Math.max(0,a0),Math.min(T,Math.max(0,a0)+W90)); rs.push(r); if(!pick||r.conf>pick.conf) pick=r; }
    const top=pick.top; beatConf=pick.conf;
    { const agree=rs.filter(r=>r!==pick&&[1,2,0.5].some(k=>Math.abs(r.top[0]/(top[0]*k)-1)<0.03)).length; if(agree>=1&&beatConf<2.2) beatConf=Math.min(2.2,beatConf+0.35*agree); } // the same tempo found in separate stretches of the song is a steady beat, even when each stretch alone is unsure
    const fam=b=>[1,2,0.5].some(r=>Math.abs(b/(top[0]*r)-1)<0.03);
    if(beatConf>=4.5 && bpm>140 && Math.abs(bpm/(top[0]*2)-1)<0.03 && top[0]>=60 && top[0]<=100){ bpm=top[0]; P=60*fr/bpm; scanFixed=true; } // e.g. reggae one-drop: the skank doubles the apparent tempo
    else if(beatConf>=2 && !fam(bpm)){ const c=[top[0],top[0]*2,top[0]/2].filter(x=>x>=55&&x<=200); bpm=c.reduce((a,x)=>Math.abs(Math.log(x/bpm))<Math.abs(Math.log(a/bpm))?x:a); P=60*fr/bpm; scanFixed=true; }
  }

  // dynamic-programming beat tracker
  const score=new Float32Array(T), back=new Int32Array(T).fill(-1), tight=80;
  for(let t=0;t<T;t++){
    let best=-Infinity,bi=-1; const lo=Math.max(0,Math.round(t-2*P)), hi=Math.round(t-P/2);
    for(let p=lo;p<=hi;p++){ const v=score[p]-tight*Math.pow(Math.log((t-p)/P),2); if(v>best){best=v;bi=p;} }
    if(bi>=0 && best>0){ score[t]=on[t]+best; back[t]=bi; } else score[t]=on[t];
    if((t&8191)===0) await tick();
  }
  let end=T-1, bs=-Infinity; for(let t=Math.max(0,T-Math.round(P*1.5));t<T;t++) if(score[t]>bs){bs=score[t];end=t;}
  const bf=[]; for(let t=end;t>=0;t=back[t]){ bf.push(t); if(back[t]<0) break; } bf.reverse();
  const off=N/2/sr, dur=buf.duration;
  let beats=bf.map(f=>f*H/sr+off);
  { // check the counting level on the tracked beats: every real beat carries a kick or a snare
    const val=b=>{ const f=Math.round((b-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const v=rhy[Math.min(T-1,Math.max(0,f+d))]; if(v>m) m=v; } return m; };
    let ev=0,od=0,ne=0,no=0; beats.forEach((b,i)=>{ if(i%2){ od+=val(b); no++; } else { ev+=val(b); ne++; } }); ev/=ne||1; od/=no||1;
    if(scanFixed){ /* syncopated but steady: a straight grid at the scanned tempo, placed where the kick and snare land */
      const per=60/bpm, cand=[]; for(let ph=0;ph<per;ph+=per/48) cand.push(ph);
      const kv=t=>{ const f=Math.round((t-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const i=Math.min(T-1,Math.max(0,f+d)); const v=onLow[i]+0.3*onBody[i]; if(v>m) m=v; } return m; }; // the kick defines the beat in syncopated styles
      let bestPh=0,bs=-1; for(const ph of cand){ let s=0; for(let t=ph;t<dur;t+=per) s+=kv(t); if(s>bs){ bs=s; bestPh=ph; } }
      beats=[]; for(let t=bestPh;t<dur;t+=per) beats.push(t); }
    else if(bpm>95 && beats.length>16 && Math.min(ev,od)<0.45*Math.max(ev,od)){ const keep=ev>=od?0:1; beats=beats.filter((_,i)=>i%2===keep); bpm/=2; P*=2; }
    else if(bpm<80 && beats.length>8){ const mids=beats.slice(0,-1).map((b,i)=>(b+beats[i+1])/2); const mv=mids.reduce((x,b)=>x+val(b),0)/(mids.length||1);
      if(!opt.x && (mv>0.7*(ev+od)/2 || (bpm<72 && beatConf>=2.5 && mv>0.45*(ev+od)/2))){ beats=[...beats,...mids].sort((x,y)=>x-y); bpm*=2; P/=2; } }
    if(!opt.x && bpm<75 && beatConf>=2 && beats.length>8){ const va=b=>{ const f=Math.round((b-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const v=onAll[Math.min(T-1,Math.max(0,f+d))]; if(v>m) m=v; } return m; };
      const mids=beats.slice(0,-1).map((b,i)=>(b+beats[i+1])/2), mv=mids.reduce((x,b)=>x+va(b),0)/(mids.length||1), bv=beats.reduce((x,b)=>x+va(b),0)/(beats.length||1);
      if(mv>0.5*bv){ beats=[...beats,...mids].sort((x,y)=>x-y); bpm*=2; P/=2; } } // e.g. a kick on 1 and 3 with a snare on 2 and 4 that lives above the kick drum's band
    // the person's own call wins: Double or Half from the tempo chips
    if(opt.x===2 && beats.length>4){ const mids=beats.slice(0,-1).map((b,i)=>(b+beats[i+1])/2); beats=[...beats,...mids].sort((x,y)=>x-y); bpm*=2; P/=2; }
    else if(opt.x===0.5 && beats.length>8){ let e2=0,o2=0; beats.forEach((b,i)=>{ if(i%2) o2+=val(b); else e2+=val(b); }); const keep=e2>=o2?0:1; beats=beats.filter((_,i)=>i%2===keep); bpm/=2; P*=2; }
  }
  if(beats.length<4){ beats=[]; for(let t=0;t<dur;t+=0.5) beats.push(t); }
  // fill gaps before first / after last tracked beat with the grid
  const period=60/bpm;
  while(beats[0]-period>0.05) beats.unshift(beats[0]-period);
  while(beats[beats.length-1]+period<dur-0.05) beats.push(beats[beats.length-1]+period);

  /* Free time: no steady beat (ambient) or a tempo that breathes (rubato ballads). A rigid grid would cut against the music,
     so the music's own events become the "beats": note and chord onsets for rubato, swells and changes for ambient. */
  let free=null;
  if(beatConf<2.0){
    const s=[...onAll].sort((a,b)=>a-b), q=s[Math.floor(s.length*(beatConf<1.4?0.97:0.88))]||0, ev=[], str=[];
    const gap=beatConf<1.4?2.5:Math.max(0.35,period*0.55);
    for(let f=2;f<T-2;f++){ const v=onAll[f]; if(v>q && v>=onAll[f-1] && v>=onAll[f+1] && v>=onAll[f-2] && v>=onAll[f+2]){ const t=f*H/sr+off; if(!ev.length||t-ev[ev.length-1]>=gap){ ev.push(t); str.push(v); } else if(v>str[str.length-1]){ ev[ev.length-1]=t; str[str.length-1]=v; } } }
    if(ev.length>=4){
      if(beatConf<1.4){ // ambient: shots hang on the music's changes, with even steps between them so the edit has room to breathe
        const out=[0]; const pts=[...ev,dur]; let prev=0; for(const e of pts){ const n=Math.max(1,Math.round((e-prev)/1.6)); for(let k=1;k<=n;k++) out.push(prev+(e-prev)*k/n); prev=e; }
        beats.length=0; out.filter(t=>t<dur-0.2).forEach(t=>beats.push(t)); free={kind:"beatless", events:new Set(ev.map(e=>out.findIndex(t=>Math.abs(t-e)<0.01)).filter(i=>i>=0))};
      } else {
        beats.length=0; ev.forEach(t=>beats.push(t)); const ms=[...str].sort((a,b)=>a-b)[str.length>>1];
        free={kind:"rubato", events:new Set(str.map((v,i)=>v>=ms*1.5?i:-1).filter(i=>i>=0))};
      }
      const ioi=beats.slice(1).map((b,i)=>b-beats[i]).sort((a,b)=>a-b); if(ioi.length) bpm=60/ioi[ioi.length>>1];
    }
  }
  if(!free && beats.length>16){
    const at=(arr,t)=>{ const f=Math.round((t-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const v=arr[Math.min(T-1,Math.max(0,f+d))]; if(v>m) m=v; } return m; };
    const score=sh=>{ let s=0; for(const b of beats){ const t=b+sh*period; if(t<0||t>dur) continue; s+=at(onLow,t)+0.6*at(onBody,t); } return s; };
    const base=score(0); let bestSh=0, bestS=base;
    for(const sh of [0.25,0.5,0.75,-0.25]){ const s=score(sh); if(s>bestS*1.15){ bestS=s; bestSh=sh; } }
    if(bestSh){ for(let i=0;i<beats.length;i++) beats[i]+=bestSh*period; while(beats.length&&beats[0]<0) beats.shift(); }
  }
  // downbeat phase: which of every-4th beat is strongest
  const atBeat=(arr,i)=>{ const f=Math.round((beats[i]-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const v=arr[Math.min(T-1,Math.max(0,f+d))]; if(v>m) m=v; } return m; };
  const beatRms=beats.map((b,i)=>{ const a=Math.max(0,Math.floor((b-off)*sr/H)), e=Math.min(T,Math.max(a+1,Math.floor(((beats[i+1]||dur)-off)*sr/H))); let r=0; for(let f=a;f<e;f++) r+=rms[f]; return r/((e-a)||1); });
  const lowB=beats.map((_,i)=>atBeat(onLow,i)), midB=beats.map((_,i)=>atBeat(onMid,i));
  const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1), sdv=a=>{ const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)**2)))||1; };
  const nl=sdv(lowB), nm=sdv(midB);
  let down=0, dv=-Infinity;
  for(let k=0;k<4;k++){
    let kick=0,snare=0,cnt=0; for(let i=k;i<beats.length;i+=4){ kick+=lowB[i]/nl; snare+=midB[i]/nm; cnt++; }
    // energy steps between consecutive bars: largest when bars are counted from the true downbeat
    const sq=[]; for(let i=k+4;i+3<beats.length;i+=4){ const a=mean(beatRms.slice(i-4,i)), b=mean(beatRms.slice(i,i+4)); const d=Math.log((b+1e-6)/(a+1e-6)); sq.push(d*d); } // squared: one clean jump on the bar line beats two half-jumps either side
    sq.sort((x,y)=>y-x); const steps=sq.slice(0,4).reduce((x,y)=>x+y,0); // the biggest section changes decide; ordinary bars don't dilute them
    const sc=(kick-0.9*snare)/(cnt||1)+2.5*steps;
    if(sc>dv){ dv=sc; down=k; }
  }
  // metre: does the bass/kick accent repeat every 3 beats (waltz, 3/4) or every 4?
  let meter=4;
  if(!free && beats.length>24){
    const acc=lowB.map((v,i)=>v/nl+0.5*Math.log(beatRms[i]+1e-6)), sd=sdv(acc);
    const contrast=m=>{ let best=-9,ph=0; for(let k=0;k<m;k++){ const on=[],off=[]; acc.forEach((v,i)=>((i-k)%m===0?on:off).push(v)); const c=(mean(on)-mean(off))/sd; if(c>best){ best=c; ph=k; } } return [best,ph]; };
    const [c3,p3]=contrast(3), [c4]=contrast(4);
    if(c3>0.5 && c3>c4*1.25){ meter=3; down=p3; }
  }
  // swing: where the "and" really falls between beats (0.5 straight, about 0.6 to 0.7 swung)
  let swing=0.5;
  if(!free){ const ph=[]; for(let i=0;i+1<beats.length;i++){ const a=(beats[i]-off)*sr/H, b=(beats[i+1]-off)*sr/H; let bf=-1,bv=0; for(let f=Math.round(a+(b-a)*0.4);f<=Math.round(a+(b-a)*0.8)&&f<T;f++){ if(onHi[f]>bv){ bv=onHi[f]; bf=f; } } if(bf>=0&&bv>0) ph.push((bf-a)/(b-a)); }
    if(ph.length>16){ ph.sort((x,y)=>x-y); const m=ph[ph.length>>1], near=ph.filter(x=>Math.abs(x-m)<0.05).length/ph.length; if(m>0.56&&m<0.76&&near>0.5) swing=m; } }
  // half-time (snare on beat 3 only, as in trap) and four-on-the-floor (kick on every beat, as in house)
  let halftime=false, four=false;
  if(!free && meter===4){ const bodyB=beats.map((_,i)=>atBeat(onBody,i)), ph=k=>mean(bodyB.filter((_,i)=>((i-down)%4+4)%4===k)), lk=k=>mean(lowB.filter((_,i)=>((i-down)%4+4)%4===k));
    halftime=ph(2)>1.6*Math.max(ph(1),ph(3)); const L=[0,1,2,3].map(lk); four=Math.min(...L)>0.85*Math.max(...L) && mean(lowB)/nl>1.0; }

  // per-beat loudness and brightness
  const be=[], bc=[], bd=[];
  for(let i=0;i<beats.length;i++){
    const a=Math.max(0,Math.floor((beats[i]-off)*sr/H)), b=Math.min(T,Math.max(a+1,Math.floor(((beats[i+1]||dur)-off)*sr/H)));
    let r=0,c=0,dn=0; for(let f=a;f<b;f++){ r+=rms[f]; c+=cent[f]; dn+=flux[f]; } r/=(b-a)||1; c/=(b-a)||1; dn/=(b-a)||1;
    be.push(20*Math.log10(r+1e-6)); bc.push(c); bd.push(dn);
  }
  const norm=arr=>{ const s=[...arr].sort((p,q)=>p-q); const lo=s[Math.floor(s.length*0.05)], hi=s[Math.floor(s.length*0.95)]||lo+1; return arr.map(v=>Math.min(1,Math.max(0,(v-lo)/((hi-lo)||1)))); };
  const C=norm(bc);
  /* Energy = how hard the music is pushing, judged against the song itself. Modern masters are so compressed that loudness
     barely moves between verse and chorus, so the arrangement counts too: how busy the rhythm is and how bright the sound is.
     Each is compared across the body of the song (quiet intros, outros and silence don't set the scale), then smoothed over
     two bars so sections, not single hits, drive the pacing. */
  let E;
  { const peak=Math.max(...be), body=be.map((v,i)=>v>peak-14?i:-1).filter(i=>i>=0);
    const stat=arr=>{ const v=body.map(i=>arr[i]); const m=v.reduce((a,b)=>a+b,0)/(v.length||1); const sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/(v.length||1))||1; return x=>(x-m)/sd; };
    const zl=stat(be), zd=stat(bd), zc=stat(bc);
    const raw=be.map((v,i)=>0.45*zl(v)+0.35*zd(bd[i])+0.2*zc(bc[i]));
    const sm=raw.map((_,i)=>{ let s=0,k=0; for(let j=i-4;j<=i+3;j++) if(j>=0&&j<raw.length){ s+=raw[j]; k++; } return s/k; });
    const bodyVals=body.map(i=>sm[i]).sort((a,b)=>a-b), rank=x=>{ let lo=0,hi=bodyVals.length; while(lo<hi){ const m=(lo+hi)>>1; if(bodyVals[m]<x) lo=m+1; else hi=m; } return lo/Math.max(1,bodyVals.length-1); };
    const dbSpread=(()=>{ const v=body.map(i=>be[i]).sort((a,b)=>a-b); return v.length?v[Math.floor(v.length*0.9)]-v[Math.floor(v.length*0.1)]:0; })();
    const loudE=norm(be);
    // compressed master (body loudness within ~5 dB): sections come from arrangement; otherwise loudness still leads
    const w=dbSpread<5?0.85:0.4;
    E=be.map((v,i)=>{ const quiet=Math.min(1,Math.max(0,(v-(peak-26))/12)); return Math.min(1,Math.max(0,(w*(0.12+0.8*rank(sm[i]))+(1-w)*loudE[i])*quiet)); });
  }
  const Es=E.map((_,i)=>{ let s=0,k=0; for(let j=i-1;j<=i+2;j++) if(j>=0&&j<E.length){s+=E[j];k++;} return s/k; });

  // waveform peaks for the timeline
  const PK=1600, peaks=new Float32Array(PK), per=Math.max(1,Math.floor(n/PK));
  for(let p=0;p<PK;p++){ let m=0; const a=p*per; for(let i=a;i<a+per&&i<n;i++){ const v=Math.abs(x[i]); if(v>m)m=v; } peaks[p]=m; }
  const lufs=measureLufs(x,sr,ch);
  let cs=0,cn=0; for(let f=0;f<T;f++){ if(rms[f]>0.01){ cs+=cent[f]; cn++; } }
  const halfHit=beats.map((b,i)=>{ const nb=beats[i+1]; if(nb==null) return 0; const f=Math.round(((b+nb)/2-off)*sr/H); let m=0; for(let d=-2;d<=2;d++){ const v=(onBody[Math.min(T-1,Math.max(0,f+d))]||0)+(onHi[Math.min(T-1,Math.max(0,f+d))]||0)+(onLow[Math.min(T-1,Math.max(0,f+d))]||0); if(v>m) m=v; } return m; });
  { const s=[...halfHit].sort((a,b)=>a-b), med=s[Math.floor(s.length/2)]||1; for(let i=0;i<halfHit.length;i++) halfHit[i]/=med*2.5||1; }
  const feel={meter, swing, halftime, four, free:free?free.kind:null, conf:+beatConf.toFixed(2)};
  feel.label=free?(free.kind==="beatless"?"no steady beat (ambient)":"free time (rubato)"):[meter===3?"3/4":"4/4", four?"four-on-the-floor":halftime?"half-time feel":null, swing>0.5?`swung (${Math.round(swing*100)}%)`:null].filter(Boolean).join(", ");
  return { tempoX:opt.x||1, bpm, beats, down, meter, swing, feel, freeEvents:free?free.events:null, E:Es, Eraw:E, C, duration:dur, peaks, lufs, centroid:cn?cs/cn:2000, halfHit };
}

