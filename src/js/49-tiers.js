/* ---------------- Free, No watermark, Creator, Pro ----------------
   Only in the Play Store build (STORE); the web app and the sideloaded app have everything.
     Free         full editing, YouTube Shorts and YouTube, 720p, with a small Beat Splicer watermark
     No watermark one purchase removes the watermark
     Creator      1080p, every platform, lens kits, your own look, the director's note, the returning image (no watermark)
     Pro          learning from your YouTube results, edit like this, Which is better, the AI reviewer, several formats at once
   Purchases are one-time Google Play products, read back from Play on every start (Restore purchases does it on demand),
   and kept locally so the app works offline. */
function capEp(ep){ if(has("hd")) return ep; const k=720/Math.min(ep.w,ep.h); return k>=1?ep:{...ep, w:Math.round(ep.w*k/2)*2, h:Math.round(ep.h*k/2)*2, br:Math.round(ep.br*0.55)}; }
/* the watermark: the logo and name, small, top left, inside the safe area */
let _wmImg=null;
function drawTierMark(o){ if(has("watermark")) return; const {g,W,H}=o, s=Math.min(W,H)*0.07, x=Math.round(W*0.05), y=Math.round(H*(W<H?0.13:0.05));
  if(!_wmImg){ _wmImg=new Image(); _wmImg.src="icons/icon-192.png"; }
  g.save(); g.globalAlpha=0.78; g.shadowColor="rgba(0,0,0,0.6)"; g.shadowBlur=s*0.15;
  if(_wmImg.complete&&_wmImg.naturalWidth) g.drawImage(_wmImg,x,y,s,s); else { g.fillStyle="#fff"; g.fillRect(x,y,s,s); }
  g.font=`700 ${Math.round(s*0.42)}px system-ui,sans-serif`; g.fillStyle="#fff"; g.textBaseline="middle"; g.fillText("Beat Splicer",x+s*1.18,y+s/2); g.restore(); }
/* Google Play */
const NPur=()=>NP("NativePurchases");
let _products=null;
async function loadProducts(){ const P=NPur(); if(!P) return null; try{ const r=await P.getProducts({productIdentifiers:Object.keys(TIER_PRODUCTS),productType:"inapp"}); _products=r.products||[]; }catch(e){ _products=[]; } return _products; }
async function readPurchases(){ const P=NPur(); if(!P) return; try{ const r=await P.getPurchases({productType:"inapp"}); let lv=0;
    (r.purchases||[]).forEach(p=>{ const ok=!p.purchaseState||p.purchaseState==="PURCHASED"||p.purchaseState==="1"; if(ok&&TIER_PRODUCTS[p.productIdentifier]) lv=Math.max(lv,TIER_PRODUCTS[p.productIdentifier]); });
    setTier(lv); }catch(e){} }
function setTier(lv){ TIER_LEVEL=lv; try{ localStorage.setItem("beatsplicerTier",String(lv)); }catch(e){} renderTierUI(); if(S.plan&&!S.running) buildPlan(); }
async function buyTier(id){ const P=NPur(); if(!P){ status("Purchases work in the app from Google Play.",true); return; } $("payMsg").textContent="Opening Google Play…";
  try{ const t=await P.purchaseProduct({productIdentifier:id,productType:"inapp",quantity:1}); if(t&&(t.purchaseState==="PENDING")){ $("payMsg").textContent="The payment is pending; it unlocks as soon as Google Play confirms it."; return; }
    setTier(Math.max(TIER_LEVEL,TIER_PRODUCTS[id])); $("payMsg").textContent=`Thank you: ${TIER_NAMES[TIER_PRODUCTS[id]]} is unlocked.`; setTimeout(()=>{ $("payBox").hidden=true; },2500); }
  catch(e){ const m=String(e&&e.message||e); $("payMsg").textContent=/cancel/i.test(m)?"No purchase made.":"The purchase didn't go through: "+m; } }
async function restoreTier(){ const P=NPur(); if(!P) return; $("payMsg").textContent="Checking your purchases with Google Play…"; try{ await P.restorePurchases(); }catch(e){} await readPurchases(); $("payMsg").textContent=`You have: ${TIER_NAMES[TIER_LEVEL]}.`; }
async function openPaywall(f){ const box=$("payBox"); box.hidden=false; $("payWhy").textContent=!STORE?"This test version has everything unlocked. In the Google Play version, these are one-time purchases:":f?`${GATE_WORDS[f]||"That"} comes with ${TIER_NAMES[GATES[f]]}${GATES[f]<3?" or above":""}.`:`You have: ${TIER_NAMES[tierLevel()]}.`; $("payMsg").textContent="";
  const list=$("payList"); list.innerHTML=""; const prods=_products||await loadProducts()||[];
  [["bs_no_watermark","No watermark","Your videos without the Beat Splicer mark."],["bs_creator","Creator","1080p, every platform, lens kits, your own look, the director's note and the returning image. No watermark."],["bs_pro","Pro","Everything in Creator, plus learning from your YouTube results, edit like this, Which is better, the AI reviewer and several formats at once."]].forEach(([id,name,desc])=>{
    const lv=TIER_PRODUCTS[id], owned=TIER_LEVEL>=lv, p=prods.find(x=>x.identifier===id||x.productIdentifier===id||x.planIdentifier===id), row=document.createElement("div"); row.className="payrow";
    const t=document.createElement("div"); t.innerHTML=`<b></b><div class="small"></div>`; t.querySelector("b").textContent=name; t.querySelector(".small").textContent=desc; row.appendChild(t);
    const b=document.createElement("button"); b.className="btn"+(owned?"":" primary"); b.disabled=owned||!NPur()||!STORE; b.textContent=!STORE?"In the Google Play app":owned?"Unlocked":(p&&p.priceString?`Buy ${p.priceString}`:"Buy"); b.onclick=()=>buyTier(id); row.appendChild(b); list.appendChild(row); }); }
function renderTierUI(){ const t=$("tierBadge"); if(t){ t.hidden=!STORE; t.textContent=TIER_NAMES[tierLevel()]; } if($("mePlan")){ const lv=tierLevel(); $("mePlan").textContent=STORE?TIER_NAMES[lv]:"Everything (test version)"; $("mePlanBtn").textContent=!STORE?"See plans":lv>=3?"See plans":"Upgrade"; } if(typeof buildEndpointUI==="function") try{ buildEndpointUI(); }catch(e){} }
$("payClose").onclick=()=>{ $("payBox").hidden=true; }; $("payRestore").onclick=restoreTier; $("payRestore").hidden=!STORE;
/* the way in: the plan badge (store version), Your plan in your profile, and on the finish screen while videos carry the mark */
function showPlans(f){ if($("meBox")) $("meBox").hidden=true; if(typeof closeFinish==="function"&&!$("finSheet").hidden) closeFinish(); openPaywall(f||null); try{ window.scrollTo({top:0,behavior:"smooth"}); }catch(e){} }
$("mePlanBtn").onclick=()=>showPlans(null);
if(STORE){ $("tierBadge").onclick=()=>showPlans(null); setTimeout(()=>{ readPurchases(); loadProducts(); },1500); }
renderTierUI();

/* in the store build, reaching for a locked control shows what unlocks it, and puts the control back */
if(STORE){
  $("lens").addEventListener("change",()=>{ if(!has("lens")&&!/^(none|natural)$/.test($("lens").value)){ setControl("lens",[...$("lens").options].some(o=>o.value==="none")?"none":"natural"); needTier("lens"); } });
  $("look").addEventListener("change",()=>{ if(!has("ownLook")&&$("look").value==="own"){ setControl("look","none"); needTier("ownLook"); } });
  $("dirNote").addEventListener("focus",()=>{ if(!has("note")){ $("dirNote").blur(); needTier("note"); } });
  $("ownMotif").addEventListener("change",()=>{ if(!has("motif")&&$("ownMotif").checked){ $("ownMotif").checked=false; needTier("motif"); } });
  $("refOn").addEventListener("change",()=>{ if(!has("reference")&&$("refOn").checked){ $("refOn").checked=false; needTier("reference"); } });
  if(!has("ownLook")&&$("look").value==="own") setControl("look","none"); }
