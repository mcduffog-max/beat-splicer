/* ---------------- Captions ---------------- */
async function syncCapWith(){
  const sel=$("capWith"), keep=sel.value; sel.innerHTML="";
  for(const id of Object.keys(PROVIDERS)) if(await providerReady(id)){ const o=document.createElement("option"); o.value=id; o.textContent=PROVIDERS[id].name; sel.appendChild(o); }
  if([...sel.options].some(o=>o.value===keep)) sel.value=keep;
  $("capBtn").disabled=!sel.options.length || !S.an;
  if(!sel.options.length){ const o=document.createElement("option"); o.textContent=HOSTED?"Claude (open in Claude)":"Add an API key first"; sel.appendChild(o); }
}
async function writeCaptions(){
  const id=$("capWith").value; if(!PROVIDERS[id]) return;
  const out=$("capOut"); out.innerHTML=""; const p=document.createElement("p"); p.className="small"; p.textContent="Writing captions…"; out.appendChild(p);
  const eps=S.eps.map(EP);
  const prompt=`Write social posts for a short music video. Topic from the creator: ${JSON.stringify($("capTopic").value.trim()||"not given")}.
Song file: ${JSON.stringify(S.audioName)}, ${Math.round(S.an.bpm)} BPM. Visual style: ${JSON.stringify($("styleDesc").textContent||$("look").value)}. Opening text: ${JSON.stringify($("hookText").value)}.
Platforms: ${eps.map(e=>e.name).join(", ")}. Upload titles already chosen (keep the captions consistent with them, don't repeat them word for word): ${JSON.stringify(eps.map(e=>({platform:e.name,title:titleFor(e).title,onScreen:titleFor(e).hook})))}.
For each platform follow its current norms (title only matters for YouTube; keep TikTok and Reels captions short with a hook in the first line; TV gets a one-line programme description and no hashtags). Do not invent facts about people, places or the song. Use Australian English spelling.
Reply with ONLY JSON: {"captions":[{"platform":"exact platform name from the list","title":"string or empty","caption":"string","hashtags":["#tag", "..."]}]}`;
  try{
    const r=await askAI(id,prompt,null);
    S.captions=Array.isArray(r.captions)?r.captions:[];
    out.innerHTML="";
    S.captions.forEach(c=>{
      const d=document.createElement("div"); d.className="cap";
      const b=document.createElement("b"); b.textContent=String(c.platform||""); d.appendChild(b);
      const ta=document.createElement("textarea");
      ta.value=[c.title?String(c.title):"",String(c.caption||""),(Array.isArray(c.hashtags)?c.hashtags.join(" "):"")].filter(Boolean).join("\n\n");
      ta.oninput=()=>{ c._text=ta.value; };
      c._text=ta.value; d.appendChild(ta);
      const cp=document.createElement("button"); cp.className="chip"; cp.type="button"; cp.textContent="Copy";
      cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(ta.value); cp.textContent="Copied"; }catch(e){ ta.select(); cp.textContent="Selected, press Ctrl+C"; } };
      d.appendChild(cp); out.appendChild(d);
    });
    if(!S.captions.length) out.textContent="No captions came back. Try again.";
  }catch(e){ out.innerHTML=""; const q=document.createElement("p"); q.className="small"; q.textContent=aiErrorText(e); out.appendChild(q); }
}
function captionFor(ep){ const c=(S.captions||[]).find(c=>String(c.platform||"").toLowerCase()===ep.name.toLowerCase()); return c?c._text:""; }

