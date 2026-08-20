// POST /api/lead/website  ->  Fan Leads row with Source "website"
//
// The source constant lives here as a literal. _lead.mjs never reads it from
// the request, so a client cannot change or omit it.

import { makeLeadHandler } from './_lead.mjs';

export default makeLeadHandler('website');

export const config = { path: '/api/lead/website' };
