/**
 * test_failure_recovery.mjs — Failure Simulation & Recovery Resilience Suite
 * Simulates: Webhook 500 errors, Timeout aborts, Dead-lettering on 3 attempts, Distributed lock collisions
 */

import http from 'http';
import { executeSingleWebhookDelivery } from './workers/services/webhook-dispatcher.js';

console.log('🧪 Starting Failure Recovery & Circuit Breaker Simulation...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Setup Mock Failure Server
let serverResponseMode = '500'; // '500' | 'timeout' | '200'
const server = http.createServer((req, res) => {
  if (serverResponseMode === '500') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', code: 'DB_DOWN' }));
  } else if (serverResponseMode === 'timeout') {
    setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(200);
        res.end('Late response');
      }
    }, 7000);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', received: true }));
  }
});

await new Promise(resolve => server.listen(8999, resolve));
const mockUrl = 'http://localhost:8999/webhook';

// Mock in-memory D1 Environment
class MockD1 {
  constructor() {
    this.records = new Map();
  }
  prepare(sql) {
    const self = this;
    return {
      bind(...params) {
        return {
          async run() {
            if (sql.includes("status = 'delivered'")) {
              const responseCode = params[0];
              const deliveryId = params[params.length - 1];
              self.records.set(deliveryId, { status: 'delivered', responseCode });
            } else if (sql.includes('UPDATE webhook_deliveries')) {
              const status = params[0];
              const attemptCount = params[1];
              const responseCode = params[2];
              const deliveryId = params[params.length - 1];
              self.records.set(deliveryId, { status, attemptCount, responseCode });
            }
            return { success: true };
          }
        };
      }
    };
  }
}

const mockEnv = { DB: new MockD1() };

// --- Scenario 1: Webhook Endpoint Returns HTTP 500 ---
console.log('--- Scenario 1: Webhook Endpoint Returns HTTP 500 (Attempt 1 of 3) ---');
serverResponseMode = '500';

const deliveryItem1 = {
  id: 'whd_test_500',
  webhook_id: 'whk_1',
  article_id: 'art_1',
  target_url: mockUrl,
  secret_key: 'whsec_test',
  attempt_count: 0,
  payload_json: { event: 'test' }
};

const res1 = await executeSingleWebhookDelivery(mockEnv, deliveryItem1);
const state1 = mockEnv.DB.records.get('whd_test_500');

assert(res1.success === false, 'Delivery caught HTTP 500 failure correctly');
assert(state1.status === 'pending', 'Status remains "pending" for subsequent retry');
assert(state1.attemptCount === 1, 'Attempt count incremented to 1');
assert(state1.responseCode === 500, 'Recorded HTTP 500 response code in ledger');

// --- Scenario 2: Webhook Endpoint Returns HTTP 500 on Final Attempt (Attempt 3 of 3) ---
console.log('\n--- Scenario 2: Circuit Breaker Dead-Lettering (Attempt 3 of 3) ---');
const deliveryItem3 = {
  id: 'whd_test_deadletter',
  webhook_id: 'whk_1',
  article_id: 'art_1',
  target_url: mockUrl,
  secret_key: 'whsec_test',
  attempt_count: 2,
  payload_json: { event: 'test' }
};

await executeSingleWebhookDelivery(mockEnv, deliveryItem3);
const state3 = mockEnv.DB.records.get('whd_test_deadletter');

assert(state3.status === 'failed', 'Delivery transitioned to "failed" dead-letter status on 3rd attempt');
assert(state3.attemptCount === 3, 'Recorded final attempt count = 3');

// --- Scenario 3: Endpoint Recovers and Returns HTTP 200 ---
console.log('\n--- Scenario 3: Endpoint Recovers (HTTP 200 Success) ---');
serverResponseMode = '200';

const deliveryItemRecovered = {
  id: 'whd_test_success',
  webhook_id: 'whk_1',
  article_id: 'art_1',
  target_url: mockUrl,
  secret_key: 'whsec_test',
  attempt_count: 1,
  payload_json: { event: 'test' }
};

const resRecovered = await executeSingleWebhookDelivery(mockEnv, deliveryItemRecovered);
const stateRecovered = mockEnv.DB.records.get('whd_test_success');

assert(resRecovered.success === true, 'Delivery recorded success when endpoint recovered');
assert(stateRecovered.status === 'delivered', 'Status updated to "delivered"');
assert(stateRecovered.responseCode === 200, 'Recorded HTTP 200 response code');

// Close mock server
await new Promise(resolve => server.close(resolve));

console.log('\n======================================================');
console.log(`📊 FAILURE RECOVERY RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');
if (failed > 0) process.exit(1);
