/* ---------------- Beat This! on capable devices ----------------
   Beat This! (Foscarin, Schlüter and Widmer, 2024, MIT licence) is a neural beat and downbeat tracker that is far more
   reliable than hand-built signal processing on syncopated, swung and odd-feeling music. It needs WebGPU to run at a
   useful speed (Chrome on Android 12 and up, or a recent desktop); on other devices this part stays switched off.
   When it runs, it acts as a referee: if its beats disagree with the app's own (a doubled or halved tempo, a beat that
   sits between the drums, the downbeat on the wrong count), the song is re-counted on its beats and downbeats.
   The model (about 190 MB) downloads once and the browser keeps it. */
const BT={base:"https://huggingface.co/musetric/beat-this-onnx/resolve/main/", ort:"https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.webgpu.min.mjs"};
let _btSess=null, _btGPU=null;
async function webgpuReady(){ if(_btGPU!==null) return _btGPU; try{ _btGPU=!!(navigator.gpu&&await navigator.gpu.requestAdapter()); }catch(e){ _btGPU=false; } return _btGPU; }
/* "capable" means WebGPU and room to spare: the model and its working memory need several hundred MB, which takes a
   phone's page down (a 4 GB Android phone did exactly that). So: 8 GB or more and not a phone, and never again on a
   device where it once stopped the page. */
function btRoomy(){ const mem=navigator.deviceMemory||4, phone=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); let crashed=false, phoneOn=false; try{ crashed=!!localStorage.getItem("beatsplicerBTcrash"); phoneOn=localStorage.getItem("beatsplicerBTphone")==="1"; }catch(e){} return !!window.BS_BT_MOCK||(mem>=8&&!phone&&!crashed)||(phone&&phoneOn); } // phones: only when you switch it on for this phone
/* each song is checked once and the answer kept, so the model never has to run twice for the same song */
function btCacheKey(){ return S.audioFile?`bt:${S.audioFile.name}:${S.audioFile.size}`:null; }
function btCached(){ try{ const k=btCacheKey(); const v=k&&localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
function btStore(r){ try{ const k=btCacheKey(); if(k) localStorage.setItem(k,JSON.stringify({beats:r.beats.map(x=>+x.toFixed(3)),downs:r.downs.map(x=>+x.toFixed(3))})); }catch(e){} }
function btRelease(){ try{ if(_btSess&&_btSess.s&&_btSess.s.release) _btSess.s.release(); }catch(e){} _btSess=null; } // the model's memory goes back to the phone straight after
async function btAvailable(){ return !HOSTED&&(!$("beatThis")||$("beatThis").checked)&&btRoomy()&&(!!window.BS_BT_MOCK||await webgpuReady()); }
async function btSession(){ if(window.BS_BT_MOCK) return {mock:true}; if(_btSess) return _btSess;
  const ort=await import(BT.ort); const [model,fb]=await Promise.all([fetch(BT.base+"beat_this.onnx").then(r=>r.arrayBuffer()), fetch(BT.base+"mel-filterbank.bin").then(r=>r.arrayBuffer())]);
  _btSess={ort, s:await ort.InferenceSession.create(model,{executionProviders:["webgpu"]}), fb:new Float32Array(fb)}; return _btSess; }
/* the model's input: 22.05 kHz mono, 1024-point STFT every 441 samples (50 frames a second), 128 mel bands, log1p(1000x) */
async function btSpectrogram(buf,fb){ const sr=22050, n=Math.ceil(buf.duration*sr), oc=new OfflineAudioContext(1,n,sr), src=oc.createBufferSource(), mono=oc.createBuffer(1,buf.length,buf.sampleRate), m=mono.getChannelData(0);
  for(let c=0;c<buf.numberOfChannels;c++){ const d=buf.getChannelData(c); for(let i=0;i<d.length;i++) m[i]+=d[i]/buf.numberOfChannels; } // the mean of the channels
  src.buffer=mono; src.connect(oc.destination); src.start(); const x=(await oc.startRendering()).getChannelData(0);
  const N=1024, H=441, T=Math.floor(x.length/H)+1, win=new Float32Array(N); for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N); // periodic Hann
  const at=i=>{ i-=N/2; if(i<0) i=-i; if(i>=x.length) i=2*(x.length-1)-i; return x[Math.max(0,Math.min(x.length-1,i))]; }; // centred, reflect padding
  const re=new Float32Array(N), im=new Float32Array(N), out=new Float32Array(T*128), mag=new Float32Array(513), rev=new Uint16Array(N);
  for(let i=0;i<N;i++){ let r=0; for(let b=0,v=i;b<10;b++,v>>=1) r=(r<<1)|(v&1); rev[i]=r; }
  for(let t=0;t<T;t++){ for(let i=0;i<N;i++){ re[rev[i]]=at(t*H+i)*win[i]; im[rev[i]]=0; }
    for(let s=2;s<=N;s<<=1){ const h=s>>1, a=-2*Math.PI/s; for(let k=0;k<h;k++){ const wr=Math.cos(a*k), wi=Math.sin(a*k); for(let j=k;j<N;j+=s){ const l=j+h, tr=wr*re[l]-wi*im[l], ti=wr*im[l]+wi*re[l]; re[l]=re[j]-tr; im[l]=im[j]-ti; re[j]+=tr; im[j]+=ti; } } }
    for(let k=0;k<513;k++) mag[k]=Math.hypot(re[k],im[k])/32; // divided by sqrt(n_fft)
    for(let b=0;b<128;b++){ let s=0; for(let k=0;k<513;k++) s+=mag[k]*fb[k*128+b]; out[t*128+b]=Math.log1p(1000*s); } }
  return {spec:out, T}; }
/* run in windows of 1500 frames (30 s), keeping 6 frames of border, and pick the peaks */
async function btRun(buf){ const S0=await btSession(); let beatL, downL, T;
  if(S0.mock){ ({beatL,downL,T}=window.BS_BT_MOCK(buf)); }
  else { const {spec,T:TT}=await btSpectrogram(buf,S0.fb); T=TT; beatL=new Float32Array(T).fill(-9); downL=new Float32Array(T).fill(-9); const C=1500, Bd=6;
    for(let st=-Bd; st<T; st+=C-2*Bd){ const w=new Float32Array(C*128); for(let f=0;f<C;f++){ const g=st+f; if(g>=0&&g<T) w.set(spec.subarray(g*128,g*128+128),f*128); }
      const r=await S0.s.run({spect:new S0.ort.Tensor("float32",w,[1,C,128])}), b=r.beat.data, d=r.downbeat.data;
      for(let f=Bd;f<C-Bd;f++){ const g=st+f; if(g>=0&&g<T&&beatL[g]===-9){ beatL[g]=b[f]; downL[g]=d[f]; } } } }
  const peaks=L=>{ const out=[]; for(let i=0;i<L.length;i++){ if(L[i]<=0) continue; let mx=true; for(let d=-3;d<=3;d++) if(L[i+d]>L[i]) mx=false; if(mx&&(!out.length||i-out[out.length-1]>3)) out.push(i); } return out.map(i=>i/50); };
  const beats=peaks(beatL), downs=peaks(downL).map(t=>beats.reduce((a,b)=>Math.abs(b-t)<Math.abs(a-t)?b:a,beats[0])); return {beats,downs}; }
/* the referee: agree, or re-count the song on the neural beats */
async function btReferee(){ if(!S.an||!S.audioBuf||S.an._bt||(S.an.feel&&S.an.feel.free==="beatless")||!(await btAvailable())) return;
  const an=S.an; let r=btCached(); if(!r){ try{ await heavy("Checking the beat with Beat This!",async()=>{ status("Checking the beat with Beat This! (downloads once)…"); try{ r=await btRun(S.audioBuf); } finally{ if(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) btRelease(); } }); if(r) btStore(r); }catch(e){ status("Beat This! couldn't run here: "+(e&&e.message||e)); return; } }
  if(!r||r.beats.length<16||S.an!==an) return; const near=(t,L,tol)=>L.some(b=>Math.abs(b-t)<=tol);
  const agree=r.beats.filter(t=>near(t,an.beats,0.07)).length/r.beats.length, extra=an.beats.filter(t=>!near(t,r.beats,0.07)).length/an.beats.length;
  const dn=an.beats.filter((b,i)=>isDownAt(an,i)), dAgree=r.downs.filter(t=>near(t,dn,0.08)).length/Math.max(1,r.downs.length);
  an._bt={agree:+agree.toFixed(2), extra:+extra.toFixed(2), dAgree:+dAgree.toFixed(2)};
  if(agree>=0.85&&extra<=0.2&&dAgree>=0.7){ status(`Beat This! agrees with the beat (${Math.round(an.bpm)} BPM).`); return; }
  const old=Math.round(an.bpm), n=await analyzeAudio(S.audioBuf,null,{beats:r.beats,downs:r.downs}); n._bt={...an._bt, fixed:true, from:old}; S.an=n; S.an.sections=null; try{ songSections(); }catch(e){}
  try{ renderTempo(); }catch(e){} status(`Beat This! re-counted the song: ${old} → ${Math.round(n.bpm)} BPM${dAgree<0.7?", with the downbeat moved to where the bar really starts":""}.`); if(!S.running) buildPlan(); }

/* the phone switch: shown only on phones that have WebGPU */
(async()=>{ const phone=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); if(!phone||HOSTED||!$("btPhoneRow")) return; if(!(await webgpuReady())) return; $("btPhoneRow").hidden=false;
  try{ $("btPhone").checked=localStorage.getItem("beatsplicerBTphone")==="1"; }catch(e){}
  $("btPhone").addEventListener("change",()=>{ try{ if($("btPhone").checked){ localStorage.setItem("beatsplicerBTphone","1"); localStorage.removeItem("beatsplicerBTcrash"); } else localStorage.removeItem("beatsplicerBTphone"); }catch(e){} if($("btPhone").checked&&S.an&&!S.an._bt) btReferee().catch(()=>{}); }); })();
