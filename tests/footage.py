"""Footage quality and continuity: soft clips stay out of the key moments, cuts don't fight the direction of movement.
   Run from the folder holding qlib/ and plib/ (made by mkq.sh).  python3 tests/footage.py [url]"""
import asyncio, sys
from playwright.async_api import async_playwright
import os
SRC=sys.argv[1] if len(sys.argv)>1 else 'file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dist-claude','index.html')
RES={}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context()).new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        for lib in ["qlib","plib"]:
            await pg.goto(SRC)
            await pg.set_input_files("#folderInput",lib); await pg.wait_for_function("S.clips.length===24 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
            await pg.set_input_files("#audioInput","struct/pop120.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000); await pg.wait_for_timeout(500)
            if lib=="qlib":
                r=await pg.evaluate("""(()=>{ let imp=0,impSoft=0,all=0,allSoft=0; for(let k=0;k<6;k++){ S.seed=300+k; buildPlan(); S.plan.forEach(s=>{ const soft=/soft/.test(S.clips[s.clip].name), im=(typeof shotImportance==="function"?shotImportance(s):(s.e>0.7?1:0.5))>=1; all++; if(soft) allSoft++; if(im){ imp++; if(soft) impSoft++; } }); } return [Math.round(100*allSoft/all), Math.round(100*impSoft/Math.max(1,imp)), imp]; })()""")
                RES["soft"]=r[1]; print(("PASS" if r[1]<=15 else "FAIL")+f" soft footage in key moments: {r[1]}% (overall {r[0]}%)")
            else:
                r=await pg.evaluate("""(()=>{ let n=0,fight=0,flow=0; const dir=s=>/right/.test(S.clips[s.clip].name)?1:-1; for(let k=0;k<6;k++){ S.seed=300+k; buildPlan(); for(let i=1;i<S.plan.length;i++){ const a=S.plan[i-1], b=S.plan[i]; if(b.drop||b._newSection) continue; n++; if(dir(a)!==dir(b)) fight++; else flow++; } } return [n,Math.round(100*fight/n)]; })()""")
                RES["pan"]=r[1]; print(("PASS" if r[1]<=20 else "FAIL")+f" cuts between opposite pans: {r[1]}% of {r[0]}")
        print("errors", errs); await b.close()
    sys.exit(0 if RES.get("soft",99)<=15 and RES.get("pan",99)<=20 else 1)
asyncio.run(main())
