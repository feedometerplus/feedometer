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
  global.FEEDOMETER_GOOGLE_CLIENT_ID = '519822758554-19n3plblqq2nqago9r619kg5bi265674.apps.googleusercontent.com';
  global.FeedOmeterConfig = {
    API_BASE_URL: global.FEEDOMETER_API_BASE,
    WORKER_URL: global.FEEDOMETER_API_BASE,
    apiBaseUrl: global.FEEDOMETER_API_BASE,
    GOOGLE_CLIENT_ID: global.FEEDOMETER_GOOGLE_CLIENT_ID
  };
  global.FEEDOMETER_CONFIG = global.FeedOmeterConfig;
})(typeof window !== 'undefined' ? window : this);

