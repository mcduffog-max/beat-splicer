// Collects every piece of text the app shows into i18n/catalog.json (English source strings).
// Text with changing parts becomes a pattern: `Studying your clips: ${k} of ${n}` → "Studying your clips: {} of {}".
// Run after a build: node tools/i18n-extract.mjs
import fs from "node:fs";
import * as acorn from "acorn"; import * as walk from "acorn-walk";
const page = fs.readFileSync("dist/index.html", "utf8");
const norm = s => s.replace(/\s+/g, " ").trim();
const keep = new Set();
function add(s) { s = norm(String(s)); if (!s || s.length < 2 || !/[A-Za-z]{2}/.test(s) || s.length > 420) return;
  if (/^https?:|^data:|^blob:|^[\w.-]+\.(js|css|png|jpe?g|mp4|webm|json|lrc|zip|wav|m4a)$/i.test(s)) return;                // addresses and file names
  if (/=>|===|!==|\bfunction\b|\bconst \b|\breturn\b|var\(--|\d+px\b|#[0-9a-fA-F]{6}\b|\$\(|\bnull\b|\bundefined\b|document\.|window\./.test(s)) return; // code
  if (/^[a-z][\w-]*$/.test(s) && s.length < 4) return;
  if (/^(rgba?|hsla?)\(|^[\[\];=<>.,:#]|^\((?![A-Za-z“‘])|^\{(?!\})/.test(s)) return;
  if (/Reply with ONLY|\bJSON\b|^You are a /.test(s)) return;                                                               // prompts for AI models stay English
  if (/^(start|finished|idle|clip \{\}|couldn't keep|app copies|folder|export:|lyrics:|mood:|sample project|automatic cut|finish screen|WebMCP|recovered|footage stopped|no footage|tempo ×|lyrics found|lyrics picked|language |page published|PASS|FAIL)\b/.test(s)) return; // the log
  keep.add(s); }
/* 1. the page */
const bodyStart = page.indexOf("<body"), appAt = page.indexOf('<script id="app"');
const body = page.slice(bodyStart, appAt).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
const unent = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
for (const m of body.matchAll(/>([^<>]+)</g)) add(unent(m[1]));
for (const m of body.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) add(unent(m[1]));
/* 2. the code, parsed properly: every string and template */
const code = page.slice(page.indexOf(">", appAt) + 1, page.indexOf("</script>", appAt));
const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
const lits = [];
/* not for the screen: the diagnostics report and self-tests (they stay English for support), the step log, AI prompts, report bodies */
const SKIP_FN = new Set(["runDiagnostics", "selfTests", "reportInfo", "sendReport", "askAI", "aiReviewPrompt", "buildPrompt"]), SKIP_CALL = new Set(["crumb", "exportLog", "anaMark", "fetch", "localStorage.setItem", "console.log", "console.warn"]);
const calleeName = c => c.type === "Identifier" ? c.name : c.type === "MemberExpression" ? (c.object.name || "") + "." + (c.property.name || "") : "";
walk.fullAncestor(ast, (n, _st, anc) => { if (!(n.type === "Literal" && typeof n.value === "string" || n.type === "TemplateLiteral")) return;
  if (anc.some(a => a.type === "TemplateLiteral" && a !== n)) return; /* inner parts are counted with their template */
  if (anc.some(a => (a.type === "FunctionDeclaration" && a.id && SKIP_FN.has(a.id.name)) || (a.type === "CallExpression" && SKIP_CALL.has(calleeName(a.callee))) || (a.type === "VariableDeclarator" && a.id && /prompt/i.test(a.id.name || "")))) return;
  lits.push({ s: n.type === "Literal" ? n.value : n.quasis.map(q => q.value.cooked ?? q.value.raw).join("{}"), n }); });
/* the changing parts of templates can hold text of their own (a ? "word" : "other"): those are collected separately */
walk.fullAncestor(ast, (n, _st, anc) => { if (n.type !== "TemplateLiteral") return; if (anc.some(a => (a.type === "FunctionDeclaration" && a.id && SKIP_FN.has(a.id.name)) || (a.type === "CallExpression" && SKIP_CALL.has(calleeName(a.callee))))) return;
  for (const e of n.expressions) walk.full(e, m => { if (m.type === "Literal" && typeof m.value === "string") lits.push({ s: m.value, n: m }); else if (m.type === "TemplateLiteral" && m !== n) lits.push({ s: m.quasis.map(q => q.value.cooked ?? q.value.raw).join("{}"), n: m }); }); });
const sentence = x => (/^(\{\}\s?)?[A-Z“‘(■✓•][^\n]*\s\S/.test(x) || /^(\{\}[\s,.:%×s·–-]*)+[A-Za-z(“]/.test(x) && /[a-z]{2,}\s[a-z]{2,}|\{\} [a-z]{3,}/.test(x)) && /[a-z]{2}/.test(x) && !/^(Content-|Mozilla|Bearer|application\/|[A-Z_]{4,}$|[A-Z_]{4,}_)/.test(x);
for (const { s } of lits) { const pieces = /<\/?[a-z][^>]*>/i.test(s) ? s.split(/<[^>]+>/) : [s]; for (const p0 of pieces) { const p = norm(p0); if (!p) continue;
    if (sentence(p) || /^[A-Z][a-z-]+(…|:)?$/.test(p) && p.length >= 3 || pieces.length > 1 && /^[a-z“][a-z’'“”]*( [^\s]+){2,}/.test(p) || /^\d+\s?[A-Za-z]/.test(p) && /\s/.test(p) || /^[a-z]+( [a-z]+){0,3}$/.test(p) && p.length > 3 && pieces.length > 1) add(p); } }
/* names used as keys (styles, presets, lenses), and the ones written in lower case in code but shown on screen */
walk.full(ast, n => { if (n.type === "Property" && n.key.type === "Literal" && typeof n.key.value === "string" && /^[A-Z0-9]/.test(n.key.value) && /\s|^[A-Z][a-z]/.test(n.key.value) && n.value.type === "ObjectExpression") add(n.key.value); });
["establish","introduce","build","peak","release","resolve","energy","pace","intro","verse","chorus","bridge","outro","breakdown","drop","quiet","free time","lyrics",
 "Intro {}","Verse {} {}","Chorus {} {}","Bridge {}","Outro {}","Breakdown {}","Drop {}","Instrumental {}","Pre-chorus {} {}","Solo {}","Interlude {}","Verse {}","Chorus {}","■ {}",
 "{} (tap to change)","{} (automatic)","{} · {}"].forEach(add);
const cat = [...keep].filter(s => s !== "{} · {}").sort((a, b) => a.localeCompare(b));
fs.writeFileSync("i18n/catalog.json", "[\n" + cat.map(s => JSON.stringify(s)).join(",\n") + "\n]\n");
console.log(cat.length, "strings,", cat.reduce((a, s) => a + s.split(/\s+/).length, 0), "words");
