/* ---------------- Sound controls ---------------- */
const eqInputs=[];
function eqRow(parent,label,get,set,min=-12,max=12,stepv=0.5,fmt=v=>(v>0?"+":"")+v.toFixed(1)+" dB"){
  const row=document.createElement("label"); row.className="eqrow";
  const l=document.createElement("span"); l.textContent=label;
  const r=document.createElement("input"); r.type="range"; r.min=min; r.max=max; r.step=stepv; r.value=get();
  const o=document.createElement("output"); o.textContent=fmt(+r.value);
  r.addEventListener("input",()=>{ set(+r.value); o.textContent=fmt(+r.value); EQ.preset=""; markPreset(); applyEq(LIVE); });
  r.addEventListener("change",saveSettings);
  row.append(l,r,o); parent.appendChild(row);
  eqInputs.push({r,o,get,fmt});
}
function syncEq(){ eqInputs.forEach(x=>{ x.r.value=x.get(); x.o.textContent=x.fmt(+x.r.value); }); markPreset(); }
function markPreset(){ document.querySelectorAll("#presets .chip").forEach(c=>c.setAttribute("aria-pressed",String(c.textContent===EQ.preset))); }
function buildSoundUI(){
  const pr=$("presets");
  Object.keys(PRESETS).forEach(name=>{ const b=document.createElement("button"); b.className="chip"; b.type="button"; b.textContent=name;
    b.onclick=()=>{ EQ.bands=[...PRESETS[name].b]; EQ.bass=0; EQ.treble=0; EQ.preset=name; syncEq(); applyEq(LIVE); saveSettings(); };
    pr.appendChild(b); });
  const top=$("eqTop");
  eqRow(top,"Volume",()=>Math.round(EQ.vol*100),v=>EQ.vol=v/100,0,150,5,v=>v+"%");
  eqRow(top,"Bass",()=>EQ.bass,v=>EQ.bass=v);
  eqRow(top,"Treble",()=>EQ.treble,v=>EQ.treble=v);
  FREQS.forEach((f,i)=>eqRow($("eqBands"),FLAB[i],()=>EQ.bands[i],v=>EQ.bands[i]=v));
  markPreset();
}

