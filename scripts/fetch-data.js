const fs = require("fs");
const path = require("path");

// ---- Config: FIFA World Cup 2026 in API-Football ----
const LEAGUE = 1;        // 1 = FIFA World Cup
const SEASON = 2026;
const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;

if (!KEY) {
  console.error("Missing API_FOOTBALL_KEY environment variable.");
  process.exit(1);
}

const headers = { "x-apisports-key": KEY };

async function api(endpoint) {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
  const json = await res.json();
  return json.response || [];
}

// status codes that mean a match is in progress
const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
const DONE = ["FT", "AET", "PEN"];

function classify(short) {
  if (LIVE.includes(short)) return "live";
  if (DONE.includes(short)) return "finished";
  return "upcoming";
}

function eventIcon(type, detail) {
  if (type === "Goal") return "\u26BD";
  if (type === "Card" && /Yellow/.test(detail)) return "\uD83D\uDFE8";
  if (type === "Card") return "\uD83D\uDFE5";
  if (type === "subst") return "\uD83D\uDD01";
  if (type === "Var") return "\uD83D\uDCFA";
  return "\u2022";
}

function eventText(e) {
  const who = e.player && e.player.name ? e.player.name : "";
  const team = e.team && e.team.name ? e.team.name : "";
  if (e.type === "Goal") {
    const assist = e.assist && e.assist.name ? ` (assist: ${e.assist.name})` : "";
    return `GOAL! ${who} scores for ${team}.${assist}`;
  }
  if (e.type === "Card") return `${e.detail} for ${who} (${team}).`;
  if (e.type === "subst") return `${team}: ${e.assist?.name || "player"} on, ${who} off.`;
  return `${e.detail || e.type} — ${who} (${team})`;
}

async function main() {
  const out = {
    meta: {
      league: "FIFA World Cup 2026",
      season: SEASON,
      lastUpdated: new Date().toISOString(),
    },
    matches: { live: [], upcoming: [], finished: [] },
    standings: [],
    scorers: [],
    assists: [],
  };

  // ---- Fixtures ----
  try {
    const fixtures = await api(`/fixtures?league=${LEAGUE}&season=${SEASON}`);
    for (const f of fixtures) {
      const bucket = classify(f.fixture.status.short);
      const match = {
        id: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status.short,
        minute: f.fixture.status.elapsed,
        round: f.league.round,
        venue: f.fixture.venue?.name || "",
        home: { name: f.teams.home.name, logo: f.teams.home.logo },
        away: { name: f.teams.away.name, logo: f.teams.away.logo },
        goals: { home: f.goals.home, away: f.goals.away },
        events: [],
      };
      out.matches[bucket].push(match);
    }
    out.matches.upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    out.matches.finished.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (e) {
    console.error("Fixtures failed:", e.message);
  }

  // ---- Live match events (commentary) ----
  for (const m of out.matches.live) {
    try {
      const evs = await api(`/fixtures/events?fixture=${m.id}`);
      m.events = evs
        .map((e) => ({
          min: `${e.time.elapsed}${e.time.extra ? "+" + e.time.extra : ""}'`,
          icon: eventIcon(e.type, e.detail),
          text: eventText(e),
          goal: e.type === "Goal",
        }))
        .reverse();
    } catch (e) {
      console.error(`Events failed for fixture ${m.id}:`, e.message);
    }
  }

  // ---- Standings ----
  try {
    const st = await api(`/standings?league=${LEAGUE}&season=${SEASON}`);
    const groups = st[0]?.league?.standings || [];
    for (const g of groups) {
      out.standings.push({
        group: g[0]?.group || "Group",
        teams: g.map((t) => ({
          rank: t.rank,
          name: t.team.name,
          logo: t.team.logo,
          played: t.all.played,
          points: t.points,
          gd: t.goalsDiff,
          gf: t.all.goals.for,
          ga: t.all.goals.against,
        })),
      });
    }
  } catch (e) {
    console.error("Standings failed:", e.message);
  }

  // ---- Top scorers ----
  try {
    const sc = await api(`/players/topscorers?league=${LEAGUE}&season=${SEASON}`);
    out.scorers = sc.slice(0, 20).map((p) => ({
      name: p.player.name,
      photo: p.player.photo,
      team: p.statistics[0]?.team?.name || "",
      goals: p.statistics[0]?.goals?.total || 0,
    }));
  } catch (e) {
    console.error("Top scorers failed:", e.message);
  }

  // ---- Top assists ----
  try {
    const as = await api(`/players/topassists?league=${LEAGUE}&season=${SEASON}`);
    out.assists = as.slice(0, 20).map((p) => ({
      name: p.player.name,
      photo: p.player.photo,
      team: p.statistics[0]?.team?.name || "",
      assists: p.statistics[0]?.goals?.assists || 0,
    }));
  } catch (e) {
    console.error("Top assists failed:", e.message);
  }

  const outPath = path.join(__dirname, "..", "data", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `Wrote data.json — live:${out.matches.live.length} upcoming:${out.matches.upcoming.length} finished:${out.matches.finished.length} scorers:${out.scorers.length}`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
