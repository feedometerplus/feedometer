/**
 * workers/services/builder-dom-eval.js — DOM-based Visual Builder selector evaluation
 */
import { parseHTML } from 'linkedom';
import { decodeEntities } from './metadata-scraper.js';
import { looksLikeLowQualityImage } from './web-to-rss.js';

function cleanText(str) {
  if (!str) return '';
  return decodeEntities(str)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(relative, base) {
  try {
    return new URL(relative, base).href;
  } catch (_) {
    return relative;
  }
}

function safeQuery(root, selector) {
  if (!root || !selector || !String(selector).trim()) return null;
  try {
    return root.querySelector(String(selector).trim());
  } catch (_) {
    return null;
  }
}

function safeQueryAll(document, selector) {
  if (!document || !selector || !String(selector).trim()) return [];
  try {
    return Array.from(document.querySelectorAll(String(selector).trim()));
  } catch (_) {
    return [];
  }
}

function extractTitle(el) {
  if (!el) return '';
  return cleanText(el.textContent || '');
}

function extractLink(el, container, pageUrl, linkSel) {
  let node = el;
  if (!node && linkSel) {
    node = safeQuery(container, linkSel);
  }
  if (!node) {
    node = container.querySelector('a[href]');
  }
  if (!node) return '';

  const anchor = node.tagName === 'A' ? node : node.closest('a');
  const href = (anchor && anchor.getAttribute('href')) || node.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return '';
  return resolveUrl(href.trim(), pageUrl);
}

function extractImage(el, container, pageUrl, imageSel) {
  let node = el;
  if (!node && imageSel) {
    node = safeQuery(container, imageSel);
  }
  if (!node) {
    node = container.querySelector('img');
  }
  if (!node) return '';

  const img = node.tagName === 'IMG' ? node : node.querySelector('img');
  if (!img) return '';

  const rawSrc =
    img.getAttribute('data-src') ||
    img.getAttribute('data-original') ||
    img.getAttribute('data-lazy-src') ||
    img.getAttribute('data-lazy') ||
    img.getAttribute('data-url') ||
    img.getAttribute('src') ||
    '';

  if (!rawSrc || looksLikeLowQualityImage(rawSrc)) return '';
  return resolveUrl(rawSrc.trim(), pageUrl);
}

function extractDescription(el, container, descSel) {
  let node = el;
  if (!node && descSel) {
    node = safeQuery(container, descSel);
  }
  if (!node) {
    node = container.querySelector('p');
  }
  if (!node) return '';
  return cleanText(node.textContent || '').slice(0, 300);
}

function extractDate(el, container, dateSel) {
  let node = el;
  if (!node && dateSel) {
    node = safeQuery(container, dateSel);
  }
  if (!node) {
    node = container.querySelector('time');
  }
  if (!node) return '';
  const dt = node.getAttribute('datetime') || node.getAttribute('data-datetime') || node.textContent || '';
  return cleanText(dt);
}

function extractAuthor(el, container, authorSel) {
  if (!authorSel) return '';
  const node = el || safeQuery(container, authorSel);
  if (!node) return '';
  return cleanText(node.textContent || '');
}

/**
 * Evaluates selector config using linkedom querySelector/querySelectorAll
 */
export function evaluateSelectorConfigDom(html, pageUrl, config = {}) {
  const containerSel = config.itemContainer || config.container || 'article';
  const titleSel = config.title || 'h1, h2, h3, h4';
  const linkSel = config.link || 'a[href]';
  const descSel = config.description || 'p';
  const imageSel = config.image || 'img';
  const dateSel = config.date || 'time';
  const authorSel = config.author || '';

  const { document } = parseHTML(String(html || ''));
  const containers = safeQueryAll(document, containerSel).slice(0, 50);
  const items = [];

  for (const container of containers) {
    const titleEl = safeQuery(container, titleSel);
    const title = extractTitle(titleEl);
    const link = extractLink(null, container, pageUrl, linkSel);
    const description = extractDescription(null, container, descSel);
    const image = extractImage(null, container, pageUrl, imageSel);
    const pubDate = extractDate(null, container, dateSel) || new Date().toUTCString();
    const author = extractAuthor(null, container, authorSel) || 'Author';

    if (!title && !link) continue;

    items.push({
      title: title || 'Untitled Article',
      link: link || pageUrl,
      description: description || title || '',
      image,
      pubDate,
      author
    });
  }

  const total = items.length || 1;
  const confidence = {
    title: Number((items.filter((i) => i.title && i.title !== 'Untitled Article').length / total).toFixed(2)),
    link: Number((items.filter((i) => i.link && /^https?:\/\//i.test(i.link)).length / total).toFixed(2)),
    image: Number((items.filter((i) => Boolean(i.image)).length / total).toFixed(2)),
    date: Number((items.filter((i) => Boolean(i.pubDate)).length / total).toFixed(2))
  };

  return {
    matchCount: items.length,
    confidence,
    items
  };
}
