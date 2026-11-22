#!/usr/bin/env node
/* Beat Splicer MCP server.
   Runs the Beat Splicer web app in a hidden browser on this computer and gives an assistant its commands:
   load a song and clips, make the cut, choose a mood or a new idea, look at frames, make the videos and save them.
   Nothing is uploaded: the files stay on this computer, as they do in the app.
   Settings (environment): BEAT_SPLICER_APP  folder with the built app (default: ../dist next to this folder) or its web address
                           BEAT_SPLICER_OUT  where videos are saved (default: ~/Movies/Beat Splicer or ~/Videos/Beat Splicer)
                           BEAT_SPLICER_BROWSER  path to Chrome/Chromium if it isn't found by itself
                           BEAT_SPLICER_SHOW=1  show the browser window instead of hiding it */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright-core";
import http from "node:http"; import fs from "node:fs"; import fsp from "node:fs/promises"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => process.stderr.write("[beat-splicer] " + a.join(" ") + "\n"); // stdout belongs to MCP
const MEDIA = /\.(mp4|mov|m4v|webm|3gp|mkv|jpe?g|png|webp|heic|mp3|m4a|wav|aac|flac|ogg|opus)$/i, AUDIO = /\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i;
const expand = p => p && p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
function outDir(d) { if (d) return path.resolve(expand(d)); if (process.env.BEAT_SPLICER_OUT) return path.resolve(expand(process.env.BEAT_SPLICER_OUT));
  const mv = path.join(os.homedir(), "Movies"), vd = path.join(os.homedir(), "Videos"); return path.join(fs.existsSync(mv) ? mv : vd, "Beat Splicer"); }

/* the app, served from this computer so it has a proper web address (it needs one for its storage) */
let appUrl = null;
async function serveApp() {
  if (appUrl) return appUrl; const src = process.env.BEAT_SPLICER_APP || path.join(HERE, "..", "dist");
  if (/^https?:\/\//.test(src)) return (appUrl = src.replace(/\/?$/, "/"));
  const root = path.resolve(expand(src));
  if (!fs.existsSync(path.join(root, "index.html"))) { const build = path.join(HERE, "..", "build.mjs"); if (fs.existsSync(build)) { log("building the app…"); execFileSync(process.execPath, [build], { cwd: path.dirname(build), stdio: ["ignore", "ignore", "inherit"] }); } }
  if (!fs.existsSync(path.join(root, "index.html"))) throw new Error(`Can't find the Beat Splicer app at ${root}. Set BEAT_SPLICER_APP to its folder or web address.`);
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".m4a": "audio/mp4", ".wasm": "application/wasm" };
  const srv = http.createServer(async (q, s) => { try { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, path.normalize(p)); if (!f.startsWith(root)) { s.writeHead(403); return s.end(); }
      const b = await fsp.readFile(f); s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); s.end(b); } catch (e) { s.writeHead(404); s.end(); } });
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); appUrl = `http://127.0.0.1:${srv.address().port}/`; log("app at", appUrl); return appUrl; }

/* one hidden browser, one page: the session */
let browser = null, page = null;
async function launch() {
  const headless = process.env.BEAT_SPLICER_SHOW !== "1", args = ["--autoplay-policy=no-user-gesture-required"];
  const tries = process.env.BEAT_SPLICER_BROWSER ? [{ executablePath: process.env.BEAT_SPLICER_BROWSER }] : [{ channel: "chrome" }, { channel: "msedge" }, {}];
  let last; for (const t of tries) { try { const b = await chromium.launch({ headless, args, ...t }); log("browser:", t.channel || t.executablePath || "bundled chromium"); return b; } catch (e) { last = e; } }
  throw new Error("Couldn't start a browser. Install Google Chrome, or set BEAT_SPLICER_BROWSER to Chrome's path. (" + String(last && last.message || last).split("\n")[0] + ")"); }
async function session(fresh = false) {
  if (page && !fresh) return page; if (!browser) browser = await launch(); if (page) await page.context().close().catch(() => {});
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } }); page = await ctx.newPage();
  page.on("pageerror", e => log("page error:", e.message)); await page.goto(await serveApp()); await page.waitForFunction(() => window.BeatSplicer && BeatSplicer.version >= 1, null, { timeout: 60000 });
  return page; }
const call = async (fn, arg) => (await session()).evaluate(fn, arg);

async function listMedia(folder, deep = 3) { const out = []; async function walk(d, k) { for (const e of await fsp.readdir(d, { withFileTypes: true })) { if (e.name.startsWith(".")) continue; const p = path.join(d, e.name);
      if (e.isDirectory()) { if (k < deep) await walk(p, k + 1); } else if (MEDIA.test(e.name)) out.push(p); } } await walk(folder, 0); return out; }
async function load({ song, clips_folder, clips, sample }) {
  if (sample) { const pg = await session(true); return pg.evaluate(() => BeatSplicer.useSample()); }
  const files = []; /* everything is checked before the current project is replaced */ if (song) { const s = path.resolve(expand(song)); if (!fs.existsSync(s)) throw new Error("No song at " + s); files.push(s); }
  if (clips_folder) { const d = path.resolve(expand(clips_folder)); if (!fs.existsSync(d)) throw new Error("No folder at " + d); const m = await listMedia(d); const vids = m.filter(f => !AUDIO.test(f)); if (!vids.length) throw new Error("No videos or photos in " + d); files.push(...vids); if (!song) { const a = m.find(f => AUDIO.test(f)); if (a) files.unshift(a); } }
  for (const c of clips || []) { const p = path.resolve(expand(c)); if (!fs.existsSync(p)) throw new Error("No file at " + p); files.push(p); }
  if (!files.some(f => AUDIO.test(f))) throw new Error("Give a song (song=...), or a clips folder that has one in it.");
  if (!files.some(f => !AUDIO.test(f))) throw new Error("Give some clips (clips_folder=... or clips=[...]).");
  /* the files go in through the app's own file picker, so it reads them exactly as it would if you picked them */
  const audio = files.filter(f => AUDIO.test(f)).slice(0, 1), media = files.filter(f => !AUDIO.test(f)), pg = await session(true);
  await pg.setInputFiles("#audioInput", audio); await pg.waitForFunction(() => typeof S !== "undefined" && !!S.an, null, { timeout: 300000 });
  await pg.setInputFiles("#videoInput", media); await pg.waitForFunction(n => S.clips.length >= n && S.clips.every(c => c.samples || c.error), media.length, { timeout: 30 * 60000 });
  return pg.evaluate(() => BeatSplicer.makeCut()); }

async function frames() { const d = await call(() => BeatSplicer.sheet()); return { type: "image", data: d.split(",")[1], mimeType: "image/jpeg" }; }
/* long jobs report progress, so the assistant (and its timeout) knows it's still going */
function progressFrom(extra) { const tok = extra && extra._meta && extra._meta.progressToken; if (tok == null || !extra.sendNotification) return () => {}; let n = 0;
  return (msg, pct) => { extra.sendNotification({ method: "notifications/progress", params: { progressToken: tok, progress: pct != null ? pct : ++n, ...(pct != null ? { total: 100 } : {}), message: msg } }).catch(() => {}); }; }
async function whileBusy(promise, report) { let done = false; const tick = async () => { while (!done) { try { const st = await page.evaluate(() => document.getElementById("status").textContent); const pc = (st.match(/(\d+)%/) || [])[1]; report(st.slice(0, 120), pc != null ? +pc : null); } catch (e) {} await new Promise(r => setTimeout(r, 2000)); } };
  tick(); try { return await promise; } finally { done = true; } }
async function makeAndSave(dir, report = () => {}) {
  const made = await whileBusy(call(() => BeatSplicer.makeVideos()), report); const to = outDir(dir); await fsp.mkdir(to, { recursive: true }); const saved = [];
  for (const m of made) { const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.evaluate(i => BeatSplicer.download(i), m.i)]);
    let f = path.join(to, m.name), k = 1; while (fs.existsSync(f)) f = path.join(to, m.name.replace(/(\.[^.]+)$/, ` (${++k})$1`)); await dl.saveAs(f); saved.push({ ...m, file: f }); }
  return saved; }

const txt = o => ({ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) });
const wrap = fn => async (a, extra) => { try { return { content: [].concat(await fn(a || {}, progressFrom(extra))) }; } catch (e) { return { isError: true, content: [txt(String(e && e.message || e).replace(/^page\.evaluate: Error: /, "").split("\n")[0])] }; } };
const MOOD_IDS = ["yours", "hype", "cine", "dream", "retro", "raw", "dark", "mono"];
const server = new McpServer({ name: "beat-splicer", version: "1.0.0" }, { instructions: "Beat Splicer cuts video clips to a song and makes videos for YouTube Shorts, TikTok, Reels and others. Typical flow: load (song plus clips folder), frames to look at the cut, set_mood or new_idea until it looks right, then make_videos. Or make_video does it all in one go. Everything runs on this computer." });
server.registerTool("load", { title: "Load a song and clips", description: "Start a new project from a song file and clips (a folder, a list of files, or both), then make the first cut. With sample=true, uses Beat Splicer's own sample song and clips. Returns what was loaded and what the cut chose.",
  inputSchema: { song: z.string().optional().describe("Path to the song (MP3, M4A, WAV…)"), clips_folder: z.string().optional().describe("Folder of videos and photos (subfolders included; a song inside it is used if none is given)"), clips: z.array(z.string()).optional().describe("Individual clip files"), sample: z.boolean().optional().describe("Use the sample song and clips instead") } }, wrap(async (a, report) => [txt(await whileBusy(load(a), report)), await frames()]));
server.registerTool("status", { title: "Current project", description: "The song, clips, mood, platforms and current cut.", inputSchema: {} }, wrap(async () => txt(await call(() => BeatSplicer.status()))));
server.registerTool("frames", { title: "Look at the cut", description: "Eight frames from the current cut, in order, as one picture.", inputSchema: {} }, wrap(frames));
server.registerTool("set_mood", { title: "Choose a mood", description: "Remake the cut in a mood: yours (chosen for this song and footage), hype (fast, punchy), cine (slow and wide), dream (soft, floating), retro (home-video), raw (hard cuts, real colour), dark (tense and controlled), mono (black and white).",
  inputSchema: { mood: z.enum(MOOD_IDS) } }, wrap(async a => [txt(await call(m => BeatSplicer.setMood(m), a.mood)), await frames()]));
server.registerTool("new_idea", { title: "A new idea", description: "A different idea for the cut: new story, pace and look.", inputSchema: {} }, wrap(async () => [txt(await call(() => BeatSplicer.newIdea())), await frames()]));
server.registerTool("shuffle", { title: "Shuffle shots", description: "Same idea, different shots.", inputSchema: {} }, wrap(async () => [txt(await call(() => BeatSplicer.shuffle())), await frames()]));
server.registerTool("set_title", { title: "Set the title", description: "The title shown at the start of the video (an empty string for none).", inputSchema: { title: z.string().max(60) } }, wrap(async a => txt(await call(t => BeatSplicer.setTitle(t), a.title))));
server.registerTool("set_platforms", { title: "Choose platforms", description: "Which videos to make: shorts (YouTube Shorts), youtube, reels, igfeed, tiktok, spotlight, pinterest, linkedin, square, tv, mobile.", inputSchema: { platforms: z.array(z.string()).min(1) } }, wrap(async a => txt(await call(p => BeatSplicer.setPlatforms(p), a.platforms))));
server.registerTool("make_videos", { title: "Make the videos", description: "Make the videos for the chosen platforms from the current cut and save them. Takes about as long as the videos are, sometimes longer.", inputSchema: { out_dir: z.string().optional().describe("Folder to save into (default: Movies or Videos › Beat Splicer)") } }, wrap(async (a, report) => txt(await makeAndSave(a.out_dir, report))));
server.registerTool("make_video", { title: "Song and clips to finished video, in one go", description: "Load a song and clips, make the cut (optionally in a mood, with a title, for chosen platforms) and save the videos. Returns the saved files and frames of the cut.",
  inputSchema: { song: z.string().optional(), clips_folder: z.string().optional(), clips: z.array(z.string()).optional(), sample: z.boolean().optional(), mood: z.enum(MOOD_IDS).optional(), title: z.string().max(60).optional(), platforms: z.array(z.string()).optional(), out_dir: z.string().optional() } },
  wrap(async (a, report) => { report("Loading the song and clips"); await whileBusy(load(a), report); if (a.platforms && a.platforms.length) await call(p => BeatSplicer.setPlatforms(p), a.platforms); if (a.mood) await call(m => BeatSplicer.setMood(m), a.mood); if (a.title != null) await call(t => BeatSplicer.setTitle(t), a.title);
    const shot = await frames(); return [txt(await makeAndSave(a.out_dir, report)), shot]; }));
process.on("SIGINT", async () => { try { await browser?.close(); } catch (e) {} process.exit(0); });
await server.connect(new StdioServerTransport()); log("ready");
