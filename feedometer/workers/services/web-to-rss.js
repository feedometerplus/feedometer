/**
 * workers/services/web-to-rss.js — Web-to-RSS Scraping & Generation Service
 * Converts any website URL, blog, or news source into standard RSS 2.0 XML.
 */

import { parseXmlFeed } from './rss-parser.js';
import { decodeEntities, pickMetaContent } from './metadata-scraper.js';

function cleanText(str) {
  if (!str) return '';
  return decodeEntities(str)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveUrl(relative, base) {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative;
  }
}

function isNavOrJunkLink(href, text) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return true;
  const lowerHref = href.toLowerCase();
  const lowerText = (text || '').toLowerCase().trim();
  
  if (['home', 'about', 'privacy', 'privacy policy', 'terms', 'terms of service', 'contact', 'login', 'sign in', 'register', 'sign up', 'subscribe', 'menu', 'categories', 'advertise', 'careers'].includes(lowerText)) {
    return true;
  }
  if (/\/(login|signin|signup|register|terms|privacy|contact|about-us|cookie-policy|subscribe|account)\b/i.test(lowerHref)) {
    return true;
  }
  return false;
}

export async function buildRssFromUrl(rawUrl, env = null) {
  let targetUrl = String(rawUrl || '').trim();
  if (!targetUrl) {
    throw new Error('Target URL is required.');
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  const standardHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  let res = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    res = await fetch(targetUrl, {
      headers: standardHeaders,
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (fetchErr) {
    // Attempt fallback feed discovery before erroring
  }

  // Fallback probe for well-known RSS feeds if main HTML is non-200 or errored
  if (!res || !res.ok) {
    try {
      const urlObj = new URL(targetUrl);
      const probePaths = ['/rss', '/feed', '/rss.xml', '/atom.xml', '/index.xml', '/feed/'];
      for (const p of probePaths) {
        try {
          const probeUrl = `${urlObj.origin}${p}`;
          const probeRes = await fetch(probeUrl, { headers: standardHeaders });
          if (probeRes.ok) {
            const probeText = await probeRes.text();
            if (/^\s*<\?xml|<rss|<feed|<rdf:RDF/i.test(probeText)) {
              const parsed = parseXmlFeed(probeText);
              if (parsed.items && parsed.items.length > 0) {
                return {
                  ok: true,
                  xml: probeText,
                  siteUrl: targetUrl,
                  feedUrl: probeUrl,
                  meta: {
                    title: parsed.title || urlObj.hostname,
                    description: parsed.description || `RSS Feed for ${urlObj.hostname}`,
                    image: ''
                  },
                  items: parsed.items.map(item => ({
                    title: item.title,
                    link: item.link,
                    description: item.snippet || item.description || '',
                    pubDate: item.pubDate || new Date().toUTCString(),
                    image: item.image || ''
                  }))
                };
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    if (!res) {
      throw new Error('Failed to connect to website. Please check the URL.');
    }
    throw new Error(`Website responded with HTTP status ${res.status}`);
  }

  const finalUrl = res.url || targetUrl;
  const rawBody = await res.text();

  // 1. If the body is already valid RSS / Atom XML, return it parsed directly
  if (/^\s*<\?xml|<rss|<feed|<rdf:RDF/i.test(rawBody)) {
    const parsed = parseXmlFeed(rawBody);
    return {
      ok: true,
      xml: rawBody,
      siteUrl: finalUrl,
      meta: {
        title: parsed.title || new URL(finalUrl).hostname,
        description: parsed.description || `RSS Feed for ${finalUrl}`,
        image: ''
      },
      items: parsed.items.map(item => ({
        title: item.title,
        link: item.link,
        description: item.snippet || item.description || '',
        pubDate: item.pubDate || new Date().toUTCString(),
        image: item.image || ''
      }))
    };
  }

  // 2. Check if the HTML contains a discoverable RSS/Atom alternate link
  const rssLinkMatch = rawBody.match(/<link[^>]+type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["'][^>]+href=["']([^"']+)["']/i)
    || rawBody.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["']/i);

  if (rssLinkMatch && rssLinkMatch[1]) {
    const feedHref = resolveUrl(rssLinkMatch[1], finalUrl);
    try {
      const feedRes = await fetch(feedHref, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FeedOmeter-Builder/2.1',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      if (feedRes.ok) {
        const feedText = await feedRes.text();
        if (/^\s*<\?xml|<rss|<feed|<rdf:RDF/i.test(feedText)) {
          const parsed = parseXmlFeed(feedText);
          if (parsed.items && parsed.items.length > 0) {
            return {
              ok: true,
              xml: feedText,
              siteUrl: finalUrl,
              feedUrl: feedHref,
              meta: {
                title: parsed.title || new URL(finalUrl).hostname,
                description: parsed.description || `RSS Feed for ${finalUrl}`,
                image: ''
              },
              items: parsed.items.map(item => ({
                title: item.title,
                link: item.link,
                description: item.snippet || item.description || '',
                pubDate: item.pubDate || new Date().toUTCString(),
                image: item.image || ''
              }))
            };
          }
        }
      }
    } catch (e) {
      // Continue to HTML extraction if alternate feed fetch failed
    }
  }

  // 3. Extract Metadata from HTML
  const titleTagMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleTagMatch ? titleTagMatch[1] : '';
  const siteTitle = pickMetaContent(rawBody, 'og:title') || pickMetaContent(rawBody, 'og:site_name') || cleanText(rawTitle) || new URL(finalUrl).hostname;
  const siteDesc = pickMetaContent(rawBody, 'og:description') || pickMetaContent(rawBody, 'description') || `Generated RSS Feed for ${siteTitle}`;
  const siteImage = pickMetaContent(rawBody, 'og:image') || '';

  // 4. Extract Articles from HTML
  const extractedItems = [];
  const seenLinks = new Set();

  // Pattern A: <article> blocks
  const articleRegex = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  let artMatch;
  while ((artMatch = articleRegex.exec(rawBody)) !== null) {
    const artHtml = artMatch[1];
    const linkMatch = artHtml.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = resolveUrl(linkMatch[1], finalUrl);
    if (seenLinks.has(href)) continue;

    const headingMatch = artHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const title = cleanText(headingMatch ? headingMatch[1] : linkMatch[2]);
    if (!title || title.length < 5 || isNavOrJunkLink(href, title)) continue;

    const pMatch = artHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const desc = cleanText(pMatch ? pMatch[1] : '');

    const imgMatch = artHtml.match(/<img\b[^>]*\b(?:src|data-src)=["']([^"']+)["'][^>]*>/i);
    const imgUrl = imgMatch ? resolveUrl(imgMatch[1], finalUrl) : '';

    const timeMatch = artHtml.match(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/i);
    const pubDate = timeMatch ? new Date(timeMatch[1]).toUTCString() : new Date().toUTCString();

    seenLinks.add(href);
    extractedItems.push({
      title,
      link: href,
      description: desc || title,
      pubDate,
      image: imgUrl
    });
  }

  // Pattern B: Headline links inside h1-h4 if fewer than 4 items extracted
  if (extractedItems.length < 4) {
    const headingRegex = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(rawBody)) !== null) {
      const hHtml = hMatch[2];
      const linkMatch = hHtml.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const href = resolveUrl(linkMatch[1], finalUrl);
      if (seenLinks.has(href)) continue;

      const title = cleanText(linkMatch[2]);
      if (!title || title.length < 8 || isNavOrJunkLink(href, title)) continue;

      seenLinks.add(href);
      extractedItems.push({
        title,
        link: href,
        description: title,
        pubDate: new Date().toUTCString(),
        image: ''
      });
      if (extractedItems.length >= 25) break;
    }
  }

  // Pattern C: General prominent <a> links with substantial text length
  if (extractedItems.length < 3) {
    const generalLinkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let gMatch;
    while ((gMatch = generalLinkRegex.exec(rawBody)) !== null) {
      const href = resolveUrl(gMatch[1], finalUrl);
      if (seenLinks.has(href)) continue;

      const title = cleanText(gMatch[2]);
      if (!title || title.length < 18 || title.length > 250 || isNavOrJunkLink(href, title)) continue;
      // Skip if anchor text is generic
      if (/^(read more|click here|learn more|see all|view details|share|comment)/i.test(title)) continue;

      seenLinks.add(href);
      extractedItems.push({
        title,
        link: href,
        description: title,
        pubDate: new Date().toUTCString(),
        image: ''
      });
      if (extractedItems.length >= 20) break;
    }
  }

  if (extractedItems.length === 0) {
    throw new Error('Unable to automatically extract articles from this webpage. The site may be protected or JavaScript-rendered.');
  }

  // 5. Generate Standard RSS 2.0 XML
  const nowUtc = new Date().toUTCString();
  const xmlItems = extractedItems.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <pubDate>${item.pubDate || nowUtc}</pubDate>
      <description>${escapeXml(item.description)}</description>
      ${item.image ? `<media:content url="${escapeXml(item.image)}" medium="image" />` : ''}
    </item>`).join('\n');

  const generatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(finalUrl)}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>en</language>
    <lastBuildDate>${nowUtc}</lastBuildDate>
    <generator>FeedOmeter Web-to-RSS Builder 2.1</generator>
    <atom:link href="${escapeXml(finalUrl)}" rel="alternate" type="text/html" />
${xmlItems}
  </channel>
</rss>`;

  return {
    ok: true,
    xml: generatedXml,
    siteUrl: finalUrl,
    meta: {
      title: siteTitle,
      description: siteDesc,
      image: siteImage
    },
    items: extractedItems
  };
}
