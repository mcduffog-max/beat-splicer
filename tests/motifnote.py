"""A returning image and the director's note.  cwd /home/claude
   Motif: stand-in readings plant one image in a moment of 4 clips; the three motif places must show it.
   Note: 'dark and lonely, then turns bright and hopeful' must darken the first half and brighten the second."""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
SETUP="""()=>{ const r=rng(9), rv=()=>{ const v=new Float32Array(512); for(let i=0;i<512;i++) v[i]=r()*2-1; return unitVec(v); }; const MOT=rv();
  S.clips.forEach((c,i)=>{ c.samples.forEach((s,k)=>{ let v=rv(); if([3,11,19,27].includes(i)&&k===1){ const w=new Float32Array(512); const n=rv(); for(let j=0;j<512;j++) w[j]=MOT[j]+0.15*n[j]; v=unitVec(w); } s.ce=packVec(v); }); c._pv=null; });
  S._ownMotif=null; S._placeKey=null; return 0; }"""
MOT="""()=>{ const M=motifMoments(); const slots=S.plan.filter(s=>s._motifSlot).map(s=>({n:s._motifSlot, hit:!!(M.set.get(s.clip)||[]).some(t=>Math.abs(t-s.src)<1.6), clip:s.clip}));
  const elsewhere=S.plan.filter(s=>!s._motifSlot&&(M.set.get(s.clip)||[]).some(t=>Math.abs(t-s.src)<1.6)).length; return {ok:M.ok, clips:[...M.set.keys()], slots, elsewhere, reasons:[...new Set(S.plan.flatMap(s=>(s.why||[]).map(w=>w.t)).filter(t=>/returning/.test(t)))]}; }"""
NOTE="""()=>{ const h=S.an.duration/2, m=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length), bn=s=>{ const c=S.clips[s.clip], sm=c.samples.reduce((a,x)=>Math.abs(x.t-s.src)<Math.abs(a.t-s.src)?x:a,c.samples[0]); return sm.bN||0; };
  return {first:+m(S.plan.filter(s=>s.start<h).map(bn)).toFixed(3), second:+m(S.plan.filter(s=>s.start>=h).map(bn)).toFixed(3), phases:notePhases().map(p=>p.text), why:S.plan.flatMap(s=>(s.why||[]).map(w=>w.t)).filter(t=>/note/.test(t)).length}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    n0=await pg.evaluate(NOTE)
    await pg.evaluate("$('dirNote').value='dark and lonely, then turns bright and hopeful'; S._notePh=null; buildPlan(); 0"); n1=await pg.evaluate(NOTE)
    await pg.evaluate("$('dirNote').value=''; S._notePh=null; 0"); await pg.evaluate(SETUP); await pg.evaluate("buildPlan(); 0"); mo=await pg.evaluate(MOT)
    print("note off", n0); print("note on ", n1); print("motif", json.dumps(mo))
    ok=mo["ok"] and sorted(mo["clips"])==[3,11,19,27] and all(s["hit"] for s in mo["slots"]) and len(mo["slots"])==3 and mo["elsewhere"]<=2 \
       and n1["first"]<n0["first"]-0.05 and n1["second"]>n0["second"]+0.05 and n1["phases"]==["dark and lonely","bright and hopeful"] and not errs
    print(("PASS" if ok else "FAIL")+" motif and note", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
