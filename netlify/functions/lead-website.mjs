// POST /api/lead/website  ->  Fan Leads row with Source "website"
//
// The source constant lives here as a literal. lib/lead.mjs never reads it from
// the request, so a client cannot change or omit it.

import { makeLeadHandler } from '../lib/lead.mjs';

export default makeLeadHandler('website');

export const config = { path: '/api/lead/website' };
