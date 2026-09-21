/**
 * workers/modules/webhooks.js — FeedOmeter Outbound Webhooks HTTP Route Handlers
 */
import { verifySessionToken } from '../lib/session.js';
import { generateRandomHex } from '../lib/crypto.js';
import { jsonResponse, errorResponse } from '../lib/response.js';
import { testWebhookEndpoint } from '../services/webhook-dispatcher.js';

export async function handleListWebhooks(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    const rows = await env.DB.prepare(`
      SELECT uw.id, uw.name, uw.target_url, uw.secret_key, uw.config_json, uw.is_active, uw.created_at,
             COUNT(wd.id) as total_deliveries,
             SUM(CASE WHEN wd.status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
             MAX(wd.delivered_at) as last_delivered_at
      FROM user_webhooks uw
      LEFT JOIN webhook_deliveries wd ON wd.webhook_id = uw.id
      WHERE uw.user_id = ?
      GROUP BY uw.id
      ORDER BY uw.created_at DESC
    `).bind(session.userId).all();

    const webhooks = (rows.results || []).map(w => {
      let config = {};
      try { config = JSON.parse(w.config_json || '{}'); } catch (_) {}
      return {
        id: w.id,
        name: w.name,
        target_url: w.target_url,
        secret_key: w.secret_key,
        config,
        is_active: Boolean(w.is_active),
        created_at: w.created_at,
        stats: {
          total: w.total_deliveries || 0,
          successful: w.successful_deliveries || 0,
          last_delivered_at: w.last_delivered_at
        }
      };
    });

    return jsonResponse({ status: 'success', webhooks });
  } catch (err) {
    return errorResponse('Failed to list webhooks: ' + err.message, 500);
  }
}

export async function handleCreateWebhook(request, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    const body = await request.json();
    const name = String(body.name || 'My Webhook').trim();
    const targetUrl = String(body.target_url || body.targetUrl || body.url || '').trim();
    const config = body.config || body.config_json || {};

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return errorResponse('A valid HTTP/HTTPS target URL is required', 400);
    }

    const webhookId = `whk_${generateRandomHex(12)}`;
    const secretKey = `whsec_${generateRandomHex(24)}`;
    const configJson = typeof config === 'string' ? config : JSON.stringify(config);
    const now = Date.now();

    await env.DB.prepare(`
      INSERT INTO user_webhooks (id, user_id, name, target_url, secret_key, config_json, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).bind(webhookId, session.userId, name, targetUrl, secretKey, configJson, now).run();

    return jsonResponse({
      status: 'success',
      message: 'Webhook created successfully',
      webhook: {
        id: webhookId,
        name,
        target_url: targetUrl,
        secret_key: secretKey,
        config: typeof config === 'object' ? config : {},
        is_active: true,
        created_at: now
      }
    }, 201);
  } catch (err) {
    return errorResponse('Failed to create webhook: ' + err.message, 500);
  }
}

export async function handleUpdateWebhook(request, webhookId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    const body = await request.json();
    const webhook = await env.DB.prepare('SELECT id FROM user_webhooks WHERE id = ? AND user_id = ?')
      .bind(webhookId, session.userId).first();
    if (!webhook) return errorResponse('Webhook not found', 404, 'NOT_FOUND');

    const updates = [];
    const values = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(String(body.name).trim());
    }
    if (body.target_url !== undefined) {
      updates.push('target_url = ?');
      values.push(String(body.target_url).trim());
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
    }
    if (body.config !== undefined || body.config_json !== undefined) {
      updates.push('config_json = ?');
      values.push(JSON.stringify(body.config || body.config_json || {}));
    }

    if (updates.length > 0) {
      values.push(webhookId, session.userId);
      await env.DB.prepare(`UPDATE user_webhooks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...values).run();
    }

    return jsonResponse({ status: 'success', message: 'Webhook updated successfully' });
  } catch (err) {
    return errorResponse('Failed to update webhook: ' + err.message, 500);
  }
}

export async function handleDeleteWebhook(request, webhookId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    await env.DB.prepare('DELETE FROM user_webhooks WHERE id = ? AND user_id = ?')
      .bind(webhookId, session.userId).run();
    return jsonResponse({ status: 'success', message: 'Webhook deleted successfully' });
  } catch (err) {
    return errorResponse('Failed to delete webhook: ' + err.message, 500);
  }
}

export async function handleTestWebhook(request, webhookId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    let targetUrl = '';
    let secretKey = '';

    if (webhookId === 'direct') {
      const body = await request.json();
      targetUrl = body.target_url || body.url;
      secretKey = body.secret_key || 'test_secret';
    } else {
      const webhook = await env.DB.prepare('SELECT target_url, secret_key FROM user_webhooks WHERE id = ? AND user_id = ?')
        .bind(webhookId, session.userId).first();
      if (!webhook) return errorResponse('Webhook not found', 404, 'NOT_FOUND');
      targetUrl = webhook.target_url;
      secretKey = webhook.secret_key;
    }

    const testResult = await testWebhookEndpoint(targetUrl, secretKey);
    return jsonResponse({ status: 'success', result: testResult });
  } catch (err) {
    return errorResponse('Webhook test failed: ' + err.message, 500);
  }
}

export async function handleGetWebhookLogs(request, webhookId, env) {
  const session = await verifySessionToken(request, env);
  if (!session) return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  if (!env.DB) return errorResponse('Database unavailable', 500);

  try {
    const logs = await env.DB.prepare(`
      SELECT wd.id, wd.article_id, wd.status, wd.response_code, wd.duration_ms, wd.delivered_at, wd.created_at, wd.response_body,
             a.title as article_title, a.url as article_url
      FROM webhook_deliveries wd
      JOIN user_webhooks uw ON uw.id = wd.webhook_id
      LEFT JOIN articles a ON a.id = wd.article_id
      WHERE wd.webhook_id = ? AND uw.user_id = ?
      ORDER BY wd.created_at DESC
      LIMIT 30
    `).bind(webhookId, session.userId).all();

    return jsonResponse({ status: 'success', logs: logs.results || [] });
  } catch (err) {
    return errorResponse('Failed to fetch webhook logs: ' + err.message, 500);
  }
}
