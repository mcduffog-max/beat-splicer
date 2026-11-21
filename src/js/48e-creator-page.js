/* ---------------- Your page on the Beat Splicer site ----------------
   The relay also serves the Beat Splicer website. Publishing sends your name, photo, a line about you, your links and
   the YouTube videos you pick; the site makes a page at /@your-name and lists you under "Made with Beat Splicer".
   The first publish returns a private key that only this device keeps: it's what lets you change or remove the page. */
const SITE=()=>RELAY.url?RELAY.url.replace(/\/$/,""):"";
function slugName(n){ return String(n||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,24)||""; }
function ytIdOf(u){ const m=String(u||"").match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/|live\/))([A-Za-z0-9_-]{11})/); return m?m[1]:(/^[A-Za-z0-9_-]{11}$/.test(String(u||"").trim())?String(u).trim():null); }
function myUploads(){ try{ return (typeof recipes==="function"?recipes():[]).filter(r=>r.ytId).map(r=>({id:r.ytId,title:r.title||[r.artist,r.song].filter(Boolean).join(" – ")||"Your video",at:r.at||0})).sort((a,b)=>b.at-a.at).slice(0,30); }catch(e){ return []; } }
function pg(){ return ME.page=ME.page||{videos:[]}; }
function renderPage(){ const P=pg(), site=SITE(), on=!!site;
  $("pgBase").textContent=(site?site.replace(/^https?:\/\//,""):"beat splicer site")+"/@";
  $("pgForm").querySelectorAll("input,button").forEach(x=>{ if(x.id!=="pgCopy"&&x.id!=="pgDown") x.disabled=!on; });
  if(!on) $("pgMsg").textContent="Your page can be published once the Beat Splicer site is live (it runs on the relay).";
  const pub=!!(P.url&&P.key); $("pgPublish").textContent=pub?"Update my page":"Publish my page"; $("pgCopy").hidden=!pub; $("pgOpen").hidden=!pub; $("pgDown").hidden=!pub; if(pub) $("pgOpen").href=P.url;
  $("meKept").textContent=pub?"Your photo, name, line, links and chosen videos are on your public page. Everything else stays on this device.":"Kept on this device unless you publish your page.";
  const W=$("whoName"); if(pub){ W.href=P.url; W.title="Your page on the Beat Splicer site"; } else { W.removeAttribute("href"); W.removeAttribute("title"); }
  const box=$("pgVids"); box.innerHTML=""; const ups=myUploads(), known=new Set(ups.map(u=>u.id)), all=[...ups, ...(P.videos||[]).filter(id=>!known.has(id)).map(id=>({id,title:"Added by link"}))];
  if(!all.length){ box.innerHTML='<div class="small">Videos you upload from the app appear here; you can also paste links.</div>'; }
  all.forEach(u=>{ const l=document.createElement("label"); l.className="pgv check"; const c=document.createElement("input"); c.type="checkbox"; c.checked=(P.videos||[]).includes(u.id); c.disabled=!on;
    c.onchange=()=>{ const v=new Set(P.videos||[]); if(c.checked){ if(v.size>=12){ c.checked=false; $("pgMsg").textContent="Up to 12 videos."; return; } v.add(u.id); } else v.delete(u.id); P.videos=[...v]; meSave(); };
    const t=document.createElement("span"); t.textContent=u.title; l.append(c,t); box.appendChild(l); }); }
function fillPageForm(){ const P=pg(); $("pgHandle").value=P.handle||slugName(ME.name); $("pgBio").value=P.bio||""; const L=P.links||{}; $("pgYT").value=L.youtube||""; $("pgIG").value=L.instagram||""; $("pgTT").value=L.tiktok||""; $("pgWeb").value=L.web||""; renderPage(); }
function readPageForm(){ const P=pg(); P.handle=slugName($("pgHandle").value)||slugName(ME.name); P.bio=$("pgBio").value.trim().slice(0,160); P.links={youtube:$("pgYT").value.trim(),instagram:$("pgIG").value.trim(),tiktok:$("pgTT").value.trim(),web:$("pgWeb").value.trim()}; meSave(); return P; }
async function pagePost(method,body){ const P=pg(), res=await fetch(SITE()+"/page",{method,headers:{"content-type":"application/json","x-app-key":RELAY.key,...(P.key?{"x-page-key":P.key}:{})},body:JSON.stringify(body)}); const j=await res.json().catch(()=>({})); if(!res.ok) throw new Error(j.error||("the site said "+res.status)); return j; }
async function publishPage(){ if(!SITE()) return; const P=readPageForm(); if(!(ME.name||"").trim()){ $("pgMsg").textContent="Add your name first (above)."; $("meName").focus(); return; }
  if(!P.handle||P.handle.length<3){ $("pgMsg").textContent="Choose a page name of at least 3 letters or numbers."; $("pgHandle").focus(); return; }
  const b=$("pgPublish"); b.disabled=true; $("pgMsg").textContent="Publishing…";
  try{ if(P.url&&P.pubHandle&&P.pubHandle!==P.handle){ try{ await pagePost("DELETE",{handle:P.pubHandle}); }catch(e){} P.key=null; } /* a new page name: the old page goes, the new one gets its own key */
    const j=await pagePost("POST",{handle:P.handle,name:ME.name,bio:P.bio,links:P.links,videos:P.videos||[],img:ME.img||"",public:true});
    if(j.key) P.key=j.key; P.url=j.url; P.pubHandle=j.handle; P.at=Date.now(); meSave(); $("pgHandle").value=j.handle; renderPage(); $("pgMsg").textContent=`Your page is live at ${j.url.replace(/^https?:\/\//,"")}.`; crumb("page published"); }
  catch(e){ $("pgMsg").textContent="Couldn't publish: "+(e&&e.message||e); } finally{ b.disabled=false; } }
$("pgPublish").onclick=publishPage;
$("pgCopy").onclick=async()=>{ const u=pg().url; try{ await navigator.clipboard.writeText(u); $("pgMsg").textContent="Link copied."; }catch(e){ const C=NP("Clipboard"); if(C){ await C.write({string:u}); $("pgMsg").textContent="Link copied."; } else $("pgMsg").textContent=u; } };
$("pgDown").onclick=async()=>{ const P=pg(); if(!P.pubHandle) return; $("pgMsg").textContent="Taking your page down…"; try{ await pagePost("DELETE",{handle:P.pubHandle}); P.url=null; P.key=null; P.pubHandle=null; meSave(); renderPage(); $("pgMsg").textContent="Your page is down. Your name and photo stay on this device."; }catch(e){ $("pgMsg").textContent="Couldn't take it down: "+(e&&e.message||e); } };
$("pgAddBtn").onclick=()=>{ const id=ytIdOf($("pgAddVid").value), P=pg(); if(!id){ $("pgMsg").textContent="That doesn't look like a YouTube link."; return; } const v=new Set(P.videos||[]); if(v.size>=12&&!v.has(id)){ $("pgMsg").textContent="Up to 12 videos."; return; } v.add(id); P.videos=[...v]; meSave(); $("pgAddVid").value=""; $("pgMsg").textContent=""; renderPage(); };
["pgHandle","pgBio","pgYT","pgIG","pgTT","pgWeb"].forEach(id=>$(id).addEventListener("change",readPageForm));
$("pgHandle").addEventListener("input",()=>{ const v=slugName($("pgHandle").value); if(v!==$("pgHandle").value&&!/-$/.test($("pgHandle").value)) $("pgHandle").value=v; });
$("pgBox").addEventListener("toggle",()=>{ if($("pgBox").open) fillPageForm(); });
renderPage();
