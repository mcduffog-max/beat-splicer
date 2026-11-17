"""Beat This! referee, with a stand-in for the model: it reports beats at 110 BPM with the downbeat on beat 1.
The app's own count (163 BPM) disagrees, so the song must be re-counted on those beats. Also: off without WebGPU.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
MOCK="""window.BS_BT_MOCK=(buf)=>{ const T=Math.floor(buf.duration*50), b=new Float32Array(T).fill(-5), d=new Float32Array(T).fill(-5); const P=60/110;
  for(let k=0;k*P<buf.duration;k++){ const f=Math.round((0.12+k*P)*50); if(f<T){ b[f]=4; if(k%4===0) d[f]=4; } } return {beatL:b,downL:d,T}; };"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); res={}
    for mock in [False,True]:
      ctx=await b.new_context(); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
      await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
      if mock: await ctx.add_init_script(MOCK)
      await pg.goto(URL); await pg.evaluate("HOSTED=false") if False else None
      await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an", timeout=120000)
      bpm0=await pg.evaluate("S.an.bpm")
      if mock:
        await pg.evaluate("HOSTED_SAVE=HOSTED") if False else None
        await pg.evaluate("btReferee()"); await pg.wait_for_function("S.an._bt", timeout=60000)
      else: await pg.wait_for_timeout(3000)
      r=await pg.evaluate("({bpm:S.an.bpm, bt:S.an._bt||null, downs:S.an.beats.filter((b,i)=>isDownAt(S.an,i)).slice(0,4).map(x=>+x.toFixed(2)), status:$('status').textContent, plan:!!S.plan})")
      print("mock" if mock else "none", f"{bpm0:.1f} ->", json.dumps(r)); res[mock]=(bpm0,r,errs); await ctx.close()
    r=res[True][1]; ok=res[False][1]["bt"] is None and abs(r["bpm"]-110)<1.5 and r["bt"] and r["bt"]["fixed"] and abs(r["downs"][0]-0.12)<0.05 and not res[True][2]
    print(("PASS" if ok else "FAIL")+" Beat This referee", res[True][2][:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
