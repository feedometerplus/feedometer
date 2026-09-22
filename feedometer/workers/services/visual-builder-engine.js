/**
 * workers/services/visual-builder-engine.js — FeedOmeter Visual RSS Builder Engine
 * Web Proxy, DOM Element Inspector Injection, CSS Selector Evaluator & Fallback Synthesizer
 */
import { evaluateSelectorConfigDom } from './builder-dom-eval.js';
import { fetchPageHtmlForBuilder, normalizeRenderMode } from './builder-page-fetch.js';
export { detectLikelyJsShell } from './builder-static-fetch.js';

/**
 * Client inspector script injected into the proxy page for point-and-click element capture
 */
export const INSPECTOR_INJECTION_SCRIPT = `
<script id="feedometer-inspector-script">
(function() {
  if (window.__feedometer_injected) return;
  window.__feedometer_injected = true;

  let activeTargetInput = 'container';
  let hoveredElement = null;
  let highlightedElements = [];

  const styleEl = document.createElement('style');
  styleEl.textContent = \`
    .__fom_hover {
      outline: 2px dashed #0284c7 !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
      background-color: rgba(2, 132, 199, 0.08) !important;
    }
    .__fom_selected {
      outline: 2px solid #10b981 !important;
      outline-offset: 2px !important;
      background-color: rgba(16, 185, 129, 0.12) !important;
    }
    .__fom_sibling {
      outline: 1.5px dashed #10b981 !important;
      outline-offset: 1px !important;
      background-color: rgba(16, 185, 129, 0.05) !important;
    }
  \`;
  document.head.appendChild(styleEl);

  function getOptimalSelector(el, isSubField) {
    if (!el || el === document.body || el === document.documentElement) return '';

    if (isSubField) {
      var tag = el.tagName.toLowerCase();
      var classes = Array.from(el.classList || [])
        .filter(function(c) {
          return c && !c.startsWith('__fom_') && !/^[a-z0-9_-]{12,}$/i.test(c) && !/^(jsx-|css-|sc-)/.test(c);
        })
        .slice(0, 2);

      if (tag === 'img') {
        if (classes.length) return 'img.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
        return 'img';
      }
      if (tag === 'a') {
        if (classes.length) return 'a.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
        return 'a';
      }
      if (classes.length > 0) {
        return tag + '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
      }
      if (['h1','h2','h3','h4','h5','h6','time','p','span','figcaption'].indexOf(tag) !== -1) {
        return tag;
      }
      return tag;
    }

    if (el.id && !/\\d{4,}/.test(el.id)) {
      return '#' + CSS.escape(el.id);
    }

    var path = [];
    var curr = el;

    while (curr && curr !== document.body && curr !== document.documentElement && path.length < 6) {
      var tag = curr.tagName.toLowerCase();
      var selector = tag;
      var classes = Array.from(curr.classList || [])
        .filter(function(c) {
          return c && !c.startsWith('__fom_') && !/^[a-z0-9_-]{12,}$/i.test(c) && !/^(jsx-|css-|sc-)/.test(c);
        })
        .slice(0, 2);

      if (classes.length > 0) {
        selector += '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
      } else {
        var parent = curr.parentElement;
        if (parent) {
          var siblings = Array.from(parent.children).filter(function(s) { return s.tagName === curr.tagName; });
          if (siblings.length > 1) {
            selector += ':nth-of-type(' + (siblings.indexOf(curr) + 1) + ')';
          }
        }
      }

      path.unshift(selector);
      if (curr.id && !/\\d{4,}/.test(curr.id)) {
        path[0] = '#' + CSS.escape(curr.id);
        break;
      }
      // Prefer stopping at repeating card-like nodes
      if (path.length >= 2 && /article|card|story|item|teaser|post/i.test(selector)) {
        break;
      }
      curr = curr.parentElement;
    }

    var out = path.join(' > ');
    if (!out || out === '.' || out === '*' || /^\\./.test(out) && out.length < 3) return tag || '';
    return out;
  }

  function highlightMatches(selector) {
    document.querySelectorAll('.__fom_selected, .__fom_sibling').forEach(el => {
      el.classList.remove('__fom_selected', '__fom_sibling');
    });
    if (!selector) return 0;
    try {
      const matches = document.querySelectorAll(selector);
      matches.forEach((el, idx) => {
        if (idx === 0) el.classList.add('__fom_selected');
        else el.classList.add('__fom_sibling');
      });
      return matches.length;
    } catch (e) {
      return 0;
    }
  }

  document.addEventListener('mouseover', function(e) {
    const target = e.target.closest('a, img, h1, h2, h3, h4, h5, h6, p, time, span, article, div, li, section') || e.target;
    if (target === document.body || target === document.documentElement) return;
    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('__fom_hover');
    }
    hoveredElement = target;
    hoveredElement.classList.add('__fom_hover');
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (hoveredElement) {
      hoveredElement.classList.remove('__fom_hover');
      hoveredElement = null;
    }
  }, true);

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target.closest('a, img, h1, h2, h3, h4, h5, h6, p, time, span, article, div, li, section') || e.target;
    if (target === document.body || target === document.documentElement) return;

    const isSub = (activeTargetInput !== 'container');
    const selector = getOptimalSelector(target, isSub);
    const matchCount = highlightMatches(selector);

    let textSnippet = (target.textContent || '').trim().slice(0, 100);
    let attrValue = '';
    if (target.tagName === 'A') attrValue = target.getAttribute('href') || '';
    if (target.tagName === 'IMG') attrValue = target.getAttribute('src') || target.getAttribute('data-src') || '';
    if (target.tagName === 'TIME') attrValue = target.getAttribute('datetime') || target.textContent.trim();

    window.parent.postMessage({
      type: 'FEEDOMETER_ELEMENT_SELECTED',
      targetField: activeTargetInput,
      field: activeTargetInput,
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      matchCount: matchCount,
      count: matchCount,
      textSnippet: textSnippet,
      attrValue: attrValue
    }, '*');
    window.parent.postMessage({
      type: 'element_selected',
      targetField: activeTargetInput,
      field: activeTargetInput,
      selector: selector,
      tagName: target.tagName.toLowerCase(),
      matchCount: matchCount,
      count: matchCount,
      textSnippet: textSnippet,
      attrValue: attrValue
    }, '*');
  }, true);

  // Listen for commands from the parent studio
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'SET_ACTIVE_FIELD' || e.data.type === 'set_target_field') {
      activeTargetInput = e.data.field || e.data.targetField || 'container';
    }
    if (e.data.type === 'HIGHLIGHT_SELECTOR' || e.data.type === 'highlight_selector') {
      highlightMatches(e.data.selector);
    }
  });

  // Notify parent that inspector is ready
  window.parent.postMessage({ type: 'FEEDOMETER_INSPECTOR_READY' }, '*');
  window.parent.postMessage({ type: 'inspector_ready' }, '*');
})();
</script>
`;

/**
 * Proxies a target website URL, rewriting relative paths and injecting the inspector script.
 */
/** Keep previews small enough for iframe parse without freezing the studio tab */
const MAX_PROXY_HTML_CHARS = 900000;

const PREVIEW_CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src https: data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https: data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';">`;

function promoteLazyMediaForPreview(html) {
  let out = String(html || '');
  out = out.replace(/<img\b([^>]*?)>/gi, (full, attrs) => {
    if (/\ssrc\s*=\s*["'](?!["'\s]*["'])[^"']+["']/i.test(attrs)) {
      return full;
    }
    const lazy = attrs.match(/\s(?:data-src|data-lazy-src|data-original|data-image)\s*=\s*(["'])(.*?)\1/i);
    if (!lazy || !lazy[2]) return full;
    const src = lazy[2].replace(/"/g, '&quot;');
    return `<img src="${src}"${attrs}>`;
  });
  return out;
}

/**
 * Visual studio only needs DOM for point-and-click — strip site JS/iframes so the parent page stays responsive.
 */
export function sanitizeHtmlForStudioPreview(html) {
  let out = String(html || '');

  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\/>/gi, '');
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<iframe\b[^>]*\/>/gi, '');
  out = out.replace(/<meta\s+[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, '');
  out = out.replace(/<link\b[^>]*\bas=["']?(?:script|worker)["']?[^>]*>/gi, '');

  return out;
}

const PROXY_NOTICE_HTML = `
<div id="feedometer-proxy-notice" style="position:sticky;top:0;z-index:2147483646;background:#fffbeb;border-bottom:1px solid #fcd34d;color:#92400e;font:600 12px/1.4 system-ui,sans-serif;padding:8px 12px;">
  Feedometer preview: this site may rely on JavaScript. Switch Page loading to <strong>Full browser render</strong> or use Auto Generator.
</div>`;

const PROXY_BROWSER_OK_HTML = `
<div id="feedometer-proxy-notice" style="position:sticky;top:0;z-index:2147483646;background:#ecfdf5;border-bottom:1px solid #6ee7b7;color:#065f46;font:600 12px/1.4 system-ui,sans-serif;padding:8px 12px;">
  Loaded with Cloudflare Browser Rendering — point-and-click selectors apply to rendered HTML.
</div>`;

export function isSiteAccessBlocked(html) {
  const s = String(html || '');
  if (/Access Denied/i.test(s) && /edgesuite|akamai|Reference\s*#/i.test(s)) return true;
  if (/errors\.edgesuite\.net/i.test(s)) return true;
  if (/You don't have permission to access/i.test(s)) return true;
  if (/Attention Required!|cf-challenge|Just a moment/i.test(s) && s.length < 80000) return true;
  return false;
}

function buildBlockedSiteHtml(targetUrl) {
  const safe = String(targetUrl || '').replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])
  );
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Site blocked</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#fef2f2;color:#7f1d1d;padding:2rem;}
.card{max-width:520px;margin:2rem auto;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:1.5rem;}
h1{font-size:1.15rem;margin:0 0 .5rem;}
p{font-size:.9rem;line-height:1.5;color:#991b1b;}
code{font-size:.8rem;word-break:break-all;}
ul{font-size:.85rem;color:#7f1d1d;line-height:1.6;}
</style></head><body><div class="card">
<h1>This website blocked the preview</h1>
<p>The site rejected automated / cloud access (often Akamai or Cloudflare bot protection).</p>
<p><code>${safe}</code></p>
<p><strong>What to try:</strong></p>
<ul>
<li>BBC News, The Verge, TechCrunch, Ars Technica, ScienceDaily</li>
<li>Or use <strong>Auto Feed Generator</strong> for a one-click feed (no live preview needed)</li>
</ul>
</div></body></html>`;
}

function preprocessProxyHtml(html, pageUrl, origin, urlObj) {
  let out = sanitizeHtmlForStudioPreview(html);
  out = promoteLazyMediaForPreview(out);

  if (out.length > MAX_PROXY_HTML_CHARS) {
    out =
      out.slice(0, MAX_PROXY_HTML_CHARS) +
      '\n<!-- Feedometer: HTML truncated for preview performance -->\n';
  }

  out = out.replace(/<meta\s+[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
  out = out.replace(/<meta\s+[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
  out = out.replace(/<meta\s+[^>]*name=["']?referrer["']?[^>]*>/gi, '');
  out = out.replace(/<script[^>]*>\s*(?:top\.)?location\s*=.*?<\/script>/gi, '');

  const baseTag = `<base href="${origin}${urlObj.pathname}">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, `$&\n  ${baseTag}\n  ${PREVIEW_CSP_META}`);
  } else {
    out = `${baseTag}\n${PREVIEW_CSP_META}\n${out}`;
  }

  return out;
}

function injectProxyBodyExtras(html, { jsShell, renderEngine }) {
  let out = html;
  let prefix = '';
  if (renderEngine === 'browser') {
    prefix = PROXY_BROWSER_OK_HTML;
  } else if (jsShell) {
    prefix = PROXY_NOTICE_HTML;
  }

  if (/<body[^>]*>/i.test(out)) {
    out = out.replace(/<body[^>]*>/i, (m) => `${m}\n${prefix}`);
  } else if (prefix) {
    out = prefix + out;
  }

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${INSPECTOR_INJECTION_SCRIPT}\n</body>`);
  } else {
    out += INSPECTOR_INJECTION_SCRIPT;
  }

  return out;
}

export async function fetchProxyPage(targetUrl, env = null, options = {}) {
  let url = String(targetUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const urlObj = new URL(url);
  const origin = urlObj.origin;
  const renderMode = normalizeRenderMode(options.renderMode || 'auto');

  const pageResult = await fetchPageHtmlForBuilder(env, url, { renderMode });

  if (isSiteAccessBlocked(pageResult.html)) {
    return {
      url: pageResult.finalUrl || url,
      html: buildBlockedSiteHtml(url),
      jsShell: false,
      renderEngine: 'blocked',
      browserSkipped: false,
      renderCached: false,
      blocked: true
    };
  }

  const showJsNotice = pageResult.jsShell && pageResult.renderEngine === 'static';

  let html = preprocessProxyHtml(pageResult.html, url, origin, urlObj);
  html = injectProxyBodyExtras(html, {
    jsShell: showJsNotice,
    renderEngine: pageResult.renderEngine
  });

  return {
    url: pageResult.finalUrl || url,
    html,
    jsShell: pageResult.jsShell,
    renderEngine: pageResult.renderEngine,
    browserSkipped: Boolean(pageResult.browserSkipped),
    renderCached: Boolean(pageResult.cached),
    blocked: false
  };
}

/**
 * Synthesizes fallback strategies for a given CSS selector
 */
export function generateFallbackChain(cssSelector, fieldType = 'title') {
  const fallbacks = [];
  if (!cssSelector) return { primary: { type: 'css', value: '' }, fallbacks: [] };

  // 1. Tag or general class fallback
  const lastTagMatch = cssSelector.match(/([a-z0-9_-]+)$/i);
  if (lastTagMatch) {
    fallbacks.push({ type: 'css', value: lastTagMatch[1] });
  }

  // 2. XPath fallback
  const xpathValue = '//' + cssSelector.replace(/>/g, '/').replace(/#/g, '*[@id="').replace(/\.([a-z0-9_-]+)/gi, '[@class="$1"]');
  fallbacks.push({ type: 'xpath', value: xpathValue });

  // 3. Semantic fallback descriptor
  const semanticDescriptions = {
    container: 'repeating article card or post boundary element',
    title: 'largest clickable headline or heading tag inside article container',
    link: 'primary destination hyperlink a[href] inside article container',
    description: 'first paragraph or summary excerpt element inside article container',
    image: 'lead visual image thumbnail img[src] or figure inside article container',
    date: 'published timestamp or time tag inside article container',
    author: 'byline or author name span inside article container'
  };

  fallbacks.push({
    type: 'semantic',
    description: semanticDescriptions[fieldType] || `semantic ${fieldType} element`
  });

  return {
    primary: { type: 'css', value: cssSelector },
    fallbacks: fallbacks
  };
}

/**
 * Evaluates custom or auto selector configuration on raw HTML (DOM + CSS selectors)
 */
export function evaluateSelectorConfig(html, pageUrl, config = {}) {
  try {
    return evaluateSelectorConfigDom(html, pageUrl, config);
  } catch (err) {
    console.warn('DOM selector evaluation failed, returning empty set:', err.message);
    return {
      matchCount: 0,
      confidence: { title: 0, link: 0, image: 0, date: 0 },
      items: [],
      error: err.message
    };
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Builds RSS 2.0 XML from evaluated visual-builder items
 */
export function buildRssXmlFromItems(items, siteUrl) {
  let hostname = 'Website';
  try {
    hostname = new URL(siteUrl).hostname;
  } catch (_) {}

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>${escapeXml(hostname)} Feed</title>\n`;
  xml += `    <link>${escapeXml(siteUrl)}</link>\n`;
  xml += `    <description>Live RSS feed generated by Feedometer Visual Builder</description>\n`;
  xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  (items || []).forEach((a) => {
    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(a.title || 'Untitled')}</title>\n`;
    xml += `      <link>${escapeXml(a.link || siteUrl)}</link>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(a.link || siteUrl)}</guid>\n`;
    if (a.description) xml += `      <description>${escapeXml(a.description)}</description>\n`;
    if (a.pubDate) xml += `      <pubDate>${escapeXml(a.pubDate)}</pubDate>\n`;
    if (a.image) xml += `      <enclosure url="${escapeXml(a.image)}" type="image/jpeg" length="0"/>\n`;
    xml += `    </item>\n`;
  });

  xml += `  </channel>\n</rss>`;
  return xml;
}
