// POST /api/lead/connect  ->  Fan Leads row with Source "connect"
//
// Hit by the form at astromahri.com/connect, which is the NFC tag
// destination. The source constant lives here as a literal. _lead.mjs never
// reads it from the request, so a client cannot change or omit it.

import { makeLeadHandler } from './_lead.mjs';

export default makeLeadHandler('connect');

export const config = { path: '/api/lead/connect' };
