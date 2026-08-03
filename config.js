// Spotify app configuration.
// 1. Create an app at https://developer.spotify.com/dashboard
// 2. Add the redirect URI below to the app's "Redirect URIs" list.
// 3. Paste the app's Client ID here (Client ID is not secret — this app uses
//    Authorization Code + PKCE, so no client secret is ever needed).
const CONFIG = {
  CLIENT_ID: "f10ee678f8534eefa83d5984d394ace6",
  REDIRECT_URI: "https://joseestebandelavega-a11y.github.io/Spotifyranker/callback.html",
  SCOPES: "playlist-read-private playlist-read-collaborative user-library-read"
};
