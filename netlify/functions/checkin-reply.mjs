// GET/POST /checkin/reply  ->  one-line reply to an astro-ops check-in,
// saved to Artist Journal Intake. Token-gated; see lib/checkin-reply.mjs.

import { handler } from '../lib/checkin-reply.mjs';

export default handler;

export const config = { path: '/checkin/reply' };
