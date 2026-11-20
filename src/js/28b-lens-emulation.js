/* ---------------- Lens emulation: the optical character of real lenses, on the GPU ----------------
   One shader reproduces what makes lenses look different, each property measured from how those lenses render:
     distortion   barrel bulge (wide and anamorphic glass) or none (modern primes)
     fringing     lateral chromatic aberration growing towards the edges (older and cheaper glass)
     falloff      natural vignetting, round, or oval for anamorphics
     field        softness towards the edges; swirl (the Helios / Petzval "swirly bokeh"); horizontal smear for anamorphics
     glow         halation and diffusion around highlights (vintage coatings, Pro-Mist filters)
     colour       warmth, contrast and lifted blacks (Cooke warmth, 70s cine glass, film stocks)
     film         grain and gate weave (16 mm, Super 8)
   Profiles are "in the style of": they reproduce the character, nothing is licensed from the makers. A kit assigns a
   lens to each section of the song (Do everything picks the kit). Without WebGL the older 2D looks are used. */
const LENSES={
  modern:   {name:"Modern prime (Zeiss Master Prime style): clean, crisp", k:0, ca:0.0004, vig:0.12, soft:0, swirl:0, ana:0, hal:0, warm:0, con:1.04, lift:0, grain:0, weave:0},
  cooke:    {name:"Cooke-style warmth: gentle, flattering", k:0.01, ca:0.0010, vig:0.28, soft:0.35, swirl:0, ana:0, hal:0.10, warm:0.035, con:0.95, lift:0.02, grain:0, weave:0},
  helios:   {name:"Helios 44-2 style: swirly edges, soft contrast", k:0.02, ca:0.0028, vig:0.38, soft:0.2, swirl:1.0, ana:0, hal:0.16, warm:0.02, con:0.9, lift:0.035, grain:0, weave:0},
  anamorphic:{name:"Anamorphic (Panavision C-series style): oval falloff, streaks", k:0.045, ca:0.0022, vig:0.4, soft:0.45, swirl:0, ana:1, hal:0.12, warm:-0.015, con:1.02, lift:0.015, grain:0, weave:0},
  k35:      {name:"70s cine glass (Canon K35 style): warm glow", k:0.015, ca:0.0018, vig:0.3, soft:0.3, swirl:0, ana:0, hal:0.34, warm:0.05, con:0.88, lift:0.045, grain:0.04, weave:0},
  promist:  {name:"Diffusion filter (Black Pro-Mist style): soft highlights", k:0, ca:0.0005, vig:0.15, soft:0.15, swirl:0, ana:0, hal:0.42, warm:0.01, con:0.93, lift:0.03, grain:0, weave:0},
  film16:   {name:"16 mm film: grain, soft corners", k:0.02, ca:0.0015, vig:0.42, soft:0.45, swirl:0, ana:0, hal:0.14, warm:0.02, con:0.94, lift:0.04, grain:0.13, weave:0.0012},
  super8:   {name:"Super 8: heavy grain, gate weave, warm fade", k:0.03, ca:0.0030, vig:0.6, soft:0.7, swirl:0, ana:0, hal:0.22, warm:0.06, con:0.84, lift:0.07, grain:0.22, weave:0.003},
  petzval:  {name:"Petzval style: sharp centre, strong swirl", k:0.01, ca:0.0025, vig:0.5, soft:0.5, swirl:1.6, ana:0, hal:0.12, warm:0.02, con:0.92, lift:0.03, grain:0, weave:0},
};
/* kits: which lens each part of the song is shot on */
const LENS_KITS={
  cinema:  {name:"Modern cinema", verse:"cooke", chorus:"modern", bridge:"promist", intro:"cooke", outro:"cooke"},
  epic:    {name:"Anamorphic epic", verse:"anamorphic", chorus:"anamorphic", bridge:"promist", intro:"anamorphic", outro:"anamorphic"},
  vintage: {name:"Vintage film", verse:"k35", chorus:"k35", bridge:"helios", intro:"super8", outro:"super8"},
  indie:   {name:"Indie 16 mm", verse:"film16", chorus:"film16", bridge:"helios", intro:"film16", outro:"film16"},
  dream:   {name:"Dreamy", verse:"helios", chorus:"promist", bridge:"petzval", intro:"promist", outro:"helios"},
  clean:   {name:"Clean and sharp", verse:"modern", chorus:"modern", bridge:"modern", intro:"modern", outro:"modern"},
};
function lensProfile(seg){ if(!has("lens")) return null; const v=$("lens")?$("lens").value:"kit:cinema"; if(LENSES[v]) return v; if(v==="natural"||v==="none") return null;
  const kit=LENS_KITS[(v.startsWith("kit:")?v.slice(4):null)||"cinema"]||LENS_KITS.cinema; if(!seg) return kit.verse; const sec=camSection(seg.start+0.05)||(seg.e>0.75?"chorus":"verse"); return kit[sec]||kit.verse; }
const LENS_FS=`precision highp float; varying vec2 v; uniform sampler2D T; uniform vec2 R; uniform float K,CA,VIG,SOFT,SWIRL,ANA,HAL,WARM,CON,LIFT,GRAIN,SEED; uniform vec2 WV;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+SEED)*43758.5453); }
vec3 tap(vec2 u){ return texture2D(T,clamp(u,0.0,1.0)).rgb; }
void main(){ vec2 asp=vec2(R.x/R.y,1.0); vec2 p=(v-0.5); vec2 q=p*asp; float r2=dot(q,q)/dot(asp*0.5,asp*0.5);
  vec2 u=0.5+p*(1.0+K*r2)/(1.0+K)+WV;                                                     // barrel distortion, scaled so the frame stays filled; gate weave
  float e=smoothstep(0.25,1.0,r2);                                                         // how far into the edge of the field
  vec2 rad=normalize(p+1e-5), tan=vec2(-rad.y,rad.x);
  vec3 c=vec3(tap(u+p*CA*r2*2.0).r, tap(u).g, tap(u-p*CA*r2*2.0).b);                      // lateral chromatic aberration
  if(SOFT+SWIRL>0.0){ vec3 acc=c; float w=1.0; for(int i=1;i<=6;i++){ float f=float(i)/6.0-0.58;
      vec2 dir=SWIRL>0.0?tan*SWIRL:(ANA>0.0?vec2(1.0,0.0):rad); vec2 o=dir*f*e*0.012*(SOFT+SWIRL)/asp;   // swirl along circles, smear sideways for anamorphics, radial blur otherwise
      acc+=tap(u+o); w+=1.0; } c=mix(c,acc/w,clamp(e*1.4,0.0,1.0)); }
  if(HAL>0.0){ vec3 g=vec3(0.0); for(int i=0;i<8;i++){ float a=float(i)*0.785398; vec2 o=vec2(cos(a),sin(a))*0.006*vec2(1.0+ANA*1.5,1.0)/asp; vec3 s=tap(u+o); g+=max(s-0.62,0.0); }
    c+=g/8.0*HAL*vec3(1.25,0.85,0.65)*2.2; }                                               // halation: warm glow bleeding from highlights
  vec2 vq=q; if(ANA>0.0) vq.x*=0.72; float vr=dot(vq,vq)/dot(asp*0.5,asp*0.5); c*=mix(1.0,pow(cos(min(1.4,sqrt(vr)*0.95)),4.0),VIG*1.6); // cos^4 natural falloff, oval for anamorphics
  c=(c-0.5)*CON+0.5; c=c*(1.0-LIFT)+LIFT; c.r+=WARM; c.b-=WARM;
  if(GRAIN>0.0){ float n=hash(v*R*0.5)-0.5; c+=n*GRAIN*(1.0-0.5*dot(c,vec3(0.33))); }
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0); }`;
let LGL=null;
function lensGL(){ if(LGL!==null) return LGL||null; try{ const cv=document.createElement("canvas"), gl=cv.getContext("webgl",{premultipliedAlpha:false,preserveDrawingBuffer:false,antialias:false}); if(!gl) throw 0;
    const sh=(t,s)=>{ const x=gl.createShader(t); gl.shaderSource(x,s); gl.compileShader(x); if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,"attribute vec2 a; varying vec2 v; void main(){ v=vec2(a.x*0.5+0.5,0.5-a.y*0.5); gl_Position=vec4(a,0.0,1.0); }")); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,LENS_FS)); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW); const loc=gl.getAttribLocation(pr,"a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx); [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE)); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const U={}; ["T","R","K","CA","VIG","SOFT","SWIRL","ANA","HAL","WARM","CON","LIFT","GRAIN","SEED","WV"].forEach(n=>U[n]=gl.getUniformLocation(pr,n));
    LGL={cv,gl,U}; }catch(e){ LGL=false; } return LGL||null; }
/* run the frame through the lens: the 2D frame goes up as a texture, the lens renders it, and the result comes back */
function lensGLPass(o,key,t){ const L=lensGL(), P=LENSES[key]; if(!L||!P) return false; const {cv,gl,U}=L, {W,H,g}=o;
  try{ if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; } gl.viewport(0,0,W,H);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,o.canvas);
    const fr=Math.floor(t*30); gl.uniform2f(U.R,W,H); gl.uniform1f(U.K,P.k); gl.uniform1f(U.CA,P.ca); gl.uniform1f(U.VIG,P.vig); gl.uniform1f(U.SOFT,P.soft); gl.uniform1f(U.SWIRL,P.swirl); gl.uniform1f(U.ANA,P.ana);
    gl.uniform1f(U.HAL,P.hal); gl.uniform1f(U.WARM,P.warm); gl.uniform1f(U.CON,P.con); gl.uniform1f(U.LIFT,P.lift); gl.uniform1f(U.GRAIN,P.grain); gl.uniform1f(U.SEED,(fr%97)*1.37);
    const wv=P.weave?[Math.sin(fr*1.7)*P.weave,(Math.sin(fr*2.3)+Math.sin(fr*0.7))*P.weave*0.6]:[0,0]; gl.uniform2f(U.WV,wv[0],wv[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); g.drawImage(cv,0,0,W,H); return true; }catch(e){ return false; } }
