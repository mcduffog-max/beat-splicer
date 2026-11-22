# Beat Splicer for AI assistants (MCP)

Lets an assistant such as Claude use Beat Splicer on your computer: "cut my Holiday folder to this song, Dreamy mood, show me frames, then make the Short". It runs the same Beat Splicer as the app, in a hidden browser window, and saves the videos to a folder. Your files never leave your computer.

## What the assistant can do

| Command | What it does |
|---|---|
| `load` | Start a project from a song and clips (a folder, a list of files, or both), or the sample clips, and make the first cut |
| `frames` | Show eight frames from the cut, in order, as one picture |
| `set_mood` | Remake the cut in a mood: yours, hype, cine, dream, retro, raw, dark, mono |
| `new_idea` / `shuffle` | A different idea, or the same idea with different shots |
| `set_title` | The title at the start of the video |
| `set_platforms` | Which videos to make: shorts, youtube, reels, igfeed, tiktok, spotlight, pinterest, linkedin, square, tv, mobile |
| `make_videos` | Make the videos and save them (default: Movies or Videos › Beat Splicer) |
| `make_video` | All of the above in one go |
| `status` | What's loaded and what the cut chose |

## Set it up (once, about 5 minutes)

1. **Node.js 20 or newer** (nodejs.org) and **Google Chrome** (it uses your installed Chrome; Edge works too).
2. **Get this folder.** Download the repository (or `git clone`), then in a terminal:
   ```
   cd beat-splicer
   node build.mjs
   cd mcp
   npm install
   ```
3. **Add it to Claude Desktop.** Settings → Developer → Edit Config, and add (with your own path):
   ```json
   {
     "mcpServers": {
       "beat-splicer": {
         "command": "node",
         "args": ["/full/path/to/beat-splicer/mcp/server.mjs"],
         "env": { "BEAT_SPLICER_OUT": "~/Movies/Beat Splicer" }
       }
     }
   }
   ```
   Restart Claude Desktop. Beat Splicer's commands appear under the tools button. For Claude Code: `claude mcp add beat-splicer -- node /full/path/to/beat-splicer/mcp/server.mjs`.
4. **Try it:** "Use Beat Splicer's sample clips, show me the frames, then make it in the mono mood."

## Options (the `env` part)

- `BEAT_SPLICER_OUT`: where videos are saved.
- `BEAT_SPLICER_SHOW=1`: show the browser window, to watch it work.
- `BEAT_SPLICER_BROWSER`: the path to Chrome, if it isn't found by itself.
- `BEAT_SPLICER_APP`: the built app's folder (default: `../dist`) or a web address where it's hosted.

Videos are made as fast as the computer allows, usually a little faster than real time. A 30-second Short takes about 30 to 60 seconds.

## In the browser (WebMCP)

The web app also offers its commands to assistants built into the browser, through WebMCP (`navigator.modelContext`, an experiment in Chrome). There it works on what's in the page: the sample clips, moods, new ideas, titles, platforms, frames and making the videos. Picking files stays with you.
