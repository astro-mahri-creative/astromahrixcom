/**
 * Check-in reply page: GET shows a one-line form, POST saves the line to
 * Artist Journal Intake as a "Check-in Reply" row.
 *
 * Who it is for: one person. Each check-in push from astro-ops links here
 * with ?t=<CHECKIN_REPLY_TOKEN>&k=<kind>. Without the right token the page
 * does not exist (404), and nothing is written. The token lives only in the
 * astro-ops GitHub Actions secrets and this site's Netlify environment.
 *
 * Why the headers matter: the token rides in the URL, so the page sends no
 * Referer anywhere, loads nothing external, and is never cached or indexed.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const NOTION_API = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28';
const MAX_TEXT = 500;

// Must match the Journal's "Check-in Kind" select options exactly: Notion
// silently creates a new option for an unknown value. The push sends the
// lowercase key; anything else is stored with no kind rather than invented.
const KINDS = { open: 'Open', unfinished: 'Unfinished', seed: 'Seed', task: 'Task', curious: 'Curious', session: 'Session' };
const ENTRY = 'Check-in Reply';

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

const digest = (s) => createHash('sha256').update(String(s)).digest();

/** Constant-time token check. Hashing first makes the lengths equal. */
export function tokenOk(given, expected) {
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(body, status = 200) {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Check-in</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f5f2; --fg:#151515; --muted:#666; --line:#d8d6d0; --accent:#151515; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --fg:#f2f2f2; --muted:#9a9a9a; --line:#333; --accent:#f2f2f2; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:17px/1.4 system-ui, -apple-system, sans-serif; }
  main { max-width:32rem; margin:0 auto; padding:2.5rem 1rem; }
  h1 { font-size:1.4rem; margin:0 0 .4rem; }
  p { color:var(--muted); margin:0 0 1.2rem; }
  textarea { box-sizing:border-box; width:100%; min-height:6rem; padding:.75rem; font:inherit; color:var(--fg); background:transparent; border:1px solid var(--line); border-radius:10px; }
  button { margin-top:.8rem; width:100%; padding:.8rem; font:inherit; font-weight:600; color:var(--bg); background:var(--accent); border:0; border-radius:10px; }
</style></head>
<body><main>${body}</main></body></html>`, { status, headers: HEADERS });
}

const notFound = () => new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });

// A note ping from an open session gets a session heading; check-ins get the general one.
const HEADINGS = {
  session: ['Jot it down', 'A few words is plenty. It lands in your journal with this session.'],
  default: ['What are you up to?', 'One line is plenty. "Still cooking" counts.'],
};

function form({ t, k, error = '', text = '' }) {
  const [h1, sub] = HEADINGS[String(k).toLowerCase()] || HEADINGS.default;
  return page(`
  <h1>${esc(h1)}</h1>
  <p>${esc(sub)}</p>
  <form method="post" action="/checkin/reply">
    <input type="hidden" name="t" value="${esc(t)}">
    <input type="hidden" name="k" value="${esc(k)}">
    <textarea name="text" maxlength="${MAX_TEXT}" required autofocus placeholder="Working on the Javelin verse...">${esc(text)}</textarea>
    ${error ? `<p role="alert">${esc(error)}</p>` : ''}
    <button type="submit">Send</button>
  </form>`, error ? 400 : 200);
}

export async function handler(req) {
  const expected = process.env.CHECKIN_REPLY_TOKEN;
  const token = process.env.NOTION_TOKEN;
  const database = process.env.JOURNAL_DB_ID;
  if (!expected || !token || !database) {
    console.error('[checkin-reply] misconfigured: CHECKIN_REPLY_TOKEN, NOTION_TOKEN or JOURNAL_DB_ID missing');
    return notFound();
  }

  if (req.method === 'GET') {
    const u = new URL(req.url);
    const t = u.searchParams.get('t') || '';
    if (!tokenOk(t, expected)) return notFound();
    return form({ t, k: u.searchParams.get('k') || '' });
  }
  if (req.method !== 'POST') return notFound();

  let fields;
  try {
    fields = new URLSearchParams(await req.text());
  } catch {
    return notFound();
  }
  const t = fields.get('t') || '';
  if (!tokenOk(t, expected)) return notFound();

  const k = (fields.get('k') || '').toLowerCase();
  const text = String(fields.get('text') || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  if (!text) return form({ t, k, error: 'Type a line first.' });

  const properties = {
    Idea: { title: [{ text: { content: text } }] },
    Entry: { select: { name: ENTRY } },
    Captured: { date: { start: new Date().toISOString() } },
  };
  if (KINDS[k]) properties['Check-in Kind'] = { select: { name: KINDS[k] } };

  let res;
  try {
    res = await fetch(NOTION_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: { database_id: database }, properties }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error(`[checkin-reply] notion request failed: ${e.message}`);
    return form({ t, k, text, error: 'Could not save that. Try again in a moment.' });
  }
  if (!res.ok) {
    console.error(`[checkin-reply] notion write FAILED status=${res.status} body=${await res.text()}`);
    if (res.status === 404) console.error('[checkin-reply] 404 usually means the Notion integration lacks access to Artist Journal Intake.');
    return form({ t, k, text, error: 'Could not save that. Try again in a moment.' });
  }
  return page(`<h1>Got it.</h1><p>Logged to your journal. Back to it.</p>`);
}
