"""Watermarks: the picture is never altered; a mark is framed out, or footage where it can't be is avoided (landscape format, mark in the middle).  python3 tests/watermarks.py (cwd with lib40/)"""
import asyncio, sys
from playwright.async_api import async_playwright
import os
SRC=sys.argv[1] if len(sys.argv)>1 else 'file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dist-claude','index.html')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context()).new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(SRC)
        await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length===40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
        await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
        r=await pg.evaluate("""(()=>{ S.eps=['youtube']; const byName=n=>S.clips.findIndex(c=>c.name===n);
          // clips 1-10: a mark in the middle of the picture (no crop can lose it); 11-20: a corner logo
          for(let k=1;k<=10;k++){ const c=S.clips[byName('clip'+String(k).padStart(2,'0')+'.mp4')]; c.wm=[{x0:0.42,y0:0.44,x1:0.58,y1:0.56,a:null,b:null}]; c._wmc=null; c._wmcs=null; }
          for(let k=11;k<=20;k++){ const c=S.clips[byName('clip'+String(k).padStart(2,'0')+'.mp4')]; c.wm=[{x0:0.82,y0:0.04,x1:0.97,y1:0.14,a:null,b:null}]; c._wmc=null; c._wmcs=null; }
          let mid=0,corner=0,n=0; for(let s=0;s<5;s++){ S.seed=900+s; buildPlan(); const ep=EP('youtube'), P=makeExportPlan(ep,windowFor(ep))||S.plan; P.forEach(x=>{ n++; const k=+S.clips[x.clip].name.slice(4,6); if(k>=1&&k<=10) mid++; else if(k<=20) corner++; }); }
          const c=S.clips[byName('clip15.mp4')], cr=viewCrop(c,1920,1080,{fit:'fill'},1); 
          return [n, Math.round(100*mid/n), Math.round(100*corner/n), [cr.t,cr.r].map(x=>+x.toFixed(2)), typeof wmSoften]; })()""")
        print(SRC.split('/')[-2], "shots", r[0], "| middle-mark clips used:", str(r[1])+"%", "| corner-logo clips used:", str(r[2])+"%", "| landscape crop for a corner logo (top,right):", r[3], "| pixel softening:", r[4])
        ok=r[1]<=5 and r[4]=="undefined" and not errs; print(("PASS" if ok else "FAIL")+" watermarks avoided without touching pixels"); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
