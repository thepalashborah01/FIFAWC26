/*
 * WC26 Portal — data fetcher (football-data.org free version)
 * Matches, standings, scorers, plus a clean-sheets leaderboard (Golden Glove).
 * Node 18+. Key from env var FOOTBALL_DATA_KEY.
 */

const fs = require("fs");
const path = require("path");

const COMP = "WC";
const BASE = "https://api.football-data.org/v4";
const KEY = process.env.FOOTBALL_DATA_KEY;

if (!KEY) {
  console.error("Missing FOOTBALL_DATA_KEY environment variable.");
  process.exit(1);
}

const headers = { "X-Auth-Token": KEY };

async function api(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`, { headers });
  const json = await res.json().catch(() => ({}));
  console.log(`${endpoint} -> HTTP ${res.status}`);
  if (!res.ok) {
    console.error(`  message: ${json.message || "(none)"}`);
    throw new Error(`${endpoint} failed`);
  }
  return json;
}

const LIVE = ["IN_PLAY", "PAUSED", "LIVE"];
const DONE = ["FINISHED", "AWARDED"];
function classify(status) {
  if (LIVE.includes(status)) return "live";
  if (DONE.includes(status)) return "finished";
  return "upcoming";
}

function pretty(s) {
  if (!s) return "";
  return s.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function team(t) {
  return { name: (t && (t.shortName || t.name)) || "TBD", logo: (t && t.crest) || "" };
}

async function main() {
  const out = {
    meta: { league: "FIFA World Cup 2026", season: 2026, lastUpdated: new Date().toISOString() },
    matches: { live: [], upcoming: [], finished: [] },
    standings: [],
    scorers: [],
    assists: [],
    goldenGlove: [],
  };

  // ---- Matches ----
  try {
    const data = await api(`/competitions/${COMP}/matches`);
    for (const m of data.matches || []) {
      const bucket = classify(m.status);
      out.matches[bucket].push({
        id: m.id,
        date: m.utcDate,
        status: m.status === "SCHEDULED" || m.status === "TIMED" ? "NS" : m.status,
        minute: m.minute || null,
        round: pretty(m.group) || pretty(m.stage),
        venue: m.venue || "",
        home: team(m.homeTeam),
        away: team(m.awayTeam),
        goals: {
          home: m.score && m.score.fullTime ? m.score.fullTime.home : null,
          away: m.score && m.score.fullTime ? m.score.fullTime.away : null,
        },
        events: [],
      });
    }
    out.matches.upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    out.matches.finished.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (e) {
    console.error("Matches failed:", e.message);
  }

  // ---- Golden Glove (clean sheets per team, derived from finished matches) ----
  try {
    const cs = {};
    const bump = (name, logo, conceded) => {
      if (!cs[name]) cs[name] = { team: name, logo: logo || "", cleanSheets: 0, played: 0 };
      cs[name].played++;
      if (conceded === 0) cs[name].cleanSheets++;
    };
    for (const m of out.matches.finished) {
      const hg = m.goals.home, ag = m.goals.away;
      if (hg == null || ag == null) continue;
      bump(m.home.name, m.home.logo, ag);
      bump(m.away.name, m.away.logo, hg);
    }
    out.goldenGlove = Object.values(cs)
      .sort((a, b) => b.cleanSheets - a.cleanSheets || a.played - b.played)
      .slice(0, 20);
  } catch (e) {
    console.error("Golden Glove failed:", e.message);
  }

  // ---- Standings ----
  try {
    const data = await api(`/competitions/${COMP}/standings`);
    for (const s of data.standings || []) {
      if (s.type && s.type !== "TOTAL") continue;
      out.standings.push({
        group: pretty(s.group) || pretty(s.stage) || "Group",
        teams: (s.table || []).map((r) => ({
          rank: r.position,
          name: (r.team && (r.team.shortName || r.team.name)) || "",
          logo: (r.team && r.team.crest) || "",
          played: r.playedGames,
          points: r.points,
          gd: r.goalDifference,
          gf: r.goalsFor,
          ga: r.goalsAgainst,
        })),
      });
    }
  } catch (e) {
    console.error("Standings failed:", e.message);
  }

  // ---- Scorers + Assists ----
  try {
    const data = await api(`/competitions/${COMP}/scorers?limit=20`);
    const list = data.scorers || [];
    out.scorers = list.map((p) => ({
      name: p.player ? p.player.name : "",
      photo: (p.team && p.team.crest) || "",
      team: p.team ? p.team.shortName || p.team.name : "",
      goals: p.goals || 0,
    }));
    out.assists = list
      .filter((p) => typeof p.assists === "number" && p.assists > 0)
      .sort((a, b) => b.assists - a.assists)
      .map((p) => ({
        name: p.player ? p.player.name : "",
        photo: (p.team && p.team.crest) || "",
        team: p.team ? p.team.shortName || p.team.name : "",
        assists: p.assists,
      }));
  } catch (e) {
    console.error("Scorers failed:", e.message);
  }

  const outPath = path.join(__dirname, "..", "data", "data.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    `Wrote data.json — live:${out.matches.live.length} upcoming:${out.matches.upcoming.length} finished:${out.matches.finished.length} scorers:${out.scorers.length} assists:${out.assists.length} glove:${out.goldenGlove.length}`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
