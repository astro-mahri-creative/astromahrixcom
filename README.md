# ASTRO MAHRI // Release Microsite

A one-page microsite for Astro Mahri's debut single — dark sci-fi / afrofuturist
transmission aesthetic. Built as a **zero-dependency static site**: just HTML, CSS,
and vanilla JS. No npm, no bundler, no build step.

> **Why no build tooling?** This is a single static page. A build pipeline would add
> fragility (Node versions, dependency drift) for zero benefit. You "build from the repo"
> by cloning it, dropping in your assets, and pushing — deployment is automated below.

---

## Quick start (local preview)

Clone, then open `index.html` in a browser. Because the assets load with relative
paths, that's all you need. If your browser is fussy about local files, serve it:

```bash
# Python (preinstalled on most machines)
python3 -m http.server 8000
# then visit http://localhost:8000

# …or Node, if you prefer
npx serve .
```

---

## Project structure

```
astromahrixcom/
├── index.html              # markup + all [SWAP] edit points
├── css/
│   └── styles.css          # full stylesheet (CSS variables at top)
├── js/
│   └── main.js             # starfield, parallax, scroll reveals
├── assets/
│   └── images/             # drop your 5 photos here (see below)
├── .github/workflows/
│   └── deploy.yml           # auto-deploy to GitHub Pages on push to main
├── netlify.toml            # one-click Netlify deploy config
├── .gitignore
├── LICENSE
└── README.md
```

---

## Customizing — find every edit point with `[SWAP]`

Search the codebase for `[SWAP]` to jump to each thing you need to change.

| Tag | Where | What to do |
|-----|-------|-----------|
| `[SWAP-SOUNDCLOUD]` | `index.html` (player) | Paste your SoundCloud embed. Easiest: on SoundCloud hit **Share → Embed**, copy the `<iframe>`, and replace the existing one. |
| `[SWAP-PHOTO-1]` | hero | Astro Mahri portrait |
| `[SWAP-PHOTO-2]` | release | Single cover art (square, ~3000×3000) |
| `[SWAP-PHOTO-3]` | editorial break | Performance / in-the-wild shot (wide) |
| `[SWAP-PHOTO-4]` | portals | Future Hooman visual |
| `[SWAP-PHOTO-5]` | portals | Lore Con visual |
| `[SWAP-LINK-FH]` | portals | Future Hooman destination URL |
| `[SWAP-LINK-LC]` | portals | Lore Con destination URL |
| `[SWAP-NOTION-FORM-URL]` | contact | Published Notion form URL — submissions land in your Notion DB so no email is ever in the repo |
| `[SWAP-TEXT]` | various | Track title, release date, streaming + social links, OG meta |

### Adding photos

Drop your images in `assets/images/` using these recommended names:

```
hero-portrait.jpg     cover-art.jpg     performance.jpg
future-hooman.jpg     lore-con.jpg
```

Then in `index.html`, each photo zone has a commented-out `<img>` right above the
placeholder. Replace the placeholder `<div class="ph-grad">…</div>` with the `<img>`:

```html
<!-- before (placeholder) -->
<div class="ph-grad" style="background:…"></div>

<!-- after (your photo) -->
<img src="assets/images/hero-portrait.jpg" alt="Astro Mahri" />
```

Until you add real photos, the page renders labeled, on-brand cosmic placeholders so
it always looks intentional.

### Recoloring

All colors live as CSS variables at the top of `css/styles.css` (`:root`). Change
`--gold`, `--magenta`, `--cyan`, etc. once and the whole site follows.

---

## Deploy

### Option A — GitHub Pages (included, automatic)

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` and publishes the site.

### Option B — Netlify

Connect the repo in Netlify and deploy — `netlify.toml` is preconfigured (publishes
the repo root, no build command). Or drag the folder onto <https://app.netlify.com/drop>.

### Option C — anywhere

It's plain static files. Upload the folder to any host (Vercel, Cloudflare Pages,
S3, your own server).

---

## Credits

Fonts via Google Fonts: **Unbounded** (display), **Space Mono** (labels), **Sora** (body).
Built for Astro Mahri. Signal from Durham, NC.
