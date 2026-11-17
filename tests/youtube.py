"""YouTube: read the channel, link Shorts to the recipes that made them, learn what works, upload scheduled. Google sign-in and APIs are mocked.
   Serve /home/claude: python3 -m http.server 8790 --directory /home/claude"""
import asyncio, json, time, re
from playwright.async_api import async_playwright
NOW=int(time.time()*1000); DAY=86400000
FAKE_GIS="window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'tok123',expires_in:3600}),10)})}}};"
# 12 recipes over 12 days: chorus openings and 'tight' pace do better
recs=[]; vids=[]; rows=[]
for k in range(12):
    chorus = k%2==0; tight = k%3==0
    at=NOW-(14-k)*DAY
    recs.append({"key":f"r{k}","at":at,"ep":"shorts","file":f"Song {k}.mp4","song":f"Song Number {k} Alpha","artist":"Band","dur":28.5,"opening":"chorus" if chorus else "strongest moment","style":"Symmetry" if k%4<2 else "Painterly surreal","motif":"none","look":"vivid","pace":"tight" if tight else "classic","text":"clean","sig":"mixed","length":"recommended","title":"no title","ytId":None})
    vids.append({"id":f"vid{k}","title":f"Band Song Number {k} Alpha","at":at+DAY//2})
    stay=0.30+(0.12 if chorus else 0)+(0.05 if tight else 0)
    rows.append([f"vid{k}",1000,int(1000*stay),17,60+20*stay,20,1,0])
async def api(route):
    u=route.request.url
    if "/channels?" in u: body={"items":[{"id":"UC1","snippet":{"title":"McDuffOG"},"contentDetails":{"relatedPlaylists":{"uploads":"UU1"}}}]}
    elif "/playlistItems?" in u: body={"items":[{"contentDetails":{"videoId":v["id"],"videoPublishedAt":time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(v["at"]/1000))},"snippet":{"title":v["title"],"publishedAt":""}} for v in vids]}
    elif "/videos?part=contentDetails" in u: body={"items":[{"id":v["id"],"contentDetails":{"duration":"PT28S"}} for v in vids]}
    elif "youtubeanalytics" in u: body={"columnHeaders":[{"name":n} for n in ["video","views","engagedViews","averageViewDuration","averageViewPercentage","likes","shares","subscribersGained"]],"rows":rows}
    elif "upload/youtube/v3/videos" in u and route.request.method=="POST":
        await route.fulfill(status=200, headers={"Location":"https://www.googleapis.com/upload/session/abc","Access-Control-Expose-Headers":"Location","Access-Control-Allow-Origin":"*"}, body="{}"); return
    elif "upload/session" in u: body={"id":"NEWVID1"}
    else: body={}
    await route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin":"*","Access-Control-Expose-Headers":"Location"}, body=json.dumps(body))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":412,"height":915}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await ctx.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        await ctx.route("https://accounts.google.com/gsi/client", lambda r: r.fulfill(status=200, content_type="application/javascript", body=FAKE_GIS))
        await ctx.route(re.compile(r"https://(www|youtubeanalytics)\.googleapis\.com/.*"), api)
        mb=open("lib/mp4box/package/dist/mp4box.all.min.js").read(); wm=open("lib/webm-muxer/package/build/webm-muxer.js").read()
        await ctx.route("https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mb))
        await ctx.route("https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=wm))
        await pg.goto("http://localhost:8790/v2/dist/index.html")
        await pg.evaluate("r=>localStorage.setItem('beatsplicerRecipes',JSON.stringify(r))", recs)
        await pg.evaluate("STEPS().forEach(d=>d.open=true); document.querySelectorAll('details').forEach(d=>d.open=true)")
        print("setup shown:", await pg.evaluate("[!$('ytBox').hidden, !$('ytSetup').hidden, $('ytLive').hidden]"))
        await pg.fill("#ytClient","123-abc.apps.googleusercontent.com"); await pg.click("#ytSave")
        await pg.click("#ytRead"); await pg.wait_for_function("/Shorts read/.test($('ytOut').textContent)", timeout=20000)
        print("result:\n  "+(await pg.evaluate("[...$('ytOut').children].map(d=>d.textContent).join('\\n  ')")))
        print("weights: chorus", await pg.evaluate("learnW('opening','chorus')"), "strongest", await pg.evaluate("learnW('opening','strongest moment')"), "tight", await pg.evaluate("learnW('pace','tight')"), "classic", await pg.evaluate("learnW('pace','classic')"))
        # make a Short, then upload it scheduled
        await pg.set_input_files("#folderInput","lib40"); await pg.wait_for_function("S.clips.length===40 && S.clips.every(c=>c.samples||c.error)", timeout=300000)
        await pg.set_input_files("#audioInput","tracks/rocket110.wav"); await pg.wait_for_function("S.an && S.plan", timeout=120000)
        await pg.evaluate("$('engine').value='exact'; $('render').click()"); await pg.wait_for_function("S.results.length>0 && !S.running && !S._exporting", timeout=600000); await pg.wait_for_timeout(800)
        print("recipe logged:", await pg.evaluate("(()=>{ const r=recipes().at(-1); return [r.ep, r.opening, r.style, r.pace, r.dur]; })()"))
        await pg.evaluate("document.querySelector('#results select').value='19'"); await pg.click("#results button:has-text('Upload to YouTube')")
        await pg.wait_for_function("/Scheduled on YouTube|Uploaded/.test($('status').textContent) || $('status').classList.contains('err')", timeout=30000)
        print("upload:", await pg.inner_text("#status"), "| recipe linked:", await pg.evaluate("recipes().at(-1).ytId"))
        await pg.locator("#results").screenshot(path="/home/claude/yt81.png")
        ok=(await pg.evaluate("learnW('opening','chorus')>1.2 && learnW('pace','tight')>1.05 && recipes().at(-1).ytId==='NEWVID1'")) and not errs
        print("PASS" if ok else "FAIL", "YouTube learning and upload"); await b.close()
        import sys; sys.exit(0 if ok else 1)
asyncio.run(main())
