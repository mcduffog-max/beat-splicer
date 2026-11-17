"""Cut on the action: clips whose movement starts at known times; with the setting on, more of the beats inside each
shot meet a movement start in the picture (downbeats, within -0.1 to +0.15 s).  cwd /home/claude; clips in actlib (see the generator in this file's history)."""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"; TRUTH=json.load(open("v2/tests/act-truth.json"))
HIT="""(T)=>{ let hit=0,n=0,shots=0; S.plan.forEach(s=>{ const c=S.clips[s.clip]; if(!c||actSkip(s,c)) return; const tb=T[c.name]; if(!tb) return; shots++; const r=s._rate||1;
  S.an.beats.forEach((b,i)=>{ if(b<=s.start+0.05||b>=s.end-0.05||!isDownAt(S.an,i)) return; const st=s.src+(b-s.start)*r; n++; if(tb.some(x=>st-x>=-0.1&&st-x<=0.15)) hit++; }); });
  return [hit,n,shots,S.plan.filter(s=>s._act).length]; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","actlib"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    await pg.evaluate("$('cutAction').checked=false; buildPlan(); 0"); off=await pg.evaluate(HIT,TRUTH)
    await pg.evaluate("$('cutAction').checked=true; buildPlan(); 0"); t0=await pg.evaluate("performance.now()")
    await pg.wait_for_function("S.plan.some(s=>s._act) && !S._actBusy", timeout=400000); secs=(await pg.evaluate("performance.now()")-t0)/1000
    on=await pg.evaluate(HIT,TRUTH)
    print(await pg.evaluate("""(()=>{ const r={skip:0,miss:0,ok:0,neg:0,why:{}}; S.plan.forEach(s=>{ const c=S.clips[s.clip]; if(actSkip(s,c)){ r.skip++; ['_manual','_lock','_rev','_ramp','_freeze','_refrain','_bookend','_loop','_pattern','_endShot'].forEach(k=>{ if(s[k]) r.why[k]=(r.why[k]||0)+1; }); return; } if(actMissing(s,c)){ r.miss++; return; } r.ok++; if(actScore(s,c,s._actBase??s.src)<0) r.neg++; }); return JSON.stringify(r); })()"""))
    await pg.evaluate("buildPlan(); 0"); again=await pg.evaluate(HIT,TRUTH)   # a rebuild reuses the measurements
    ov=await pg.evaluate("(()=>{ let bad=0; S.plan.forEach((a,i)=>S.plan.forEach((b,j)=>{ if(j<=i||a.clip!==b.clip||S.clips[a.clip].kind==='image') return; const A=[a.src,a.src+(a.end-a.start)*(a._rate||1)], B=[b.src,b.src+(b.end-b.start)*(b._rate||1)]; if(A[0]<B[1]-0.01&&B[0]<A[1]-0.01) bad++; })); return bad; })()")
    i=await pg.evaluate("S.plan.findIndex(s=>s._act)"); await pg.evaluate(f"showShot({i}); 0"); info=await pg.inner_text("#shotInfo")
    print("off",off,"on",on,"rebuild",again,f"measured in {secs:.0f}s","overlaps",ov); print(info)
    fo,fn=off[0]/max(1,off[1]), on[0]/max(1,on[1])
    ok=fn>fo+0.2 and again[:2]==on[:2] and ov==0 and not errs
    print(("PASS" if ok else "FAIL")+f" downbeats meeting a movement start: {fo:.0%} -> {fn:.0%}", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
