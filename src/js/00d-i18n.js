/* ---------------- Languages ----------------
   The app is written in English; each language is a file (i18n/<code>.json) mapping English text to its translation.
   The page is translated as it appears: text, button labels, placeholders, tips and announcements. Text with changing
   parts ("Studying your clips: 3 of 8") matches a pattern ("Studying your clips: {} of {}"), and the changing parts are
   translated too when they're known words. The code keeps working in English underneath (enOf, S._statusEn), and
   anything marked data-noi18n (diagnostics, your own words) is left alone. */
const LANGS_ALL=[["en","English"],["es","Español"],["pt","Português (Brasil)"],["fr","Français"],["de","Deutsch"],["it","Italiano"],["hi","हिन्दी"],["id","Bahasa Indonesia"],["ja","日本語"],["ko","한국어"],["zh","中文（简体）"],["ar","العربية"],["tr","Türkçe"],["vi","Tiếng Việt"]];
const LANGS_READY=/*@LANGS@*/null; /* stamped at build time: the languages with a translation file */
const LANGS=LANGS_ALL.filter(x=>!LANGS_READY||LANGS_READY.includes(x[0]));
const I18N={lang:"en", dict:null, pats:[], cache:new Map(), busy:false};
function pickLang(){ let l=null; try{ l=localStorage.getItem("beatsplicerLang"); }catch(e){} if(l&&LANGS.some(x=>x[0]===l)) return l;
  for(const n of (navigator.languages||[navigator.language||"en"])){ const c=String(n).toLowerCase().split("-")[0]; if(LANGS.some(x=>x[0]===c)) return c; } return "en"; }
const _esc=s=>s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
function i18nLoad(lang,data){ I18N.lang=lang; I18N.dict=data&&data.t||null; I18N.cache.clear(); I18N.pats=[];
  if(I18N.dict) for(const k of Object.keys(I18N.dict)) if(k.includes("{}")){ const parts=k.split("{}"); I18N.pats.push({k, re:new RegExp("^"+parts.map(_esc).join("([\\s\\S]*?)")+"$"), n:parts.length-1, lit:parts.join("").length}); }
  I18N.pats.sort((a,b)=>b.lit-a.lit); /* the most specific pattern wins */
  document.documentElement.lang=lang==="zh"?"zh-CN":lang==="pt"?"pt-BR":lang; document.documentElement.dir=lang==="ar"?"rtl":"ltr"; }
function fill(tr,vals){ let i=0; return tr.replace(/\{(\d*)\}/g,(m,d)=>{ const v=vals[d===""?i++:+d]; return v==null?"":v; }); }
/* one string: exact, else pattern; unknown text comes back as it was */
function t(s){ if(!I18N.dict||s==null) return s; const raw=String(s), key=raw.replace(/\s+/g," ").trim(); if(!key||!/[A-Za-z]/.test(key)) return raw;
  if(I18N.cache.has(key)) return keepSpace(raw,I18N.cache.get(key));
  let out=I18N.dict[key];
  if(out==null){ for(const p of I18N.pats){ const m=key.match(p.re); if(m){ out=fill(I18N.dict[p.k],m.slice(1).map(v=>t(v))); break; } } }
  if(out==null&&/[.!?]\s+\S/.test(key)){ const parts=key.split(/(?<=[.!?…])\s+(?=[A-Z“"(])/); if(parts.length>1){ const tp=parts.map(x=>t(x)); if(tp.some((x,i)=>x!==parts[i])) out=tp.join(I18N.lang==="ja"||I18N.lang==="zh"?"":" "); } } /* a message made of sentences: each one */
  if(out==null){ const b=key.match(/^([•■✓◀▶]\s?)(.+)$/); if(b){ const r=t(b[2]); if(r!==b[2]) out=b[1]+r; } } /* a marker in front */
  if(out==null&&key.includes(" · ")){ const parts=key.split(" · "), tp=parts.map(x=>t(x)); if(tp.some((x,i)=>x!==parts[i])) out=tp.join(" · "); } /* "Style · Chosen by Do everything" */
  if(out==null) out=key; if(I18N.cache.size>5000) I18N.cache.clear(); I18N.cache.set(key,out); return keepSpace(raw,out); }
function keepSpace(raw,tr){ const a=raw.match(/^\s*/)[0], b=raw.match(/\s*$/)[0]; return a+tr+b; }
/* the page */
const I18N_ATTRS=["placeholder","title","aria-label"], EN=new WeakMap();
function enOf(el){ return el&&EN.has(el)?EN.get(el):(el?el.textContent:""); }
function skipNode(n){ for(let e=n.nodeType===1?n:n.parentElement;e;e=e.parentElement){ if(e.dataset&&e.dataset.noi18n!=null) return true; const tg=e.tagName; if(tg==="SCRIPT"||tg==="STYLE"||tg==="TEXTAREA"||tg==="CODE"||tg==="PRE") return true; } return false; }
function trText(n){ const cur=n.nodeValue; if(!cur||!/[A-Za-z]/.test(cur)) return; const prev=n.__tr; if(prev&&cur===prev.out) return; const en=cur, out=t(en); n.__tr={en,out};
  const p=n.parentElement; if(p&&p.childNodes.length===1) EN.set(p,en); if(out!==cur) n.nodeValue=out; }
function trAttrs(el){ for(const a of I18N_ATTRS){ const v=el.getAttribute&&el.getAttribute(a); if(!v||!/[A-Za-z]/.test(v)) continue; const k="__a_"+a; if(el[k]&&el[k].out===v) continue; const out=t(v); el[k]={en:v,out}; if(out!==v) el.setAttribute(a,out); } }
function trTree(root){ if(!I18N.dict||skipNode(root)) return; if(root.nodeType===3) return trText(root); if(root.nodeType!==1) return; trAttrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType===1&&n.dataset&&n.dataset.noi18n!=null?NodeFilter.FILTER_REJECT:n.nodeType===1&&/^(SCRIPT|STYLE|TEXTAREA|PRE|CODE)$/.test(n.tagName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  let n; while((n=w.nextNode())){ if(n.nodeType===3) trText(n); else trAttrs(n); } }
let _i18nObs=null;
function i18nWatch(){ if(_i18nObs) return; _i18nObs=new MutationObserver(ms=>{ if(!I18N.dict) return; for(const m of ms){ if(m.type==="characterData"){ if(!skipNode(m.target)) trText(m.target); } else if(m.type==="attributes"){ if(!skipNode(m.target)) trAttrs(m.target); } else m.addedNodes.forEach(x=>trTree(x)); } });
  _i18nObs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS}); }
/* back to English: put every remembered original back */
function untranslate(){ const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT); let n; while((n=w.nextNode())){ if(n.nodeType===3){ if(n.__tr&&n.nodeValue===n.__tr.out) n.nodeValue=n.__tr.en; n.__tr=null; } else for(const a of I18N_ATTRS){ const k="__a_"+a; if(n[k]&&n.getAttribute(a)===n[k].out) n.setAttribute(a,n[k].en); n[k]=null; } } }
async function setLang(lang,save){ if(save) try{ localStorage.setItem("beatsplicerLang",lang); }catch(e){}
  if(I18N.dict) untranslate(); if(lang==="en"){ i18nLoad("en",null); return; }
  let data=null; try{ const r=await fetch(`i18n/${lang}.json`,{cache:"no-cache"}); if(r.ok) data=await r.json(); }catch(e){}
  if(!data){ i18nLoad("en",null); return; } i18nLoad(lang,data); trTree(document.body); i18nWatch(); document.title=t("Beat Splicer"); }
