// Joins the translations (i18n/src/<lang>/*.tsv, one line per string: "<number in catalog-frozen.json><TAB><translation>";
// a missing number keeps the English) into public/i18n/<lang>.json, and checks each keeps the changing parts ({}).
import fs from "node:fs";
const cat = [...JSON.parse(fs.readFileSync("i18n/catalog-frozen.json", "utf8")), ...(fs.existsSync("i18n/extra.json") ? JSON.parse(fs.readFileSync("i18n/extra.json", "utf8")) : [])]; // extra.json: strings added after the catalog was frozen (numbers 1672 on)
const holes = s => (s.match(/\{\d*\}/g) || []).length;
let bad = 0;
for (const lang of fs.readdirSync("i18n/src").sort()) { const dir = `i18n/src/${lang}`; if (!fs.statSync(dir).isDirectory()) continue; const t = {}; const seen = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".tsv")).sort()) for (const line of fs.readFileSync(`${dir}/${f}`, "utf8").split("\n")) {
    const m = line.match(/^(\d+)\t(.*)$/); if (!m) { if (line.trim()) { console.log(`${lang}/${f}: can't read line: ${line.slice(0, 60)}`); bad++; } continue; }
    const i = +m[1], tr = m[2].trim(), en = cat[i]; if (en == null) { console.log(`${lang}: no string #${i}`); bad++; continue; } if (!tr || tr === "=") continue;
    if (seen.has(i)) { console.log(`${lang}: #${i} twice`); bad++; } seen.add(i);
    const he = holes(en), ht = holes(tr), numbered = /\{\d+\}/.test(tr);
    if (!numbered && ht !== he || numbered && (/\{\}/.test(tr) || [...tr.matchAll(/\{(\d+)\}/g)].some(x => +x[1] >= he))) { console.log(`${lang} #${i}: ${he} vs ${ht} changing parts: ${en.slice(0, 70)} → ${tr.slice(0, 70)}`); bad++; continue; }
    t[en] = tr; }
  fs.mkdirSync("public/i18n", { recursive: true }); fs.writeFileSync(`public/i18n/${lang}.json`, JSON.stringify({ v: 1, lang, t }));
  console.log(`${lang}: ${Object.keys(t).length} of ${cat.length}`); }
process.exitCode = bad ? 1 : 0;
