/**
 * test_developer_keys.mjs — Comprehensive Unit Tests for Developer Key Management Module
 */
import { handleListApiKeys, handleCreateApiKey, handleRevokeApiKey } from './workers/modules/developer-keys.js';
import { hashApiKey } from './workers/middleware/api-key-auth.js';

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
console.log('🧪 DEVELOPER API KEYS MANAGEMENT TEST SUITE');
console.log('======================================================================\n');

const mockSessionUser = { userId: 'usr_dev_team_1', email: 'dev@company.com' };
const mockKeysDb = [];

const mockEnv = {
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM user_sessions')) {
            return {
              session_id: 'sess_1',
              user_id: 'usr_dev_team_1',
              email: 'dev@company.com',
              status: 'active',
              expires_at: Date.now() + 1000000
            };
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM api_keys')) {
            return {
              results: mockKeysDb.filter(k => k.user_id === args[0] && k.is_active === 1)
            };
          }
          return { results: [] };
        },
        run: async () => {
          if (sql.includes('INSERT INTO api_keys')) {
            const [id, user_id, name, key_prefix, key_suffix, key_hash, permissions, rate_limit_per_min, expires_at, created_at] = args;
            mockKeysDb.push({
              id, user_id, name, key_prefix, key_suffix, key_hash, permissions, rate_limit_per_min, expires_at, created_at, is_active: 1
            });
            return { meta: { changes: 1 } };
          }
          if (sql.includes('is_active = 0')) {
            const [revoked_at, id, user_id] = args;
            const key = mockKeysDb.find(k => k.id === id && k.user_id === user_id);
            if (key) {
              key.is_active = 0;
              key.revoked_at = revoked_at;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: 1 } };
        }
      })
    })
  }
};

// Create Mock Session Request
function createSessionRequest(url, method = 'GET', body = null) {
  const req = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test_session_token'
    },
    body: body ? JSON.stringify(body) : null
  });
  return req;
}

// 1. Test Key Creation with Expiration & Masking
console.log('1. Testing Key Creation (30-day expiration & prefix/suffix):');
const reqCreate = createSessionRequest('https://api.feedometer.com/api/developer/keys', 'POST', {
  name: 'Data Pipeline API Key',
  expires_in_days: 30,
  permissions: ['read:articles', 'read:sources', 'read:me']
});

const resCreate = await handleCreateApiKey(reqCreate, mockEnv);
const jsonCreate = await resCreate.json();

assert(resCreate.status === 201, 'Creates key with HTTP 201 Created');
assert(jsonCreate.status === 'success', 'Response status is success');
assert(jsonCreate.key.secret_token.startsWith('fom_live_'), 'Generates valid fom_live_ token');
assert(jsonCreate.key.key_prefix.startsWith('fom_live_'), 'Key prefix extracted');
assert(jsonCreate.key.key_suffix.length === 8, 'Key suffix is 8 characters');
assert(jsonCreate.key.masked_key.includes('••••••••'), 'Masked key hides middle secret characters');
assert(jsonCreate.key.expires_at > Date.now(), 'Calculated 30-day expiration timestamp in future');

// Verify stored in DB with SHA-256 hash (never plain text!)
const storedKey = mockKeysDb[0];
assert(storedKey.key_hash !== jsonCreate.key.secret_token, 'Database stores hash, NOT raw secret token');
const expectedHash = await hashApiKey(jsonCreate.key.secret_token);
assert(storedKey.key_hash === expectedHash, 'Database key_hash matches SHA-256 computation');

// 2. Test Key Listing (Masked Output)
console.log('\n2. Testing Key Listing:');
const reqList = createSessionRequest('https://api.feedometer.com/api/developer/keys', 'GET');
const resList = await handleListApiKeys(reqList, mockEnv);
const jsonList = await resList.json();

assert(resList.status === 200, 'Lists keys with HTTP 200');
assert(jsonList.count === 1, 'Returns 1 active key');
assert(jsonList.keys[0].secret_token === undefined, 'Never leaks raw secret_token in listing endpoint');
assert(jsonList.keys[0].masked_key !== undefined, 'Returns masked key identifier');

// 3. Test Key Revocation
console.log('\n3. Testing Key Revocation:');
const keyIdToRevoke = jsonCreate.key.id;
const reqRevoke = createSessionRequest(`https://api.feedometer.com/api/developer/keys/${keyIdToRevoke}`, 'DELETE');
const resRevoke = await handleRevokeApiKey(reqRevoke, mockEnv, keyIdToRevoke);
const jsonRevoke = await resRevoke.json();

assert(resRevoke.status === 200, 'Revokes key with HTTP 200');
assert(jsonRevoke.message.includes('revoked'), 'Success message confirms revocation');

// Listing should now be empty
const resListAfter = await handleListApiKeys(reqList, mockEnv);
const jsonListAfter = await resListAfter.json();
assert(jsonListAfter.count === 0, 'Revoked key is no longer in active list');

console.log('\n======================================================================');
console.log(`🎉 DEVELOPER KEYS MANAGEMENT: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) process.exit(1);
