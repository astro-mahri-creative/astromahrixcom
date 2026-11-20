/**
 * Exercises the check-in reply handler without touching Notion.
 *
 *   node tests/checkin-reply.test.mjs
 *
 * The Notion write is intercepted by stubbing global fetch, so the exact
 * request body that WOULD be sent is captured and asserted.
 */

import assert from 'node:assert/strict';
import { handler, tokenOk } from '../netlify/lib/checkin-reply.mjs';

process.env.CHECKIN_REPLY_TOKEN = 'reply-secret-123';
process.env.NOTION_TOKEN = 'ntn_test';
process.env.JOURNAL_DB_ID = '3ee42266c22c434283b74f6daceff664';

let captured = null;
let nextOk = true;
globalThis.fetch = async (url, init) => {
  captured = { url, body: JSON.parse(init.body) };
  return { ok: nextOk, status: nextOk ? 200 : 404, json: async () => ({ id: 'p1' }), text: async () => '{}' };
};
console.error = () => {};

const BASE = 'https://astromahri.com/checkin/reply';
const get = (qs) => handler(new Request(`${BASE}${qs}`));
const post = (fields) => handler(new Request(BASE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
}));

let passed = 0;
async function check(name, fn) {
  captured = null; nextOk = true;
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
}

await check('token compare: right token yes, wrong or empty no', () => {
  assert.equal(tokenOk('reply-secret-123', 'reply-secret-123'), true);
  assert.equal(tokenOk('reply-secret-12', 'reply-secret-123'), false);
  assert.equal(tokenOk('', 'reply-secret-123'), false);
});

await check('GET with the token shows the form, private headers set', async () => {
  const r = await get('?t=reply-secret-123&k=seed');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /What are you up to\?/);
  assert.match(html, /name="k" value="seed"/);
  assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.match(r.headers.get('X-Robots-Tag'), /noindex/);
});

await check('GET without or with a wrong token is a plain 404', async () => {
  assert.equal((await get('')).status, 404);
  assert.equal((await get('?t=nope&k=open')).status, 404);
});

await check('POST with the token writes one Check-in Reply row to the Journal', async () => {
  const r = await post({ t: 'reply-secret-123', k: 'unfinished', text: '  Finished the Javelin   verse  ' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Got it\./);
  assert.equal(captured.url, 'https://api.notion.com/v1/pages');
  assert.deepEqual(captured.body.parent, { database_id: '3ee42266c22c434283b74f6daceff664' });
  const p = captured.body.properties;
  assert.equal(p.Idea.title[0].text.content, 'Finished the Javelin verse');
  assert.equal(p.Entry.select.name, 'Check-in Reply');
  assert.equal(p['Check-in Kind'].select.name, 'Unfinished');
  assert.ok(Date.parse(p.Captured.date.start));
});

await check('a session note ping gets the session heading and saves with Check-in Kind Session', async () => {
  const g = await get('?t=reply-secret-123&k=session');
  assert.match(await g.text(), /Jot it down/);
  await post({ t: 'reply-secret-123', k: 'session', text: 'Bridge chords finally sit right' });
  assert.equal(captured.body.properties['Check-in Kind'].select.name, 'Session');
  assert.equal(captured.body.properties.Entry.select.name, 'Check-in Reply');
});

await check('the question from the push is the heading and is saved in the row body', async () => {
  const g = await get('?t=reply-secret-123&k=session&q=' + encodeURIComponent('Stuck on anything? Even a word helps.'));
  const html = await g.text();
  assert.match(html, /<h1>Stuck on anything\? Even a word helps\.<\/h1>/);
  assert.match(html, /name="q" value="Stuck on anything\? Even a word helps\."/);
  await post({ t: 'reply-secret-123', k: 'session', q: 'Stuck on anything? Even a word helps.', text: 'The hook transition' });
  assert.deepEqual(captured.body.children, [{ object: 'block', type: 'quote', quote: { rich_text: [{ type: 'text', text: { content: 'Stuck on anything? Even a word helps.' } }] } }]);
  assert.equal(captured.body.properties.Idea.title[0].text.content, 'The hook transition');
});

await check('a question is escaped on the page and capped at 200 characters', async () => {
  const g = await get('?t=reply-secret-123&k=open&q=' + encodeURIComponent('<script>x</script>'));
  const html = await g.text();
  assert.ok(!html.includes('<script>x'));
  await post({ t: 'reply-secret-123', k: 'open', q: 'y'.repeat(400), text: 'hi' });
  assert.equal(captured.body.children[0].quote.rich_text[0].text.content.length, 200);
});

await check('no question: no body, and the kind heading is shown', async () => {
  const g = await get('?t=reply-secret-123&k=open');
  assert.match(await g.text(), /What are you up to\?/);
  await post({ t: 'reply-secret-123', k: 'open', text: 'hi' });
  assert.equal(captured.body.children, undefined);
});

await check('POST with a wrong token writes nothing', async () => {
  const r = await post({ t: 'guess', k: 'open', text: 'hello' });
  assert.equal(r.status, 404);
  assert.equal(captured, null);
});

await check('unknown kind is stored without a kind, never invented', async () => {
  await post({ t: 'reply-secret-123', k: 'Hacked Option', text: 'hi' });
  assert.equal(captured.body.properties['Check-in Kind'], undefined);
});

await check('empty text re-shows the form; long text is capped at 500', async () => {
  const r = await post({ t: 'reply-secret-123', k: 'open', text: '   ' });
  assert.equal(r.status, 400);
  assert.equal(captured, null);
  await post({ t: 'reply-secret-123', k: 'open', text: 'x'.repeat(900) });
  assert.equal(captured.body.properties.Idea.title[0].text.content.length, 500);
});

await check('HTML in the reply is escaped when the form re-renders', async () => {
  nextOk = false;
  const r = await post({ t: 'reply-secret-123', k: 'open', text: '<script>alert(1)</script>' });
  const html = await r.text();
  assert.ok(!html.includes('<script>alert'));
  assert.match(html, /&lt;script&gt;/);
});

await check('missing configuration hides the page entirely', async () => {
  const saved = process.env.JOURNAL_DB_ID;
  delete process.env.JOURNAL_DB_ID;
  assert.equal((await get('?t=reply-secret-123')).status, 404);
  process.env.JOURNAL_DB_ID = saved;
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
