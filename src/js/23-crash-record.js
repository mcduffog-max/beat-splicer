/* ---------------- Crash record: if the page dies while analysing a file, name it next time and set it aside ---------------- */
const fileKeyOf=f=>f.name+"|"+f.size;
function crumb(step){ try{ const a=JSON.parse(localStorage.getItem("beatsplicerCrumbs")||"[]"); a.push({step,t:Date.now(),mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null}); localStorage.setItem("beatsplicerCrumbs",JSON.stringify(a.slice(-14))); }catch(e){} }
function crumbsNotice(){ try{ const a=JSON.parse(localStorage.getItem("beatsplicerCrumbs")||"[]"); if(!a.length) return; const last=a[a.length-1];
    if(last.step==="idle"||last.step==="song ready"||Date.now()-last.t>6*3600e3){ return; }
    if(/beat this/i.test(last.step)){ try{ localStorage.setItem("beatsplicerBTcrash","1"); }catch(e){} localStorage.setItem("beatsplicerCrumbs","[]"); try{ localStorage.removeItem("beatsplicerBTphone"); }catch(e){} status("Last time the Beat This! check ran out of memory and stopped the page. It's switched off on this phone; you can switch it back on under Camera and lenses, ideally with fewer other apps open."); return; } // a known cause: switch it off and say so, no error report needed
    const tail=a.slice(-6).map(x=>`${new Date(x.t).toLocaleTimeString()} ${x.step}${x.mem?` (${x.mem} MB)`:""}`).join("\n");
    S.lastError=(S.lastError?S.lastError+"\n\n":"")+"Last steps before the page stopped:\n"+tail+"\nBrowser: "+navigator.userAgent.slice(0,120);
    if(!$("errBtn").hidden) return;
    status(`The page stopped last time just after: “${last.step}”. Tap “Copy error details” and send them to me.`,true); $("errBtn").hidden=false;
    localStorage.setItem("beatsplicerCrumbs","[]"); }catch(e){} }
function anaMark(kind,f,i,n){ try{ if(f) localStorage.setItem("beatsplicerAnalysing",JSON.stringify({kind,name:f.name,size:f.size,type:f.type||"",i,n,at:Date.now()})); else localStorage.removeItem("beatsplicerAnalysing"); }catch(e){} }
function skipList(){ try{ return JSON.parse(localStorage.getItem("beatsplicerSkip")||"[]"); }catch(e){ return []; } }
function isSkipped(f){ return skipList().includes(fileKeyOf(f)); }
function lastAnalysisNotice(){
  try{ const a=JSON.parse(localStorage.getItem("beatsplicerAnalysing")||"null"); if(!a) return;
    const sk=skipList(); if(!sk.includes(a.name+"|"+a.size)){ sk.push(a.name+"|"+a.size); localStorage.setItem("beatsplicerSkip",JSON.stringify(sk.slice(-50))); }
    localStorage.removeItem("beatsplicerAnalysing");
    S.lastError=`The page stopped while analysing ${a.kind==="song"?"a song":"a clip"}: “${a.name}” (${(a.size/1e6).toFixed(1)} MB, ${a.type||a.name.split(".").pop()}), item ${a.i} of ${a.n}. Browser: ${navigator.userAgent.slice(0,120)}`;
    status(`Last time the page stopped while analysing “${a.name}” (${(a.size/1e6).toFixed(0)} MB). It’s been set aside: link the folder again and the rest will be analysed. Tap “Copy error details” to send me what happened.`,true); $("errBtn").hidden=false;
  }catch(e){} }

/* Large WAV files are read in pieces and reduced to analysis quality (22 kHz mono) as they're read, never decoded whole:
   a 24-bit 96 kHz track would otherwise need several hundred MB just to be opened. */
async function wavForAnalysis(file){ return wavRead(file,"analysis"); }
async function wavForPlayback(file){ return wavRead(file,"playback"); }
async function wavRead(file,mode,secStart,secLen){
  const head=new DataView(await file.slice(0,Math.min(file.size,1<<16)).arrayBuffer());
  const tag=o=>String.fromCharCode(head.getUint8(o),head.getUint8(o+1),head.getUint8(o+2),head.getUint8(o+3));
  if(tag(0)!=="RIFF"||tag(8)!=="WAVE") return null;
  let o=12, fmt=null, dataOff=0, dataLen=0;
  while(o+8<=head.byteLength){ const id=tag(o), len=head.getUint32(o+4,true);
    if(id==="fmt ") fmt={code:head.getUint16(o+8,true),ch:head.getUint16(o+10,true),sr:head.getUint32(o+12,true),bits:head.getUint16(o+22,true)};
    if(id==="data"){ dataOff=o+8; dataLen=Math.min(len,file.size-dataOff); break; }
    o+=8+len+(len&1); }
  if(!fmt||!dataOff) return null;
  const code=fmt.code===0xFFFE?(fmt.bits===32?3:1):fmt.code, bps=fmt.bits/8, frame=bps*fmt.ch; if(!(code===1||code===3)||![2,3,4].includes(bps)) return null;
  const play=mode==="playback";
  // playback keeps stereo at the file's own rate, or a whole fraction of a hi-res rate; analysis is mono at 22 kHz
  const fac=play?(fmt.sr>=176400?4:fmt.sr>=88200?2:1):fmt.sr/22050, outSr=play?fmt.sr/fac:22050, nch=play?Math.min(2,fmt.ch):1;
  if(play&&outSr<8000) return null;
  if(secStart!=null){ const f0=Math.floor(secStart*fmt.sr)*frame; dataOff+=Math.min(f0,dataLen); dataLen=Math.max(0,Math.min(dataLen-f0,Math.floor((secLen||0)*fmt.sr)*frame)); }
  const frames=Math.floor(dataLen/frame), outLen=Math.floor(frames/fac), outs=[...Array(nch)].map(()=>new Float32Array(outLen));
  const CH=Math.floor((8<<20)/frame)*frame, acc=new Float64Array(nch); let cnt=0,oi=0,next=fac,fi=0;
  const rd=(dv,p)=>code===3?dv.getFloat32(p,true): bps===2?dv.getInt16(p,true)/32768: bps===3?((dv.getUint8(p)|(dv.getUint8(p+1)<<8)|(dv.getInt8(p+2)<<16)))/8388608: dv.getInt32(p,true)/2147483648;
  for(let pos=0;pos<frames*frame&&oi<outLen;pos+=CH){ const dv=new DataView(await file.slice(dataOff+pos,dataOff+Math.min(frames*frame,pos+CH)).arrayBuffer());
    for(let b=0;b+frame<=dv.byteLength;b+=frame,fi++){
      if(nch===1){ let v=0; for(let c=0;c<fmt.ch;c++) v+=rd(dv,b+c*bps); acc[0]+=v/fmt.ch; }
      else { acc[0]+=rd(dv,b); acc[1]+=rd(dv,b+(fmt.ch>1?bps:0)); }
      cnt++; if(fi+1>=next){ if(oi<outLen){ for(let c=0;c<nch;c++){ outs[c][oi]=acc[c]/cnt; acc[c]=0; } oi++; } cnt=0; next+=fac; } } // average each group of samples down
    await yieldNow(); }
  const buf=new AudioBuffer({length:Math.max(1,oi),numberOfChannels:nch,sampleRate:outSr}); outs.forEach((o,c)=>buf.copyToChannel(o.subarray(0,oi),c)); return buf;
}
async function songForAnalysis(file){
  if(/\.wav$/i.test(file.name) && file.size>40e6){ const b=await wavForAnalysis(file); if(b) return b; }
  const oc=new OfflineAudioContext(2,1,22050); return await oc.decodeAudioData(await file.arrayBuffer());
}

