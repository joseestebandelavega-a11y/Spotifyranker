// Spotify OAuth Authorization Code + PKCE flow, fully client-side.

const AUTH_STORAGE_KEY = "spotify_swiss_auth";

const Auth = {
  async login() {
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    const state = generateRandomString(16);

    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      response_type: "code",
      redirect_uri: CONFIG.REDIRECT_URI,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: CONFIG.SCOPES,
      state,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  },

  saveTokens(data) {
    const existing = this.getTokens();
    const record = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || (existing && existing.refresh_token) || null,
      expires_at: Date.now() + data.expires_in * 1000,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record));
  },

  getTokens() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  isLoggedIn() {
    return !!this.getTokens();
  },

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  async getValidAccessToken() {
    const tokens = this.getTokens();
    if (!tokens) return null;
    if (Date.now() < tokens.expires_at - 60000) return tokens.access_token;
    if (!tokens.refresh_token) {
      this.logout();
      return null;
    }
    return this.refreshAccessToken(tokens.refresh_token);
  },

  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CONFIG.CLIENT_ID,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      this.logout();
      return null;
    }

    const data = await res.json();
    this.saveTokens(data);
    return data.access_token;
  },
};
