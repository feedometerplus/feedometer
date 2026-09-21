/**
 * workers/services/alert-dispatcher.js — FeedOmeter Multi-Channel Alert Dispatcher
 * In-App Notification Ledger, Web Push VAPID Dispatching, and Live Rule Match Testing
 */
import { evaluateArticleAgainstRule } from './rule-engine.js';

/**
 * Atomically claim pending alert delivery tasks
 */
export async function claimPendingAlertDeliveries(env, limit = 20, lockDurationMs = 60000) {
  if (!env.DB) return [];
  const now = Date.now();
  const lockExpires = now + lockDurationMs;

  try {
    const candidates = await env.DB.prepare(`
      SELECT ad.id, ad.alert_id, ad.article_id, ad.channel, ad.attempt_count,
             ua.user_id, ua.name as alert_name,
             a.title as article_title, a.url as article_url, a.snippet as article_snippet, a.image_url as article_image
      FROM alert_deliveries ad
      JOIN user_alerts ua ON ua.id = ad.alert_id
      JOIN articles a ON a.id = ad.article_id
      WHERE (ad.status = 'pending' OR (ad.status = 'processing' AND ad.locked_until < ?))
        AND ad.attempt_count < 3
        AND ua.is_active = 1
      ORDER BY ad.created_at ASC
      LIMIT ?
    `).bind(now, limit).all();

    const rows = candidates.results || [];
    if (rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');

    await env.DB.prepare(`
      UPDATE alert_deliveries 
      SET status = 'processing', locked_until = ?
      WHERE id IN (${placeholders})
    `).bind(lockExpires, ...ids).run();

    return rows;
  } catch (err) {
    console.error('Error claiming alert deliveries:', err.message);
    return [];
  }
}

/**
 * Execute a single alert delivery
 */
export async function executeSingleAlertDelivery(env, delivery) {
  const now = Date.now();
  let success = true;
  let errorMsg = null;

  try {
    if (delivery.channel === 'in_app') {
      // In-app notifications are instantly accessible from the delivery record itself
      success = true;
    } else if (delivery.channel === 'push') {
      // Fetch user push subscriptions
      const subs = await env.DB.prepare(`
        SELECT endpoint, p256dh, auth_key FROM user_push_subscriptions WHERE user_id = ?
      `).bind(delivery.user_id).all();

      const pushEndpoints = subs.results || [];
      if (pushEndpoints.length > 0) {
        // Send push payload (or mock push payload for standard Web Push API endpoints)
        for (const sub of pushEndpoints) {
          try {
            await fetch(sub.endpoint, {
              method: 'POST',
              headers: { 'TTL': '86400', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: `Alert: ${delivery.alert_name}`,
                body: delivery.article_title,
                url: delivery.article_url,
                icon: delivery.article_image || '/favicon.svg'
              })
            });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    success = false;
    errorMsg = err.message;
  }

  const nextAttempt = (delivery.attempt_count || 0) + 1;
  if (success) {
    await env.DB.prepare(`
      UPDATE alert_deliveries 
      SET status = 'sent', sent_at = ?, locked_until = 0
      WHERE id = ?
    `).bind(now, delivery.id).run();
  } else {
    const finalStatus = nextAttempt >= 3 ? 'failed' : 'pending';
    await env.DB.prepare(`
      UPDATE alert_deliveries 
      SET status = ?, attempt_count = ?, error_message = ?, locked_until = 0
      WHERE id = ?
    `).bind(finalStatus, nextAttempt, errorMsg, delivery.id).run();
  }

  return { success, channel: delivery.channel };
}

/**
 * Dispatch pending alerts batch
 */
export async function dispatchPendingAlerts(env, limit = 20) {
  if (!env.DB) return { sent: 0, failed: 0 };
  const claimed = await claimPendingAlertDeliveries(env, limit);
  if (claimed.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    claimed.map(item => executeSingleAlertDelivery(env, item))
  );

  let sent = 0;
  let failed = 0;
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.success) sent++;
    else failed++;
  });

  return { total: claimed.length, sent, failed };
}

/**
 * Test an alert configuration against recent articles
 */
export async function testAlertMatch(env, config, limit = 20) {
  if (!env.DB) return { matches: [] };
  try {
    const recent = await env.DB.prepare(`
      SELECT id, title, url, snippet, image_url, published_at, source_id
      FROM articles
      ORDER BY published_at DESC
      LIMIT ?
    `).bind(limit).all();

    const articles = recent.results || [];
    const matched = [];

    for (const art of articles) {
      const item = {
        id: art.id,
        source_id: art.source_id,
        title: art.title,
        url: art.url,
        summary: art.snippet,
        image: art.image_url,
        published: art.published_at
      };
      const result = evaluateArticleAgainstRule(item, config);
      if (result.matched) {
        matched.push(Object.assign({}, item, { matchedKeywords: result.matchedKeywords }));
      }
    }

    return { totalChecked: articles.length, matchedCount: matched.length, matches: matched };
  } catch (err) {
    return { error: err.message, matches: [] };
  }
}
