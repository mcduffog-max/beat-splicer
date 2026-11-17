/* ---------------- Song structure: verses, choruses and the rest, heard from the audio ----------------
   Works without lyrics. The song is measured bar by bar for harmony (which notes sound: chroma) and texture
   (how it sounds: a coarse spectrum). Places where the texture changes mark section boundaries; sections whose
   harmony repeats are grouped, and the loud group that comes back most is the chorus. */
function songStructure(buf, an){
  if(!buf||!an||!an.beats||an.beats.length<16||(an.feel&&an.feel.free)) return null;
  const sr0=buf.sampleRate, dec=Math.max(1,Math.round(sr0/11025)), sr=sr0/dec, n=Math.floor(buf.length/dec), ch=buf.numberOfChannels;
  const x=new Float32Array(n); { const cs=[]; for(let c=0;c<ch;c++) cs.push(buf.getChannelData(c));
    for(let i=0;i<n;i++){ let s=0; for(let k=0;k<dec;k++){ const j=i*dec+k; for(const c of cs) s+=c[j]||0; } x[i]=s/(dec*ch); } }
  const N=4096, Hp=1024, T=Math.max(1,Math.floor((n-N)/Hp)+1), NB=16;
  const win=new Float32Array(N); for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
  const pcOf=new Int8Array(N/2).fill(-1), wOf=new Float32Array(N/2), bandOf=new Int8Array(N/2).fill(-1);
  for(let k=1;k<N/2;k++){ const f=k*sr/N;
    if(f>=55&&f<=2000){ const midi=69+12*Math.log2(f/440); pcOf[k]=((Math.round(midi)%12)+12)%12; wOf[k]=1-Math.min(1,Math.abs(midi-Math.round(midi))*2)*0.6; }
    if(f>=60&&f<=5000){ bandOf[k]=Math.min(NB-1,Math.floor(Math.log(f/60)/Math.log(5000/60)*NB)); } }
  const chroma=new Float32Array(T*12), tim=new Float32Array(T*NB), lev=new Float32Array(T), re=new Float64Array(N), im=new Float64Array(N);
  for(let t=0;t<T;t++){ const o=t*Hp; let e=0;
    for(let i=0;i<N;i++){ const v=x[o+i]||0; re[i]=v*win[i]; im[i]=0; e+=v*v; }
    fft(re,im); lev[t]=Math.sqrt(e/N);
    for(let k=1;k<N/2;k++){ const m=Math.hypot(re[k],im[k]); if(m<=0) continue; const lm=Math.log1p(m*100);
      if(pcOf[k]>=0) chroma[t*12+pcOf[k]]+=lm*wOf[k]; if(bandOf[k]>=0) tim[t*NB+bandOf[k]]+=lm; } }
  // bars from the beat grid: the first downbeat, then every `meter` beats
  const B=an.beats, meter=an.meter||4; const downs=[]; for(let i=0;i<B.length;i++) if(isDownAt(an,i)) downs.push(i); // the beat map's own bar lines, so a dropped beat doesn't shift every bar after it
  const bars=[]; for(let k=0;k+1<downs.length;k++){ const a=downs[k], z=downs[k+1]; if(z-a>=2) bars.push([B[a],B[z]]); }
  if(bars.length<8) return null;
  const fr=t=>Math.max(0,Math.min(T-1,Math.round((t*sr-N/2)/Hp)));
  const nb=bars.length, C=bars.map(()=>new Float32Array(12)), Tm=bars.map(()=>new Float32Array(NB)), L=new Float32Array(nb);
  bars.forEach(([a,b],j)=>{ const f0=fr(a), f1=Math.max(f0+1,fr(b)); for(let f=f0;f<f1;f++){ for(let q=0;q<12;q++) C[j][q]+=chroma[f*12+q]; for(let q=0;q<NB;q++) Tm[j][q]+=tim[f*NB+q]; L[j]+=lev[f]; } L[j]/=(f1-f0); });
  const unit=v=>{ let s=0; for(const z of v) s+=z*z; s=Math.sqrt(s)||1; for(let i=0;i<v.length;i++) v[i]/=s; };
  C.forEach(v=>{ const mx=Math.max(...v)||1; for(let i=0;i<12;i++) v[i]=v[i]/mx; unit(v); });
  { const mu=new Float32Array(NB), sd=new Float32Array(NB); Tm.forEach(v=>v.forEach((z,i)=>mu[i]+=z/nb)); Tm.forEach(v=>v.forEach((z,i)=>sd[i]+=(z-mu[i])**2/nb));
    Tm.forEach(v=>{ for(let i=0;i<NB;i++) v[i]=(v[i]-mu[i])/(Math.sqrt(sd[i])||1); unit(v); }); }
  const dot=(a,b)=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
  const Lmax=Math.max(...L)||1; for(let j=0;j<nb;j++) L[j]/=Lmax;
  // novelty: a checkerboard kernel slid along the bar-by-bar similarity of texture, harmony and loudness
  const simT=(i,j)=>dot(Tm[i],Tm[j]), simC=(i,j)=>dot(C[i],C[j]), sim=(i,j)=>0.45*simT(i,j)+0.35*simC(i,j)+0.2*(1-Math.min(1,Math.abs(L[i]-L[j])*3));
  const K=4, nov=new Float32Array(nb);
  for(let j=2;j<=nb-2;j++){ const k=Math.min(K,j,nb-j); let ws=0,wn=0,xs=0,xn=0; // same-side pairs against cross pairs, each averaged (balanced at the song's edges too)
    for(let a=-k;a<k;a++) for(let b=-k;b<k;b++){ if(a===b) continue; const g=Math.exp(-((a+0.5)**2+(b+0.5)**2)/(2*(k*0.6)**2)), v=sim(j+a,j+b); if((a<0)===(b<0)){ ws+=g*v; wn+=g; } else { xs+=g*v; xn+=g; } }
    nov[j]=Math.max(0,ws/(wn||1)-xs/(xn||1))*(k/K); }
  { const mx=Math.max(...nov)||1; for(let j=4;j<=nb-4;j++){ let p=0,q=0; for(let k=1;k<=4;k++){ p+=L[j-k]; q+=L[j+k-1]; } nov[j]=nov[j]/mx+1.5*Math.abs(q-p)/4; } } // a change of loudness marks a section too (drums coming in)
  const nmax=Math.max(...nov), thr=nmax*0.18;
  const cand=[]; for(let j=2;j<nb-1;j++){ if(nov[j]>thr&&nov[j]>=nov[j-1]&&nov[j]>=nov[j+1]) cand.push([nov[j]+(j%4===0?0.15*thr:0)+(j%8===0?0.1*thr:0),j]); } // phrases start on 4- and 8-bar lines more often than not
  cand.sort((a,b)=>b[0]-a[0]); const cuts=[0];
  for(const [,j] of cand){ if(cuts.every(c=>Math.abs(c-j)>=4)&&j<=nb-4) cuts.push(j); }
  cuts.sort((a,b)=>a-b); cuts.push(nb);
  for(let guard=0;guard<20;guard++){ let split=null; for(let i=0;i<cuts.length-1;i++){ const a=cuts[i], z=cuts[i+1]; if(z-a<=24) continue; let bj=-1,bv=-1; for(let j=a+4;j<=z-4;j++){ const v=nov[j]+(j%4===0?0.02:0); if(v>bv){ bv=v; bj=j; } } if(bj>0){ split=bj; break; } }
    if(split==null) break; cuts.push(split); cuts.sort((a,b)=>a-b); }
  let segs=[]; for(let i=0;i<cuts.length-1;i++) segs.push({b0:cuts[i],b1:cuts[i+1]});
  // repeats: two sections are the same part when their bars line up in harmony and texture
  const segSim=(A,Bs)=>{ const la=A.b1-A.b0, lb=Bs.b1-Bs.b0, len=Math.min(la,lb); let best=-1;
    for(let sh=0;sh<=Math.max(0,la-len);sh+=1) for(let sh2=0;sh2<=Math.max(0,lb-len);sh2+=1){ let s=0; for(let k=0;k<len;k++) s+=0.6*simC(A.b0+sh+k,Bs.b0+sh2+k)+0.4*simT(A.b0+sh+k,Bs.b0+sh2+k); s/=len; if(s>best) best=s; }
    return best*(0.75+0.25*Math.min(la,lb)/Math.max(la,lb)); };
  segs.forEach(s=>{ s.e=0; for(let j=s.b0;j<s.b1;j++) s.e+=L[j]; s.e/=(s.b1-s.b0); });
  const grp=segs.map((_,i)=>i); const find=i=>grp[i]===i?i:(grp[i]=find(grp[i]));
  const pairs=[]; for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++) pairs.push([segSim(segs[i],segs[j]),i,j]);
  const ps=pairs.map(p=>p[0]).sort((a,b)=>a-b); pairs.sort((a,b)=>b[0]-a[0]);
  // the bar for "same part" rises until no one group swallows most of the song (a rock song can sound alike throughout)
  for(const q of [0.7,0.8,0.88,0.94]){ const same=Math.max(0.6,ps.length?ps[Math.min(ps.length-1,Math.floor(ps.length*q))]:1); for(let i=0;i<grp.length;i++) grp[i]=i;
    pairs.forEach(([s,i,j])=>{ if(s>=same) grp[find(j)]=find(i); });
    const cnt=new Map(); segs.forEach((_,i)=>{ const g=find(i); cnt.set(g,(cnt.get(g)||0)+1); }); if(Math.max(...cnt.values())<=Math.max(2,segs.length*0.5)) break; }
  segs.forEach((s,i)=>s.g=find(i));
  // which group is the chorus: it comes back, it's among the loudest, and it isn't the opening
  const groups=new Map(); segs.forEach(s=>{ if(!groups.has(s.g)) groups.set(s.g,[]); groups.get(s.g).push(s); });
  const eMed=[...segs.map(s=>s.e)].sort((a,b)=>a-b)[segs.length>>1];
  let chorusG=null, best=-1;
  for(const [g,m] of groups){ if(m.length<2) continue; const e=m.reduce((a,s)=>a+s.e,0)/m.length, early=m[0].b0===0?0.5:1;
    const sc=(e/(eMed||1))*Math.sqrt(m.length)*early; if(sc>best){ best=sc; chorusG=g; } }
  let verseG=null; best=-1; for(const [g,m] of groups){ if(g===chorusG||m.length<2) continue; const sc=m.length+m.reduce((a,s)=>a+(s.b1-s.b0),0)/32; if(sc>best){ best=sc; verseG=g; } }
  const firstChorus=segs.findIndex(s=>s.g===chorusG), lastChorus=chorusG==null?-1:segs.map(s=>s.g).lastIndexOf(chorusG);
  let nV=0,nC=0; segs.forEach((s,i)=>{
    if(s.g===chorusG){ s.kind="chorus"; s.label=`chorus ${++nC}`; }
    else if(i===0&&s.e<eMed*0.95&&(firstChorus!==0)) { s.kind="intro"; s.label="intro"; }
    else if(i===segs.length-1&&i>lastChorus&&lastChorus>=0) { s.kind="outro"; s.label="outro"; }
    else if(s.g===verseG||(chorusG!=null&&i<firstChorus)) { s.kind="verse"; s.label=`verse ${++nV}`; }
    else if(groups.get(s.g).length===1&&i>firstChorus&&firstChorus>=0) { s.kind="bridge"; s.label="bridge"; }
    else { s.kind="verse"; s.label=`verse ${++nV}`; } });
  // a boundary sits on the beat where the music actually changes: test the bar line and the beats either side of it
  const E=an.E||[], bi=t=>{ let k=0; while(k<B.length-1&&B[k+1]<=t+1e-3) k++; return k; }, avg=(a,z)=>{ let x=0,c=0; for(let k=Math.max(0,a);k<Math.min(E.length,z);k++){ x+=E[k]; c++; } return c?x/c:0; };
  const snap=t=>{ const i=bi(t); let best=i, bs=-1; for(const k of [i-1,i,i+1]){ if(k<4||k>=B.length-4) continue; const v=Math.abs(avg(k,k+meter)-avg(k-meter,k))+(k===i?0.02:0); if(v>bs){ bs=v; best=k; } } return B[best]; };
  segs.forEach((s,i)=>{ if(i>0) s.tt=snap(bars[s.b0][0]); });
  const out=segs.map(s=>({t0:s.tt!=null?s.tt:bars[s.b0][0], t1:0, bars:s.b1-s.b0, kind:s.kind, label:s.label, chorus:s.kind==="chorus", energy:+s.e.toFixed(2), group:s.g}));
  if(out.length) out[0].t0=Math.min(out[0].t0,0.0001); out.forEach((o,i)=>{ o.t1=i+1<out.length?out[i+1].t0:an.duration; });
  return out;
}
/* the song's sections, worked out once per beat map and cached on it */
function songSections(){ const an=S.an; if(!an) return []; if(an.sections!==undefined) return an.sections||[];
  try{ an.sections=S.audioBuf?songStructure(S.audioBuf,an):null; }catch(e){ an.sections=null; } return an.sections||[]; }
