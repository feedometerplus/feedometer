/**
 * Feedometer API base URL (Cloudflare Worker).
 * Always prefer the deployed Worker so local file/Pages preview can fetch RSS.
 * Optional: run `npx wrangler dev` — the reader will try 8787 first, then production.
 */
(function (global) {
  'use strict';

  var PRODUCTION_API = 'https://feedometer-api.feedometer.workers.dev';
  var host = global.location && global.location.hostname;

  global.FEEDOMETER_API_BASE = PRODUCTION_API.replace(/\/$/, '');
  global.FEEDOMETER_LOCAL_API = (host === 'localhost' || host === '127.0.0.1')
    ? 'http://127.0.0.1:8787'
    : '';
})(typeof window !== 'undefined' ? window : this);
