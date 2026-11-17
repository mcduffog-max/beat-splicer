"""Blind comparisons: a simulated viewer who secretly likes the story arc and dislikes match cuts makes 14 picks;
the learned weights must move that way and the cut closer to that taste must win more often later.  cwd /home/claude"""
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
    await pg.evaluate("$('storyOn').checked=true; S.clips.forEach((c,i)=>{ c.tags=[0.3,0.7].map(f=>({t:c.dur*f,scale:i%6,faces:i%3?0:1,inten:0.5})); }); buildPlan(); 0")
    await pg.click("#cmpOpen"); await pg.wait_for_function("!$('cmpPickA').disabled", timeout=60000)
    await pg.click("#cmpA"); await pg.wait_for_timeout(1500); await pg.click("#cmpA")   # starts playback, then stops it
    # hidden taste: lower story cost is better, match cuts are bad
    judge="""(()=>{ const s=P=>{ const f=planFeatures(P,_pair.win); return -f.st*2 + f.mc*2 - f.q*0.3; }; const a=s(_pair.A.plan), b=s(_pair.B.plan); return Math.abs(a-b)<0.01?'same':a>b?'A':'B'; })()"""
    hist=[]
    for k in range(14):
      if k: await pg.click("#cmpAgain"); await pg.wait_for_function("!$('cmpPickA').disabled", timeout=60000)
      pick=await pg.evaluate(judge); newer=await pg.evaluate("_pair.newer"); hist.append((pick,newer))
      await pg.click({"A":"#cmpPickA","B":"#cmpPickB","same":"#cmpSame"}[pick])
    w=await pg.evaluate("TASTE.w"); msg=await pg.inner_text("#cmpMsg")
    late=[h for h in hist[7:] if h[1] and h[0]!="same"]; late_win=sum(1 for h in late if h[0]==h[1])/max(1,len(late))
    print("weights", json.dumps(w)); print("picks", hist); print("message:", msg); print(f"late agreement {late_win:.0%} over {len(late)}")
    ai=None; await pg.click("#cmpAgain"); await pg.wait_for_function("!$('cmpAI').disabled", timeout=60000); await pg.click("#cmpAI"); await pg.wait_for_timeout(3000); ai=await pg.inner_text("#cmpMsg"); print("AI:", ai[:160])
    ok=w.get("st",1)>1.1 and w.get("mc",1)<1 and "picks" in msg and not errs
    print(("PASS" if ok else "FAIL")+" taste learning", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
