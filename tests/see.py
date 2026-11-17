"""What each shot shows: the whole pipeline (download, read every clip, score lyric lines, search) with a tiny random stand-in model.
   Checks the mechanics, not the quality: the real model is only reachable from the phone.
   Needs transformers.js in /home/claude/tjs (npm i --ignore-scripts @huggingface/transformers) and a server: python3 -m http.server 8790 --directory /home/claude"""
import asyncio, os, re
from playwright.async_api import async_playwright
TJ="/home/claude/tjs/node_modules"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("requestfailed", lambda r: errs.append("failed: "+r.url[:120]))
        await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        tjs=open(f"{TJ}/@huggingface/transformers/dist/transformers.min.js").read()
        await ctx.route("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2", lambda r: r.fulfill(status=200, content_type="application/javascript", body=tjs))
        async def ort(route):
            f=route.request.url.split("/dist/")[-1].split("?")[0]; path=f"{TJ}/onnxruntime-web/dist/{f}"
            if os.path.exists(path): await route.fulfill(status=200, content_type="application/wasm" if f.endswith(".wasm") else "application/javascript", body=open(path,"rb").read())
            else: await route.fulfill(status=404, body="")
        await ctx.route(re.compile(r"https://cdn\.jsdelivr\.net/npm/onnxruntime-web@.*"), ort)
        await pg.goto("http://localhost:8790/v2/dist/index.html")
        await pg.evaluate("SEE.local='/v2/tests/'; SEE.model='tinyclip'; SEE.dtype='fp32'")
        await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length===40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
        await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
        await pg.evaluate("setLyrics(arguments[0]||'', 'file')" if False else "0")
        await pg.evaluate("t=>setLyrics(t,'file')", open("lyr/rocket110.lrc").read())
        print("box shown:", await pg.evaluate("!$('seeBox').hidden"), "|", await pg.evaluate("$('seeInfo').textContent"))
        await pg.evaluate("seeAll()"); await pg.wait_for_function("seeCount()[0]===seeCount()[1] && !S._seeBusy", timeout=600000)
        print("embedded:", await pg.evaluate("seeCount()"), "| status:", await pg.inner_text("#status"))
        await pg.wait_for_function("!!S._seeLines", timeout=60000)
        print("lines scored:", await pg.evaluate("S._seeLines.size"), "| seeCost sample:", await pg.evaluate("(()=>{ const s=S.plan.find(x=>lyricAt(x.start)); return s? seeCost(s, S.clips[s.clip].samples[0]):null })()"))
        await pg.evaluate("STEPS()[1].open=true"); await pg.fill("#seeQ","night city"); await pg.wait_for_timeout(1500)
        print("search hits:", await pg.evaluate("$('seeHits').children.length"))
        print("project bytes per moment:", await pg.evaluate("S.clips[0].samples[0].ce.length"))
        print("errors", [e for e in errs if 'favicon' not in e][:6]); await b.close()
asyncio.run(main())
