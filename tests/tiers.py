"""Store build tiers, with Google Play stood in for: Free shows the watermark, caps exports at 720p, locks other
platforms and lens kits; buying Creator removes the watermark and lifts the limits.  cwd /home/claude
Builds the store page first: BS_STORE=1 node build.mjs && cp dist-claude/index.html dist-claude/store-test.html"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/store-test.html"
MOCK="""window.__owned=JSON.parse(localStorage.getItem('__owned')||'[]'); window.Capacitor={isNativePlatform:()=>true, Plugins:{ NativePurchases:{
  getProducts:async()=>({products:[{identifier:'bs_no_watermark',priceString:'A$5.00'},{identifier:'bs_creator',priceString:'A$15.00'},{identifier:'bs_pro',priceString:'A$35.00'}]}),
  getPurchases:async()=>({purchases:window.__owned.map(id=>({productIdentifier:id,purchaseState:'PURCHASED',isAcknowledged:true}))}),
  purchaseProduct:async(o)=>{ window.__owned.push(o.productIdentifier); localStorage.setItem('__owned',JSON.stringify(window.__owned)); return {productIdentifier:o.productIdentifier,purchaseState:'PURCHASED'}; },
  restorePurchases:async()=>({}) }}};"""
WM="""async()=>{ const W=360,H=640, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const o={ep:EP('shorts'),canvas:cv,g:cv.getContext('2d',{willReadFrequently:true}),W,H}; o.g.fillStyle='#000'; o.g.fillRect(0,0,W,H);
  drawTierMark(o); await new Promise(r=>setTimeout(r,300)); o.g.fillStyle='#000'; o.g.fillRect(0,0,W,H); drawTierMark(o); const d=o.g.getImageData(0,0,W,H/3).data; let lit=0; for(let i=0;i<d.length;i+=4) if(d[i]+d[i+1]+d[i+2]>200) lit++; return lit; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":412,"height":915}); await ctx.add_init_script(MOCK); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.wait_for_timeout(2500)
    free={"tier":await pg.evaluate("TIER_NAMES[tierLevel()]"), "watermarkPixels":await pg.evaluate(WM), "short720":await pg.evaluate("[capEp(EP('shorts')).w,capEp(EP('shorts')).h]"),
      "reels":await pg.evaluate("has('platforms')"), "lens":await pg.evaluate("setControl('lens','kit:epic'); lensProfile({start:1,e:0.5})"), "own":await pg.evaluate("setControl('look','own'); readFx().look.own||false"), "badge":await pg.inner_text("#tierBadge")}
    await pg.evaluate("openPaywall('hd')"); await pg.wait_for_timeout(500); pay=await pg.inner_text("#payBox")
    await pg.click("#payList .payrow:nth-child(2) button"); await pg.wait_for_timeout(800)
    creator={"tier":await pg.evaluate("TIER_NAMES[tierLevel()]"), "watermarkPixels":await pg.evaluate(WM), "short":await pg.evaluate("[capEp(EP('shorts')).w,capEp(EP('shorts')).h]"), "reels":await pg.evaluate("has('platforms')"), "lens":await pg.evaluate("setControl('lens','kit:epic'); lensProfile({start:1,e:0.5})"), "pro":await pg.evaluate("has('taste')"), "msg":await pg.inner_text("#payMsg")}
    await pg.reload(); await pg.wait_for_timeout(2500); after=await pg.evaluate("TIER_NAMES[tierLevel()]")
    print("free", json.dumps(free)); print("paywall:", " | ".join(x.strip() for x in pay.split("\n") if x.strip())[:400]); print("creator", json.dumps(creator)); print("after restart:", after)
    ok=free["tier"]=="Free" and free["watermarkPixels"]>50 and free["short720"]==[720,1280] and not free["reels"] and free["lens"] is None and not free["own"] \
       and creator["tier"]=="Creator" and creator["watermarkPixels"]==0 and creator["short"]==[1080,1920] and creator["reels"] and creator["lens"] and not creator["pro"] and after=="Creator" and not errs
    print(("PASS" if ok else "FAIL")+" tiers", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
