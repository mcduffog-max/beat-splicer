/* Where in-app bug reports (and, once the repository is private, app updates) go: the Beat Splicer relay, a small
   Cloudflare Worker that holds the GitHub token (see relay/README.md). Empty until it's deployed; reports then open a
   pre-filled GitHub issue in the browser instead. */
const RELAY={url:"", key:""};
