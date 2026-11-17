/* ---------------- The finishing pass on the graphics chip ----------------
   Each frame, once the shots are laid down (with their shot-matching corrections), one GPU pass does the rest:
     motion blur   camera moves (push, punch, drift, reveal) smear the picture along the move, as a real shutter would
     the lens      distortion, fringing, edge softness, swirl, falloff, halation (in linear light, as optics behave)
     the grade     the colour look as one colour matrix plus its tint layers (multiply, screen, soft light, overlay)
     grain         film grain and gate weave from the lens profile
   One pass instead of a stack of canvas filters and blend layers: better looking and lighter on the phone. Without
   WebGL (or if the graphics chip gives up mid-export) the frame falls back to the canvas look automatically. */
const FINISH_FS=`precision highp float; varying vec2 v; uniform sampler2D T; uniform vec2 R;
uniform float K,CA,VIG,SOFT,SWIRL,ANA,HAL,WARM,CON,LIFT,GRAIN,SEED; uniform vec2 WV; uniform vec3 MB;
uniform mat3 GM; uniform vec3 GO; uniform vec4 LC0,LC1,LC2; uniform float LM0,LM1,LM2;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+SEED)*43758.5453); }
vec3 lin(vec3 c){ return pow(max(c,0.0),vec3(2.2)); } vec3 srgb(vec3 c){ return pow(max(c,0.0),vec3(1.0/2.2)); }
vec3 tap(vec2 u){ return lin(texture2D(T,clamp(u,0.0,1.0)).rgb); }
vec3 blend(vec3 c,vec4 L,float m){ if(m<0.5) return c; vec3 s=L.rgb, r;
  if(m<1.5) r=c*s; else if(m<2.5) r=1.0-(1.0-c)*(1.0-s);
  else if(m<3.5){ vec3 d=mix(sqrt(c),((16.0*c-12.0)*c+4.0)*c,step(c,vec3(0.25))); r=mix(c+(2.0*s-1.0)*(d-c),c-(1.0-2.0*s)*c*(1.0-c),step(s,vec3(0.5))); }
  else r=mix(1.0-2.0*(1.0-c)*(1.0-s),2.0*c*s,step(c,vec3(0.5)));
  return mix(c,r,L.a); }
void main(){ vec2 asp=vec2(R.x/R.y,1.0); vec2 p=v-0.5; vec2 q=p*asp; float r2=dot(q,q)/dot(asp*0.5,asp*0.5);
  vec2 u=0.5+p*(1.0+K*r2)/(1.0+K)+WV; float e=smoothstep(0.25,1.0,r2); vec2 rad=normalize(p+1e-5), tg=vec2(-rad.y,rad.x);
  vec3 c=vec3(tap(u+p*CA*r2*2.0).r, tap(u).g, tap(u-p*CA*r2*2.0).b);
  if(abs(MB.x)+abs(MB.y)+abs(MB.z)>0.0004){ vec3 acc=c; for(int i=1;i<=6;i++){ float f=float(i)/6.0-0.5; acc+=tap(u-(MB.xy+p*MB.z)*f); } c=acc/7.0; } // shutter: the picture smeared along the camera's move
  if(SOFT+SWIRL>0.0){ vec3 acc=c; float w=1.0; for(int i=1;i<=6;i++){ float f=float(i)/6.0-0.58; vec2 dir=SWIRL>0.0?tg*SWIRL:(ANA>0.0?vec2(1.0,0.0):rad); acc+=tap(u+dir*f*e*0.012*(SOFT+SWIRL)/asp); w+=1.0; } c=mix(c,acc/w,clamp(e*1.4,0.0,1.0)); }
  if(HAL>0.0){ vec3 g=vec3(0.0); for(int i=0;i<8;i++){ float a=float(i)*0.785398; vec3 s=tap(u+vec2(cos(a),sin(a))*0.006*vec2(1.0+ANA*1.5,1.0)/asp); g+=max(s-0.35,0.0); } c+=g/8.0*HAL*vec3(1.25,0.85,0.65)*1.6; }
  vec2 vq=q; if(ANA>0.0) vq.x*=0.72; float vr=dot(vq,vq)/dot(asp*0.5,asp*0.5); c*=mix(1.0,pow(cos(min(1.4,sqrt(vr)*0.95)),4.0),VIG*1.6);
  c=srgb(c); c=(c-0.5)*CON+0.5; c=c*(1.0-LIFT)+LIFT; c.r+=WARM; c.b-=WARM;
  c=clamp(GM*c+GO,0.0,1.0); c=blend(c,LC0,LM0); c=blend(c,LC1,LM1); c=blend(c,LC2,LM2);
  if(GRAIN>0.0){ float n=hash(v*R*0.5)-0.5; c+=n*GRAIN*(1.0-0.5*dot(c,vec3(0.33))); }
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0); }`;
let FGL=null, FGL_BROKEN=false;
function finishGL(){ if(FGL!==null) return FGL||null; try{ const cv=document.createElement("canvas"), gl=cv.getContext("webgl",{premultipliedAlpha:false,preserveDrawingBuffer:false,antialias:false}); if(!gl) throw 0;
    const sh=(t,s)=>{ const x=gl.createShader(t); gl.shaderSource(x,s); gl.compileShader(x); if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,"attribute vec2 a; varying vec2 v; void main(){ v=vec2(a.x*0.5+0.5,0.5-a.y*0.5); gl_Position=vec4(a,0.0,1.0); }")); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FINISH_FS)); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW); const loc=gl.getAttribLocation(pr,"a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx); [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE)); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const U={}; ["T","R","K","CA","VIG","SOFT","SWIRL","ANA","HAL","WARM","CON","LIFT","GRAIN","SEED","WV","MB","GM","GO","LC0","LC1","LC2","LM0","LM1","LM2"].forEach(n=>U[n]=gl.getUniformLocation(pr,n));
    cv.addEventListener("webglcontextlost",()=>{ FGL_BROKEN=true; }); FGL={cv,gl,U,slow:false};
    // a software renderer (no real graphics chip) or a slow one would make exports crawl: test once, then decide
    try{ const ext=gl.getExtension("WEBGL_debug_renderer_info"), name=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):""; if(/swiftshader|llvmpipe|software|basic render/i.test(name)) FGL.slow=true;
      else { const t=document.createElement("canvas"); t.width=1080; t.height=1920; const tg=t.getContext("2d"); tg.fillStyle="#468"; tg.fillRect(0,0,1080,1920); cv.width=1080; cv.height=1920; gl.viewport(0,0,1080,1920);
        const run=()=>{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,t); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); tg.drawImage(cv,0,0); tg.getImageData(0,0,1,1); };
        run(); const t0=performance.now(); run(); run(); if((performance.now()-t0)/2>45) FGL.slow=true; } }catch(e){} FGL.renderer=FGL.slow?"slow":"ok"; }catch(e){ FGL=false; } return FGL||null; }
function gpuOn(){ if(FGL_BROKEN||($("gpuFinish")&&!$("gpuFinish").checked)) return false; const L=finishGL(); return !!L&&(!L.slow||!!window.BS_FORCE_GPU); }
/* a CSS filter list as one colour matrix (the Filter Effects formulas; in-between clamping is skipped) */
function filterMatrix(f){ let M=[1,0,0,0,1,0,0,0,1], O=[0,0,0]; const mul=(A,AO)=>{ const N=[],NO=[]; for(let i=0;i<3;i++){ for(let j=0;j<3;j++) N[i*3+j]=A[i*3]*M[j]+A[i*3+1]*M[3+j]+A[i*3+2]*M[6+j]; NO[i]=A[i*3]*O[0]+A[i*3+1]*O[1]+A[i*3+2]*O[2]+AO[i]; } M=N; O=NO; };
  String(f||"").replace(/([a-z-]+)\(([^)]+)\)/g,(m,k,a)=>{ const x=parseFloat(a);
    if(k==="brightness") mul([x,0,0,0,x,0,0,0,x],[0,0,0]);
    else if(k==="contrast") mul([x,0,0,0,x,0,0,0,x],[0.5-0.5*x,0.5-0.5*x,0.5-0.5*x]);
    else if(k==="saturate") mul([0.213+0.787*x,0.715-0.715*x,0.072-0.072*x, 0.213-0.213*x,0.715+0.285*x,0.072-0.072*x, 0.213-0.213*x,0.715-0.715*x,0.072+0.928*x],[0,0,0]);
    else if(k==="grayscale"){ const g=1-Math.min(1,x); mul([0.2126+0.7874*g,0.7152-0.7152*g,0.0722-0.0722*g, 0.2126-0.2126*g,0.7152+0.2848*g,0.0722-0.0722*g, 0.2126-0.2126*g,0.7152-0.7152*g,0.0722+0.9278*g],[0,0,0]); }
    else if(k==="sepia"){ const s=1-Math.min(1,x); mul([0.393+0.607*s,0.769-0.769*s,0.189-0.189*s, 0.349-0.349*s,0.686+0.314*s,0.168-0.168*s, 0.272-0.272*s,0.534-0.534*s,0.131+0.869*s],[0,0,0]); }
    else if(k==="hue-rotate"){ const t=x*Math.PI/180, c=Math.cos(t), s=Math.sin(t); mul([0.213+c*0.787-s*0.213,0.715-c*0.715-s*0.715,0.072-c*0.072+s*0.928, 0.213-c*0.213+s*0.143,0.715+c*0.285+s*0.140,0.072-c*0.072-s*0.283, 0.213-c*0.213-s*0.787,0.715-c*0.715+s*0.715,0.072+c*0.928+s*0.072],[0,0,0]); }
    return m; });
  return {M,O}; }
const BLEND_ID={multiply:1,screen:2,"soft-light":3,overlay:4};
function rgbaOf(s){ const m=String(s).match(/rgba?\(([^)]+)\)/); if(!m) return [0,0,0,0]; const p=m[1].split(",").map(Number); return [p[0]/255,p[1]/255,p[2]/255,p[3]==null?1:p[3]]; }
/* the move's speed this frame, for the shutter */
function moveVelocity(o,t){ const seg=o._seg, c=seg&&S.clips[seg.clip]; if(!seg||!c||c.kind==="image"||!S.an) return [0,0,0]; const dt=1/((o.ep&&o.ep.fps)||30), bi=beatInfo(t);
  const a=directorMove(seg,t,o.W,o.H,bi), b=directorMove(seg,Math.max(seg.start,t-dt),o.W,o.H,beatInfo(t-dt)); if(!a||!b) return [0,0,0];
  const k=0.5; return [k*(a.dx-b.dx)/o.W, k*(a.dy-b.dy)/o.H, k*(a.s/b.s-1)]; } // half the frame's move: a 180° shutter
function gpuFinish(o,t,F,opts){ if(!F.gpu) return false; const L=finishGL(); if(!L) return false; const {cv,gl,U}=L, {W,H,g}=o;
  try{ if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; } gl.viewport(0,0,W,H); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,o.canvas);
    const lensKey=$("lens")&&$("lens").value==="tiltshift"?null:lensProfile(o._seg), P=(lensKey&&LENSES[lensKey])||{k:0,ca:0,vig:0,soft:0,swirl:0,ana:0,hal:0,warm:0,con:1,lift:0,grain:0,weave:0};
    const fr=Math.floor(t*30); gl.uniform2f(U.R,W,H); gl.uniform1f(U.K,P.k); gl.uniform1f(U.CA,P.ca); gl.uniform1f(U.VIG,P.vig); gl.uniform1f(U.SOFT,P.soft); gl.uniform1f(U.SWIRL,P.swirl); gl.uniform1f(U.ANA,P.ana);
    gl.uniform1f(U.HAL,P.hal); gl.uniform1f(U.WARM,P.warm); gl.uniform1f(U.CON,P.con); gl.uniform1f(U.LIFT,P.lift); gl.uniform1f(U.GRAIN,P.grain); gl.uniform1f(U.SEED,(fr%97)*1.37);
    const wv=P.weave?[Math.sin(fr*1.7)*P.weave,(Math.sin(fr*2.3)+Math.sin(fr*0.7))*P.weave*0.6]:[0,0]; gl.uniform2f(U.WV,wv[0],wv[1]);
    const mb=opts&&opts.still||!$("motionBlur")||!$("motionBlur").checked?[0,0,0]:moveVelocity(o,t); gl.uniform3f(U.MB,mb[0],mb[1],mb[2]);
    const fm=filterMatrix(F.look&&F.look.f); gl.uniformMatrix3fv(U.GM,false,new Float32Array([fm.M[0],fm.M[3],fm.M[6],fm.M[1],fm.M[4],fm.M[7],fm.M[2],fm.M[5],fm.M[8]])); gl.uniform3f(U.GO,fm.O[0],fm.O[1],fm.O[2]);
    const ov=(F.look&&F.look.over)||[]; [0,1,2].forEach(i=>{ const l=ov[i]; gl.uniform4fv(U["LC"+i],l?rgbaOf(l[1]):[0,0,0,0]); gl.uniform1f(U["LM"+i],l?BLEND_ID[l[0]]||0:0); });
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); g.save(); g.globalAlpha=1; g.globalCompositeOperation="copy"; g.drawImage(cv,0,0,W,H); g.restore(); return true; }
  catch(e){ FGL_BROKEN=true; return false; } }
