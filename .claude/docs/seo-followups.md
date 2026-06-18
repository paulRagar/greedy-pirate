# SEO follow-ups

What's already shipped lives in commit history; this doc captures the **next** moves whenever you have appetite. Ordered by effort vs payoff. Tick items off as they land.

## 0. Already done (for reference)

- `app/robots.ts` — blocks `/api`, `/admin`, `/auth`, `/play`, `/profile`.
- `app/sitemap.ts` — root, `/rules`, `/choose-game`, `/play-local`, `/play/join`.
- `app/opengraph-image.tsx` — auto-generated 1200×630 PNG at build.
- `app/layout.tsx` — `WebSite` + `VideoGame` JSON-LD, Twitter card.
- `app/rules/page.tsx` — full prose, `HowTo` + `FAQPage` schema, own metadata.
- Per-route metadata on `choose-game`, `play-local`, `play/join`, `setup`.

---

## 1. Free, in-codebase wins (no accounts)

### 1a. PWA manifest + icons
Blocked on icon assets. Need PNG icons at **192×192** and **512×512** in `public/assets/icons/` (current favicon is only 16×16). Once present:

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
   return {
      name: 'Greedy Pirate',
      short_name: 'Greedy Pirate',
      start_url: '/',
      display: 'standalone',
      background_color: '#02060f',
      theme_color: '#02060f',
      icons: [
         { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
         { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
   };
}
```

Helps "Add to Home Screen" on mobile + a small ranking signal.

### 1b. Privacy + Terms pages
Create `app/privacy/page.tsx` and `app/terms/page.tsx`. Use Termly's free generator → paste output. Must mention:

- Supabase auth cookies (essential)
- Vercel Analytics (cookieless)
- Anonymous user IDs in Supabase
- Email if user upgrades account
- Daily stale-room purge (cron)
- Contact email
- No ad networks, no data selling

Add a slim footer in `app/layout.tsx` with links to both. Search Console + AdSense (if ever) gate on these.

### 1c. More content routes
Each new indexable page = more keyword surface. Cheap wins:

- `/strategy` — 400-word piece on push-your-luck theory, when to bank, leader pressure.
- `/about` — story of the game, who built it. Humans read this; bots love it.
- `/changelog` — version notes. Fresh content = recrawl frequency boost.
- `/blog/<slug>` — write 1 post per month on related topics (top push-your-luck games, family card games for ages 8+, etc.).

Add each to `app/sitemap.ts`.

### 1d. Internal linking
From home + footer, link to `/rules`, `/strategy`, `/about`. Internal links pass authority around. Currently the home → `/choose-game` is the only link. Add a "How to play" anchor link near the CTA.

### 1e. Image alt text audit
Run through `app/HomeClient.tsx` + game UI. Hero `<Image alt=''>` is fine (decorative), but any non-decorative imagery (coin icons in instructional contexts, etc.) needs descriptive `alt`. Accessibility + SEO double-win.

### 1f. Twitter card image source
Currently `app/opengraph-image.tsx` serves both OG and Twitter cards (Next wires it automatically). If you want a distinct Twitter visual, add `app/twitter-image.tsx` with the same shape.

### 1g. Core Web Vitals
Run Lighthouse on prod (`pnpm dlx unlighthouse --site https://greedypirate.com` or DevTools). Target:
- LCP < 2.5s on mobile
- CLS < 0.1
- INP < 200ms

Likely wins: preload `home-cove.webp` (already `priority`), audit font loading (no extra fonts loaded?), inspect ambient sea / parallax JS bundle size.

### 1h. `app/icon.png` + `app/apple-icon.png`
Next.js convention: place a 512×512 `app/icon.png` and 180×180 `app/apple-icon.png` at the root of `app/`. Next auto-generates the `<link>` tags. Replaces the inline `icons` field in `metadata`.

### 1i. Schema.org enrichments
Currently shipping `WebSite`, `VideoGame`, `HowTo`, `FAQPage`. Future:
- **`BreadcrumbList`** on `/rules`, `/strategy` — improves SERP appearance.
- **`AggregateRating`** once you have real reviews (not before — fake = penalty).
- **`Organization`** if you publish under a studio name.

---

## 2. External accounts (when you're ready)

Pick one per week. Each one is a high-authority backlink + a discovery channel.

### 2a. Google Search Console (10 min)
1. Add `greedypirate.com` property at https://search.google.com/search-console.
2. Verify via DNS TXT in Vercel → Settings → Domains.
3. Submit `https://greedypirate.com/sitemap.xml`.
4. Watch the **Coverage** report weekly.
5. Use the **URL Inspection** tool to force-crawl a page after deploys.

### 2b. itch.io listing (30 min)
1. Create account, "Create a new project", type: **HTML5**.
2. Pick "This game can be played in the browser" → paste `https://greedypirate.com`.
   - Or upload nothing and link out (simpler, since online mode needs the server).
3. Tags: `card-game`, `multiplayer`, `push-your-luck`, `pirates`, `party-game`, `free`, `browser`.
4. Description: copy the `/rules` page intro.
5. Cover: same OG image works.
6. Pricing: free.

### 2c. BoardGameGeek (1 hr)
1. Submit at https://boardgamegeek.com/wiki/page/Submit_a_New_Game.
2. Approval: 1–2 weeks (moderated).
3. After approval: write a rules summary, link to `greedypirate.com`, upload card art / screenshots.
4. Tag genres: push-your-luck, card game, party game.

### 2d. Reddit launches (handle carefully)
- **r/WebGames** — explicitly purpose-built, no risk.
- **r/playmygame** — same.
- **r/IndieDev**, **r/SideProject** — friendly.
- **r/boardgames** — strict; lead with genre comparison ("digital Diamant for the browser"). Read posting rules.
- **r/incagold / r/cantstop** — niche but high-intent.

Format: 1 sentence framing + 2-3 screenshots/GIF + link last. Best window: Mon–Thu morning ET. Stick around to answer every comment.

### 2e. HN Show HN (one-shot)
- Title: `Show HN: Greedy Pirate – a push-your-luck card game in your browser`.
- Body: 2 sentences on the game, 1 paragraph on the stack (Next 15, Supabase Realtime, Drizzle, server-authoritative engine). HN respects technical depth.
- Time: ~8am PT weekday.
- One-shot — pick a Tuesday after privacy + ToS pages live.

### 2f. Product Hunt (1 hr prep + launch day)
- Schedule launch for **Tue/Wed**, midnight PT.
- Assets needed:
  - Thumbnail 240×240
  - Gallery: 5 images at 1270×760
  - Tagline ≤ 60 chars
- Pre-line up 5–10 friends to upvote in first hour (algorithmic boost).
- One-shot — save until you've got the privacy/ToS and a tutorial overlay live.

### 2g. Discord communities
- r/boardgames Discord, /r/IndieGaming Discord, BGG Discord — drop in #show-off channels.
- Lower-pressure than Reddit; mods generally welcome new web games.

### 2h. YouTube playthrough
- 90-second silent screen recording with captions. "Greedy Pirate playthrough" indexes for the same query as the site. Embed on `/rules` for double-dip.

---

## 3. Operational

### 3a. Sitemap freshness
`app/sitemap.ts` currently hardcodes `lastModified`. When you add new routes or refresh prose, bump the date. Or make it dynamic from `process.env.VERCEL_GIT_COMMIT_DATE`.

### 3b. 404 polish
Branded `app/not-found.tsx` reduces bounce + Google likes a real 404. Quick check current state — already exists per `ls`. Verify it ranks above default Next 404.

### 3c. Canonical hygiene
Every new route must export its own `metadata` with `alternates.canonical`. Set up a lint rule or copy-paste discipline. Duplicate content kills ranking.

### 3d. Monitoring
- **Vercel Analytics** — already on. Watch top entry pages.
- **Search Console performance** — query report shows which keywords surface you. Steer content where you're already showing up on page 2 → push to page 1.
- **Plausible / GoatCounter** (optional) — if you want simpler bounce/dwell data later.

### 3e. Image optimization
`home-cove.webp` quality 85 is good. If LCP slips, drop to 75 + add `placeholder='blur'` for less popping.

### 3f. Rate limiting + abuse before traffic
Before SEO drives real users:
- Cap room creations per IP/anon ID per hour
- Profanity filter on display names + auto-generated room codes
- Sentry or Vercel Log Drain for silent errors

---

## 4. Keyword targets (refresher)

Primary (low comp, easy wins):
- `greedy pirate game`
- `bank or bust card game`
- `free pirate card game browser`

Secondary (genre intercepts):
- `push your luck card game online`
- `incan gold online` / `diamant online`
- `digital can't stop`
- `zombie dice alternative`

Long-tail (content opportunities):
- `card game for 2 to 10 players`
- `pass and play party card game`
- `mobile browser card game no download`
- `family card game ages 8+`

Build one route or one blog post per keyword cluster.

---

## 5. Quick "did this work?" checklist

After a deploy, sanity-check:

```sh
curl -sI https://greedypirate.com/robots.txt | head -1
curl -sI https://greedypirate.com/sitemap.xml | head -1
curl -sI https://greedypirate.com/opengraph-image | head -1
curl -s https://greedypirate.com | grep -o '"@type":"VideoGame"' | head -1
```

All four should respond `200`. The last should print the JSON-LD type string.

Validators worth bookmarking:
- https://search.google.com/test/rich-results — paste URL, confirms schema parses.
- https://www.opengraph.xyz/ — paste URL, previews how X/FB/Discord render the card.
- https://validator.schema.org/ — deep JSON-LD validation.
