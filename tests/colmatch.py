"""Shot matching: four families of clips (warm and dark, cool and bright, flat, untouched) end up closer in colour and brightness.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
MEASURE="""async(mode)=>{ setControl('colMatch',mode); setControl('look','none'); setControl('lens','none'); for(const s of S.plan) s._cmF=null; S.plan._cmRef=null;
  const W=192,H=108, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const o={ep:EP('youtube')||{w:W,h:H},canvas:cv,g:cv.getContext('2d',{willReadFrequently:true}),W,H}, F=readFx(), out=[]; const t0=performance.now();
  for(let i=0;i<S.plan.length;i++){ const s=S.plan[i]; await renderStill(o,i,(s.start+s.end)/2,{...F,hook:'',end:'',lower:'',brand:'off',doodles:false,glitch:false,grain:false},false);
    const d=o.g.getImageData(0,0,W,H).data; let r=0,g=0,b=0; for(let k=0;k<d.length;k+=4){ r+=d[k]; g+=d[k+1]; b+=d[k+2]; } const n=d.length/4; r/=n; g/=n; b/=n;
    out.push([Math.log((r+4)/(g+4)),Math.log((b+4)/(g+4)),0.299*r+0.587*g+0.114*b,(+S.clips[s.clip].name.slice(0,2))%4]); }
  const sd=j=>{ const v=[0,1,2,3].map(k=>{ const q=out.filter(x=>x[3]===k); return q.reduce((a,x)=>a+x[j],0)/Math.max(1,q.length); }), m=v.reduce((a,b)=>a+b,0)/v.length; return Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length); };
  return {n:out.length, rg:sd(0), bg:sd(1), L:sd(2), ms:(performance.now()-t0)/out.length, filt:document.querySelectorAll('filter[id^=bscm]').length}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","cmlib"); await pg.wait_for_function("S.clips.length>=16 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    R={}
    for m in ["off","gentle","strong"]: R[m]=await pg.evaluate(MEASURE,m); print(m,json.dumps({k:(round(v,4) if isinstance(v,float) else v) for k,v in R[m].items()}))
    import os
    if os.environ.get("SHEET"):
      png=await pg.evaluate("""async()=>{ const idx=[2,9,16,23,30,37,44,51], W=240,H=135, sh=document.createElement('canvas'); sh.width=W*idx.length; sh.height=H*2+4; const sg=sh.getContext('2d'); sg.fillStyle='#000'; sg.fillRect(0,0,sh.width,sh.height);
        for(const [row,mode] of [[0,'off'],[1,'gentle']]){ setControl('colMatch',mode); for(const s of S.plan) s._cmF=null; S.plan._cmRef=null;
          for(let k=0;k<idx.length;k++){ const i=idx[k], s=S.plan[i], cv=document.createElement('canvas'); cv.width=W; cv.height=H; const o={ep:EP('youtube'),canvas:cv,g:cv.getContext('2d'),W,H};
            await renderStill(o,i,(s.start+s.end)/2,{...readFx(),hook:'',end:'',lower:'',brand:'off',doodles:false,glitch:false,grain:false},false); sg.drawImage(cv,k*W,row*(H+4)); } }
        return sh.toDataURL('image/png'); }""")
      import base64; open(os.environ["SHEET"],"wb").write(base64.b64decode(png.split(",")[1]))
    await pg.evaluate("showShot(3); 0"); print(await pg.inner_text("#shotInfo"))
    o,g=R["off"],R["gentle"]; ok=g["rg"]+g["bg"]<(o["rg"]+o["bg"])*0.88 and g["L"]<o["L"]*0.9 and R["strong"]["L"]<g["L"] and not errs
    print(("PASS" if ok else "FAIL")+" shots end up closer in colour and brightness", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
