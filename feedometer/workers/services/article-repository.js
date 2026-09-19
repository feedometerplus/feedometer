/**
 * workers/services/article-repository.js — Canonical Article Identity & D1 Persistence Service
 */
import { generateRandomHex, sha256Hex } from '../lib/crypto.js';
import { pickBestArticleImage } from './feed-imaging.js';
import { decodeEntities, fetchPageMetadata } from './metadata-scraper.js';

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1';
}

export function mergeArticlePayload(body) {
  const nested = body && body.article_data && typeof body.article_data === 'object' ? body.article_data : {};
  const merged = Object.assign({}, nested);
  const src = body || {};
  Object.keys(src).forEach((key) => {
    if (key === 'article_data') return;
    if (src[key] !== undefined && src[key] !== null && src[key] !== '') {
      merged[key] = src[key];
    }
  });
  const url = decodeEntities((merged.url || merged.link || nested.url || nested.link || '').trim());
  merged.url = url;
  merged.link = url;
  if (nested.source && nested.source.id && !merged.source_id) merged.source_id = nested.source.id;
  if (nested.source && nested.source.title && !merged.source_title) merged.source_title = nested.source.title;
  if (nested.sourceTitle && !merged.source_title) merged.source_title = nested.sourceTitle;
  return merged;
}

export function hostToSourceId(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return 'src_' + host.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  } catch (e) {
    return '';
  }
}

export function isCatalogArticleId(id) {
  return typeof id === 'string' && id.indexOf('art_') === 0;
}

export async function ensureGeneralSource(env) {
  const id = 'src_general';
  try {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO sources (id, title, feed_url, website_url, source_type, category, is_verified, status)
      VALUES (?, 'General Web Feeds', '', '', 'rss', 'general', 0, 'active')
    `).bind(id).run();
  } catch (e) {}
  return id;
}

export function hydrateCatalogItem(row) {
  if (!row) return row;
  // Same thumbnail rules as the live stream (workers/services/feed-imaging.js).
  if (!row.image_url) {
    row.image_url = pickBestArticleImage(row);
  }
  return row;
}

export async function hydrateAndPersist(env, row) {
  const item = hydrateCatalogItem(row);
  const needsTitle = !item.title || item.title === 'Untitled Article';
  const needsImage = !item.image_url;
  if (!needsTitle && !needsImage) return item;
  const meta = await fetchPageMetadata(item.url);
  if (!meta) return item;
  const title = needsTitle && meta.title ? meta.title : item.title;
  const image = needsImage && meta.image_url ? meta.image_url : item.image_url;
  const snippet = !item.snippet && meta.snippet ? meta.snippet : item.snippet;
  try {
    await env.DB.prepare('UPDATE articles SET title = ?, image_url = ?, snippet = ? WHERE id = ?')
      .bind(title || item.title, image || '', snippet || '', item.id).run();
  } catch (e) {}
  item.title = title;
  item.image_url = image;
  item.snippet = snippet;
  if (meta.site_name && item.source_title === 'General Web Feeds') {
    item.source_title = meta.site_name;
  }
  return item;
}

export async function resolveSourceId(env, articleData, url) {
  let sourceId = articleData.source_id || (articleData.source && articleData.source.id) || '';
  if (sourceId) {
    const srcRow = await env.DB.prepare('SELECT id FROM sources WHERE id = ?').bind(sourceId).first();
    if (srcRow) return srcRow.id;
    sourceId = '';
  }
  if (articleData.feed_url) {
    const src = await env.DB.prepare('SELECT id FROM sources WHERE feed_url = ?').bind(articleData.feed_url).first();
    if (src) return src.id;
  }
  const derivedId = hostToSourceId(url);
  const sourceTitle = (articleData.source_title || articleData.sourceTitle || (articleData.source && articleData.source.title) || '').trim();
  if (derivedId) {
    const byId = await env.DB.prepare('SELECT id FROM sources WHERE id = ?').bind(derivedId).first();
    if (byId) return derivedId;
    try {
      const host = new URL(url).origin;
      await env.DB.prepare(`
        INSERT OR IGNORE INTO sources (id, title, feed_url, website_url, source_type, category, is_verified, status)
        VALUES (?, ?, ?, ?, 'rss', 'general', 0, 'active')
      `).bind(derivedId, sourceTitle || derivedId.replace(/^src_/, ''), url, host).run();
      return derivedId;
    } catch (e) {}
  }
  return ensureGeneralSource(env);
}

export async function ensureArticleInCatalog(env, articleData) {
  if (!articleData) return null;
  const url = decodeEntities((articleData.url || articleData.link || '').trim());
  if (!url) return null;

  const canonicalHash = articleData.canonical_url_hash || await sha256Hex(url.toLowerCase().split('?')[0]);
  let title = String(articleData.title || '').trim();
  let imageUrl = pickBestArticleImage(articleData);
  let snippet = String(articleData.snippet || articleData.summary || articleData.description || '').slice(0, 4000);
  const content = String(articleData.content || '').slice(0, 20000);
  if (!title || title === 'Untitled Article' || !imageUrl) {
    const meta = await fetchPageMetadata(url);
    if (meta) {
      if (!title || title === 'Untitled Article') title = meta.title || title;
      if (!imageUrl) imageUrl = meta.image_url || '';
      if (!snippet) snippet = (meta.snippet || '').slice(0, 4000);
      if (meta.site_name && !articleData.source_title) articleData.source_title = meta.site_name;
    }
  }

  const existing = await env.DB.prepare('SELECT id, title, image_url, snippet FROM articles WHERE canonical_url_hash = ?').bind(canonicalHash).first();
  if (existing) {
    const nextTitle = (!existing.title || existing.title === 'Untitled Article') && title ? title : existing.title;
    const nextImage = (!existing.image_url && imageUrl) ? imageUrl : existing.image_url;
    const nextSnippet = (!existing.snippet && snippet) ? snippet : existing.snippet;
    if (nextTitle !== existing.title || nextImage !== existing.image_url || nextSnippet !== existing.snippet) {
      await env.DB.prepare(`
        UPDATE articles SET title = ?, image_url = ?, snippet = ? WHERE id = ?
      `).bind(nextTitle || existing.title, nextImage || '', nextSnippet || '', existing.id).run();
    }
    return existing.id;
  }

  const sourceId = await resolveSourceId(env, articleData, url);
  const articleId = `art_${generateRandomHex(12)}`;
  const now = Date.now();
  let publishedAt = now;
  const rawPub = articleData.published_at || articleData.published || articleData.pubDate;
  if (rawPub) {
    const parsed = new Date(rawPub).getTime();
    if (!Number.isNaN(parsed)) publishedAt = parsed;
  }

  await env.DB.prepare(`
    INSERT INTO articles (id, canonical_url_hash, source_id, title, url, author, snippet, content, image_url, published_at, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(canonical_url_hash) DO UPDATE SET
      title = CASE WHEN articles.title = 'Untitled Article' AND excluded.title != '' THEN excluded.title ELSE articles.title END,
      image_url = CASE WHEN (articles.image_url IS NULL OR articles.image_url = '') THEN excluded.image_url ELSE articles.image_url END,
      snippet = CASE WHEN (articles.snippet IS NULL OR articles.snippet = '') THEN excluded.snippet ELSE articles.snippet END,
      content = CASE WHEN (articles.content IS NULL OR articles.content = '') THEN excluded.content ELSE articles.content END
  `).bind(
    articleId,
    canonicalHash,
    sourceId,
    title || 'Untitled Article',
    url,
    articleData.author || articleData.creator || '',
    snippet,
    content,
    imageUrl,
    publishedAt,
    now
  ).run();

  const final = await env.DB.prepare('SELECT id FROM articles WHERE canonical_url_hash = ?').bind(canonicalHash).first();
  return final ? final.id : articleId;
}

export async function resolveCatalogArticleId(env, body) {
  const payload = mergeArticlePayload(body);
  if (payload.url) {
    const catalogId = await ensureArticleInCatalog(env, payload);
    if (catalogId) return catalogId;
  }
  if (isCatalogArticleId(payload.article_id)) {
    const row = await env.DB.prepare('SELECT id FROM articles WHERE id = ?').bind(payload.article_id).first();
    if (row) return row.id;
  }
  return null;
}

export async function recordArticleEvent(env, userId, sourceId, articleId, eventType, request) {
  if (!env.DB || !articleId) return;
  try {
    const eventId = `evt_${generateRandomHex(12)}`;
    const ip = request ? getClientIp(request) : '127.0.0.1';
    await env.DB.prepare(`
      INSERT INTO article_events (id, user_id, source_id, article_id, event_type, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, userId || null, sourceId || null, articleId, eventType, ip, Date.now()).run();
  } catch (e) {
    console.error('Failed to log article event:', e.message);
  }
}
