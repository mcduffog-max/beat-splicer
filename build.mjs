// Beat Splicer build: joins the parts back into one page.
//   node build.mjs          -> dist/        the web app (installable, works offline)
//                           -> dist-claude/ the single file for claude.ai (no app install, no service worker)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const src = "src", parts = fs.readdirSync(`${src}/js`).filter(f => f.endsWith(".js")).sort();
const STORE = process.env.BS_STORE === "1"; // the Play Store build: paid tiers switched on
const app = parts.map(f => fs.readFileSync(`${src}/js/${f}`, "utf8")).join("").replace("/*@STORE@*/false", STORE ? "true" : "false");
const css = fs.readFileSync(`${src}/styles.css`, "utf8");
const shell = fs.readFileSync(`${src}/index.html`, "utf8");
const fill = (s) => s.replace("/*@STYLE@*/", () => css).replace("/*@APP@*/", () => app);
const version = crypto.createHash("sha256").update(app + css + shell).digest("hex").slice(0, 10);

// claude.ai copy: exactly the page as it has always been
fs.mkdirSync("dist-claude", { recursive: true });
fs.writeFileSync("dist-claude/index.html", fill(shell));

// web app: same page plus the install manifest and the offline worker
const head = `<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#000000">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
`;
const reg = `<script>if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost") && !/claude\\.ai$|claudeusercontent/.test(location.hostname)) addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>
`;
let web = fill(shell).replace("<title>", head + "<title>").replace("</body>", reg + "</body>");
fs.rmSync("dist", { recursive: true, force: true }); fs.mkdirSync("dist/icons", { recursive: true });
fs.writeFileSync("dist/index.html", web);
for (const f of fs.readdirSync("public", { recursive: true })) {
  const p = path.join("public", f); if (fs.statSync(p).isDirectory()) continue;
  const out = path.join("dist", f); fs.mkdirSync(path.dirname(out), { recursive: true });
  let body = fs.readFileSync(p); if (f === "sw.js") body = Buffer.from(body.toString().replace("@VERSION@", version));
  fs.writeFileSync(out, body);
}
fs.writeFileSync("dist/.nojekyll", "");
console.log(`built ${version}: ${parts.length} parts, ${(web.length / 1024).toFixed(0)} KB`);
