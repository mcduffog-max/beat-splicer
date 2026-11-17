"""Song sections heard from the audio: chorus starts must land within one beat of the truth.  python3 tests/sections.py [url]"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
URL=sys.argv[1] if len(sys.argv)>1 else "file://"+os.path.join(HERE,"..","dist-claude","index.html")
async def main():
    fails=0
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context()).new_page()
        await pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(URL)
        for name in ["pop120","rock96"]:
            await pg.evaluate("S.an=null"); await pg.set_input_files("#audioInput",os.path.join(HERE,"songs",name+".wav")); await pg.wait_for_function("S.an", timeout=120000)
            got=await pg.evaluate("songSections().filter(s=>s.chorus).map(s=>s.t0)")
            truth=json.load(open(os.path.join(HERE,"songs",name+".json"))); want=[t for k,t in truth if k=="chorus"]
            beat=60/await pg.evaluate("S.an.bpm")
            # back-to-back choruses count as one section
            want=[t for i,t in enumerate(want) if not (i and truth[[x[1] for x in truth].index(t)-1][0]=="chorus")]
            ok=len(got)==len(want) and all(abs(g-w)<=beat for g,w in zip(got,want))
            print(("PASS " if ok else "FAIL ")+f"{name}: choruses at {[round(g,1) for g in got]}, expected {want}"); fails+=not ok
        await b.close()
    sys.exit(1 if fails else 0)
asyncio.run(main())
