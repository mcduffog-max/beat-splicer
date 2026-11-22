/* the language picker (in your profile), then the page in your language: the phone's, or the one you chose */
{ const sel=$("langSel"); LANGS.forEach(([c,n])=>{ const o=document.createElement("option"); o.value=c; o.textContent=n; sel.appendChild(o); });
  sel.value=pickLang(); sel.onchange=()=>{ setLang(sel.value,true); crumb("language "+sel.value); }; }
setLang(pickLang(),false);
