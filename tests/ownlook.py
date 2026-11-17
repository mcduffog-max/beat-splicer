"""Own look and house style.  cwd /home/claude
   Two libraries (warm-cast and cool-cast versions of the same clips) must get different own looks; the look is the
   default; Do everything prefers it; house style keeps the lettering through Do everything."""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
async def run(b,lib):
    ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput",lib); await pg.wait_for_function("S.clips.length>=8 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    return pg,ctx,errs
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); out={}
    for lib in ["lkwarm","lkcool"]:
      pg,ctx,errs=await run(b,lib); out[lib]=await pg.evaluate("({def:$('look').value, look:ownLook(), words:ownLookWords()})"); print(lib, json.dumps(out[lib])[:400])
      if lib=="lkcool":
        await pg.evaluate("setControl('textStyle','serif'); saveHouseStyle(); 0")
        await pg.click("#autoBtn"); await pg.wait_for_function("/Movement:|couldn|error/i.test($('autoOut').textContent)", timeout=600000)
        auto=await pg.evaluate("({look:$('look').value, text:$('textStyle').value, said:$('autoOut').textContent})"); print("do everything:", auto["look"], auto["text"], "|", [l for l in auto["said"].split(".") if "Colour" in l or "Restraint" in l][:2])
        house_ok=auto["text"]=="serif"; errs_all=errs
      await ctx.close()
    a,c=out["lkwarm"]["look"]["desc"],out["lkcool"]["look"]["desc"]
    differ=(a["shadow"][0]-a["shadow"][2])-(c["shadow"][0]-c["shadow"][2])>4 and (a["high"][0]-a["high"][2])-(c["high"][0]-c["high"][2])>4
    ok=out["lkwarm"]["def"]=="own" and differ and house_ok and not errs_all
    print(("PASS" if ok else "FAIL")+" own look and house style", errs_all[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
