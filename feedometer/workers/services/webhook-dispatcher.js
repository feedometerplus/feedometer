/**
 * workers/services/webhook-dispatcher.js — FeedOmeter Outbound Webhook Dispatcher
 * HMAC-SHA256 Payload Signing, Subrequest Capped Parallel Delivery, and Retry Handling
 */

/**
 * Compute HMAC-SHA256 signature string for a webhook payload
 */
export async function generateHmacSignature(secretKey, payloadString) {
  const enc = new TextEncoder();
  const keyData = enc.encode(secretKey || '');
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadString || ''));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Atomically claim pending webhook delivery tasks
 */
export async function claimPendingWebhookDeliveries(env, limit = 15, lockDurationMs = 60000) {
  if (!env.DB) return [];
  const now = Date.now();
  const lockExpires = now + lockDurationMs;

  try {
    const candidates = await env.DB.prepare(`
      SELECT wd.id, wd.webhook_id, wd.article_id, wd.payload_json, wd.attempt_count,
             uw.target_url, uw.secret_key
      FROM webhook_deliveries wd
      JOIN user_webhooks uw ON uw.id = wd.webhook_id
      WHERE (wd.status = 'pending' OR (wd.status = 'processing' AND wd.locked_until < ?))
        AND wd.attempt_count < 3
        AND uw.is_active = 1
      ORDER BY wd.created_at ASC
      LIMIT ?
    `).bind(now, limit).all();

    const rows = candidates.results || [];
    if (rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');

    await env.DB.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'processing', locked_until = ?
      WHERE id IN (${placeholders})
    `).bind(lockExpires, ...ids).run();

    return rows;
  } catch (err) {
    console.error('Error claiming webhook deliveries:', err.message);
    return [];
  }
}

/**
 * Dispatches a single webhook delivery with timeout and telemetry logging
 */
export async function executeSingleWebhookDelivery(env, delivery) {
  const startTime = Date.now();
  const payloadStr = typeof delivery.payload_json === 'string' 
    ? delivery.payload_json 
    : JSON.stringify(delivery.payload_json);

  let responseCode = 0;
  let responseBody = '';
  let errorMsg = null;
  let success = false;

  try {
    const signature = await generateHmacSignature(delivery.secret_key, payloadStr);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(delivery.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FeedOmeter-Webhook/2.1 (+https://feedometer.com)',
        'X-Feedometer-Signature-256': signature,
        'X-Feedometer-Event': 'article.matched',
        'X-Feedometer-Delivery-ID': delivery.id
      },
      body: payloadStr,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    responseCode = response.status;
    const rawText = await response.text();
    responseBody = rawText.slice(0, 500); // cap logged body length

    if (response.ok) {
      success = true;
    } else {
      errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    }
  } catch (err) {
    errorMsg = err.name === 'AbortError' ? 'Webhook delivery timed out after 6000ms' : err.message;
    responseCode = 0;
  }

  const durationMs = Date.now() - startTime;
  const now = Date.now();
  const nextAttemptCount = (delivery.attempt_count || 0) + 1;

  if (success) {
    await env.DB.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'delivered', response_code = ?, response_body = ?, duration_ms = ?, delivered_at = ?, locked_until = 0
      WHERE id = ?
    `).bind(responseCode, responseBody, durationMs, now, delivery.id).run();
  } else {
    const finalStatus = nextAttemptCount >= 3 ? 'failed' : 'pending';
    await env.DB.prepare(`
      UPDATE webhook_deliveries 
      SET status = ?, attempt_count = ?, response_code = ?, response_body = ?, duration_ms = ?, locked_until = 0
      WHERE id = ?
    `).bind(finalStatus, nextAttemptCount, responseCode, errorMsg || responseBody, durationMs, delivery.id).run();
  }

  return { success, responseCode, durationMs, errorMsg };
}

/**
 * Dispatch a batch of pending webhook deliveries (Capped at 15 for Cloudflare Workers subrequest safety)
 */
export async function dispatchWebhookBatch(env, limit = 15) {
  if (!env.DB) return { delivered: 0, failed: 0 };
  const claimed = await claimPendingWebhookDeliveries(env, limit);
  if (claimed.length === 0) return { delivered: 0, failed: 0 };

  const results = await Promise.allSettled(
    claimed.map(item => executeSingleWebhookDelivery(env, item))
  );

  let delivered = 0;
  let failed = 0;
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.success) delivered++;
    else failed++;
  });

  return { total: claimed.length, delivered, failed };
}

/**
 * Test an arbitrary webhook endpoint with an instant verification ping
 */
export async function testWebhookEndpoint(targetUrl, secretKey) {
  const startTime = Date.now();
  const testPayload = JSON.stringify({
    event: 'endpoint.verified',
    timestamp: startTime,
    message: 'Hello from FeedOmeter Webhook Dispatcher! Your endpoint is verified and ready.',
    source: 'FeedOmeter Automation Engine'
  });

  try {
    const signature = await generateHmacSignature(secretKey, testPayload);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FeedOmeter-Webhook/2.1 (+https://feedometer.com)',
        'X-Feedometer-Signature-256': signature,
        'X-Feedometer-Event': 'endpoint.verified'
      },
      body: testPayload,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const body = (await res.text()).slice(0, 300);

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      durationMs,
      responsePreview: body
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      statusText: err.name === 'AbortError' ? 'Connection timed out (6s)' : err.message,
      durationMs: Date.now() - startTime,
      error: err.message
    };
  }
}
