/**
 * test_api_key_auth.mjs — Comprehensive Unit Tests for API Key Authentication, Expiration & KV Rate Limiting
 */
import { hashApiKey, extractApiKey, verifyApiKey } from './workers/middleware/api-key-auth.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('🧪 API KEY AUTHENTICATION & SECURITY TEST SUITE');
console.log('======================================================================\n');

// 1. Test Key Hashing & Extraction
console.log('1. Testing Key Extraction & Cryptographic SHA-256 Hashing:');
const testKey = 'fom_live_a1b2c3d4e5f67890123456789abcdef0';
const reqBearer = new Request('https://api.feedometer.com/api/v1/articles', {
  headers: { 'Authorization': `Bearer ${testKey}` }
});
assert(extractApiKey(reqBearer) === testKey, 'Extracts key from Authorization Bearer header');

const reqXKey = new Request('https://api.feedometer.com/api/v1/articles', {
  headers: { 'X-API-Key': testKey }
});
assert(extractApiKey(reqXKey) === testKey, 'Extracts key from X-API-Key header');

const reqQuery = new Request(`https://api.feedometer.com/api/v1/articles?api_key=${testKey}`);
assert(extractApiKey(reqQuery) === testKey, 'Extracts key from query parameter fallback');

const reqInvalid = new Request('https://api.feedometer.com/api/v1/articles', {
  headers: { 'Authorization': 'Bearer invalid_prefix_key' }
});
assert(extractApiKey(reqInvalid) === null, 'Rejects keys not starting with fom_live_');

const hash1 = await hashApiKey(testKey);
const hash2 = await hashApiKey(testKey);
assert(typeof hash1 === 'string' && hash1.length === 64, `Hash is 64-char hex string: ${hash1.slice(0, 16)}...`);
assert(hash1 === hash2, 'Hash is deterministic and repeatable');

const hashDiff = await hashApiKey('fom_live_different_key_1234567890');
assert(hash1 !== hashDiff, 'Different keys produce distinct hashes');

// 2. Test Verification with In-Memory Mock D1
console.log('\n2. Testing Mock D1 Verification & Scope Validation:');

const mockKeyRow = {
  id: 'key_test_001',
  user_id: 'usr_enterprise_1',
  name: 'Data Pipeline',
  key_prefix: 'fom_live_a1b2',
  key_suffix: '9abcdef0',
  permissions: JSON.stringify(['read:articles', 'read:sources']),
  rate_limit_per_min: 5,
  last_used_at: null,
  expires_at: null,
  is_active: 1
};

const mockDb = {
  prepare: (sql) => ({
    bind: (...args) => ({
      first: async () => {
        if (args[0] === hash1) return { ...mockKeyRow };
        return null;
      },
      run: async () => ({ meta: { changes: 1 } })
    })
  })
};

const mockKv = new Map();
const mockKvStore = {
  get: async (k) => mockKv.get(k) || null,
  put: async (k, v, opts) => mockKv.set(k, v)
};

const mockEnv = { DB: mockDb, FEEDS_KV: mockKvStore };

// Valid authentication
const authValid = await verifyApiKey(reqBearer, mockEnv, 'read:articles');
assert(authValid.valid === true, 'Valid API key authenticates successfully');
assert(authValid.userId === 'usr_enterprise_1', 'Resolves authenticated user ID');

// Scope verification
const authScopeForbidden = await verifyApiKey(reqBearer, mockEnv, 'write:me');
assert(authScopeForbidden.valid === false && authScopeForbidden.status === 403, 'Rejects request missing required scope (403 Forbidden)');

// Invalid key
const reqBadKey = new Request('https://api.feedometer.com/api/v1/articles', {
  headers: { 'Authorization': 'Bearer fom_live_unknown_key_99999999999999' }
});
const authInvalid = await verifyApiKey(reqBadKey, mockEnv);
assert(authInvalid.valid === false && authInvalid.status === 401, 'Rejects unknown key with 401 Unauthorized');

// 3. Test Expiration
console.log('\n3. Testing Key Expiration:');
const mockExpiredKey = {
  ...mockKeyRow,
  expires_at: Date.now() - 10000 // Expired 10s ago
};
const mockDbExpired = {
  prepare: () => ({
    bind: () => ({
      first: async () => mockExpiredKey,
      run: async () => {}
    })
  })
};
const authExpired = await verifyApiKey(reqBearer, { DB: mockDbExpired, FEEDS_KV: mockKvStore });
assert(authExpired.valid === false && authExpired.status === 401, 'Rejects expired API key with 401');
assert(authExpired.error.includes('expired'), 'Error message specifies key expiration');

// 4. Test KV Rate Limiter
console.log('\n4. Testing Zero-Lock KV Rate Limiter:');
mockKv.clear(); // Reset KV

// Send 5 requests (within rate limit of 5)
for (let i = 1; i <= 5; i++) {
  const res = await verifyApiKey(reqBearer, mockEnv, 'read:articles');
  assert(res.valid === true, `Request ${i}/5 allowed under limit`);
}

// 6th request should hit rate limit (429)
const resRateLimited = await verifyApiKey(reqBearer, mockEnv, 'read:articles');
assert(resRateLimited.valid === false && resRateLimited.status === 429, '6th request blocked by KV rate limiter (429 Rate Limit Exceeded)');
assert(resRateLimited.retryAfter === 60, 'Rate limit response includes Retry-After: 60');

console.log('\n======================================================================');
console.log(`🎉 API KEY AUTH RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) process.exit(1);
