// Thin wrapper around the Spotify Web API for the calls this app needs.

const LIKED_SONGS_ID = "__liked_songs__";

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
    if (res.status === 403) {
      throw new Error("Spotify denied that request — log out and back in to refresh your permissions.");
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
    // unavailable (e.g. deleted or region-restricted) — those are the only
    // ones we can't do anything with. Everything else is kept and rendered
    // defensively, since fields like `tracks` are sometimes missing/partial
    // without the whole entry being unusable.
    const playlists = items.filter((pl) => pl && pl.id);

    // "Liked Songs" isn't a real playlist — it's the separate Saved Tracks
    // library — so it never shows up in /me/playlists. Surface it as a
    // synthetic entry pinned to the top of the list. This can 403 if the
    // current session predates the user-library-read scope being added
    // (existing token, not yet re-authorized) — don't let that take down
    // the whole playlist list, just skip Liked Songs.
    try {
      const likedMeta = await this.getLikedSongsMeta();
      return [likedMeta, ...playlists];
    } catch (e) {
      return playlists;
    }
  },

  async getLikedSongsMeta() {
    const data = await this.request("/me/tracks?limit=1");
    return {
      id: LIKED_SONGS_ID,
      name: "Liked Songs",
      images: [],
      tracks: { total: data.total },
      owner: { display_name: "You" },
    };
  },

  mapTrackItems(items) {
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

  async getAllPlaylistTracks(playlistId) {
    if (playlistId === LIKED_SONGS_ID) return this.getAllLikedSongs();

    const fields = "next,items(track(id,uri,name,type,is_local,artists(name),album(images)))";
    let items = [];
    let url = `/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;
    while (url) {
      const data = await this.request(url);
      items = items.concat(data.items);
      url = data.next;
    }
    return this.mapTrackItems(items);
  },

  async getAllLikedSongs() {
    // /me/tracks doesn't support the playlist-tracks `fields` filter param,
    // so this fetches full saved-track objects rather than a trimmed shape.
    let items = [];
    let url = "/me/tracks?limit=50";
    while (url) {
      const data = await this.request(url);
      items = items.concat(data.items);
      url = data.next;
    }
    return this.mapTrackItems(items);
  },
};
