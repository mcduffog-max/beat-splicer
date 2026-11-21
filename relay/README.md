# Beat Splicer relay

A tiny Cloudflare Worker (free plan). It is also **the Beat Splicer website**:

- **The landing page** at its address (`/`): what Beat Splicer is, the Play Store link once you have one, and everyone who has published a page.
- **Creator pages** at `/@name`: a user's photo, name, a line about them, their links and the YouTube videos they pick, published from the app (profile → Your page on the Beat Splicer site). Each page has a "Report this page" link; reports arrive as GitHub issues labelled `page-report`.

And it sits between the app and GitHub:

- **In-app bug reports** become issues in this repository, labelled `from-app`.
- **App updates** keep working once the repository is private: the app asks the relay for the newest build, and the relay fetches it from GitHub with its own token.

The GitHub token lives only in the Worker's settings, never in the app.

## Set it up (about 10 minutes, once)

1. **GitHub token.** github.com → your picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Name: `beat-splicer-relay`. Expiration: 1 year.
   - Repository access: Only select repositories → `beat-splicer`.
   - Permissions: **Issues: Read and write**, **Contents: Read-only** (Metadata is added automatically).
   - Generate, and copy the token (it is shown once).
2. **Cloudflare account.** Sign up free at dash.cloudflare.com.
3. **Create the Worker.** Workers & Pages → Create → Create Worker → name it `beat-splicer-relay` → Deploy → Edit code. Replace everything with the contents of `worker.js` from this folder → Deploy.
4. **Settings.** Worker → Settings → Variables and Secrets → Add:
   - `GITHUB_TOKEN` (type Secret): the token from step 1.
   - `REPO` (type Text): `mcduffog-max/beat-splicer`.
   - `APP_KEY` (type Secret): any long random text, e.g. 30 random letters and numbers.
   - `ADMIN_KEY` (type Secret): another long random text, for you only (taking pages down).
   - `PLAY_URL` (type Text, later): the Google Play link once the app is live; the landing page's button switches to it.
   - `WEB_URL` (type Text, optional): where the browser version lives, if not GitHub Pages.
   Deploy again.
4b. **Storage for creator pages.** Workers & Pages → KV → Create a namespace called `beat-splicer-pages`. Then Worker → Settings → Bindings → Add → KV namespace: variable name `PAGES`, namespace `beat-splicer-pages` → Deploy. (Free plan: plenty for thousands of pages.)
5. **Tell Claude** the Worker's address (it looks like `https://beat-splicer-relay.<your-name>.workers.dev`) and the `APP_KEY`. They go into `src/js/00b-config.js`, and the next build sends reports straight to GitHub.

Until then, **Report a problem** opens a pre-filled GitHub issue in the browser instead (you need to be signed in to GitHub to submit it).

## Check it

Open the Worker's address in a browser: it should answer `{"ok":true,"service":"beat-splicer relay"}`. `/latest` shows the newest Android build.

## Creator pages: looking after them

- **Take a page down**: someone reports a page → you get a `page-report` issue. Run this from any terminal (or ask Claude):
  `curl -X POST https://<your-worker>/admin/hide -H "x-admin-key: <ADMIN_KEY>" -H "content-type: application/json" -d '{"handle":"their-name"}'`
- Page names are first come, first served; the device that published a page holds its private key, so only it can change or remove the page.
- A domain later (e.g. beatsplicer.app): Worker → Settings → Domains & Routes → Add custom domain. Then tell Claude, so the app uses it.
