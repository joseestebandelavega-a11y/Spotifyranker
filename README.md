# Spotify Swiss Tournament Ranker

A static, client-only web app that lets you rank the tracks in one of your
Spotify playlists by playing them head-to-head in a Swiss-style tournament.
No backend, no server, no build step — just HTML/CSS/JS hosted on GitHub
Pages.

## How it works

1. **Log in with Spotify** using OAuth Authorization Code + PKCE, entirely
   in the browser (no client secret is ever used or stored).
2. **Pick one or more playlists** and the app imports their tracks — select
   several to merge them into a single pool (tracks appearing in more than
   one selected playlist are only counted once) so you can rank your true
   favorite across playlists, not just within one.
3. The app runs a **Swiss-style tournament**: each round pairs tracks with
   similar records, avoids repeat matchups where possible, and gives a bye
   to one track when the field is odd. The number of rounds is chosen
   automatically based on playlist size (editable before you start).
4. Each matchup is a **head-to-head screen** with two embedded Spotify
   players so you can listen to both and pick a winner.
5. A **live leaderboard** tracks wins/losses and a Buchholz tiebreaker
   (sum of your opponents' scores) throughout.
6. At the end you get a **final ranked list** — the seeding order for a
   future single-elimination bracket (not built yet, by design).

Progress (auth session + in-progress tournament) is saved to
`localStorage`, so a page refresh won't lose your place.

## Setup

### 1. Create a Spotify app

Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
create an app, and open its Settings.

Add this exact Redirect URI:

```
https://joseestebandelavega-a11y.github.io/Spotifyranker/callback.html
```

(Adjust the domain/path if you rename the repo or use a custom domain —
see `config.js`.)

### 2. Set the Client ID

`config.js` already has your Client ID filled in:

```js
const CONFIG = {
  CLIENT_ID: "f10ee678f8534eefa83d5984d394ace6",
  REDIRECT_URI: "https://joseestebandelavega-a11y.github.io/Spotifyranker/callback.html",
  SCOPES: "playlist-read-private playlist-read-collaborative"
};
```

The Client ID is not a secret under PKCE — it's fine for it to live in a
public repo. If you ever rotate it, just edit this file.

### 3. Enable GitHub Pages

In the repo: **Settings → Pages → Source → GitHub Actions**. The included
workflow (`.github/workflows/deploy.yml`) deploys the site on every push to
`main`.

### 4. Visit the site

Once deployed, go to the Pages URL, log in with Spotify, pick one or more
playlists, and start ranking.

## Notes

- All CSS/JS is loaded with a `?v=N` cache-busting query string in
  `index.html`/`callback.html`, since GitHub Pages doesn't set aggressive
  no-cache headers and mobile browsers can otherwise keep serving a stale
  script after a deploy. Bump the `N` whenever you push a JS/CSS change.
- Requires at least 2 unique tracks across the selected playlist(s). Local
  files and non-track items (e.g. podcast episodes) are skipped on import.
- Tested up to 5,000 tracks: import, pairing, and the Buchholz tiebreak
  calculation are all incremental/O(n log n), so large merged pools stay
  fast (the Swiss engine's own bookkeeping runs in well under a second for
  5,000 tracks across 15 rounds).
- Embedded players use Spotify's public iframe embed widget
  (`open.spotify.com/embed/track/...`), so playback works the same as any
  embedded Spotify player on a website — no Premium/Web Playback SDK
  requirement.
- The final rankings screen has a "Copy Ranked List as JSON" button so the
  ordered result (with Spotify URIs) can be reused later, e.g. to seed a
  single-elimination bracket.
