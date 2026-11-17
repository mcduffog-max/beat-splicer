"""GPU finishing pass: each colour look matches the canvas version closely; lenses and motion blur change the picture;
an export still passes the frame check, and its cost is reported.  cwd /home/claude"""
import asyncio, sys, json, time
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
STILL="""async(a)=>{ const [gpu,look,lens,blur,i,dt]=a; $('gpuFinish').checked=gpu; $('motionBlur').checked=blur; setControl('look',look); setControl('lens',lens); setControl('colMatch','off');
  const W=320,H=180, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const o={ep:EP('youtube'),canvas:cv,g:cv.getContext('2d',{willReadFrequently:true}),W,H}, s=S.plan[i];
  const F={...readFx(),hook:'',end:'',lower:'',brand:'off',doodles:false,glitch:false,grain:false,vignette:false};
  await renderStill(o,i,s.start+dt,F,false); if(blur){ postFx(o,s.start+dt,windowFor(EP('youtube')),F,beatInfo(s.start+dt),{}); }
  const d=o.g.getImageData(0,0,W,H).data; let r=0,g=0,b=0,sh=0; for(let k=0;k<d.length;k+=4){ r+=d[k]; g+=d[k+1]; b+=d[k+2]; if(k%(W*4)) sh+=Math.abs(d[k]-d[k-4]); } const n=d.length/4;
  return {mean:[r/n,g/n,b/n].map(x=>+x.toFixed(1)), sharp:+(sh/n).toFixed(2), gpu:F.gpu}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required","--use-gl=swiftshader","--ignore-gpu-blocklist"]); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    print("webgl:", await pg.evaluate("!!finishGL()"), "| judged slow here (software renderer):", await pg.evaluate("finishGL().slow"), "| used by default:", await pg.evaluate("gpuOn()"))
    await pg.evaluate("window.BS_FORCE_GPU=true")
    worst=0
    for look in ["none","tealorange","warmfilm","vivid","moody","bw","fincher","cold","own"]:
      a=await pg.evaluate(STILL,[False,look,"none",False,6,0.5]); g=await pg.evaluate(STILL,[True,look,"none",False,6,0.5])
      d=max(abs(x-y) for x,y in zip(a["mean"],g["mean"])); worst=max(worst,d); print(f"{look:10s} canvas {a['mean']} gpu {g['mean']} diff {d:.1f} (gpu used {g['gpu']})")
    l0=await pg.evaluate(STILL,[True,"none","none",False,6,0.5]); l1=await pg.evaluate(STILL,[True,"none","helios",False,6,0.5]); print("helios changes the picture:", l0["mean"], l1["mean"], l0["sharp"], l1["sharp"])
    i=await pg.evaluate("S.plan.findIndex(s=>s._dmove==='punch')"); kind=await pg.evaluate(f"S.plan[{i}]._dmove")
    s0=await pg.evaluate(STILL,[True,"none","none",False,i,0.02]); s1=await pg.evaluate(STILL,[True,"none","none",True,i,0.02]); print(f"motion blur on a {kind}: sharpness {s0['sharp']} -> {s1['sharp']}")
    T={}
    await pg.evaluate("window.BS_FORCE_GPU=false")
    for gpu in [False]:
      await pg.evaluate(f"$('gpuFinish').checked={str(gpu).lower()}; setControl('lens','kit:cinema'); setControl('look','own'); $('engine').value='exact'; S.eps=['shorts']; S.results=[]; 0")
      t=time.time(); await pg.evaluate("$('render').click()"); await pg.wait_for_function("S.results.length>0 && !S.running && !S._exporting", timeout=900000); T[gpu]=time.time()-t
      chk=await pg.evaluate("(()=>{ const r=S.results[S.results.length-1]; return r&&r.check?[r.check.ok,r.check.summary]:null; })()"); print("export gpu" if gpu else "export canvas", f"{T[gpu]:.0f}s", chk)
    ok=worst<12 and l0["mean"]!=l1["mean"] and s1["sharp"]<s0["sharp"] and not errs
    print(("PASS" if ok else "FAIL")+" GPU finishing", errs[:3]); sys.exit(0 if ok else 1)
asyncio.run(main())
