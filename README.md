# DC Menu

Live menus for every UC Davis dining commons — **Segundo, Tercero, Cuarto and Latitude** — with upvotes and downvotes on every dish. Works in the browser and installs on phones like an app.

- **Always live.** The site scrapes [UC Davis Dining](https://housing.ucdavis.edu/dining/menus/) on the server and re-scrapes at most every 15 minutes. Nothing to update by hand; new weeks show up on their own.
- **Votes follow the dish.** A vote is tied to the dish name, not the date or hall, so when "Orange Chicken" comes back next week (or at another DC) its score is still there.
- **Opens to what matters.** Today's date and the meal being served right now, at your usual dining commons, with whether each one is open right now.
- **Top voted.** A leaderboard for each dining commons (most and least loved dishes on this week's menu, with when each is served next), top-rated dishes on campus for the current meal, and "your upvotes this week".
- **Search.** Find a dish and see every dining commons and meal serving it this week.
- **Filters.** Vegan, vegetarian, halal and 20g+ protein, plus allergens to avoid (dairy, egg, gluten, soy, sesame, fish, shellfish, tree nuts, peanuts, alcohol, shared fryer). Allergens and nutrition for every dish.
- **Desktop and mobile layouts.** A menu column with a leaderboard rail on wide screens; a single column with a bottom tab bar on phones. Light and dark mode.

## Design

Built to read like a printed dining menu rather than an app dashboard, in UC Davis colors.

- **Type:** Figtree and Newsreader, free stand-ins for UC Davis's brand faces (Proxima Nova and Freight). Sizes follow a √φ scale (each step ≈1.272×): 10, 12.6, 16, 20.4, 25.9, 32.9 and 41.9px (`text-cap`, `text-body`, `text-lead`, `text-h3`, `text-h2`, `text-h1`). Descriptions use a φ (1.618) line height.
- **Spacing:** Fibonacci steps only (3, 5, 8, 13, 21, 34, 55, 89px) as `f3`…`f89`, so neighbouring gaps sit in the golden ratio.
- **Layout:** on desktop, a 610px menu column beside a 377px rail with a 55px gutter, which puts the two columns in the golden ratio.
- **Color:** Aggie Blue `#022851`, Aggie Gold `#FFBF00` and the cream page from housing.ucdavis.edu. Zone rules use the colors of the zone signs in the dining commons.

Tokens live in `app/globals.css`.

## Deploy on Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new). No settings to change.
2. In the Vercel project, open **Storage → Create Database → Upstash for Redis** (the free plan is plenty) and connect it to the project. This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables (any custom prefix works too).
3. **Redeploy** so the new variables are picked up.

Without step 2 the site still works, but votes live in server memory and disappear. The footer shows a warning until a database is connected.

## Install it on your phone

- **iPhone:** open the site in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → ⋮ → **Install app**.

It opens full-screen with its own icon, and jumps to the current meal whenever you reopen it.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Redis env vars, votes are kept in memory.

```bash
npm run scrape            # print what the scraper sees for every hall, day and meal
npm run scrape -- --json  # also write menu.json
```

The scraped data is also served as JSON at `/api/menu`.

## How it works

| Piece | File |
| --- | --- |
| Scraper (fetch + parse the UC Davis pages with cheerio) | `lib/scraper.ts` |
| Live caching: page regenerates in the background every 15 min | `app/page.tsx`, `lib/menu.ts` |
| Vote storage (Upstash Redis, atomic Lua script, one vote per visitor per dish) | `lib/votes.ts`, `app/api/votes/route.ts` |
| Picking today / the current meal in Davis time | `lib/menu-view.ts`, `lib/time.ts` |
| Leaderboards, search, open-now status | `lib/insights.ts` |
| Diet and allergen filters | `lib/filters.ts` |
| UI | `components/` |
| App name | `lib/app.ts` |

Each UC Davis dining page contains the whole week (Sunday–Saturday) broken into meals and color-coded zones, which match the zone signs and floor plans in the DCs. If UC Davis is unreachable during a refresh, the last good menu keeps being served.

Voters are anonymous: a random ID in an httpOnly cookie keeps one vote per person per dish, and a per-IP rate limit stops scripted floods.

Unofficial student project, not affiliated with UC Davis. Always confirm allergens with dining staff.
