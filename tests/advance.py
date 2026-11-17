"""Reusing clips across videos with fresh footage: after a Short is made, the next version may use the same clips, but
never a stretch of footage the first one showed; with the setting off, repeats are allowed.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
MAKE="(()=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); recordUsage(P); recordMade([{plan:P}]); return P.length; })()"
CHECK="""()=>{ const P=makeExportPlan(EP('shorts'),windowFor(EP('shorts'))); let reused=0, overlap=[], forward=0;
  P.forEach(s=>{ const c=S.clips[s.clip]; if(!c||c.kind==='image') return; const sh=(shownBefore()||new Map()).get(clipKey(s.clip)); if(!sh) return; reused++;
    const a=s.src, b=a+(s.end-s.start)*(s._ramp?RAMP_SPAN:(s._rate||1)); const o=sh.filter(([x,y])=>Math.min(y,b)-Math.max(x,a)>0.05); if(o.length) overlap.push([clipKey(s.clip).split('|')[0],+a.toFixed(2),+b.toFixed(2),o]); if(a>=sh[sh.length-1][1]-0.05) forward++; });
  return {shots:P.length, reusedClips:reused, movedPastEarlier:forward, overlaps:overlap.length, sample:overlap.slice(0,3), mode:$('exclN').value}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    print("default setting:", await pg.evaluate("$('exclN').value")); await pg.evaluate("S.eps=['shorts']; 0")
    R=[]
    for k in range(3):
      await pg.evaluate(MAKE); await pg.evaluate("remix()"); await pg.wait_for_timeout(2500); await pg.wait_for_function("!S.running", timeout=60000); r=await pg.evaluate(CHECK); R.append(r); print(f"video {k+2}:", json.dumps(r))
    ok=all(r["overlaps"]==0 and r["mode"]=="adv" for r in R) and R[-1]["reusedClips"]>0 and not errs
    print(("PASS" if ok else "FAIL")+" fresh footage when clips are reused", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
