"""Edit like this: a reference cut every two beats (1.09 s) to the reference song. The app must find about 55 cuts,
mostly on the beat, and with the reference on, the edit's shots get much shorter.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    asl=lambda: pg.evaluate("S.plan.reduce((a,s)=>a+s.end-s.start,0)/S.plan.length")
    before=await asl()
    await pg.set_input_files("#refFile","refvid/reference.mp4"); await pg.wait_for_function("REF && REF.stats || /Couldn/.test($('refInfo').textContent)", timeout=300000)
    st=await pg.evaluate("REF&&REF.stats"); info=await pg.inner_text("#refInfo"); after=await asl()
    print("stats", json.dumps(st)); print("info:", info); print(f"edit's average shot {before:.2f} s -> {after:.2f} s")
    ok=st and 45<=st["cuts"]<=60 and abs(st["asl"]-1.09)<0.25 and st["onBeat"]>=0.7 and after<before*0.75 and not errs
    print(("PASS" if ok else "FAIL")+" edit like this", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
