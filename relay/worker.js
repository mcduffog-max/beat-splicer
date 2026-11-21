/* Beat Splicer relay and website (Cloudflare Worker, free plan).
   Website
   - GET  /            the Beat Splicer landing page, with the creators who share a page
   - GET  /@name       a creator's page: photo, name, a line about them, links and the videos they chose
   - GET  /privacy     the privacy policy
   For the app
   - POST /report      turns an in-app bug report into a GitHub issue in your repository
   - GET  /latest      newest Android build (works when the repository is private)
   - GET  /apk         downloads that build's APK, for the in-app Update button
   - POST /page        publishes or updates a creator page; DELETE /page takes it down
   - POST /page-report someone reports a creator page (becomes a GitHub issue labelled page-report)
   - POST /admin/hide  you take a page down (needs ADMIN_KEY)
   Settings (Worker → Settings → Variables): GITHUB_TOKEN (secret: fine-grained token, this repo only,
   Issues: read and write, Contents: read), REPO = "mcduffog-max/beat-splicer", APP_KEY (secret: any random text,
   the same value goes into the app), ADMIN_KEY (secret: another random text, yours only), PLAY_URL (text, optional:
   the Google Play link once the app is live), WEB_URL (text, optional: where the browser version is).
   Storage: a KV namespace bound as PAGES (Worker → Settings → Bindings → KV namespace). */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "content-type,x-app-key,x-page-key,x-admin-key" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const gh = (env, path, init = {}) => fetch(`https://api.github.com/repos/${env.REPO}${path}`, { ...init, headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "beat-splicer-relay", ...(init.headers || {}) } });
const recent = new Map(); // a light per-address limit: 6 reports an hour
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/report" && req.method === "POST") {
      if (env.APP_KEY && req.headers.get("x-app-key") !== env.APP_KEY) return json({ error: "not from the app" }, 403);
      const ip = req.headers.get("cf-connecting-ip") || "?", now = Date.now(), hits = (recent.get(ip) || []).filter(t => now - t < 3600e3);
      if (hits.length >= 6) return json({ error: "too many reports, try again later" }, 429); hits.push(now); recent.set(ip, hits);
      let r; try { r = await req.json(); } catch (e) { return json({ error: "bad report" }, 400); }
      const clip = (s, n) => String(s || "").slice(0, n);
      const title = clip(r.title, 120) || "Problem reported from the app";
      const body = [`**What happened**\n\n${clip(r.what, 4000) || "(not described)"}`, `**App**: ${clip(r.app, 200)}`, r.error ? `**Error details**\n\n\`\`\`\n${clip(r.error, 12000)}\n\`\`\`` : "", r.diag ? `<details><summary>Diagnostics</summary>\n\n\`\`\`\n${clip(r.diag, 40000)}\n\`\`\`\n</details>` : "", r.contact ? `**Contact**: ${clip(r.contact, 200)}` : ""].filter(Boolean).join("\n\n");
      const res = await gh(env, "/issues", { method: "POST", body: JSON.stringify({ title, body, labels: ["from-app"] }) });
      if (!res.ok) return json({ error: `GitHub said ${res.status}` }, 502);
      const issue = await res.json(); return json({ number: issue.number });
    }
    if (url.pathname === "/latest" || url.pathname === "/apk") {
      const res = await gh(env, "/releases/tags/android-latest"); if (!res.ok) return json({ error: `GitHub said ${res.status}` }, 502);
      const rel = await res.json(), asset = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
      if (url.pathname === "/latest") return json({ name: rel.name, body: rel.body, apk: asset ? `${url.origin}/apk` : null, size: asset && asset.size });
      if (!asset) return json({ error: "no APK in the latest release" }, 404);
      const file = await fetch(asset.url, { headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/octet-stream", "user-agent": "beat-splicer-relay" } });
      return new Response(file.body, { status: file.status, headers: { ...CORS, "content-type": "application/vnd.android.package-archive", "content-disposition": "attachment; filename=beat-splicer.apk" } });
    }
    if (url.pathname === "/privacy") return new Response(PRIVACY, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/health") return json({ ok: true, service: "beat-splicer relay", pages: !!env.PAGES });
    if (url.pathname === "/page" && (req.method === "POST" || req.method === "DELETE")) return pageWrite(req, env, url);
    if (url.pathname === "/page-report" && req.method === "POST") return pageReport(req, env);
    if (url.pathname === "/admin/hide" && req.method === "POST") { if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "no" }, 403);
      const h = String((await req.json().catch(() => ({}))).handle || "").toLowerCase(); await dropPage(env, h); return json({ hidden: h }); }
    let m = url.pathname.match(/^\/avatar\/([a-z0-9-]{3,24})\.jpg$/); if (m && env.PAGES) { const b = await env.PAGES.get("img:" + m[1], "arrayBuffer"); if (!b) return new Response("", { status: 404 }); return new Response(b, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" } }); }
    m = url.pathname.match(/^\/@([A-Za-z0-9-]{3,24})\/?$/); if (m) return creatorPage(env, url, m[1].toLowerCase());
    if (url.pathname === "/" || url.pathname === "") return landingPage(env, url);
    return html(notFound(url), 404);
  }
};

/* ---------------- the website ---------------- */
const html = (s, st = 200, extra = {}) => new Response(s, { status: st, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...extra } });
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RESERVED = new Set(["admin", "api", "apk", "latest", "privacy", "report", "page", "pages", "health", "avatar", "beat-splicer", "beatsplicer", "help", "support", "about", "app", "www", "official", "team"]);
const writes = new Map(); // per-address limit on page changes: 30 an hour
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function cleanLink(kind, u) { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; let x; try { x = new URL(u); } catch (e) { return ""; }
  if (x.protocol !== "https:" && x.protocol !== "http:") return ""; const h = x.hostname.replace(/^www\.|^m\./, "");
  const ok = { youtube: /^(youtube\.com|youtu\.be)$/, instagram: /^instagram\.com$/, tiktok: /^tiktok\.com$/, web: /./ }[kind]; return ok && ok.test(h) ? x.href.slice(0, 200) : ""; }
async function readIndex(env) { try { return JSON.parse(await env.PAGES.get("index") || "[]"); } catch (e) { return []; } }
async function dropPage(env, h) { if (!env.PAGES || !h) return; await env.PAGES.delete("page:" + h); await env.PAGES.delete("img:" + h); const ix = (await readIndex(env)).filter(x => x.handle !== h); await env.PAGES.put("index", JSON.stringify(ix)); }
async function pageWrite(req, env, url) {
  if (!env.PAGES) return json({ error: "Pages aren't switched on yet (the PAGES storage isn't connected)." }, 503);
  if (env.APP_KEY && req.headers.get("x-app-key") !== env.APP_KEY) return json({ error: "not from the app" }, 403);
  const ip = req.headers.get("cf-connecting-ip") || "?", now = Date.now(), hits = (writes.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 30) return json({ error: "Too many changes, try again in a while." }, 429); hits.push(now); writes.set(ip, hits);
  let r; try { r = await req.json(); } catch (e) { return json({ error: "bad request" }, 400); }
  const h = String(r.handle || "").toLowerCase().trim(), key = String(req.headers.get("x-page-key") || "");
  if (!/^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(h)) return json({ error: "Your page name can use 3 to 24 letters, numbers and dashes." }, 400);
  if (RESERVED.has(h)) return json({ error: "That page name is taken. Try another." }, 409);
  const old = await env.PAGES.get("page:" + h, "json");
  if (old && (!key || (await sha(key)) !== old.keyHash)) return json({ error: "That page name is taken. Try another." }, 409);
  if (req.method === "DELETE") { if (!old) return json({ ok: true }); await dropPage(env, h); return json({ ok: true, removed: h }); }
  let newKey = null, keyHash = old && old.keyHash; if (!old) { newKey = crypto.randomUUID() + crypto.randomUUID().slice(0, 8); keyHash = await sha(newKey); }
  if (old && r.renameFrom) {} // renames are a new page plus taking the old one down, done by the app
  let hasImg = old ? !!old.hasImg : false;
  if (typeof r.img === "string") {
    if (r.img === "") { await env.PAGES.delete("img:" + h); hasImg = false; }
    else { const m = r.img.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/); if (!m) return json({ error: "The photo must be a JPEG." }, 400);
      const bin = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0)); if (bin.length > 150000 || bin[0] !== 0xFF || bin[1] !== 0xD8) return json({ error: "The photo is too big or not a JPEG." }, 400);
      await env.PAGES.put("img:" + h, bin); hasImg = true; } }
  const L = r.links || {}, links = {}; for (const k of ["youtube", "instagram", "tiktok", "web"]) { const v = cleanLink(k, L[k]); if (v) links[k] = v; }
  const videos = [...new Set((Array.isArray(r.videos) ? r.videos : []).map(String).filter(v => /^[A-Za-z0-9_-]{11}$/.test(v)))].slice(0, 12);
  const rec = { handle: h, name: String(r.name || "").replace(/\s+/g, " ").trim().slice(0, 40) || h, bio: String(r.bio || "").replace(/\s+/g, " ").trim().slice(0, 160), links, videos, public: r.public !== false, hasImg, at: now, since: old ? old.since : now, keyHash };
  await env.PAGES.put("page:" + h, JSON.stringify(rec));
  const ix = (await readIndex(env)).filter(x => x.handle !== h); if (rec.public) ix.unshift({ handle: h, name: rec.name, hasImg, n: videos.length, at: now }); await env.PAGES.put("index", JSON.stringify(ix.slice(0, 60)));
  return json({ ok: true, handle: h, url: `${url.origin}/@${h}`, ...(newKey ? { key: newKey } : {}) });
}
async function pageReport(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "?", now = Date.now(), hits = (recent.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= 6) return html(simplePage("Thanks", "<p>We already have your reports. Thank you.</p>")); hits.push(now); recent.set(ip, hits);
  const f = await req.formData().catch(() => null), h = String(f && f.get("handle") || "").slice(0, 24), why = String(f && f.get("why") || "").slice(0, 1000);
  if (env.GITHUB_TOKEN && h) await gh(env, "/issues", { method: "POST", body: JSON.stringify({ title: `Page reported: @${h}`, body: `Someone reported the page **@${h}**.\n\n${why || "(no reason given)"}\n\nTo take it down: POST /admin/hide with {"handle":"${h}"} and your ADMIN_KEY.`, labels: ["page-report"] }) }).catch(() => {});
  return html(simplePage("Thanks for telling us", `<p>The page will be checked. <a href="/">Back to Beat Splicer</a></p>`));
}
/* the look: Beat Splicer's own marks. Archivo in two widths, the beat amber, the app's blue, a cool grey ground. */
const CSS = `:root{--bg:#ECEEF2;--panel:#FFFFFF;--ink:#14161C;--muted:#5C6270;--line:#D5D9E1;--beat:#E08A00;--blue:#1F5FD6;--wave:#B6BCC8;--tileA:#1F5FD6;--tileB:#E08A00;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--panel:#1A1D24;--ink:#ECEEF3;--muted:#9AA1AF;--line:#2A2F39;--beat:#FFA826;--blue:#6E9BFF;--wave:#3B4150;color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.55 Archivo,system-ui,sans-serif;font-variation-settings:"wdth" 100}
a{color:var(--blue)}a:focus-visible,button:focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:6px}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
.mark{display:inline-flex;align-items:flex-end;gap:3px;height:20px;margin-right:10px}.mark i{width:4px;border-radius:2px;background:var(--ink)}.mark i:nth-child(1){height:8px}.mark i:nth-child(2){height:16px}.mark i:nth-child(3){height:11px;background:var(--beat)}.mark i:nth-child(4){height:20px}.mark i:nth-child(5){height:10px}
.brand{display:flex;align-items:center;text-decoration:none;color:var(--ink);font-weight:700;font-variation-settings:"wdth" 112;font-size:18px;letter-spacing:-.01em}
h1,h2,.display{font-variation-settings:"wdth" 125;letter-spacing:-.025em;line-height:1.02;margin:0}
h1{font-size:clamp(44px,9vw,104px);font-weight:800;max-width:11ch}
h2{font-size:clamp(26px,4.2vw,40px);font-weight:750;margin-bottom:18px}
.lede{font-size:clamp(18px,2.2vw,21px);max-width:38ch;color:var(--muted);margin:22px 0 28px}
.cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border-radius:999px;font-weight:650;text-decoration:none;font-size:16px;border:0;cursor:pointer}
.btn.main{background:var(--ink);color:var(--bg)}.btn.soft{background:var(--panel);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.note{color:var(--muted);font-size:14px}
.hero{padding:34px 0 10px}
.strip{margin:44px 0 10px;width:100%;height:auto;display:block}
.strip .bar{fill:var(--wave)}.strip .beat{fill:var(--beat)}.strip .cut{stroke:var(--ink);stroke-width:2.2}
.strip .shot{opacity:.9}
@media (prefers-reduced-motion:no-preference){.strip .cut,.strip .shot{animation:drop .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--k)*90ms + 250ms)}@keyframes drop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}}
.cap{display:flex;justify-content:space-between;color:var(--muted);font-size:13px;margin-bottom:40px}
.listen{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;padding-top:44px;padding-bottom:44px;border-top:1px solid var(--line)}
.listen h3{font-variation-settings:"wdth" 112;font-size:20px;margin:0 0 6px;letter-spacing:-.01em}.listen p{margin:0;color:var(--muted)}
.tick{display:block;width:22px;height:4px;border-radius:2px;background:var(--beat);margin-bottom:14px}
.local{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;align-items:center;padding-top:48px;padding-bottom:48px;border-top:1px solid var(--line)}
.local p{color:var(--muted);margin:0;max-width:44ch}
@media (max-width:720px){.local{grid-template-columns:1fr}}
.makers .wrap{padding-top:44px;padding-bottom:44px;border-top:1px solid var(--line)}
.who{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.card{display:flex;gap:10px;align-items:center;padding:10px;border-radius:14px;background:var(--panel);text-decoration:none;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.card b{display:block;font-weight:650;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{color:var(--muted);font-size:13px}
.av{width:44px;height:44px;border-radius:50%;flex:none;object-fit:cover;background:var(--line);display:grid;place-items:center;font-weight:700;color:var(--muted)}
footer{padding:30px 0 50px;border-top:1px solid var(--line);color:var(--muted);font-size:14px;display:flex;gap:18px;flex-wrap:wrap}
footer a{color:var(--muted)}
.me{padding:26px 0 8px;display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center}
.me .av{width:104px;height:104px;font-size:34px}
.me h1{font-size:clamp(34px,7vw,64px);max-width:none}
.me .handle{color:var(--muted);margin-top:6px}
.bio{max-width:52ch;margin:18px 0 0;font-size:18px}
.links{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 6px}
.vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:30px 0 44px}
@media (min-width:720px){.vids{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}}
.vid{aspect-ratio:9/16;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 1px 0 var(--line)}
.vid iframe{width:100%;height:100%;border:0;display:block}
.empty{color:var(--muted);padding:30px 0 50px}
@media (max-width:520px){.me{grid-template-columns:1fr}.me .av{width:84px;height:84px}}
details.rep{margin-left:auto}details.rep summary{cursor:pointer}details.rep form{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}details.rep input{flex:1 1 200px;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit}`;
const HEAD = (title, desc, url, img) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">${img ? `<meta property="og:image" content="${esc(img)}">` : ""}<meta name="theme-color" content="#14161C">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="13" width="3" height="7" rx="1.5" fill="#14161C"/><rect x="7" y="5" width="3" height="15" rx="1.5" fill="#14161C"/><rect x="12" y="9" width="3" height="11" rx="1.5" fill="#E08A00"/><rect x="17" y="2" width="3" height="18" rx="1.5" fill="#14161C"/></svg>')}">
<style>${CSS}</style></head><body>`;
const BRAND = `<a class="brand" href="/" aria-label="Beat Splicer home"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>Beat Splicer</a>`;
function simplePage(title, inner) { return HEAD(title + " · Beat Splicer", title, "/", null) + `<div class="wrap"><div class="top">${BRAND}</div><h2>${esc(title)}</h2>${inner}</div></body></html>`; }
function notFound(url) { return simplePage("Nothing here", `<p>That page doesn't exist, or its owner took it down. <a href="/">Beat Splicer home</a></p>`); }
/* the hero: a song's waveform with the edit laid over it. Cuts land on the strong beats; between them, the shots. */
function heroStrip() { let s = 7, rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const W = 1000, H = 190, n = 96, bw = W / n, bars = [], beats = [], cuts = [], shots = [];
  const hues = ["var(--blue)", "var(--ink)", "var(--beat)", "var(--blue)", "var(--muted)", "var(--ink)"]; /* the shots: the brand's own few colours, not a rainbow */
  for (let i = 0; i < n; i++) { const beat = i % 4 === 0, bar = i % 16 === 0, env = 0.45 + 0.55 * Math.sin(i / n * Math.PI * 1.15) ** 2, h = (beat ? 0.78 + 0.2 * rnd() : 0.18 + 0.42 * rnd()) * env * 120 + 6;
    bars.push(`<rect class="bar" x="${(i * bw + 1.5).toFixed(1)}" y="${(150 - h / 2 - 20).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`);
    if (beat) beats.push(`<rect class="beat" x="${(i * bw + bw / 2 - 2).toFixed(1)}" y="${H - 8}" width="4" height="${bar ? 8 : 5}" rx="1.5"/>`); }
  const at = [0, 8, 16, 20, 32, 40, 44, 48, 64, 72, 80, 88, 96]; for (let k = 0; k < at.length - 1; k++) { const x0 = at[k] * bw, x1 = at[k + 1] * bw;
    shots.push(`<rect class="shot" style="--k:${k}" x="${(x0 + 2).toFixed(1)}" y="0" width="${(x1 - x0 - 4).toFixed(1)}" height="26" rx="6" fill="${hues[k % hues.length]}"/>`);
    if (k) cuts.push(`<line class="cut" style="--k:${k}" x1="${x0.toFixed(1)}" x2="${x0.toFixed(1)}" y1="0" y2="${H - 12}"/>`); }
  return `<svg class="strip" viewBox="0 0 ${W} ${H}" role="img" aria-label="A song's waveform with the edit laid over it: every cut lands on a beat">${bars.join("")}${beats.join("")}${shots.join("")}${cuts.join("")}</svg>`; }
function avatarTag(env, url, p, cls = "av") { return p.hasImg ? `<img class="${cls}" src="${url.origin}/avatar/${p.handle}.jpg?v=${p.at || 0}" alt="" width="44" height="44" loading="lazy">` : `<span class="${cls}" aria-hidden="true">${esc((p.name || p.handle).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase())}</span>`; }
function getApp(env) { const play = env.PLAY_URL, web = env.WEB_URL || "https://mcduffog-max.github.io/beat-splicer/";
  return play ? `<a class="btn main" href="${esc(play)}">Get it on Google Play</a><a class="btn soft" href="${esc(web)}">Use it in your browser</a>` : `<a class="btn main" href="${esc(web)}">Use it in your browser</a><span class="note">The Android app is coming to Google Play.</span>`; }
async function landingPage(env, url) {
  const ix = env.PAGES ? (await readIndex(env)).slice(0, 24) : [];
  const makers = ix.length ? `<section class="makers"><div class="wrap"><h2>Made with Beat Splicer</h2><div class="who">${ix.map(p => `<a class="card" href="/@${esc(p.handle)}">${avatarTag(env, url, p)}<span style="min-width:0"><b>${esc(p.name)}</b><span>@${esc(p.handle)}</span></span></a>`).join("")}</div></div></section>` : "";
  return html(HEAD("Beat Splicer: your clips, cut to the beat", "Beat Splicer listens to your song and edits your clips to it, on your phone.", url.origin + "/", null) + `
<div class="wrap"><div class="top">${BRAND}<a href="#how" class="note">How it works</a></div>
<section class="hero"><h1>Cut to the beat.</h1><p class="lede">Beat Splicer listens to your song (the beat, the chorus, the drop, the words) and edits your clips to it. On your phone, in minutes, and a different cut every time.</p><div class="cta">${getApp(env)}</div>
${heroStrip()}<div class="cap"><span>The song</span><span>Every cut on a beat</span></div></section></div>
<section id="how"><div class="wrap listen">
<div><span class="tick"></span><h3>The beat and the bar</h3><p>Cuts land where the drummer lands. Movement in your footage meets the downbeat, not a grid.</p></div>
<div><span class="tick"></span><h3>The shape of the song</h3><p>Verse, chorus, breakdown and drop each get their own pace. Shorts open on the hook, or wherever you choose.</p></div>
<div><span class="tick"></span><h3>The words</h3><p>It finds the lyrics and shows what's sung as it's sung, and your opening line folds away letter by letter.</p></div>
</div></section>
<section><div class="wrap local"><h2>Your footage never leaves your phone.</h2><p>Everything is worked out on the device: the listening, the choosing, the cutting, the export. Nothing is uploaded unless you post it yourself.</p></div></section>
${makers}
<div class="wrap"><footer><span>Beat Splicer</span><a href="/privacy">Privacy</a><a href="https://github.com/${esc(env.REPO || "mcduffog-max/beat-splicer")}/issues">Report a problem</a></footer></div></body></html>`);
}
async function creatorPage(env, url, h) {
  if (!env.PAGES) return html(notFound(url), 404); const p = await env.PAGES.get("page:" + h, "json"); if (!p || p.public === false) return html(notFound(url), 404);
  const LN = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", web: "Website" };
  const links = Object.entries(p.links || {}).map(([k, v]) => `<a class="btn soft" href="${esc(v)}" rel="noopener nofollow ugc">${LN[k] || "Link"}</a>`).join("");
  const vids = (p.videos || []).map(v => `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1&playsinline=1" title="Video by ${esc(p.name)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`).join("");
  const img = p.hasImg ? `${url.origin}/avatar/${p.handle}.jpg?v=${p.at}` : null;
  return html(HEAD(`${p.name} (@${p.handle}) · Beat Splicer`, p.bio || `Videos ${p.name} made with Beat Splicer.`, `${url.origin}/@${p.handle}`, img) + `
<div class="wrap"><div class="top">${BRAND}</div>
<section class="me">${avatarTag(env, url, p)}<div><h1>${esc(p.name)}</h1><div class="handle">@${esc(p.handle)}</div></div></section>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}${links ? `<div class="links">${links}</div>` : ""}
${vids ? `<section class="vids">${vids}</section>` : `<p class="empty">No videos shared yet.</p>`}
<footer><span>Made with <a href="/">Beat Splicer</a></span><details class="rep"><summary>Report this page</summary><form method="post" action="/page-report"><input type="hidden" name="handle" value="${esc(p.handle)}"><input name="why" maxlength="1000" placeholder="What's wrong with it?" aria-label="What's wrong with it?"><button class="btn soft" type="submit">Send</button></form></details></footer></div></body></html>`);
}

const PRIVACY = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beat Splicer privacy policy</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#222}h1{font-size:26px}h2{font-size:19px;margin-top:28px}</style><h1>Beat Splicer: privacy policy</h1><p><i>Last updated: 20 November 2026</i></p><p>Beat Splicer edits your video clips to your music on your own device. This page explains what leaves your device and why.</p><h2>What stays on your device</h2><li>Your clips, photos and songs. They are read, analysed and turned into videos on your phone. They are never uploaded by the app.</li><li>The videos you make, which are saved to your phone (Movies/Beat Splicer) and only go elsewhere when you share or upload them yourself.</li><li>Your settings, projects, the app&#x27;s notes on what is in your clips, and the record of which footage earlier videos used.</li><h2>What is sent, and only when you use the feature</h2><li><b>Lyrics lookup</b>: the song&#x27;s title and artist go to LRCLIB (lrclib.net) to find synced lyrics.</li><li><b>Downloads of the app&#x27;s models</b>: the picture-and-word model and, on capable devices, the beat model are downloaded from Hugging Face and jsDelivr. Nothing about you or your clips is sent.</li><li><b>AI reviewer</b> (optional, with your own key): small contact-sheet pictures of your edit and a text summary go to the AI provider you choose (Anthropic, OpenAI, Google or xAI), under that provider&#x27;s terms.</li><li><b>YouTube</b> (optional, in the web version): with your Google sign-in, the app reads your channel&#x27;s statistics and uploads videos you choose. Google&#x27;s privacy policy applies.</li><li><b>Problem reports</b> (only when you press Send report): your description, the app version, device model, the last error, recent steps and settings go to the developer as an issue in a private GitHub repository. Your clips and songs are not included. An email address is included only if you type one.</li><li><b>Purchases</b>: handled by Google Play. The app learns only which upgrades you own.</li><li><b>Your page on the Beat Splicer site</b> (optional, only when you press Publish my page): your name, photo, the line about you, your links and the YouTube videos you pick are published on a public page, and you appear under “Made with Beat Splicer”. Take my page down removes it; reported pages can be removed by the developer. Your name and photo otherwise stay on your device.</li><h2>What the app does not do</h2><p>No accounts, no advertising, no analytics or tracking, and no selling or sharing of data.</p><h2>Children</h2><p>Beat Splicer is not directed at children under 13.</p><h2>Contact</h2><p>Questions or requests: [your contact email]</p>`;
