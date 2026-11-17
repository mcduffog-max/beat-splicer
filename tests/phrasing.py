"""Phrasing: cuts follow the singer, a long take where the song breathes, off-beat cuts, a held breath before the biggest drop.  cwd /home/claude"""
import asyncio, sys, json
from playwright.async_api import async_playwright
URL="file:///home/claude/v2/dist-claude/index.html"
ST="""()=>{ const L=S.lyrics.lines.map(l=>l.t).filter(t=>t>0.5), cuts=S.plan.map(s=>s.start);
  const onVoice=L.filter(t=>cuts.some(c=>Math.abs(c-t)<0.08)).length/L.length, lens=S.plan.map(s=>s.end-s.start);
  const B=S.an.beats, onBeat=S.plan.slice(1).filter(s=>B.some(b=>Math.abs(b-s.start)<0.03)).length/(S.plan.length-1);
  return {onVoice:+onVoice.toFixed(2), onBeat:+onBeat.toFixed(2), takes:S.plan.filter(s=>s._take).map(s=>+(s.end-s.start).toFixed(1)), sync:S.plan.filter(s=>s._sync).length, breath:S.plan.filter(s=>s._breath).length,
    shortest:+Math.min(...lens).toFixed(2), longest:+Math.max(...lens).toFixed(1), n:S.plan.length, drops:S.plan.filter(s=>s.drop).map(s=>+s.start.toFixed(2)), reasons:[...new Set(S.plan.flatMap(s=>(s.why||[]).map(w=>w.t)).filter(t=>/long take|breath|singer|off-beat/.test(t)))]}; }"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":1280,"height":900}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
    await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
    await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await pg.goto(URL); await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length>=40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
    await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
    await pg.evaluate("t=>setLyrics(t,'file')", open("lyr/rocket110.lrc").read()); await pg.wait_for_function("S.lyrics", timeout=20000)
    await pg.evaluate("$('phrasing').checked=false; buildPlan(); 0"); off=await pg.evaluate(ST)
    await pg.evaluate("$('phrasing').checked=true; buildPlan(); 0"); on=await pg.evaluate(ST)
    ex=await pg.evaluate("(()=>{ const P=makeExportPlan(EP('youtube'),windowFor(EP('youtube'))); return [P.some(s=>s._take), P.some(s=>s._breath)]; })()")
    print("off", json.dumps(off)); print("on ", json.dumps(on)); print("export keeps take/breath", ex)
    ok=on["onVoice"]>=off["onVoice"]+0.25 and len(on["takes"])>=1 and on["breath"]==1 and on["shortest"]>=min(0.39,off["shortest"]-0.01) and on["drops"]==off["drops"] and on["onBeat"]<off["onBeat"] and not errs
    print(("PASS" if ok else "FAIL")+" phrasing", errs[:2]); sys.exit(0 if ok else 1)
asyncio.run(main())
