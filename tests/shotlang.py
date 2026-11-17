"""Shot language with stand-in picture readings: 40 clips in 8 made-up places, each clip at a known shot size.
Checks that places are found, that sections stay in a place for a few shots, and that the story arc gets shot sizes.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
SETUP="""()=>{ const r=rng(5), rv=()=>{ const v=new Float32Array(512); for(let i=0;i<512;i++) v[i]=r()*2-1; return unitVec(v); };
  const P=[...Array(8)].map(rv), Q=[...Array(6)].map(rv), F=[rv(),rv()];
  S.clips.forEach((c,i)=>{ c._truePlace=i%8; c._trueScale=Math.floor(i/8)%6; c.tags=[]; c._pv=null;
    c.samples.forEach(s=>{ const n=rv(), v=new Float32Array(512); for(let k=0;k<512;k++) v[k]=P[i%8][k]+0.2*n[k]+0.25*Q[c._trueScale][k]; s.ce=packVec(unitVec(v)); s._stag=null; }); });
  S._seeScale=Q.concat(F); S._placeKey=null; S.seed=7; return 0; }"""
STATS="""()=>{ const pl=places(); let same=0,pairs=0; S.plan.forEach((s,i)=>{ const p=S.plan[i-1]; if(!p||secIdx(p.start)!==secIdx(s.start)) return; pairs++; if(S.clips[s.clip]._truePlace===S.clips[p.clip]._truePlace) same++; });
  const sc=S.plan.map(s=>[wantScale(s,s._beat||storyBeat(s,0,S.plan)),S.clips[s.clip]._trueScale]), m=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const mx=m(sc.map(x=>x[0])), my=m(sc.map(x=>x[1])), cov=m(sc.map(x=>(x[0]-mx)*(x[1]-my))), sd=k=>Math.sqrt(m(sc.map(x=>(x[k]-(k?my:mx))**2)));
  let pure=0; const g=new Map(); S.clips.forEach(c=>{ const k=c._place; if(!g.has(k)) g.set(k,[]); g.get(k).push(c._truePlace); }); g.forEach(v=>{ const cnt={}; v.forEach(x=>cnt[x]=(cnt[x]||0)+1); pure+=Math.max(...Object.values(cnt)); });
  return {places:pl&&pl.n, purity:pure/S.clips.length, samePlace:same/Math.max(1,pairs), scaleCorr:cov/(sd(0)*sd(1)||1), matchCuts:S.plan.filter(s=>s._mcut).length,
    reasons:[...new Set(S.plan.flatMap(s=>(s.why||[]).map(w=>w.t.split(':')[0])))].slice(0,12)}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort()); mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    await pg.evaluate("$('storyOn').checked=true; 0")
    base=await pg.evaluate("(()=>{ S.clips.forEach((c,i)=>{ c._truePlace=i%8; c._trueScale=Math.floor(i/8)%6; }); S.seed=7; buildPlan(); return 0; })()")
    before=await pg.evaluate(STATS.replace("const pl=places();","const pl=null;"))
    await pg.evaluate(SETUP); await pg.evaluate("buildPlan(); 0"); after=await pg.evaluate(STATS)
    print("without readings", json.dumps(before)); print("with readings   ", json.dumps(after))
    ok=after["places"] in range(7,10) and after["purity"]>0.95 and after["samePlace"]>before["samePlace"]+0.15 and after["scaleCorr"]>before["scaleCorr"]+0.15 and not errs
    print(("PASS" if ok else "FAIL")+" places found, scenes hold, shot sizes follow the story", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
