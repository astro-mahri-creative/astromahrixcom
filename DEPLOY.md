# Deploy Guide — astromahri.com

The site's production architecture follows the standard split:

| Layer | Service | Role |
|-------|---------|------|
| Source of truth | **GitHub** (`<your-github>/astromahrixcom`) | Code, history, PRs, branch protection |
| Production frontend | **Netlify** | Serves the static site at astromahri.com; SSL, CDN, deploy previews |
| Dynamic backend | **Render** | Reserved for any API / cron / DB the site eventually needs (not used today) |

> **Today:** this site is fully static — no JavaScript backend, no DB, no auth. Netlify alone handles production. Render is documented here for the day a feature needs a backend (mailing list, fan signups, analytics endpoint, ticket waitlist, etc.) so you don't have to re-figure the pattern.

---

## One-time setup

### 1. GitHub (source)

The repo already exists locally. To put it on GitHub:

1. Go to <https://github.com/new>, name it **`astromahrixcom`**, **public**, **uninitialized** (no README/.gitignore/license — they're already in the local repo).
2. From the repo root, wire up the remote and push:
   ```powershell
   git remote add origin git@github.com:<your-github>/astromahrixcom.git
   git push -u origin main
   ```
3. In repo **Settings → Branches**, add a protection rule for `main`:
   - Require a pull request before merging (optional, for solo workflow)
   - Require status checks (once Netlify/Render are wired)
   - Disallow force pushes

### 2. Netlify (production frontend)

1. Log in to <https://app.netlify.com>.
2. **Add new site → Import from GitHub** → pick `astromahrixcom`.
3. Build settings (Netlify auto-detects from [`netlify.toml`](netlify.toml), confirm):
   - **Build command:** *(empty)*
   - **Publish directory:** `.`
   - **Production branch:** `main`
4. **Deploy site.** First deploy lands at something like `astromahrixcom-xxxx.netlify.app`.
5. **Domain management:**
   - **Domains → Add custom domain →** `astromahri.com`. Add `www.astromahri.com` as an alias.
   - Set primary to the apex (or `www.` — pick one, redirect the other).
   - **DNS:** point your registrar's nameservers at Netlify DNS (simplest) OR keep DNS at your registrar and add records:
     - Apex `astromahri.com`: `A` → `75.2.60.5` (Netlify's load balancer)
     - `www.astromahri.com`: `CNAME` → `<your-site>.netlify.app`
   - **HTTPS:** Netlify auto-provisions Let's Encrypt once DNS resolves. Force-renew from **Domain → HTTPS** if it stalls.
6. **Deploy previews:** on by default. Every PR gets a unique preview URL — great for proofing changes before merge.
7. **Notifications (optional):** **Site settings → Build & deploy → Deploy notifications** — email or Slack on failed deploys.

### 3. GitHub Pages workflow — decide

The repo currently has [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) which deploys to GitHub Pages on every push to `main`. Now that Netlify is the production host, choose:

- **Recommended: delete it** — one source of truth, no duplicate builds. Run: `rm .github/workflows/deploy.yml && git commit -am "Drop GitHub Pages workflow (Netlify is prod)"`
- **Keep as cold backup** — adds a parallel GH Pages URL you can fall back to if Netlify has an outage. Costs nothing but adds noise to PR checks.

### 4. Render (backend — when needed)

**Skip this whole section until a feature requires a backend.** When that day comes:

1. Add the backend code to this same repo under e.g. `/api/` (monorepo) **or** create a separate repo if you prefer.
2. <https://render.com> → **New → Web Service** → connect the GitHub repo.
3. Configure:
   - **Runtime:** Node / Python / whatever fits
   - **Build command:** install + build
   - **Start command:** server start
   - **Branch:** `main` (auto-deploy on push)
   - **Environment:** add any secrets here, NOT in the repo
4. Render gives you a URL like `astromahri-api.onrender.com`. Add a custom subdomain (`api.astromahri.com`) and point a CNAME at it.
5. In the frontend, call that URL. Free Render web services sleep after 15 min of inactivity — if that matters, upgrade to a paid tier or use a cron-keepalive.

**Pattern for combining:** the static frontend on Netlify (`astromahri.com`) calls the Render backend (`api.astromahri.com`) from JS. CORS gets configured on the Render side. Both auto-deploy from `main` on the same repo.

---

## Routine deploy flow

Day-to-day, deploying = pushing to `main`. The whole loop:

```powershell
# 1. Get latest
git checkout main
git pull

# 2. Make + test changes
python -m http.server 8000
# open http://localhost:8000, click around

# 3. Commit + push
git add <files>
git commit -m "Short summary of change"
git push origin main

# 4. Netlify auto-deploys (~30-60 seconds). Watch in dashboard.
# 5. Verify https://astromahri.com — hard refresh if needed.
```

For anything risky, branch first and use a deploy preview:

```powershell
git checkout -b try/new-hero
# ...edits...
git push -u origin try/new-hero
# Open a PR. Netlify posts a "Deploy Preview" URL on the PR.
# Review at that URL. When happy, merge → auto-deploys to prod.
```

---

## Pre-deploy checklist

Before pushing changes that touch user-facing content:

- [ ] Every `[SWAP-*]` marker is resolved (search the repo for `[SWAP`).
  - [ ] `[SWAP-SOUNDCLOUD]` — real player iframe in place
  - [ ] `[SWAP-PHOTO-1..5]` — real images, not placeholders
  - [ ] `[SWAP-LINK-FH]` / `[SWAP-LINK-LC]` — real destination URLs
  - [ ] `[SWAP-NOTION-FORM-URL]` — published Notion form URL
  - [ ] `[SWAP-TEXT]` — track title, release date, streaming + social URLs, OG image URL
- [ ] No lore reveals snuck back in (no "brighter timeline", "origin sector", etc.)
- [ ] OG image URL points at a publicly fetchable absolute URL (after the site is live)
- [ ] Tested in a browser at `http://localhost:8000`, golden path + at least one section scrolled
- [ ] Mobile breakpoint sanity-checked (≤900px width)
- [ ] Commit message reflects the actual change

---

## Rollback

If a deploy breaks production:

1. **Netlify → Deploys** tab.
2. Find the last green deploy.
3. **Publish deploy** button on that row → site reverts instantly. No git changes needed.
4. Fix the bug locally, push a real correction.

A revert via `git revert <bad-sha>` + push also works — the next Netlify build will deploy the reverted state. Use the Netlify-side rollback for *speed*, the git revert for *cleanliness*.

---

## Troubleshooting

| Symptom | Where to look |
|--------|---------------|
| Deploy didn't trigger | Netlify dashboard → Deploys → did the webhook fire? GitHub → Settings → Webhooks → check delivery log. |
| Deploy failed | Netlify build log. Static sites usually only fail on git pull issues or invalid `netlify.toml`. |
| Site is up but old content | Hard refresh (Ctrl+Shift+R). Netlify aggressively cache-busts on deploy, so this is usually a browser cache. |
| HTTPS warning | Netlify → Domain settings → HTTPS → **Renew certificate**. |
| Custom domain not resolving | `nslookup astromahri.com` from PowerShell — confirm A record matches Netlify's IP, CNAME matches site URL. DNS can take up to 48h on first setup. |
| Asset 404 in prod but works locally | Likely a relative-path issue or case mismatch (Linux is case-sensitive, Windows isn't). Check the actual path on disk vs the markup. |
| SoundCloud embed shows nothing | Check `[SWAP-SOUNDCLOUD]` — the placeholder URL `soundcloud.com/astromahri/madness` 404s until the track is uploaded under that slug. |
| Notion form doesn't open | The `[SWAP-NOTION-FORM-URL]` `href` is still the placeholder. Replace with the published form URL. |

---

## Future: adding a backend (when the time comes)

When you want, say, a real mailing list signup that hits a private endpoint:

1. **Plan the schema** — what data, what response, what's the auth model (probably none for write-only signup; rate limit instead).
2. **Add `/api` to this repo** with a minimal server (Node + Express or Python + FastAPI — pick what's most familiar).
3. **Push** — Render auto-deploys.
4. **Wire frontend** — a tiny `fetch('https://api.astromahri.com/signup', { method: 'POST', body: ... })` call from the page.
5. **CORS** — allow `https://astromahri.com` (and the preview URL pattern) on the Render side.
6. **Secrets** — env vars in Render dashboard, never in git. Anything you accidentally commit to git is forever-public.

The Netlify side stays unchanged. The architecture grows by addition, not replacement.
