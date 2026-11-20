/* Beat Splicer relay (Cloudflare Worker, free plan).
   - POST /report   turns an in-app bug report into a GitHub issue in your repository
   - GET  /latest   newest Android build (works when the repository is private)
   - GET  /apk      downloads that build's APK, for the in-app Update button
   The GitHub token lives here as a Worker secret, never inside the app.
   Settings (Worker → Settings → Variables): GITHUB_TOKEN (secret: fine-grained token, this repo only,
   Issues: read and write, Contents: read), REPO = "mcduffog-max/beat-splicer", APP_KEY (secret: any random text,
   the same value goes into the app). */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "content-type,x-app-key" };
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
    return json({ ok: true, service: "beat-splicer relay" });
  }
};

const PRIVACY = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beat Splicer privacy policy</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#222}h1{font-size:26px}h2{font-size:19px;margin-top:28px}</style><h1>Beat Splicer: privacy policy</h1><p><i>Last updated: 20 November 2026</i></p><p>Beat Splicer edits your video clips to your music on your own device. This page explains what leaves your device and why.</p><h2>What stays on your device</h2><li>Your clips, photos and songs. They are read, analysed and turned into videos on your phone. They are never uploaded by the app.</li><li>The videos you make, which are saved to your phone (Movies/Beat Splicer) and only go elsewhere when you share or upload them yourself.</li><li>Your settings, projects, the app&#x27;s notes on what is in your clips, and the record of which footage earlier videos used.</li><h2>What is sent, and only when you use the feature</h2><li><b>Lyrics lookup</b>: the song&#x27;s title and artist go to LRCLIB (lrclib.net) to find synced lyrics.</li><li><b>Downloads of the app&#x27;s models</b>: the picture-and-word model and, on capable devices, the beat model are downloaded from Hugging Face and jsDelivr. Nothing about you or your clips is sent.</li><li><b>AI reviewer</b> (optional, with your own key): small contact-sheet pictures of your edit and a text summary go to the AI provider you choose (Anthropic, OpenAI, Google or xAI), under that provider&#x27;s terms.</li><li><b>YouTube</b> (optional, in the web version): with your Google sign-in, the app reads your channel&#x27;s statistics and uploads videos you choose. Google&#x27;s privacy policy applies.</li><li><b>Problem reports</b> (only when you press Send report): your description, the app version, device model, the last error, recent steps and settings go to the developer as an issue in a private GitHub repository. Your clips and songs are not included. An email address is included only if you type one.</li><li><b>Purchases</b>: handled by Google Play. The app learns only which upgrades you own.</li><h2>What the app does not do</h2><p>No accounts, no advertising, no analytics or tracking, and no selling or sharing of data.</p><h2>Children</h2><p>Beat Splicer is not directed at children under 13.</p><h2>Contact</h2><p>Questions or requests: [your contact email]</p>`;
