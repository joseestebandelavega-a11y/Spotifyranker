// Swiss-style tournament engine: pairing, byes, scoring, tiebreaks.

class SwissTournament {
  constructor(tracks) {
    this.players = tracks.map((t) => ({
      ...t,
      wins: 0,
      losses: 0,
      score: 0,
      buchholz: 0,
      hadBye: false,
      opponents: new Set(),
    }));
    this.totalRounds = SwissTournament.recommendedRounds(this.players.length);
    this.rounds = [];
    this.byId = new Map(this.players.map((p) => [p.id, p]));
  }

  static recommendedRounds(n) {
    if (n < 2) return 0;
    return Math.min(n - 1, Math.max(3, Math.ceil(Math.log2(n)) + 2));
  }

  get currentRoundNum() {
    return this.rounds.length;
  }

  get isComplete() {
    return this.rounds.length >= this.totalRounds && this.isCurrentRoundComplete();
  }

  isCurrentRoundComplete() {
    const round = this.rounds[this.rounds.length - 1];
    return !round || round.matches.every((m) => m.winnerId !== null);
  }

  currentRound() {
    return this.rounds[this.rounds.length - 1] || null;
  }

  nextOpenMatch() {
    const round = this.currentRound();
    if (!round) return null;
    return round.matches.find((m) => m.winnerId === null) || null;
  }

  startNextRound() {
    const matches = this.pairRound();
    this.rounds.push({ number: this.rounds.length + 1, matches });
    return this.rounds[this.rounds.length - 1];
  }

  pairRound() {
    // Shuffle first so equal-score groups aren't always ordered the same way,
    // then sort by standings (score, tiebreak) to bracket similar performers together.
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    const sorted = shuffled.sort(
      (a, b) => b.score - a.score || b.buchholz - a.buchholz
    );

    const available = [...sorted];
    const matches = [];

    if (available.length % 2 === 1) {
      let byeIdx = -1;
      for (let i = available.length - 1; i >= 0; i--) {
        if (!available[i].hadBye) {
          byeIdx = i;
          break;
        }
      }
      if (byeIdx === -1) byeIdx = available.length - 1;
      const byePlayer = available.splice(byeIdx, 1)[0];
      byePlayer.wins++;
      byePlayer.score++;
      byePlayer.hadBye = true;
      // The bye player's score just increased by 1, so existing opponents'
      // Buchholz needs the same +1 propagation a match win would trigger.
      for (const oppId of byePlayer.opponents) {
        const opp = this.byId.get(oppId);
        if (opp) opp.buchholz += 1;
      }
      matches.push({ a: byePlayer, b: null, bye: true, winnerId: byePlayer.id });
    }

    while (available.length) {
      const p1 = available.shift();
      let idx = available.findIndex((p) => !p1.opponents.has(p.id));
      if (idx === -1) idx = 0; // no fresh opponent left in the field: forced rematch
      const p2 = available.splice(idx, 1)[0];
      matches.push({ a: p1, b: p2, bye: false, winnerId: null });
    }

    return matches;
  }

  recordResult(match, winnerId) {
    if (match.bye) return;
    match.winnerId = winnerId;

    const a = match.a;
    const b = match.b;

    // Buchholz sums each *unique* opponent's current score. On a first
    // meeting, credit each side with the other's pre-match score up front
    // (a forced rematch, from the pairing fallback, is a no-op here since
    // the opponents set already has the id and shouldn't be double-counted).
    const firstMeeting = !a.opponents.has(b.id);
    a.opponents.add(b.id);
    b.opponents.add(a.id);
    if (firstMeeting) {
      a.buchholz += b.score;
      b.buchholz += a.score;
    }

    const winner = winnerId === a.id ? a : b;
    const loser = winner === a ? b : a;
    winner.wins++;
    winner.score++;
    loser.losses++;

    // The winner's score just increased by 1, so every player who already
    // has the winner as an opponent (including the one just added above)
    // needs their Buchholz bumped by 1 to track the winner's new total —
    // that set is exactly winner.opponents, bounded by rounds played, not
    // the full field size.
    for (const oppId of winner.opponents) {
      const opp = this.byId.get(oppId);
      if (opp) opp.buchholz += 1;
    }
  }

  get standings() {
    return [...this.players].sort(
      (a, b) => b.score - a.score || b.buchholz - a.buchholz || b.wins - a.wins
    );
  }

  toJSON() {
    return {
      players: this.players.map((p) => ({ ...p, opponents: [...p.opponents] })),
      totalRounds: this.totalRounds,
      rounds: this.rounds.map((r) => ({
        number: r.number,
        matches: r.matches.map((m) => ({
          aId: m.a.id,
          bId: m.b ? m.b.id : null,
          bye: m.bye,
          winnerId: m.winnerId,
        })),
      })),
    };
  }

  static fromJSON(data) {
    const t = Object.create(SwissTournament.prototype);
    t.players = data.players.map((p) => ({ ...p, opponents: new Set(p.opponents) }));
    t.totalRounds = data.totalRounds;
    t.byId = new Map(t.players.map((p) => [p.id, p]));
    t.rounds = data.rounds.map((r) => ({
      number: r.number,
      matches: r.matches.map((m) => ({
        a: t.byId.get(m.aId),
        b: m.bId ? t.byId.get(m.bId) : null,
        bye: m.bye,
        winnerId: m.winnerId,
      })),
    }));
    return t;
  }
}
