// UI controller: wires screens together and drives the tournament flow.

const TOURNAMENT_STORAGE_KEY = "spotify_swiss_tournament";

const state = {
  user: null,
  playlists: [],
  selectedPlaylist: null,
  tracks: [],
  tournament: null,
};

const screens = {
  login: document.getElementById("screen-login"),
  playlists: document.getElementById("screen-playlists"),
  loading: document.getElementById("screen-loading"),
  setup: document.getElementById("screen-setup"),
  match: document.getElementById("screen-match"),
  roundDone: document.getElementById("screen-round-done"),
  final: document.getElementById("screen-final"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function showLoading(message) {
  document.getElementById("loading-message").textContent = message || "Loading…";
  showScreen("loading");
}

function showError(message) {
  const el = document.getElementById("error-banner");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}

// ---------- Persistence ----------

function saveTournamentState() {
  if (!state.tournament) return;
  localStorage.setItem(
    TOURNAMENT_STORAGE_KEY,
    JSON.stringify({
      playlistName: state.selectedPlaylist ? state.selectedPlaylist.name : "",
      tournament: state.tournament.toJSON(),
    })
  );
}

function clearTournamentState() {
  localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
}

function loadTournamentState() {
  const raw = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return { playlistName: data.playlistName, tournament: SwissTournament.fromJSON(data.tournament) };
  } catch (e) {
    return null;
  }
}

// ---------- Header / auth ----------

function updateHeader() {
  const header = document.getElementById("user-header");
  if (state.user) {
    header.classList.remove("hidden");
    document.getElementById("user-name").textContent = state.user.display_name || state.user.id;
  } else {
    header.classList.add("hidden");
  }
}

document.getElementById("login-btn").addEventListener("click", () => Auth.login());

document.getElementById("logout-btn").addEventListener("click", () => {
  Auth.logout();
  clearTournamentState();
  window.location.reload();
});

// ---------- Playlists ----------

async function loadPlaylists() {
  showLoading("Loading your playlists…");
  try {
    state.user = await SpotifyAPI.getCurrentUser();
    updateHeader();
    state.playlists = await SpotifyAPI.getAllPlaylists();
    renderPlaylists();
    showScreen("playlists");
  } catch (e) {
    showError(e.message);
    showScreen("login");
  }
}

function renderPlaylists() {
  const list = document.getElementById("playlist-list");
  list.innerHTML = "";
  for (const pl of state.playlists) {
    const li = document.createElement("li");
    li.className = "playlist-item";
    const img = pl.images && pl.images.length ? pl.images[0].url : "";
    li.innerHTML = `
      <img class="playlist-thumb" src="${img}" alt="" />
      <div class="playlist-info">
        <div class="playlist-name">${escapeHtml(pl.name)}</div>
        <div class="playlist-meta">${pl.tracks.total} tracks · by ${escapeHtml(pl.owner.display_name || "unknown")}</div>
      </div>
    `;
    li.addEventListener("click", () => selectPlaylist(pl));
    list.appendChild(li);
  }
}

async function selectPlaylist(playlist) {
  showLoading(`Importing "${playlist.name}"…`);
  try {
    state.selectedPlaylist = playlist;
    state.tracks = await SpotifyAPI.getAllPlaylistTracks(playlist.id);
    if (state.tracks.length < 2) {
      showError("This playlist needs at least 2 tracks.");
      showScreen("playlists");
      return;
    }
    renderSetup();
    showScreen("setup");
  } catch (e) {
    showError(e.message);
    showScreen("playlists");
  }
}

function renderSetup() {
  document.getElementById("setup-playlist-name").textContent = state.selectedPlaylist.name;
  document.getElementById("setup-track-count").textContent = state.tracks.length;
  const recommended = SwissTournament.recommendedRounds(state.tracks.length);
  const roundsInput = document.getElementById("setup-rounds");
  roundsInput.value = recommended;
  roundsInput.max = Math.max(1, state.tracks.length - 1);
  roundsInput.min = 1;
}

document.getElementById("back-to-playlists-btn").addEventListener("click", () => {
  showScreen("playlists");
});

document.getElementById("start-tournament-btn").addEventListener("click", () => {
  const rounds = parseInt(document.getElementById("setup-rounds").value, 10);
  state.tournament = new SwissTournament(state.tracks);
  if (rounds && rounds > 0) {
    state.tournament.totalRounds = Math.min(rounds, state.tracks.length - 1);
  }
  state.tournament.startNextRound();
  saveTournamentState();
  renderMatch();
});

// ---------- Matches ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function trackCardHtml(side, track) {
  return `
    <div class="track-card">
      <iframe
        src="https://open.spotify.com/embed/track/${track.id}?utm_source=generator"
        width="100%" height="352" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy">
      </iframe>
      <div class="track-title">${escapeHtml(track.name)}</div>
      <div class="track-artist">${escapeHtml(track.artists)}</div>
      <button class="pick-btn" data-side="${side}">Pick this track</button>
    </div>
  `;
}

function renderMatch() {
  const t = state.tournament;
  if (!t) return;

  if (t.isComplete) {
    renderFinal();
    return;
  }

  const match = t.nextOpenMatch();
  if (!match) {
    renderRoundDone();
    return;
  }

  document.getElementById("match-round-label").textContent =
    `Round ${t.currentRoundNum} of ${t.totalRounds}`;
  const round = t.currentRound();
  const doneCount = round.matches.filter((m) => m.winnerId !== null).length;
  document.getElementById("match-progress-label").textContent =
    `Match ${doneCount + 1} of ${round.matches.length}`;

  const container = document.getElementById("match-container");
  container.innerHTML = trackCardHtml("a", match.a) + trackCardHtml("b", match.b);

  container.querySelectorAll(".pick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const winner = btn.dataset.side === "a" ? match.a : match.b;
      t.recordResult(match, winner.id);
      saveTournamentState();
      renderMatch();
    });
  });

  renderLiveStandings();
  showScreen("match");
}

function renderLiveStandings() {
  const tbody = document.getElementById("live-standings-body");
  tbody.innerHTML = "";
  state.tournament.standings.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(p.name)} <span class="muted">— ${escapeHtml(p.artists)}</span></td>
      <td>${p.wins}-${p.losses}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("toggle-standings-btn").addEventListener("click", () => {
  document.getElementById("live-standings-panel").classList.toggle("hidden");
});

// ---------- Round done ----------

function renderRoundDone() {
  const t = state.tournament;
  document.getElementById("round-done-label").textContent =
    `Round ${t.currentRoundNum} of ${t.totalRounds} complete`;
  renderStandingsTable(document.getElementById("round-done-standings-body"));
  showScreen("roundDone");
}

document.getElementById("next-round-btn").addEventListener("click", () => {
  state.tournament.startNextRound();
  saveTournamentState();
  renderMatch();
});

// ---------- Final ----------

function renderStandingsTable(tbody) {
  tbody.innerHTML = "";
  state.tournament.standings.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="standings-track">
        ${p.image ? `<img src="${p.image}" class="standings-thumb" alt="" />` : ""}
        <div>
          <div>${escapeHtml(p.name)}</div>
          <div class="muted">${escapeHtml(p.artists)}</div>
        </div>
      </td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.buchholz}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFinal() {
  document.getElementById("final-playlist-name").textContent = state.selectedPlaylist.name;
  renderStandingsTable(document.getElementById("final-standings-body"));
  showScreen("final");
}

document.getElementById("copy-json-btn").addEventListener("click", async () => {
  const ranked = state.tournament.standings.map((p, i) => ({
    rank: i + 1,
    id: p.id,
    uri: p.uri,
    name: p.name,
    artists: p.artists,
    wins: p.wins,
    losses: p.losses,
    tiebreak: p.buchholz,
  }));
  await navigator.clipboard.writeText(JSON.stringify(ranked, null, 2));
  const btn = document.getElementById("copy-json-btn");
  const original = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = original), 1500);
});

document.getElementById("start-over-btn").addEventListener("click", () => {
  clearTournamentState();
  state.tournament = null;
  state.selectedPlaylist = null;
  state.tracks = [];
  showScreen("playlists");
});

// ---------- Init ----------

(async function init() {
  if (!Auth.isLoggedIn()) {
    showScreen("login");
    return;
  }

  const saved = loadTournamentState();
  if (saved) {
    state.tournament = saved.tournament;
    state.selectedPlaylist = { name: saved.playlistName };
  }

  await loadPlaylists();

  if (state.tournament) {
    if (state.tournament.isComplete) {
      renderFinal();
    } else if (state.tournament.isCurrentRoundComplete()) {
      renderRoundDone();
    } else {
      renderMatch();
    }
  }
})();
