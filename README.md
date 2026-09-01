# ASTRO MAHRI // Release Microsite

A one-page microsite for Astro Mahri's debut single — dark sci-fi / afrofuturist
transmission aesthetic. **Zero dependencies and no build step**: HTML, CSS and vanilla
JS, plus two serverless functions that import nothing but the standard library.

> **Why no build tooling?** A build pipeline would add fragility (Node versions,
> dependency drift) for zero benefit here. You "build from the repo" by cloning it,
> dropping in your assets, and pushing — deployment is automated below. There is no
> `package.json`, and the tests run straight off `node`.

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
├── 404.html                # branded not-found page
├── sitemap.xml             # one entry: the apex (/connect is noindex)
├── robots.txt
├── css/
│   └── styles.css          # full stylesheet (CSS variables at top)
├── js/
│   └── main.js             # starfield, parallax, scroll reveals
├── assets/
│   ├── branding/           # logo mark + wordmark (SVG)
│   └── images/             # the 5 photos + cover art (see below)
├── connect/
│   ├── index.html          # NFC tag destination — self-contained, do not move
│   └── astro-mahri.vcf     # contact card
├── netlify/functions/
│   ├── _lead.mjs           # shared lead handler; sets Source server-side
│   ├── lead-website.mjs    # POST /api/lead/website
│   └── lead-connect.mjs    # POST /api/lead/connect
├── tests/
│   └── lead.test.mjs       # node tests/lead.test.mjs — no runner needed
├── netlify.toml            # deploy config, headers, functions directory
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
| `[SWAP-TEXT]` | various | Track title, release date, streaming + social links, OG meta |

The contact form has no `[SWAP]` marker: it posts to `/api/lead/website`, a serverless
function in this repo. Nothing to paste — see **[Lead capture](#lead-capture)** below.

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

## Lead capture

The form on `/` and the form on `/connect` both POST to serverless functions in
`netlify/functions/`. Each endpoint hard-codes its own `Source` tag as a literal, and
the shared handler never reads `source` from the request — so a crafted POST cannot
change it. **The endpoint you hit *is* the tag.**

| Endpoint | Writes `Source` |
|----------|-----------------|
| `POST /api/lead/website` | `website` |
| `POST /api/lead/connect` | `connect` |

Rows land in the Notion **Fan Leads** database with `Status = New`.

Two environment variables are required — set them in **Netlify → Site settings →
Environment variables**, never in the repo:

- `NOTION_TOKEN`
- `FAN_LEADS_DB_ID`

The Notion integration must also be **shared with the Fan Leads database**. If it
isn't, Notion answers 404, and the visitor just sees a generic save error — so verify
with one real submission after any credential change.

Run the tests with no runner and no network:

```bash
node tests/lead.test.mjs
```

They stub `fetch`, so every branch executes and the exact body that *would* be sent to
Notion is asserted — including that a spoofed `source` in the request body is ignored.

---

## Deploy

Production deploys to **Netlify** from `main` (auto-detects `netlify.toml`, no
build command). See **[DEPLOY.md](DEPLOY.md)** for the full setup: GitHub remote,
Netlify import, custom domain + DNS, pre-deploy checklist, rollback, and how
Render slots in when a backend is eventually added.

---

## Credits

Fonts via Google Fonts: **Unbounded** (display), **Space Mono** (labels), **Sora** (body).
Built for Astro Mahri. Signal from Durham, NC.
