"""Planning the whole video at once: the beam's edit must cost less in total than shot-by-shot picking, stay quick,
and keep the rules (no repeated footage).  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
RUN="""(on)=>{ $('planWhole').checked=on; const R=[]; let ms=0; for(const seed of [3,7,11,19]){ S.seed=seed; const t=performance.now(); buildPlan(); ms+=performance.now()-t; R.push(S._planCost); } return {costs:R.map(x=>+x.toFixed(1)), ms:Math.round(ms/4), n:S.plan.length}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); res={}
    for lib,n in [("lib40",40),("plib",24)]:
      ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
      mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
      await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
      await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
      await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
      await pg.goto(URL); await pg.set_input_files("#folderInput",lib); await pg.wait_for_function(f"S.clips.length>={min(n,40)} && S.clips.every(c=>c.samples||c.error)", timeout=600000)
      await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
      g=await pg.evaluate(RUN,False); bm=await pg.evaluate(RUN,True); clips=await pg.evaluate("S.clips.length")
      print(lib, clips, "clips | greedy", g, "| beam", bm); res[lib]=(g,bm,errs); await ctx.close()
    ok=all(sum(bm["costs"])<sum(g["costs"]) and bm["ms"]<max(2500,g["ms"]*6) and not e for g,bm,e in res.values())
    print(("PASS" if ok else "FAIL")+" whole-video planning"); sys.exit(0 if ok else 1)
asyncio.run(main())
