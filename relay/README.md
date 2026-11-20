# Beat Splicer relay

A tiny Cloudflare Worker (free plan) that sits between the app and GitHub:

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
   Deploy again.
5. **Tell Claude** the Worker's address (it looks like `https://beat-splicer-relay.<your-name>.workers.dev`) and the `APP_KEY`. They go into `src/js/00b-config.js`, and the next build sends reports straight to GitHub.

Until then, **Report a problem** opens a pre-filled GitHub issue in the browser instead (you need to be signed in to GitHub to submit it).

## Check it

Open the Worker's address in a browser: it should answer `{"ok":true,"service":"beat-splicer relay"}`. `/latest` shows the newest Android build.
