# Beat Splicer

Cuts your video clips to your music and makes Shorts, Reels and music videos, on your phone.

Live app: https://mcduffog-max.github.io/beat-splicer/

## How it's built

- `src/index.html` is the page, `src/styles.css` its styles, and `src/js/` the app in numbered parts.
  The parts share one scope and are joined in order, so the app still ships as a single page.
- `node build.mjs` makes:
  - `dist/`: the web app (installable from Chrome, opens offline after the first visit);
  - `dist-claude/index.html`: the same app as one file for claude.ai.
- `public/` holds the install manifest, the offline worker, icons and the face models.
- Every push to `main` builds and publishes `dist/` to GitHub Pages.

## Tests

`python3 tests/regress.py http://localhost:8765/` runs 17 checks with Playwright against a served `dist/`
(`cd dist && python3 -m http.server 8765`). They expect the test clips and songs described in the
engineering notes. `python3 tests/sections.py` checks that choruses are found within one beat on two test songs. Run both before every push.
