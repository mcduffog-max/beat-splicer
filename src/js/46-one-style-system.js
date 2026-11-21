/* ---------------- One style system ----------------
   A single Style card: Automatic (Do everything picks), Ask AI, a look, or a director, plus the visual idea. The newest
   choice wins, and the card always says what is in effect, who chose it, and whether you've adjusted it since. */
S.style=S.style||{name:"",by:"",auto:true,custom:false};
function renderStyleState(){ const st=S.style, nm=st.name||S.direct||"";
  $("styleAutoChip").setAttribute("aria-pressed",String(!!st.auto));
  document.querySelectorAll("#styles .chip,#dstyles .chip").forEach(c=>c.setAttribute("aria-pressed",String(!st.auto&&c.textContent===nm)));
  const by={auto:"Chosen by Do everything",ai:"Picked by AI",you:"Your choice",pick:"Picked for this song"}[st.by]||"";
  $("styleNow").textContent=nm?`${st.custom?"Custom, based on ":""}${nm}${by?` · ${by}`:""}`:st.auto?"Automatic: Do everything picks a style for each new cut.":"";
  const d=(STYLES[nm]||DSTYLES[nm]||{}).d; $("styleDesc").textContent=d||"";
  const mi=MOTIF_INFO[motifId()]; $("motifDesc").textContent=mi&&motifId()!=="none"?`${mi[0]}: ${mi[1]}.`:""; }
function setStyleState(name,by,auto){ S.style={name:name||"",by:by||"",auto:!!auto,custom:false}; renderStyleState(); saveProjectSoon(); }
// every route into a style reports here
{ const _as=applyStyle; applyStyle=function(name,tied){ const r=_as.apply(this,arguments); if(!tied) setStyleState(name,"you",false); return r; }; }
{ const _sd=setDirect; setDirect=function(name,why){ const r=_sd.apply(this,arguments); if(!S._autoRun&&!S._styleAI) setStyleState(name||"",name?"you":"",false); return r; }; }
$("styleAutoChip").onclick=()=>{ S.style.auto=true; if(S.an&&S.clips.some(c=>c.samples)){ const p=pickDirector(); S._autoRun=true; try{ $("direct").value="auto"; setDirect(p.name,p.why); }finally{ S._autoRun=false; } setStyleState(p.name,"pick",true); status(`Automatic style: ${p.name} for now (${p.why}). Do everything may pick another for each new cut.`); } else setStyleState("","",true); };
$("styleAiChip").onclick=async()=>{ if(!aiProvider()){ status("Ask AI to choose needs Claude or an AI key: tap All settings, then Where it’s going › Connect ChatGPT, Gemini or Grok.",true); return; } if(!S.plan){ status("Add a song and clips first.",true); return; }
  const b=$("styleAiChip"); b.disabled=true; S._styleAI=true; try{ await aiChooseDirector(); if(S.direct) setStyleState(S.direct,"ai",false); }finally{ S._styleAI=false; b.disabled=false; } };
// adjusting any detail after choosing marks the style as custom (the change itself is still undoable)
setTimeout(renderStyleState,0);
document.addEventListener("change",e=>{ const id=e.target&&e.target.id; if(!id||!LOOK_IDS.includes(id)) return;
  if(id==="motif"){ renderStyleState(); return; } if(["pace","variety","look","trans","trLen","textStyle","sigTrans","kb","slowmo","stillMotion"].includes(id)||/^fx|^ov/.test(id)){ if(S.style.name||S.direct){ S.style.custom=true; renderStyleState(); } } },true);

