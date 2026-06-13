# WC26 — One Portal

A live 2026 FIFA World Cup app: matches, group tables, top scorers, top assists, and live match commentary — all in one place. It's a **PWA** (installs to your phone's home screen like a real app) hosted free on **GitHub Pages**, with data pulled automatically by **GitHub Actions** from API-Football.

It works out of the box with built-in **sample data**, so you can see it running before you connect anything. Then you add your free API key and it goes live.

---

## What's in here

```
index.html              The app itself
manifest.webmanifest    Makes it installable as a PWA
sw.js                   Service worker (offline shell + install)
icon.svg                App icon
data/data.json          The data the app reads (sample now; auto-updated later)
scripts/fetch-data.js   Pulls live data from API-Football
.github/workflows/      The scheduled job that runs the fetcher
```

---

## Part 1 — Get it online (sample data, ~10 minutes)

You don't need an API key for this part.

1. **Make a GitHub account** at github.com (free) if you don't have one.
2. **Create a new repository.** Click the **+** (top right) → **New repository**. Name it `wc26-portal`, set it **Public**, and create it.
3. **Upload these files.** On the empty repo page, click **uploading an existing file**. Drag in *everything* from this folder (including the `data`, `scripts`, and `.github` folders — keep the folder structure). Click **Commit changes**.
4. **Turn on GitHub Pages.** Go to **Settings → Pages**. Under "Build and deployment", set **Source = Deploy from a branch**, **Branch = main**, folder = **/ (root)**. Save.
5. Wait 1–2 minutes, then open the link Pages gives you (like `https://yourname.github.io/wc26-portal/`). The app is live with sample data. Open it on your phone and tap **Share → Add to Home Screen** to install it.

---

## Part 2 — Make it real (connect the live feed)

1. **Get a free API key.** Go to dashboard.api-football.com/register, sign up (no card needed), and copy your key from **Account → My Access**.
2. **Add the key to GitHub as a secret** (this keeps it hidden — never put it in a file):
   In your repo go to **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `API_FOOTBALL_KEY`
   - Value: *paste your key*
   - Save.
3. **Run the fetcher once.** Go to the **Actions** tab → **Update World Cup data** → **Run workflow**. After a minute it will pull live data and update `data/data.json` automatically.
4. Refresh the app — the sample badge disappears and you're showing real World Cup data. From now on it refreshes on its own.

---

## Important: free tier vs. live updates

The free API plan allows **100 requests per day**. Each refresh uses a handful of requests, so the free plan **cannot** update every few minutes all day long — it'll run out.

- **On the free plan:** open `.github/workflows/update-data.yml` and change the schedule line to hourly: `- cron: "0 * * * *"`, or just press **Run workflow** manually during the matches you care about.
- **For genuinely live updates during matches:** upgrade to API-Football's **Pro plan (about $19/month, 7,500 requests/day)**. Then the default 15-minute schedule (or faster) works fine.

Note: GitHub's scheduled jobs are "best effort" and can be delayed a few minutes during busy times. For true second-by-second live scores you'd later move the fetcher to a small always-on backend (e.g. a free Vercel function) — that's the v2 upgrade.

---

## What's here vs. what's next

**In this v1:** live/upcoming/finished matches, group tables with advancing teams highlighted, Golden Boot race, top assists, and live match commentary (goals, cards, subs).

**Coming in v2** (needs a small backend, which GitHub Pages alone can't run): the full qualification scenario calculator, fan chat, xG and match stats, and the predict-the-score game. See the build brief for the full roadmap.

---

## Customizing

- The competition is set at the top of `scripts/fetch-data.js` (`LEAGUE = 1`, `SEASON = 2026`). Those are the World Cup values.
- Colors and styling live in the `<style>` block at the top of `index.html`.

## A note on rights

Football data is licensed — check API-Football's terms for public display. Don't use FIFA's official logos or marks as your branding without permission. Avoid hosting video highlights.
