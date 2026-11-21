/* ---------------- Plain words and finding things ----------------
   Projects: saving or opening a project file sits in one menu (the current project is kept on the device anyway).
   All settings gets a search box: type "border" or "slow motion" and only those settings show, with their sections open. */
$("projBtn").onclick=e=>{ e.stopPropagation(); const p=$("projPop"); p.hidden=!p.hidden; $("projBtn").setAttribute("aria-expanded",String(!p.hidden)); };
document.addEventListener("click",e=>{ const p=$("projPop"); if(!p.hidden&&!p.contains(e.target)&&e.target!==$("projBtn")){ p.hidden=true; $("projBtn").setAttribute("aria-expanded","false"); } });
$("saveProj").addEventListener("click",()=>{ $("projPop").hidden=true; }); $("openProj").addEventListener("change",()=>{ $("projPop").hidden=true; });
/* search: every label, row of buttons, sub-heading and note inside the settings panel is a candidate */
const SRCH_SEL="details.step .step-body label, details.step .step-body .btns, details.step .step-body h3.sub, details.step .step-body p.small, details.step .step-body .row, details.step .step-body .chipset, details.step .step-body .styles";
let _srchOpen=null;
function searchSettings(q){ q=q.trim().toLowerCase(); const panel=$("viewSimple").closest(".panel"); const items=[...panel.querySelectorAll(SRCH_SEL)];
  panel.querySelectorAll(".srch-hide,.srch-hit").forEach(el=>el.classList.remove("srch-hide","srch-hit"));
  if(!q){ if(_srchOpen){ panel.querySelectorAll("details").forEach(d=>{ d.open=_srchOpen.has(d); }); _srchOpen=null; } panel.classList.remove("searching"); return; }
  if(!_srchOpen) _srchOpen=new Set([...panel.querySelectorAll("details")].filter(d=>d.open)); panel.classList.add("searching");
  const words=q.split(/\s+/).filter(Boolean), match=el=>{ const t=(el.textContent+" "+(el.title||"")+" "+[...el.querySelectorAll("[title],option")].map(x=>x.title||x.textContent).join(" ")).toLowerCase(); return words.every(w=>t.includes(w)); };
  const hits=items.filter(el=>match(el)), direct=hits.slice();
  /* a matching sub-heading brings its whole group: everything after it up to the next heading */
  hits.filter(h=>h.matches("h3.sub")).forEach(h=>{ let n=h.nextElementSibling; while(n&&!n.matches("h3.sub,details")){ if(!hits.includes(n)) hits.push(n); n=n.nextElementSibling; } });
  /* inside each step, everything that neither is nor holds a match is hidden, level by level */
  const isHit=el=>hits.some(h=>h===el||h.contains(el)), holds=el=>hits.some(h=>el!==h&&el.contains(h));
  const prune=box=>{ for(const ch of box.children){ if(ch.tagName==="SUMMARY"||isHit(ch)) continue; if(holds(ch)) prune(ch); else ch.classList.add("srch-hide"); } };
  panel.querySelectorAll("details.step > .step-body").forEach(prune);
  panel.querySelectorAll("details").forEach(d=>{ d.open=hits.some(h=>d.contains(h)); });
  direct.forEach(h=>{ if(!direct.some(o=>o!==h&&h.contains(o))) h.classList.add("srch-hit"); });
  setText($("searchCount")||{},""); return hits.length; }
{ let t=0; $("setSearch").addEventListener("input",()=>{ clearTimeout(t); t=setTimeout(()=>{ const n=searchSettings($("setSearch").value); if($("setSearch").value.trim()&&!n) status(`No setting matches “${$("setSearch").value.trim()}”.`); },200); }); }
{ const _av=applyView; applyView=function(v){ _av(v); const all=v==="all"; $("setSearch").hidden=!all; if(!all&&$("setSearch").value){ $("setSearch").value=""; searchSettings(""); } }; $("viewSimple").onclick=()=>applyView("simple"); $("viewAll").onclick=()=>applyView("all"); applyView((()=>{ try{ return localStorage.getItem("beatsplicerView")||"simple"; }catch(e){ return "simple"; } })()); }
