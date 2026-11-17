# Beat Splicer version 2: engineering notes

Plan: the "Beat Splicer version 2 plan" doc (claude.ai artifact 866bef58-bf83-4426-8b32-dabc98fd60f2). Stages: 1 own web address, 2 Android app, 3 cloud helper. Stage 1 features are all built (17 Nov 2026); phone testing and fine-tuning are pending. A refinement pass (shot matching, cut on the action, shot language, retention learning) and an originality pass (phrasing, restraint, returning image, director's note, own look, house style) followed the same evening.

## Where it lives
- Repository: github.com/mcduffog-max/beat-splicer (public, branch `main`). The Claude GitHub app is installed on it, so sessions can push after `add_repo`.
- Live web app: https://mcduffog-max.github.io/beat-splicer/ (GitHub Pages, published by `.github/workflows/pages.yml` on every push to main).
- The claude.ai artifact (1e022ae5-945d-4aa9-a946-d3c4058c0c2c) is still published from the same source: `dist-claude/index.html`. Features that need the network (automatic lyrics, CLIP, YouTube) hide themselves there (`HOSTED`).
- These notes are also kept in the repository at `docs/engineering-notes.md`.

## Layout
- `src/index.html` (markup, `/*@STYLE@*/` and `/*@APP@*/` placeholders), `src/styles.css`, `src/js/NN-name.js` (the app in ordered parts sharing one global scope; `node build.mjs` joins them in file-name order). New parts slot in by name (`02a-…` runs after `02-…`).
- `public/`: manifest, offline worker `sw.js` (version stamped at build), icons, face models (`models/*.bin.json`).
- `node build.mjs` → `dist/` (web app) and `dist-claude/index.html` (single file, no worker).
- Watch out: one-line code with a `//` comment in the middle swallows the rest of the line; use `/* */`. Check every part with `node --check src/js/*.js`, and when checking the built page extract `<script[^>]*>` (the app script has `id="app"`), or a syntax error slips through.

## Tests (run all before every push; cwd /home/claude for those using lib40/qlib/plib/cmlib/actlib/lkwarm/lkcool)
- `tests/regress.py <url or path>`: 19 checks (incl. shot reasons, phone layout, no repeated footage; a speed ramp counts at its real source span, `RAMP_SPAN`).
- `tests/sections.py`: chorus starts within a beat on synthetic `tests/songs/pop120.wav`, `rock96.wav`.
- `tests/lyrics.py`: mocked LRCLIB with a 3 s shorter cut; first chorus line must land at 24.3 s.
- `tests/footage.py`: soft clips in key moments ≤ 15% (qlib), cuts between opposing pans ≤ 20% (plib); make libs with `tests/mkq.sh`.
- `tests/see.py`: CLIP pipeline end to end with a tiny random stand-in model (`tests/tinyclip`); needs transformers.js in /home/claude/tjs (`npm i --ignore-scripts @huggingface/transformers`) and `python3 -m http.server 8790 --directory /home/claude`.
- `tests/youtube.py`: mocked Google sign-in and APIs: learning direction, retention curves, scheduled upload, recipe linking.
- `tests/colmatch.py` (cmlib: 16 lib40 clips in four colour-cast families), `tests/action.py` (actlib: 40 clips with movement at known times, truth in `tests/act-truth.json`), `tests/shotlang.py` (stand-in CLIP readings: 8 places, known shot sizes).
- `tests/phrasing.py`, `tests/restraint.py`, `tests/motifnote.py`, `tests/ownlook.py` (lkwarm/lkcool: 10 lib40 clips with warm and cool channel mixes).
- The sandbox can't reach Hugging Face, LRCLIB, Google or github.io; those parts are tested with mocks and need checking on Paul's phone.

## Tempo (fixed on Paul's real songs)
- The steady-beat scan runs on three 90-second stretches (start, middle, late) and keeps the most confident; a tempo found in more than one stretch adds confidence (up to 2.2).
- A count below 75 BPM doubles when the half-beats carry at least half the onset strength of the beats (People Are People's snare sits above the kick band).
- Results: People Are People 60 → 120 (published 118.9), Blasphemous Rumours 60 rubato → 120 (119.7), M83 Outro 38 → 109, Old Man 136 → 143, Come As You Are 120, Teen Spirit 117.

## Song sections from audio
- `songStructure(buf, an)`: per-bar chroma and 16 log bands; balanced checkerboard novelty plus loudness steps; peaks above 18% of max, ≥ 4 bars apart, no section over 24 bars; each boundary snapped to the beat with the biggest energy change.
- Grouping by best-aligned bar similarity; threshold rises until no group holds more than half. Chorus = repeated loud group, not the opening.
- Shown as playable chips under the song; the playing one can be marked as, or not as, the chorus (`markChorus`, `S.an._secByHand`). Used by Shorts openings and story acts.

## Lyrics found automatically
- `findLyrics(auto)`: LRCLIB get, then search by artist+title, then free text; the synced result closest in length wins. Title/artist from tags, else the file name ("Artist - Title (Official Video)").
- `lyricOffsetFromSections()` lines lyric sections up with audio sections (vocals ~0.3 s after the bar line), centre of the best plateau, applied when the versions differ.
- `autoLyrics()` runs on every new song without lyrics (web app only).

## Shot quality and continuity
- Samples now carry `dx, dy` (global shift over 0.5 s, block matching on 96×54), `fx, fy` (where movement is), `fl:1`. `backfillFlow()` measures old clips in the background after a restore.
- `qualityCost` = importance × (2.5 × softness below 0.85 of the library median, murky/washed out, shake, upscale for the first format). `shotImportance`: 0.4 base, +0.6 loud, +0.6 drop, +0.6 chorus.
- `continuityCost`: opposing pans +0.45, matching −0.25; eye-line distance; not applied at drops or new sections.
- `advanceClips`: a returning clip moves forward, else back, else to any unseen gap; when every stretch is used, another clip takes the shot (`chooseClip` excluding it), and only then the least-repeated stretch. Export plans run it once more at the end.

## Shot matching (colour)
- `28c-shot-matching.js`, setting `colMatch` (off / gentle 0.55 / strong 0.85; default gentle). Per shot (samples covering it): white balance in log r/g, b/g towards the edit's duration-weighted median, weaker for strongly coloured scenes, ±0.16; exposure 0.8–1.35 (night capped at 1.12, very bright floor 0.92); contrast from block-luma spread of `c.fp`, 0.88–1.2.
- One `feColorMatrix` SVG filter per correction (`url(#bscmN)`, `color-interpolation-filters=sRGB`) placed before the look in `drawClip`; the shot comes from `o._cm` (transitions) or `o._seg` (stills). Shot panel: "Colour match: brighter 12%, warmer".
- colmatch.py: cast gap −31%, brightness gap −53% (gentle).

## Cut on the action
- `05a-cut-on-action.js`, setting `cutAction`. After a build, `measureAction()` measures frame difference six times a second (64×36) around each shot's start, cached in `c._act`; `actionAlign()` (run in both planning paths after `assignReverse`/`restrainMoves`) slides the start up to ±0.67 s in 1/12 s steps so movement onsets meet beats (downbeats ×1, beats ×0.5) and the shot opens on movement. Never through a source cut (diff > 34), into another use of the clip (slow motion counted at full length) or for locked, manual, reversed, ramped, frozen, refrain, bookend, loop, pattern or end shots. Needs a 15% better score to move. `s._act` = {from, by, gain}; shown in the shot panel.
- action.py: downbeats meeting a movement start 20–30% → 50–70%.

## Shot language
- `15b-shot-language.js`. With CLIP readings, `seeTagAt` gives shot size (six prompts, softmax ×100, expected index) and faces (face detection if run, else a face prompt). `tagAt` falls back to it when a clip has no AI-review tags, so the story arc, outline and checklist work without the AI review. Prompt vectors are cached in localStorage `beatsplicerShotVecs`.
- `places()`: clips clustered by mean CLIP vector, threshold = 85th percentile of pair similarity within 0.8–0.92. `placeCost`: within a section, the same place −0.3 until four shots, then +0.12; the first shot of a new section +0.18 for staying.
- `matchCutCost` (setting `matchCuts`): layout-hash similarity ≥ 0.8 with a different family, at most one per 8 s, never at drops or builds; `seg._mcut`.
- shotlang.py: 8/8 places found, same-place neighbours 9% → 37%, shot-size vs story correlation −0.09 → 0.67.

## Originality
- **Phrasing** (`05b-phrasing.js`, `phrasing`): `phraseShape` runs on the segments before trims. Vocal entries: a cut within 0.6 s of a lyric line start moves to it, or a long shot splits there (both parts ≥ 0.7 s). Off-beat cuts: in loud passages (e ≥ 0.55), at most one per 12 s, where `an.halfHit` ≥ 1.15, at the swung "and". Long takes: 2 bars (doubled when shorter than 3.5 s, max 6.5 s) where energy is steady and moderate, not a chorus, not the first 8 s; one per song (two from 150 s), 60 s apart; `seg._take` asks for moving, long-enough footage. Held breath: the last two build chops before the biggest drop merge and freeze for 0.25–0.5 s (`_breath`, `_freeze`). phrasing.py: lyric entries with a cut 11% → 56%; drops unchanged.
- **Restraint** (`05c-restraint.js`, `restraint` one/few/any; default one): after the existing transition budget, bold transitions (whip, zoom, zoomout, zoomthru, spin, mask, flash) are kept only at the highest-ranked moments (drop 6, after a build 3, chorus lead 2, after the breath 3, + energy), 20 s apart: one (two past 120 s), or one per 40 s with "few". Soft dissolves: the quietest 6% (10%). `restrainMoves`: at most 1 (2) speed ramp and 1 (2) rewind. Do everything reports the bold moment. restraint.py: 8 bold transitions → 1.
- **Returning image** (`15c-own-motif.js`, `ownMotif`): `motifMoments` finds an image in ≥ 3 families (CLIP similarity ≥ 0.86, else layout hash/grid ≥ 0.8; sampled to 1500 points, 150 probes), preferring distinct (3–6 families) and lively; slots near 10%, 62% and the last shot (`_motifSlot` 1–3, copied into exports); slot shots −2.4 for a motif moment, motif moments elsewhere +0.7.
- **Director's note** (`15d-director-note.js`, text `dirNote`): phases split on then/turns/becomes/until/but/;/→, each its share of the song, or the choruses / last chorus when named. Word lexicon → brightness, warmth, movement targets (`noteCost`), and pace/energy bias for Do everything (`noteBias`). With CLIP, each phase is z-scored against all moments like lyrics. motifnote.py: the note darkens the first half (0.36 → 0.30) and brightens the second (0.58 → 0.64); motif slots 3/3.
- **Own look** (`28d-own-look.js`, look value `own`, now the default; Do everything keeps it ~75% of the time over a style's preset, trend looks weighted 0.2–0.5): shadow tint = chroma of the darkest 30% of sample colours, highlight tint = brightest 30% (multiply / screen layers), contrast and saturation from song energy and spectral brightness, note words push warmth and brightness. `ownLookWords()` describes it.
- **House style** (`houseOn`, `houseSave`, localStorage `beatsplicerHouse`): lettering and the finish-with-the-song ending kept through Do everything. Novelty: `styleSig` adds lens, energy, visual idea, signature transition, lettering and rhythm; "own" never counts as the same look; novelty weight in `versionScore` 3 → 5; Do everything reports "N% different from the closest of your recent videos".

## Learning and planning (17 Nov 2026, late)
- **Blind comparisons** (`47c-taste.js`, stage-bar button "Which is better?"): `makePair` rebuilds the plan twice with the same seed, perturbing 2–3 judgement weights (×1.6 / ×0.55), over 20 s from the Shorts window; sides shuffled. `comparePlay` previews a side (S.plan swapped only while making the export plan). A pick runs a Bradley–Terry step on per-shot mean cost features (`planFeatures` from `seg._W`): rate 0.5 for you, 0.25 for the AI judge (`compareAI`: two 8-frame contact sheets, JSON verdict). Weights 0.2–3 in localStorage `beatsplicerTaste`; `tasteSum(W)` replaces the plain sum in `chooseClip` (terms in `TASTE_TERMS`). `tasteSummary` reports learned leanings and how often the side closer to the learned taste wins. taste.py: a simulated viewer who likes the story arc moves `st` to 1.46 in 14 picks.
- **Whole-video planning** (`planShots` in `05-planning.js`, `planWhole`, default on): beam search; each beam asks `chooseClip` for its best clip per candidate (`ctx._topM`, `ctx._cands`), contexts cloned (`cloneCtx`), beams deduped on their last three picks; width 4 (≤150 clips), 3 (≤400), 2; during Do everything with >150 clips it plans shot by shot and replans the chosen cut whole at the end. `S._planCost` = summed chosen costs. beam.py: total cost 2–12% lower than shot-by-shot, about 2.2× the planning time (0.4 s on 40 clips).
- **Edit like this** (`47d-reference.js`, `refFile`, `refOn`, localStorage `beatsplicerRef`): decodes the reference's audio and runs `analyzeAudio`; watches the first 120 s at 2× with `requestVideoFrameCallback` (32×18 luma diff + 16-bin histogram, cut when > max(22, 4× median), 0.25 s apart). Stats: average shot length overall and in quiet/middle/loud passages, cuts on the beat / downbeat / off-beat (±70 ms), long takes per minute, median movement. Applied as tendencies: `refPaceK` scales `makeSegments`' target length to the reference's band, `refSyncGap` and a lower off-beat threshold, `refTakes` sets the number of long takes, `refMotionCost` (learnable `rf`). reference.py: reference cut every 3 beats found as 54 cuts, 1.09 s, 98% on the beat; the edit's average shot 1.49 → 1.07 s.
- Tests: `tests/taste.py`, `tests/beam.py`, `tests/reference.py` (refvid/reference.mp4, cut on the app's own beat grid for rocket110 at 163 BPM).

## Rendering, models and the Android app (17 Nov 2026, night)
- **GPU finishing pass** (`30a-gpu-finish.js`, `gpuFinish`, `motionBlur`): one WebGL fragment shader per frame after the shots are drawn: motion blur from the director move's velocity (half the frame's move, 7 taps), lens profile (distortion, CA, softness/swirl, halation in linear light, cos⁴ falloff), the look's CSS filter list folded into one 3×3 matrix + offset (`filterMatrix`, Filter Effects formulas) plus up to three tint layers (multiply/screen/soft-light/overlay), grain and weave. With it on, `drawClip` draws without the look filter and `postFx` skips the look layers and the 2D lens (rack focus and tilt-shift stay 2D). `finishGL` tests the renderer once: software renderers (SwiftShader, llvmpipe) or > 45 ms per 1080×1920 frame mark it slow and the canvas path is used (`window.BS_FORCE_GPU` overrides for tests). Parity with the canvas looks within 6/255 on mean colour (gpu.py). NB: the earlier WebGL lens pass (`lensGLPass`) was never called; this replaces it.
- **Beat This! referee** (`02b-beat-this.js`, `beatThis`): only with WebGPU (`navigator.gpu.requestAdapter()`), never on claude.ai. onnxruntime-web 1.22.0 (webgpu build) + `musetric/beat-this-onnx` (190 MB) + `mel-filterbank.bin`; spectrogram in JS (22.05 kHz mean mono, periodic Hann 1024, hop 441, centre reflect pad, |X|/32, 128 mel, log1p(1000x)); 1500-frame windows with 6-frame borders, keep-first; peaks > 0 with ±3-frame max. Agreement test (≥ 85% of its beats within 70 ms, ≤ 20% extra app beats, ≥ 70% downbeats); otherwise `analyzeAudio(buf,null,{beats,downs})` re-counts on its grid (`opt.beats` replaces the tracked beats, tempo from a straight-line fit; `opt.downs` sets meter and downbeat phase). beatthis.py uses a stand-in (`window.BS_BT_MOCK`): 163 → 110 BPM, downbeat moved. CLIP also runs with `device:"webgpu"` where available.
- **Android app** (Capacitor 8.6.2; `package.json`, `capacitor.config.json`, `android/`; app id `com.mcduffog.beatsplicer`, minSdk 24, target 36): `00a-native.js` — `NATIVE`, `nativeSave` writes in 3 MB base64 slices to `Movies/Beat Splicer` (videos), `Pictures/…`, `Download/…` on external storage (legacy storage + WRITE_EXTERNAL_STORAGE ≤ API 29), falling back to Documents; `nativeShare` (Share plugin) for YouTube/Instagram/TikTok apps; `nativeAwake` (KeepAwake plugin) during exports. Google sign-in is hidden in the app (web views are refused), so channel reading and upload stay in Chrome. Icons and splash generated from `public/icons`. `.github/workflows/android.yml` builds a debug APK on every push and publishes it as the `android-latest` release (`beat-splicer.apk`).
- Tests: `tests/gpu.py`, `tests/beatthis.py`.

## What each shot shows (CLIP)
- transformers.js 4.3.2 from jsdelivr, `Xenova/clip-vit-base-patch32`, dtype q8, one wasm thread. `seeAll()` embeds up to five moments per clip (224 cover crop), others borrow the nearest; stored as `s.ce` (base64 int8, 684 chars).
- `seeReady()` embeds lyric lines ("a photo of …") and z-scores each against all moments; `seeCost` rewards z > 0.5. Search box `#seeQ` shows the top 12 clips.

## Reasons on the timeline
- `chooseClip` keeps the winning candidate's cost parts; `shotReasons` turns the strongest into words (`seg.why`): match cut, same place, viewer-holding footage, phrasing (singer, off-beat, long take, breath), the returning image, and "Fits your note". The shot panel lists them; a lyric match has "Wrong match", which adds `lyKey|clipKey` to `S.vetoes` (saved with projects; `vetoCost` +3).

## YouTube
- Recipes (`beatsplicerRecipes` in localStorage) are written per export; each keeps its shot list (`shots`: start, end, movement level, photo/video, shot size, transition, camera move, cut on action, match cut), kept for the latest 200. Google Identity Services token client with the person's own OAuth client ID (`beatsplicerYTClient`); scopes youtube.readonly, yt-analytics.readonly, youtube.upload.
- Reads uploads playlist, durations, and Analytics (views, engagedViews when available, averageViewPercentage…). Matching: upload id, else song words ≥ 60% in the title, length within 2.5 s, published 0–14 days after the export.
- Score = engaged/views + 0.25 × APV (or APV alone); per-choice effect shrunk by n/(n+3); `learnW` = exp(8 × effect) clamped 0.6–1.8, only for n ≥ 2, used in Do everything's picks of style, rhythm, look, lettering, transition and visual idea.
- Retention (`47b-retention.js`): for up to 40 linked Shorts with shot lists, the audience retention report (`dimensions=elapsedVideoTimeRatio`, `metrics=audienceWatchRatio,relativeRetentionPerformance`, `filters=video==ID`; cached in `beatsplicerRet`, final after 30 days). Each shot's share of remaining viewers lost per second, minus the video's median; per feature, shrunk by n/(n+8); the opening shot (first 1.5 s) learned separately. `retentionCost` applies movement, photo/video and shot size effects to Shorts (n ≥ 8, or ≥ 5 for the opening; ±0.35 per term). Summary lines: "Viewers stay through …", "Viewers leave during …", biggest drop in the latest Short. Novelty (above) is the counterweight so learning doesn't flatten the channel.
- Upload: resumable `videos.insert`, public now or private with `publishAt` (tonight 7 pm / tomorrow 12 pm); links the recipe by id.
- Paul still needs to create the Google Cloud project and OAuth client (origin https://mcduffog-max.github.io).
