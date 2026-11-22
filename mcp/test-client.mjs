/* A test: talks to the server as an assistant would. node test-client.mjs [clips folder] */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
const t = new StdioClientTransport({ command: process.execPath, args: [new URL("./server.mjs", import.meta.url).pathname], env: { ...process.env }, stderr: "inherit" });
const c = new Client({ name: "test", version: "1" }); await c.connect(t);
const opt = { timeout: 120000, resetTimeoutOnProgress: true, maxTotalTimeout: 3600000, onprogress: p => { if (p.message && /%/.test(p.message)) process.stderr.write(`  … ${p.message}\n`); } };
const show = (n, r) => { const tx = r.content.filter(x => x.type === "text").map(x => x.text).join(" ").replace(/\s+/g, " ").slice(0, 260); const im = r.content.filter(x => x.type === "image"); console.log(`${n}${r.isError ? " ERROR" : ""}: ${tx}${im.length ? ` [+${im.length} image, ${Math.round(im[0].data.length * 0.75 / 1024)} KB]` : ""}`); return r; };
console.log("tools:", (await c.listTools()).tools.map(x => x.name).join(", "));
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";
const folder = process.argv[2];
show("load " + T(), await c.callTool({ name: "load", arguments: folder ? { clips_folder: folder } : { sample: true } }, undefined, opt));
show("set_mood mono " + T(), await c.callTool({ name: "set_mood", arguments: { mood: "mono" } }));
show("set_mood bad " + T(), await c.callTool({ name: "set_mood", arguments: { mood: "purple" } }));
show("set_title " + T(), await c.callTool({ name: "set_title", arguments: { title: "Night Drive" } }));
const fr = show("frames " + T(), await c.callTool({ name: "frames", arguments: {} })); fs.writeFileSync("/home/claude/work/mcp-frames.jpg", Buffer.from(fr.content[0].data, "base64"));
const mv = show("make_videos " + T(), await c.callTool({ name: "make_videos", arguments: { out_dir: "/home/claude/work/mcp-out" } }, undefined, opt));
show("status " + T(), await c.callTool({ name: "status", arguments: {} }));
await c.close(); process.exit(0);
