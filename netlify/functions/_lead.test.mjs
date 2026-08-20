/**
 * Exercises the lead handler without touching Notion.
 *
 *   node site/netlify/functions/_lead.test.mjs
 *
 * The Notion write is intercepted by stubbing global fetch, so every branch
 * runs and the exact request body that WOULD be sent is captured and
 * asserted. That is what makes the source-spoofing claim checkable rather
 * than merely stated.
 */

import { makeLeadHandler } from './_lead.mjs';

process.env.NOTION_TOKEN = 'ntn_test';
process.env.FAN_LEADS_DB_ID = 'fac628415e344c30b5a95e8ea034caf9';

let captured = null;
let nextResponse = { ok: true, status: 200, body: { id: 'page_123' } };

globalThis.fetch = async (url, init) => {
  captured = { url, body: JSON.parse(init.body), headers: init.headers };
  return {
    ok: nextResponse.ok,
    status: nextResponse.status,
    json: async () => nextResponse.body,
    text: async () => JSON.stringify(nextResponse.body),
  };
};

// Silence expected warn/error noise so failures stand out.
const realWarn = console.warn, realErr = console.error, realLog = console.log;
console.warn = () => {}; console.error = () => {}; console.log = () => {};

// Each call gets a distinct IP by default. Sharing one would let the rate
// limiter starve later assertions of their Notion write, which is exactly
// what happened the first time this ran -- the failure looked like a schema
// bug and was really cross-test interference. Rate limiting is pinned to a
// fixed IP in its own section below.
let ipSeq = 0;
const post = (handler, body, headers = {}) => handler(new Request('https://astromahri.com/api/lead/x', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-nf-client-connection-ip': `203.0.113.${(ipSeq += 1) % 250}`,
    ...headers,
  },
  body: JSON.stringify(body),
}));

const website = makeLeadHandler('website');
const connect = makeLeadHandler('connect');

const older = () => Date.now() - 30_000;
let pass = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { pass += 1; realLog(`  ok    ${label}`); }
  else { fail += 1; realLog(`  FAIL  ${label} ${extra}`); }
}

realLog('\nlead handler\n' + '='.repeat(58));

// ---------- source integrity ----------
realLog('\nSOURCE INTEGRITY');

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', t: older() });
check('website endpoint tags source=website', captured?.body.properties.Source.select.name === 'website');

captured = null;
await post(connect, { name: 'Ada', email: 'ada@example.com', t: older() });
check('connect endpoint tags source=connect', captured?.body.properties.Source.select.name === 'connect');

// The whole point: client-supplied source must be ignored, not honoured.
captured = null;
await post(connect, {
  name: 'Ada', email: 'ada@example.com', t: older(),
  source: 'website', Source: 'website', properties: { Source: { select: { name: 'website' } } },
});
check('client-supplied source is ignored', captured?.body.properties.Source.select.name === 'connect',
  `got ${captured?.body.properties.Source.select.name}`);

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', t: older(), source: 'other' });
check('client cannot inject an unrelated option', captured?.body.properties.Source.select.name === 'website');

check('an invalid source constant fails at load, not at request time',
  (() => { try { makeLeadHandler('Website'); return false; } catch { return true; } })());

// ---------- schema discipline ----------
realLog('\nSCHEMA');

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', note: 'met at Lore Con', t: older() });
const props = Object.keys(captured.body.properties).sort();
check('sends only the five known properties',
  JSON.stringify(props) === JSON.stringify(['Email', 'Name', 'Note', 'Source', 'Status']), props.join(','));
check('Status is New on insert', captured.body.properties.Status.select.name === 'New');
check('parent is the database id', captured.body.parent.database_id === process.env.FAN_LEADS_DB_ID);
check('Submitted is never sent', !('Submitted' in captured.body.properties));

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', t: older() });
check('Note omitted entirely when empty', !('Note' in captured.body.properties));

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', note: '   ', t: older() });
check('whitespace-only note omitted', !('Note' in captured.body.properties));

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com', nickname: 'x', Tags: ['y'], t: older() });
check('unknown client fields never reach Notion',
  !('nickname' in captured.body.properties) && !('Tags' in captured.body.properties));

// ---------- validation ----------
realLog('\nVALIDATION');

let r = await post(website, { email: 'ada@example.com', t: older() });
check('missing name rejected 400', r.status === 400);

r = await post(website, { name: 'Ada', t: older() });
check('missing email rejected 400', r.status === 400);

r = await post(website, { name: 'Ada', email: 'not-an-email', t: older() });
check('malformed email rejected 400', r.status === 400);

captured = null;
await post(website, { name: 'A'.repeat(500), email: 'ada@example.com', note: 'N'.repeat(9000), t: older() });
check('name capped at 100', captured.body.properties.Name.title[0].text.content.length === 100);
check('note capped at 2000', captured.body.properties.Note.rich_text[0].text.content.length === 2000);

r = await website(new Request('https://x/', { method: 'GET' }));
check('GET rejected 405', r.status === 405);

// ---------- spam gates ----------
realLog('\nSPAM GATES');

captured = null;
r = await post(website, { name: 'Bot', email: 'b@example.com', company: 'ACME', t: older() });
check('honeypot blocks the write', captured === null);
check('honeypot still returns 200 (bots learn nothing)', r.status === 200);

captured = null;
r = await post(website, { name: 'Bot', email: 'b@example.com', t: Date.now() });
check('sub-2s submission blocked', captured === null);

captured = null;
await post(website, { name: 'Ada', email: 'ada@example.com' });
check('missing timestamp still allowed (JS-disabled visitor)', captured !== null);

// ---------- failure handling ----------
realLog('\nFAILURE HANDLING');

nextResponse = { ok: false, status: 404, body: { message: 'object_not_found' } };
r = await post(website, { name: 'Ada', email: 'ada@example.com', t: older() }, { 'x-nf-client-connection-ip': '198.51.100.1' });
check('Notion 404 surfaces as 502, not success', r.status === 502);
check('failure body carries no success flag', (await r.json()).ok === undefined);

nextResponse = { ok: true, status: 200, body: { id: 'page_123' } };

// ---------- rate limiting ----------
realLog('\nRATE LIMITING');

const ip = { 'x-nf-client-connection-ip': '198.51.100.77' };
let limited = 0;
for (let i = 0; i < 8; i += 1) {
  const rr = await post(website, { name: `A${i}`, email: `a${i}@example.com`, t: older() }, ip);
  if (rr.status === 429) limited += 1;
}
check('burst from one IP gets limited', limited > 0, `${limited} of 8 blocked`);

const fresh = await post(website, { name: 'Ada', email: 'ada@example.com', t: older() },
  { 'x-nf-client-connection-ip': '198.51.100.200' });
check('a different IP is unaffected', fresh.status === 200);

console.warn = realWarn; console.error = realErr; console.log = realLog;
realLog('\n' + '='.repeat(58));
realLog(`${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
