/**
 * Shared handler for the Fan Leads capture endpoints.
 *
 * SOURCE INTEGRITY — the reason this file exists.
 *
 * `source` is a parameter of makeLeadHandler, supplied by the endpoint module
 * that imports it. It is a literal constant in lead-website.mjs and
 * lead-connect.mjs. It is never read from the request body, the query string,
 * a header, or any other client-controlled surface. There is no code path in
 * this file that can assign `source` from input, so a crafted POST to either
 * endpoint cannot change the tag it receives. The endpoint you hit IS the tag.
 *
 * Native Notion forms were tried first and cannot do this: the form builder
 * has no hidden-field or default-value option, and form submissions do not
 * inherit database-template property values (verified by test submission --
 * both rows arrived with Source and Status empty).
 */

const NOTION_API = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28';

// Must match the Fan Leads select options exactly. Notion silently CREATES a
// new select option for an unrecognised value rather than rejecting it, which
// would quietly pollute the property, so the allowed set is pinned here and
// checked before any write.
const VALID_SOURCES = new Set(['website', 'connect', 'event', 'other']);
const STATUS_ON_INSERT = 'New';

const LIMITS = { name: 100, email: 254, note: 2000 };

// Best-effort in-process rate limit. Serverless instances are recycled, so
// this is not a hard guarantee -- it stops a burst from one source, not a
// determined distributed attack. Good enough for a fan capture form; see
// README for the Netlify Blobs upgrade if abuse ever shows up.
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  seen.push(now);
  hits.set(ip, seen);
  // Keep the map from growing without bound across a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > RATE.windowMs) hits.delete(k);
    }
  }
  return seen.length > RATE.max;
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Deliberately permissive: reject what is clearly not an address, no more. */
function validEmail(v) {
  return typeof v === 'string'
    && v.length <= LIMITS.email
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function makeLeadHandler(source) {
  if (!VALID_SOURCES.has(source)) {
    // Fails at module load, not at request time, so a typo cannot ship.
    throw new Error(`Invalid source constant: ${source}`);
  }

  return async function handler(req) {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const token = process.env.NOTION_TOKEN;
    const database = process.env.FAN_LEADS_DB_ID;
    if (!token || !database) {
      console.error('[lead] misconfigured: NOTION_TOKEN or FAN_LEADS_DB_ID missing');
      return json(500, { error: 'Server not configured.' });
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: 'Expected JSON.' });
    }

    const ip = req.headers.get('x-nf-client-connection-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || 'unknown';

    // --- spam gates ---
    // Honeypot: a field hidden from humans. Anything filling it is automated.
    // Returns 200 so a bot cannot distinguish rejection from success and
    // start probing for the check.
    // The field is `subject_ref`, deliberately outside the autocomplete
    // vocabulary. It used to be `company`, which browsers and password
    // managers autofilled -- tripping this gate on real people and discarding
    // their submissions behind a success message. Do not name it after
    // anything a browser knows how to fill.
    if (clean(payload.subject_ref, 200)) {
      console.warn(`[lead] honeypot tripped source=${source} ip=${ip}`);
      return json(200, { ok: true });
    }

    // Humans do not complete a three-field form in under two seconds.
    //
    // `t` is stamped by the VISITOR's clock and compared against ours, so a
    // device running fast yields a negative elapsed -- which is also < 2000.
    // Treating that as "too fast" silently discarded the leads of anyone whose
    // clock was off. A negative value tells us nothing about how long they
    // spent, so it is not evidence of a bot: only a real, positive, implausibly
    // short duration is.
    const elapsed = Number(payload.t) ? Date.now() - Number(payload.t) : null;
    if (elapsed !== null && elapsed >= 0 && elapsed < 2000) {
      console.warn(`[lead] too fast (${elapsed}ms) source=${source} ip=${ip}`);
      return json(200, { ok: true });
    }

    if (rateLimited(ip)) {
      console.warn(`[lead] rate limited ip=${ip} source=${source}`);
      return json(429, { error: 'Too many submissions. Try again in a few minutes.' });
    }

    // --- validation ---
    const name = clean(payload.name, LIMITS.name);
    const email = clean(payload.email, LIMITS.email);
    const note = clean(payload.note, LIMITS.note);

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    if (!email) errors.email = 'Email is required.';
    else if (!validEmail(email)) errors.email = 'That does not look like an email address.';
    if (Object.keys(errors).length) return json(400, { error: 'Check the form.', fields: errors });

    // --- write ---
    // Only the five properties that already exist. Note is omitted entirely
    // when empty rather than sent as an empty array, so an absent note never
    // depends on how Notion handles a zero-length rich_text.
    const properties = {
      Name: { title: [{ text: { content: name } }] },
      Email: { email },
      Source: { select: { name: source } },
      Status: { select: { name: STATUS_ON_INSERT } },
    };
    if (note) properties.Note = { rich_text: [{ text: { content: note } }] };

    let res;
    try {
      res = await fetch(NOTION_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parent: { database_id: database }, properties }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      // Network failure or timeout. Never report success on an unwritten lead.
      console.error(`[lead] notion request failed source=${source}: ${e.message}`);
      return json(502, { error: 'Could not save that. Please try again.' });
    }

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[lead] notion write FAILED source=${source} status=${res.status} body=${detail}`);
      if (res.status === 404) {
        // Overwhelmingly the most common cause: the integration was never
        // granted access to the database. Named explicitly so it is not
        // mistaken for a bad database ID.
        console.error('[lead] 404 usually means the Notion integration lacks access to Fan Leads. Share the database with it.');
      }
      return json(502, { error: 'Could not save that. Please try again.' });
    }

    const page = await res.json();
    console.log(`[lead] created source=${source} page=${page.id}`);
    return json(200, { ok: true });
  };
}
