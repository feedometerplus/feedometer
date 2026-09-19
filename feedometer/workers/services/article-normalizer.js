/**
 * workers/services/article-normalizer.js — Canonical URL Normalization & Article Identity
 *
 * After we clean the title and URL, we also attach a thumbnail here so Home /
 * Top Stories never need browser-side image picking. See feed-imaging.js.
 */
import { sha256Hex } from '../lib/crypto.js';
import { pickBestArticleImage } from './feed-imaging.js';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid', '_ga', 'ved', 'usg'
]);

export function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = ''; // Strip fragments

    // Strip tracking parameters
    const keysToDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => parsed.searchParams.delete(k));

    // Remove trailing slash on non-root paths
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    return parsed.toString();
  } catch (e) {
    return rawUrl.trim().split('#')[0];
  }
}

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num));
}

export function sanitizeText(str) {
  if (!str) return '';
  return decodeHtmlEntities(str)
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateArticleHash(link, feedUrl = '', fallbackTitle = '') {
  const canonical = canonicalizeUrl(link);
  if (canonical) {
    return await sha256Hex(canonical);
  }
  const fallbackStr = `${feedUrl}::${fallbackTitle}`;
  return await sha256Hex(fallbackStr);
}

export async function normalizeArticle(rawItem, sourceInfo = {}) {
  const canonicalLink = canonicalizeUrl(rawItem.link || rawItem.guid);
  const title = sanitizeText(rawItem.title) || 'Untitled Article';
  const summary = sanitizeText(rawItem.summary || rawItem.description || '');
  const id = await generateArticleHash(canonicalLink, sourceInfo.feed_url || '', title);
  const author = sanitizeText(rawItem.author || '');

  // Normalize ISO publication timestamp
  let published = new Date().toISOString();
  if (rawItem.published) {
    const d = new Date(rawItem.published);
    if (!isNaN(d.getTime())) {
      published = d.toISOString();
    }
  }

  const chosenImage = pickBestArticleImage({
    image: rawItem.image,
    image_url: rawItem.image,
    thumbnail: rawItem.thumbnail,
    content: rawItem.content || rawItem.summary || '',
    snippet: summary,
    url: canonicalLink || rawItem.link || '',
    link: canonicalLink || rawItem.link || ''
  }) || '';

  return {
    id,
    title,
    summary,
    description: summary,
    link: canonicalLink || rawItem.link || '',
    url: canonicalLink || rawItem.link || '',
    published,
    pubDate: published,
    publishedAt: published,
    author,
    source: {
      id: sourceInfo.id || 'unknown',
      title: sourceInfo.title || 'Feed Source',
      website_url: sourceInfo.website_url || '',
      logo_url: sourceInfo.logo_url || ''
    },
    image: chosenImage,
    image_url: chosenImage
  };
}
