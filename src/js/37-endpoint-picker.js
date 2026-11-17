/* ---------------- Endpoint picker ---------------- */
function buildEndpointUI(){
  const box=$("eps"); box.innerHTML="";
  ENDPOINTS.forEach(ep=>{
    const l=document.createElement("label"); l.className="ep";
    const c=document.createElement("input"); c.type="checkbox"; c.checked=S.eps.includes(ep.id);
    c.onchange=()=>{ S.eps=ENDPOINTS.filter(e=>e.id===ep.id?c.checked:S.eps.includes(e.id)).map(e=>e.id); syncPreviewEps(); updateButtons(); saveSettings(); drawTimeline(); };
    const d=document.createElement("div");
    const b=document.createElement("b"); b.textContent=ep.name;
    const sm=document.createElement("small"); sm.textContent=`${ep.w} × ${ep.h}, ${ep.max===Infinity?"any length":"up to "+fmtTime(ep.max)}, ${ep.lufs} LUFS`;
    d.append(b,sm); l.append(c,d); l.hidden=!S.epsAll&&!c.checked&&S.eps.length>0; box.appendChild(l);
  });
  { const mb=$("epsMore"); if(mb){ const hid=ENDPOINTS.length-S.eps.length; mb.hidden=!S.epsAll&&(S.eps.length===0||hid<=0); mb.textContent=S.epsAll?"Show only the ones I post to":`Add another format (${hid} more)`; } }
  syncPreviewEps();
}
function syncPreviewEps(){
  const sel=$("previewEp"), keep=sel.value; sel.innerHTML="";
  const list=S.eps.length?S.eps:ENDPOINTS.map(e=>e.id);
  list.forEach(id=>{ const o=document.createElement("option"); o.value=id; o.textContent=EP(id).name; sel.appendChild(o); });
  if(list.includes(keep)) sel.value=keep;
  sizeStage();
}

