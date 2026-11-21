"use strict";
const APP_SRC = (()=>{ try{
  const d=document.documentElement.cloneNode(true);
  d.querySelectorAll("script:not(#app)").forEach(s=>s.remove());
  d.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(m=>m.remove());
  const csp=document.createElement("meta"); csp.setAttribute("http-equiv","Content-Security-Policy");
  csp.setAttribute("content","default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/ https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/ https://cdn.jsdelivr.net/npm/mp4box@0.5.2/ https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src blob:; connect-src https://lrclib.net https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/ https://api.openai.com https://generativelanguage.googleapis.com https://api.x.ai; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
  const head=d.querySelector("head"); head.insertBefore(csp,head.firstChild);
  d.querySelectorAll('input[type="password"]').forEach(i=>i.removeAttribute("value"));
  return "<!doctype html>\n"+d.outerHTML; }catch(e){ return ""; } })();
const _$c=new Map(); const $ = id => { const e=_$c.get(id); if(e&&e.isConnected) return e; const f=document.getElementById(id); if(f) _$c.set(id,f); return f; }; /* remembered: the planner reads settings thousands of times a build */
/* settings read in the planner's inner loops: remembered until the next build or the next change on the page */
const _ov=new Map(); let _ovGen=-1; ["change","input"].forEach(ev=>document.addEventListener(ev,()=>_ov.clear(),true));
function optV(id){ if(_ovGen!==S._planGen){ _ov.clear(); _ovGen=S._planGen; } let v=_ov.get(id); if(v===undefined){ const e=$(id); v=e?(e.type==="checkbox"?e.checked:e.value):null; _ov.set(id,v); } return v; }
const S = { audioBuf:null, audioName:"", an:null, clips:[], plan:null, seed:1, running:null, peaks:null, results:[], review:null, reviewedSig:null, cropIdx:-1 };
const capP = name => (window.claude && window.claude.use) ? window.claude.use(name).catch(()=>null) : Promise.resolve(null);
const downloadsP = capP("downloads"), sampleP = capP("sample");

const FREQS=[31,62,125,250,500,1000,2000,4000,8000,16000];
const FLAB=["31 Hz","62 Hz","125 Hz","250 Hz","500 Hz","1 kHz","2 kHz","4 kHz","8 kHz","16 kHz"];
const PRESETS={
  "Flat":{b:[0,0,0,0,0,0,0,0,0,0]}, "Bass boost":{b:[6,5,4,2,0,0,0,0,0,0]},
  "Treble boost":{b:[0,0,0,0,0,0,2,4,5,6]}, "Vocal":{b:[-3,-2,-1,0,2,4,4,2,0,-1]},
  "Loudness":{b:[5,4,2,0,-1,0,0,1,3,4]}
};
const EQ={bands:new Array(10).fill(0), bass:0, treble:0, vol:1, preset:"Flat"};
let LIVE=null;

/* Publishing endpoints. Safe = share of the frame kept clear of platform buttons and captions. */
const ENDPOINTS=[
  {id:"youtube", name:"YouTube", w:1920,h:1080, fps:30, br:14e6, lufs:-14, max:Infinity, short:false, safe:{t:.05,b:.05,l:.05,r:.05}, tip:"Landscape 16:9. Longer edits are fine. YouTube plays at about −14 LUFS."},
  {id:"shorts",  name:"YouTube Shorts", w:1080,h:1920, fps:30, br:12e6, lufs:-14, max:180, rec:29, short:true, safe:{t:.12,b:.25,l:.06,r:.14}, tip:"Vertical 9:16, up to 3 minutes. Keep text out of the bottom fifth and right edge."},
  {id:"reels",   name:"Instagram and Facebook Reels", w:1080,h:1920, fps:30, br:12e6, lufs:-14, max:180, rec:15, short:true, safe:{t:.14,b:.22,l:.06,r:.12}, tip:"Vertical 9:16, up to 3 minutes. The grid previews the centre, so keep the subject central."},
  {id:"igfeed",  name:"Instagram and Facebook feed", w:1080,h:1350, fps:30, br:10e6, lufs:-14, max:180, rec:30, short:true, muted:true, safe:{t:.06,b:.10,l:.06,r:.06}, tip:"Portrait 4:5, the tallest shape the feed shows without cropping."},
  {id:"tiktok",  name:"TikTok", w:1080,h:1920, fps:30, br:12e6, lufs:-14, max:600, rec:30, short:true, safe:{t:.12,b:.24,l:.06,r:.16}, tip:"Vertical 9:16. Captions and buttons cover the bottom quarter and right edge."},
  {id:"spotlight", name:"Snapchat Spotlight", w:1080,h:1920, fps:30, br:12e6, lufs:-14, max:60, rec:30, short:true, safe:{t:.15,b:.20,l:.06,r:.12}, tip:"Vertical 9:16; keep it under 60 s. The top 15% and bottom 20% are covered by names and buttons."},
  {id:"pinterest", name:"Pinterest video Pin", w:1000,h:1500, fps:30, br:10e6, lufs:-14, max:900, rec:15, short:true, safe:{t:.08,b:.06,l:.06,r:.10}, tip:"2:3 portrait. Pinterest suggests 6 to 15 s; the save button sits top right."},
  {id:"linkedin",  name:"LinkedIn and X feed", w:1080,h:1350, fps:30, br:10e6, lufs:-14, max:600, rec:30, short:true, muted:true, safe:{t:.08,b:.12,l:.08,r:.08}, tip:"4:5 portrait is the safest feed shape on LinkedIn and X. Both autoplay muted, so on-screen text carries the message."},
  {id:"square",  name:"Square (any feed)", w:1080,h:1080, fps:30, br:10e6, lufs:-14, max:600, rec:30, short:true, safe:{t:.06,b:.06,l:.06,r:.06}, tip:"1:1 plays well in mixed feeds on desktop and mobile."},
  {id:"tv",      name:"TV and big screens", w:1920,h:1080, fps:25, br:20e6, lufs:-23, max:Infinity, short:false, safe:{t:.1,b:.1,l:.1,r:.1}, tip:"1080p at 25 fps (PAL regions), −23 LUFS broadcast loudness, text kept inside the title-safe area."},
  {id:"mobile",  name:"Mobile and messaging", w:720,h:1280, fps:30, br:4e6, lufs:-14, max:Infinity, short:false, safe:{t:.06,b:.08,l:.06,r:.06}, tip:"Smaller vertical file that sends quickly over WhatsApp and Messages."}
];
const EP=id=>ENDPOINTS.find(e=>e.id===id);
S.eps=["shorts"]; // YouTube Shorts unless the person picks others

const LOOK_IDS=["mode","pace","variety","trans","trLen","fit","zoom","kb","fadeIn","fadeOut","look","fxPulse","fxShake","fxGlitch","fxGrain","fxVignette","fxBars","hookText","endText","space","spaceAmt","shortLen","previewEp","showSafe","aiGate",
  "fxFisheye","fxSplit","fxMultiply","fxMirror","fxStrobe","fxHandheld","fxWash","fxDoodles","slowmo",
  "rvClaude","rvOpenai","rvGemini","rvGrok","modelOpenai","modelGemini","modelGrok","keepKeys","capTopic",
  "stillMotion","lens","camEnergy","textStyle","ovLeaks","ovBokeh","ovDust","ovLower","clipSound","clipVol","projName","nameScheme","proRules","autoTitles","payoffOn","artistName","engine","storyOn","storyShape","faceFrame","aiImagery","exclN","fxRamp","motif","sigTrans","fxReverse","camMoves","ownMusic","songVer","audTexture","audRadio","audFilterDrop","audStutter","audEcho","songEnd","sfxWhoosh","sfxImpact","sfxRiser","endStyle","endCard","wmAvoid","progBorder","progScope","progOpacity","progDir","progColor","progShadow","progSide","textFold","lyricMatch","lyricShow","colMatch","cutAction","matchCuts","phrasing","restraint","ownMotif","dirNote","houseOn","planWhole","autoCut","refOn","gpuFinish","motionBlur","beatThis"];
function saveSettings(){ try{ const look={}; LOOK_IDS.forEach(id=>{ const el=$(id); if(el) look[id]=el.type==="checkbox"?el.checked:el.value; });
  localStorage.setItem("beatsplicer2",JSON.stringify({EQ,look,eps:S.eps,t2:1,t3:1})); }catch(e){} }
function loadSettings(){ try{ const s=JSON.parse(localStorage.getItem("beatsplicer2")||"null"); if(!s) return;
  if(!s.t2&&s.look){ s.look.autoTitles=false; s.look.payoffOn=false; } // Nov 2026: no titles unless the person adds one
  if(!s.t3&&s.look){ s.look.camMoves="director"; } // Nov 2026: the camera director becomes the default
  if(s.look&&s.look.lens&&!/^kit:/.test(s.look.lens)&&!LENSES[s.look.lens]&&!["tiltshift","none"].includes(s.look.lens)) s.look.lens={telephoto:"cooke",dreamy:"promist",vintage:"k35",natural:"none"}[s.look.lens]||"kit:cinema"; // earlier lens names
  if(s.EQ) Object.assign(EQ,s.EQ);
  if(Array.isArray(s.eps)) S.eps=s.eps.filter(id=>EP(id));
  if(s.look) LOOK_IDS.forEach(id=>{ const el=$(id); if(!el||!(id in s.look)) return; if(el.type==="checkbox") el.checked=!!s.look[id]; else el.value=id==="textStyle"?normStyle(s.look[id]):s.look[id]; });
}catch(e){} }

