"""Beat Splicer regression suite: run before every publish.  python3 regress.py [path-to-html]"""
import asyncio, sys, time, json
from playwright.async_api import async_playwright
URL=(sys.argv[1] if len(sys.argv)>1 and "://" in sys.argv[1] else "file://"+(sys.argv[1] if len(sys.argv)>1 else "/mnt/user-data/outputs/splicer.html"))
R=[]
def ok(name,cond,detail=""): R.append((name,bool(cond),detail)); print(("PASS " if cond else "FAIL ")+name+(f"  [{detail}]" if detail else ""),flush=True)
async def setup(ctx,errs):
    pg=await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    return pg
async def load(pg,clips="lib40",n=40,song="tracks/rocket110.wav"):
    await pg.goto(URL)
    await pg.set_input_files("#folderInput",clips); await pg.wait_for_function(f"S.clips.length>={n} && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput",song); await pg.wait_for_function("S.an && S.plan", timeout=120000)
async def main():
    t0=time.time()
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); errs=[]
        # A. phone: self-tests, layout
        ctx=await b.new_context(viewport={"width":412,"height":915}); pg=await setup(ctx,errs); await load(pg)
        st=await pg.evaluate("selfTests().then(T=>T.map(x=>[x.name,x.ok,x.why]))")
        bad=[x for x in st if not x[1]]; ok(f"Self-tests ({len(st)})", not bad, "; ".join(f"{x[0]}: {x[2]}" for x in bad))
        w1=await pg.evaluate("document.documentElement.scrollWidth"); await pg.click("#viewAll"); await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true); 0")
        w2=await pg.evaluate("document.documentElement.scrollWidth"); ok("Phone layout fits the screen (both views, all open)", w1<=412 and w2<=412, f"{w1}px / {w2}px"); await pg.click("#viewSimple")
        modes=[]; 
        for _ in range(3): await pg.click("#themeBtn"); modes.append(await pg.evaluate("$('themeBtn').dataset.mode"))
        ok("Theme switch cycles", modes==["dark","light","system"], str(modes))
        # B. export
        await pg.evaluate("S.eps=['shorts']; buildEndpointUI(); $('engine').value='exact'; 0")
        await pg.click("#render"); await pg.wait_for_function("$('status').textContent.startsWith('Done') || $('status').classList.contains('err')", timeout=900000)
        chk=await pg.evaluate("S.results[0]&&S.results[0].check&&[S.results[0].check.ok,(S.results[0].check.shots||[]).join('/')]")
        ok("Export a Short and pass the frame check", chk and chk[0], str(chk))
        # C. Do everything
        t=time.time(); await pg.click("#autoBtn"); await pg.wait_for_function("/Movement:|couldn|error/i.test($('autoOut').textContent)", timeout=600000)
        ok("Do everything completes", "Movement:" in await pg.inner_text("#autoOut"), f"{time.time()-t:.1f}s, style {await pg.evaluate('S.style.name')}")
        ok("Style card shows Do everything's choice", await pg.evaluate("S.style.by==='auto'&&S.style.name===S.direct"))
        await ctx.close()
        # D. timeline on desktop: trim, undo, redo, swap
        ctx=await b.new_context(viewport={"width":1280,"height":1000}); pg=await setup(ctx,errs); await load(pg)
        await pg.evaluate("$('timeline').scrollIntoView({block:'center'}); 0"); await pg.wait_for_timeout(200)
        G=await pg.evaluate("(()=>{ const r=$('timeline').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,d:S.an.duration}; })()"); X=lambda t: G['x']+t/G['d']*G['w']; y=G['y']+110
        k=await pg.evaluate("S.plan.findIndex((s,i)=>i>3&&s.start>15&&s.start*($('timeline').getBoundingClientRect().width/S.an.duration)<($('timeline').parentElement.clientWidth-60))")
        t1=await pg.evaluate(f"S.plan[{k}].start"); await pg.mouse.move(X(t1),y); await pg.mouse.down(); await pg.mouse.move(X(t1)+8,y,steps=3); await pg.mouse.move(X(t1)+20,y,steps=4); await pg.mouse.up()
        t2=await pg.evaluate(f"S.plan[{k}].start"); onb=await pg.evaluate(f"S.an.beats.some((b,i)=>Math.abs(b-S.plan[{k}].start)<0.002||(S.an.beats[i+1]&&Math.abs((b+S.an.beats[i+1])/2-S.plan[{k}].start)<0.002))")
        ok("Trim a cut onto the beat", t2!=t1 and onb, f"{t1:.2f} -> {t2:.2f}")
        await pg.evaluate("buildPlan(); 0"); ok("Trim survives a rebuild", abs(await pg.evaluate(f"S.plan[{k}].start")-t2)<0.001)
        await pg.click("#undoBtn"); u=await pg.evaluate(f"S.plan[{k}].start"); await pg.click("#redoBtn"); r=await pg.evaluate(f"S.plan[{k}].start")
        ok("Undo and redo the trim", abs(u-t1)<0.001 and abs(r-t2)<0.001, f"{u:.2f} / {r:.2f}")
        a,c=await pg.evaluate("[S.plan[5].clip,S.plan[9].clip]"); m5,m9=await pg.evaluate("[(S.plan[5].start+S.plan[5].end)/2,(S.plan[9].start+S.plan[9].end)/2]")
        await pg.mouse.move(X(m5),y); await pg.mouse.down(); await pg.mouse.move(X(m5)+15,y,steps=3); await pg.mouse.move(X(m9),y,steps=8); await pg.mouse.up()
        ok("Swap two shots by dragging", await pg.evaluate("[S.plan[5].clip,S.plan[9].clip]")==[c,a])
        await pg.evaluate("setControl('look','neon'); $('look').dispatchEvent(new Event('change',{bubbles:true})); 0"); await pg.wait_for_timeout(1400); await pg.click("#undoBtn")
        ok("Undo a settings change", await pg.evaluate("$('look').value")!="neon")
        await pg.evaluate("document.querySelectorAll('details.step').forEach(d=>d.open=true); 0"); await pg.click("#styles .chip:has-text('Cinematic')"); ok("Style card follows a look chip", "Cinematic" in await pg.inner_text("#styleNow"))
        # E. lyrics
        await pg.evaluate("S.clips.forEach((c,i)=>{ c.tags=[0.25,0.75].map(f=>({t:c.dur*f,scale:2,faces:0,subj:'',setting:'',scene:[i%2?'city':'desert']})); }); buildPlan(); 0")
        await pg.set_input_files("#lyricsFile","lyr/rocket110.lrc"); await pg.wait_for_function("S.lyrics", timeout=20000)
        stat="""(()=>{ let hit=0,n=0; for(const s of S.plan){ const l=lyricAt(s.start+Math.min(0.4,(s.end-s.start)/2)); if(!l) continue; const k=/desert|sand|dune|canyon/i.test(l.text)?'desert':/city|neon|downtown|street/i.test(l.text)?'city':null; if(!k) continue; n++; if(clipScenes(S.clips[s.clip]).has(k)) hit++; } return [hit,n]; })()"""
        on=await pg.evaluate(stat); await pg.evaluate("$('lyricMatch').checked=false; buildPlan(); 0"); off=await pg.evaluate(stat); await pg.evaluate("$('lyricMatch').checked=true; buildPlan(); 0")
        ok("Lyrics steer shots to what's sung", on[0]/max(1,on[1]) > off[0]/max(1,off[1])+0.15, f"{on} with, {off} without")
        await pg.evaluate("$('lyricsBox').open=true; 0"); await pg.click("#lyTapStart"); await pg.wait_for_timeout(900); n1=await pg.evaluate("tapNow()"); await pg.click("#lyTapBtn"); await pg.wait_for_timeout(700); n2=await pg.evaluate("tapNow()"); await pg.click("#lyTapBtn"); await pg.click("#lyTapStop")
        tl=await pg.evaluate("S.lyrics.lines.slice(0,2).map(l=>l.t)")
        ok("Tap-to-time records each line", abs(tl[0]-(n1-0.12))<0.1 and abs(tl[1]-(n2-0.12))<0.1 and await pg.evaluate("S.lyrics.src==='tap'"), f"{tl} vs {[round(n1-0.12,2),round(n2-0.12,2)]}")
        await pg.click("#foldAll"); await pg.click("summary:has-text('Video clips')"); await pg.wait_for_timeout(200); await pg.click("summary:has-text('Publish')"); await pg.wait_for_timeout(200)
        lay=await pg.evaluate("[STEPS().filter(d=>d.open).map(d=>d.querySelector('h2').textContent).join(), $('preview').parentElement.id, $('remix2').parentElement.id, $('clipList').children.length<=9||S.clipsAll]")
        ok("Compact layout: one step open, Preview and Remix by the screen", lay==["Publish","stageBar","stageBar",True], str(lay))
        wy=await pg.evaluate("(()=>{ showShot(5); const r=$('shotPanel').getBoundingClientRect(), w=document.querySelector('.work').getBoundingClientRect(); return [S.plan.every(s=>s._manual||(s.why&&s.why.length)), $('shotWhy').textContent.startsWith('Why this shot'), r.bottom<=w.bottom+1||getComputedStyle(document.querySelector('.work')).overflowY==='auto']; })()")
        ok("Every shot says why it was chosen, and the panel fits the page", all(wy), str(wy))
        ov=await pg.evaluate("(()=>{ let bad=0; for(const P of [S.plan, makeExportPlan(EP('youtube'),windowFor(EP('youtube')))]){ const U=new Map(); P.forEach(s=>{ const c=S.clips[s.clip]; if(!c||c.kind==='image') return; const a=s.src, b=s.src+(s.end-s.start), u=U.get(s.clip)||[]; if(u.some(([x,y])=>Math.min(y,b)-Math.max(x,a)>0.05)) bad++; u.push([a,b]); U.set(s.clip,u); }); } return bad; })()")
        ok("A returning clip moves on: no frames shown twice", ov==0, f"{ov} repeats")
        # F. save and restore with trims and locks
        await pg.evaluate("S.locks.set(lockKey(S.plan[3]),{clip:S.plan[3].clip,src:S.plan[3].src,rev:false}); S.plan[3]._lock=true; 0")
        await pg.evaluate("saveProject()"); n=await pg.evaluate("S.plan.length"); tr=await pg.evaluate("S.trims.length")
        pg2=await setup(ctx,errs); await pg2.goto(URL); await pg2.wait_for_function("!$('restoreBox').hidden", timeout=20000)
        await pg2.click("#restoreBtn"); await pg2.wait_for_function("/restored|Couldn/.test($('status').textContent)", timeout=300000)
        rs=await pg2.evaluate("[S.plan&&S.plan.length, S.trims.length, S.locks.size, !!S.lyrics]")
        ok("Restore brings back the edit, trims, locks and lyrics", rs[0]==n and rs[1]==tr and rs[2]>=1 and rs[3], str(rs))
        await ctx.close()
        ok("No page errors", not errs, "; ".join(errs[:3]))
        await b.close()
    f=[x for x in R if not x[1]]
    print(f"\n{len(R)-len(f)}/{len(R)} passed in {time.time()-t0:.0f}s" + ("" if not f else "  FAILED: "+", ".join(x[0] for x in f)))
    sys.exit(1 if f else 0)
asyncio.run(main())
