// Thin wrapper around the Spotify Web API for the calls this app needs.

const SpotifyAPI = {
  async request(path) {
    const token = await Auth.getValidAccessToken();
    if (!token) throw new Error("Not authenticated");

    const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      Auth.logout();
      throw new Error("Your session expired. Please log in again.");
    }
    if (!res.ok) {
      throw new Error(`Spotify API error (${res.status})`);
    }
    return res.json();
  },

  getCurrentUser() {
    return this.request("/me");
  },

  async getAllPlaylists() {
    let items = [];
    let url = "/me/playlists?limit=50";
    while (url) {
      const data = await this.request(url);
      items = items.concat(data.items);
      url = data.next;
    }
    // The Spotify API can return null entries for playlists that became
    // unavailable (e.g. deleted or region-restricted), and occasionally
    // omits fields like `tracks` on malformed entries — skip those.
    return items.filter((pl) => pl && pl.id && pl.tracks);
  },

  async getAllPlaylistTracks(playlistId) {
    const fields = "next,items(track(id,uri,name,type,is_local,artists(name),album(images)))";
    let items = [];
    let url = `/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;
    while (url) {
      const data = await this.request(url);
      items = items.concat(data.items);
      url = data.next;
    }

    const seen = new Set();
    const tracks = [];
    for (const item of items) {
      const t = item.track;
      if (!t || t.type !== "track" || t.is_local || !t.id || seen.has(t.id)) continue;
      seen.add(t.id);
      const images = (t.album && t.album.images) || [];
      tracks.push({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name).join(", "),
        image: images.length ? images[images.length > 2 ? 2 : 0].url : null,
      });
    }
    return tracks;
  },
};
