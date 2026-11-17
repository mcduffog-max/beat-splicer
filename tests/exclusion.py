"""Excluding clips from previous videos: after a Short is made, the next version (Remix, Do everything) must not use any
clip, or look-alike of a clip, that appeared in it, with "Don't use clips from my last 1 version" on.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
SHOT="""()=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); return {keys:[...new Set(P.map(s=>clipKey(s.clip)))], fams:[...new Set(P.map(s=>famOf(s.clip)))], n:P.length}; }"""
CHECK="""(prev)=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))), all=S.plan; const pk=new Set(prev.keys), pf=new Set(prev.fams);
  const hitShort=P.filter(s=>pk.has(clipKey(s.clip))).map(s=>clipKey(s.clip)), hitAll=all.filter(s=>pk.has(clipKey(s.clip))).length, famHit=P.filter(s=>pf.has(famOf(s.clip))).length;
  return {relaxed:!!S._exclRelaxed, excluded:S._excl?S._excl.size:0, shortRepeats:[...new Set(hitShort)], planRepeats:hitAll, lookalikeRepeats:famHit, inEdit:S.clips.filter((c,i)=>c.samples&&!isExcluded(i)).length}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    await pg.evaluate("setControl('exclN','1'); $('exclN').dispatchEvent(new Event('change')); S.eps=['shorts']; 0")
    print("families:", await pg.evaluate("new Set(S.clips.map((c,i)=>famOf(i))).size"), "of", await pg.evaluate("S.clips.length"), "clips")
    R={}
    first=await pg.evaluate(SHOT); await pg.evaluate("(()=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); recordUsage(P); recordMade([{plan:P}]); })(); 0")   # what a finished export records
    await pg.evaluate("remix()"); await pg.wait_for_timeout(2500); R["after remix"]=await pg.evaluate(CHECK,first)
    second=await pg.evaluate(SHOT); await pg.evaluate("(()=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); recordUsage(P); recordMade([{plan:P}]); })(); 0")
    await pg.click("#autoBtn"); await pg.wait_for_function("/Movement:|couldn|error/i.test($('autoOut').textContent)", timeout=600000); R["after Do everything"]=await pg.evaluate(CHECK,second)
    print("first Short:", first["n"], "shots,", len(first["keys"]), "clips")
    for k,v in R.items(): print(k, json.dumps(v))
    ok=all(not v["relaxed"] and not v["shortRepeats"] for v in R.values()) and not errs
    print(("PASS" if ok else "FAIL")+" exclusion of previous clips", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
