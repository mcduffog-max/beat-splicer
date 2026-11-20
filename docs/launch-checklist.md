# Beat Splicer: Google Play launch checklist

What's already built is marked **done**. The rest needs your accounts, so only you can do it; each step says exactly where to click.

## Built (done)

- **Tiers**: Free (720p, YouTube Shorts and YouTube, small Beat Splicer mark), No watermark, Creator, Pro. Switched on only in the Play Store build; your own test app and the web app keep everything.
- **Google Play purchases**: one-time products `bs_no_watermark`, `bs_creator`, `bs_pro`; prices come from Play; Restore purchases; Creator includes No watermark, Pro includes everything.
- **Report a problem**: button in the top bar and on every error; sends to GitHub Issues through the relay (pre-filled GitHub issue until the relay exists).
- **Relay** (`relay/worker.js`): bug reports, app updates from a private repository, and the privacy policy page at `/privacy`.
- **Play Store bundle build**: the "Build the Android app" workflow makes a signed `.aab` once the upload key secrets exist.
- **Your test app is now "Beat Splicer Dev"** (its own app id), so it can sit beside the Play Store app.
- **Store wording**: lens and style descriptions no longer name brands or real people.
- **Drafts**: privacy policy (`docs/privacy.md`), store listing and data safety answers (`docs/store-listing.md`).

## Your steps

### 1. Relay (about 10 minutes)
Follow `relay/README.md`: GitHub token, free Cloudflare account, paste `worker.js`, add the three settings. Send me the Worker address and the APP_KEY.

### 2. Upload key secrets (5 minutes)
I've made the upload key (two files sent separately: `UPLOAD_KEYSTORE_B64.txt` and `UPLOAD_PASSWORD.txt`). Keep both somewhere safe, e.g. a password manager, as well.
GitHub → beat-splicer → Settings → Secrets and variables → Actions → New repository secret:
- `UPLOAD_KEYSTORE_B64`: paste the whole contents of `UPLOAD_KEYSTORE_B64.txt`
- `UPLOAD_PASSWORD`: paste the contents of `UPLOAD_PASSWORD.txt`
The next build then also produces `beat-splicer-play-bundle` (Actions → the latest "Build the Android app" run → Artifacts).

### 3. Make the repository private (1 minute, after steps 1–2 and once I've added the relay address)
GitHub → beat-splicer → Settings → General → Danger Zone → Change visibility → Private.
The free web version on GitHub Pages stops (Pages on private repositories needs a paid GitHub plan); the app and its updates carry on through the relay.

### 4. Google Play developer account
play.google.com/console → sign up as a personal account, pay the one-time US$25 fee, verify your identity (photo ID) and phone.

### 5. Create the app in Play Console
- Create app → name "Beat Splicer", app (not game), free (with in-app purchases).
- App content: privacy policy URL = your relay address + `/privacy` (fill your contact email into `docs/privacy.md` first and tell me, so the page shows it); data safety (answers in `docs/store-listing.md`); content rating questionnaire; target audience 13+; no ads.
- Store listing: text from `docs/store-listing.md`; icon 512×512 and feature graphic 1024×500 (I can make both); at least 2 phone screenshots (take them in the app).
- Monetisation → Products → In-app products: create `bs_no_watermark` (A$5), `bs_creator` (about A$15), `bs_pro` (about A$35), and activate them. A merchant (payments) profile is needed first; Play Console walks you through it.

### 6. Closed test: 12 testers for 14 days (required for new personal accounts)
- Testing → Closed testing → create a track, upload `beat-splicer-play.aab`, add at least 12 testers' Google account emails (friends, family), share the opt-in link.
- All 12 must stay opted in for 14 consecutive days. Use the time to try purchases (licence testers buy for free: Settings → License testing → add your own email).
- Then Production → Apply for production access, answer the questions, and release.

### 7. Updates after launch
Every fix I push builds a new bundle; upload it to the track in Play Console (Release → Create new release). Later, uploads can be automated with a Google Cloud service account.

## Worth knowing

- The upload key is not the final signing key: Google Play holds that (Play App Signing). If the upload key is ever lost, Play Console can reset it.
- Purchases are checked on the phone against Google Play. Server-side checking can be added to the relay later if piracy becomes a concern.
- Google sign-in for YouTube doesn't work inside apps, so reading your channel and uploading stay in the web version for now; in the app, Share sends videos to the YouTube app.
