/* ---------------- You: your photo and name, quietly in the top bar ----------------
   The photo is cropped to a circle and kept small (160 px) on this device with the name; nothing is sent anywhere.
   The top bar stays pinned while the page scrolls, so they're always in view. On phones the theme switch moves into
   this panel to make room. */
function meLoad(){ try{ return JSON.parse(localStorage.getItem("beatsplicerMe")||"{}")||{}; }catch(e){ return {}; } }
let ME=meLoad();
function meSave(){ try{ localStorage.setItem("beatsplicerMe",JSON.stringify(ME)); }catch(e){ status("Couldn't keep your photo on this device (storage is full).",true); } }
function initials(n){ const w=String(n||"").trim().split(/\s+/).filter(Boolean); return (w.length>1?w[0][0]+w[w.length-1][0]:(w[0]||"").slice(0,2)).toUpperCase(); }
function renderMe(){ const n=(ME.name||"").trim(), ini=initials(n);
  [["meImg","meInit"],["meBigImg","meBigInit"]].forEach(([im,it])=>{ const I=$(im); if(ME.img){ I.src=ME.img; I.hidden=false; $(it).textContent=""; $(it).hidden=true; } else { I.hidden=true; I.removeAttribute("src"); $(it).hidden=false; $(it).textContent=ini; } });
  $("whoName").hidden=!n; $("whoName").textContent=n; $("meNoImg").hidden=!ME.img;
  const lab=n?`${n}: photo, name and theme`:"Your profile: photo, name and theme"; $("meBtn").title=lab; $("meBtn").setAttribute("aria-label",lab);
  const t=document.documentElement.getAttribute("data-theme")||"system"; document.querySelectorAll("[data-theme-set]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.themeSet===t))); }
async function setMePhoto(file){ try{ const bmp=await createImageBitmap(file), z=Math.min(bmp.width,bmp.height), c=document.createElement("canvas"); c.width=c.height=160;
    const g=c.getContext("2d"); g.imageSmoothingQuality="high"; g.drawImage(bmp,(bmp.width-z)/2,(bmp.height-z)/2.6,z,z,0,0,160,160); bmp.close&&bmp.close(); /* centred, a touch high: faces sit in the upper middle */
    ME.img=c.toDataURL("image/jpeg",0.86); meSave(); renderMe(); }
  catch(e){ status("Couldn't read that photo. Try a JPEG or PNG.",true); } }
$("meBtn").onclick=()=>{ const b=$("meBox"); b.hidden=!b.hidden; if(!b.hidden){ $("meName").value=ME.name||""; renderMe(); if(!ME.name) $("meName").focus(); } };
$("meClose").onclick=()=>{ $("meBox").hidden=true; };
$("meFile").onchange=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=""; if(f) setMePhoto(f); };
$("meNoImg").onclick=()=>{ delete ME.img; meSave(); renderMe(); };
$("meName").addEventListener("input",()=>{ ME.name=$("meName").value.replace(/\s+/g," ").slice(0,30); meSave(); renderMe(); });
$("meName").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); $("meBox").hidden=true; } });
document.querySelectorAll("[data-theme-set]").forEach(b=>b.onclick=()=>{ applyTheme(b.dataset.themeSet); renderMe(); });
renderMe();
