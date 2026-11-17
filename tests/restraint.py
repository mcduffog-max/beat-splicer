"""Restraint: with the default, one bold moment (two in a long video) at the biggest moment; few soft dissolves; at most one ramp and one rewind per export.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
ST="""()=>{ const BT=["whip","zoom","zoomout","zoomthru","spin","mask","flash"], f=P=>({bold:P.filter(s=>s.tr&&BT.includes(s.tr.type)).map(s=>s.tr.type+'@'+s.start.toFixed(1)), soft:P.filter(s=>s.tr&&['crossfade','dip'].includes(s.tr.type)).length, ramps:P.filter(s=>s._ramp).length, revs:P.filter(s=>s._rev).length, n:P.length});
  const sh=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); return {main:f(S.plan), yt:f(makeExportPlan(EP('youtube'),windowFor(EP('youtube')))), shorts:f(sh), biggestDrop:(S.plan.filter(s=>s.drop)[0]||{}).start}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    R={}
    for m in ["any","one"]:
      await pg.evaluate(f"setControl('restraint','{m}'); buildPlan(); 0"); R[m]=await pg.evaluate(ST); print(m, json.dumps(R[m]))
    o=R["one"]; ok=len(o["main"]["bold"])<=2 and len(o["shorts"]["bold"])<=1 and o["yt"]["ramps"]<=1 and o["yt"]["revs"]<=1 and len(R["any"]["main"]["bold"])>len(o["main"]["bold"]) and not errs
    print(("PASS" if ok else "FAIL")+" restraint", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
