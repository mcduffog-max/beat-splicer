"""Lyrics found automatically: a mocked LRCLIB returns two cuts of the song; the app picks the one closest in length and lines it up with the recording.  python3 tests/lyrics.py"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
import asyncio, json
from playwright.async_api import async_playwright
V=["Riding down the empty road","Nothing left to call my own","Every mile a little more","Closer to the open door"]
C=["City lights are calling me","Calling me tonight","City lights are calling me","Calling me tonight"]
V2=["Sand and wind like the days before","Dust is rising from the floor","Every step a little slower","Waiting for the night to lower"]
Bv=["Down and down the river runs","Under all the setting suns"]
def lrc(shift):
    out=[]; 
    def add(t0,lines,step=4):
        for k,l in enumerate(lines): t=t0+k*step+shift; out.append(f"[{int(t//60):02d}:{t%60:05.2f}]{l}")
    add(8.4,V); add(24.3,C); add(40.4,V2); add(56.3,C); add(72.4,Bv); add(80.3,C); add(88.3,C)
    return "\n".join(out)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        calls=[]
        async def lr(route):
            u=route.request.url; calls.append(u.split("/api/")[1][:90])
            if "/api/get" in u: await route.fulfill(status=404, body="{}")
            else: await route.fulfill(status=200, content_type="application/json", body=json.dumps([
                {"trackName":"Pop Song","artistName":"Test Band","duration":140,"instrumental":False,"syncedLyrics":lrc(0),"plainLyrics":"x"},
                {"trackName":"Pop Song","artistName":"Test Band","duration":101,"instrumental":False,"syncedLyrics":lrc(-3.0),"plainLyrics":"x"}]))
        await ctx.route("https://lrclib.net/api/**", lr); await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto("file://"+os.path.join(HERE,"..","dist-claude","index.html"))
        await pg.set_input_files("#audioInput",os.path.join(HERE,"songs","Test Band - Pop Song (Official Music Video).wav")); await pg.wait_for_function("S.an", timeout=120000)
        await pg.wait_for_function("!!S.lyrics", timeout=20000)
        print("searched:", calls); print("song parsed as:", await pg.evaluate("lySong()"))
        print("status:", await pg.inner_text("#status"))
        print("first chorus line now at:", await pg.evaluate("S.lyrics.lines.find(l=>/City/.test(l.text)).t"), "(true 24.3), shift", await pg.evaluate("S.lyrics.shift"))
        print("short opens on:", await pg.evaluate("(()=>{ const w=windowFor(EP('shorts')); return [w[0], S._hookWhy]; })()"))
        print("lyric sections:", await pg.evaluate("lyricSections().map(s=>[s.name,s.t0,s.chorus])"), await pg.evaluate("S.lyrics.exact"))
        t=await pg.evaluate("S.lyrics.lines.find(l=>/City/.test(l.text)).t"); why=await pg.evaluate("S._hookWhy||''")
        ok=abs(t-24.3)<=0.3 and "chorus" in why and not errs
        print(("PASS" if ok else "FAIL")+f" lyrics lined up to {t} (true 24.3); Short opens on {why}"); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
