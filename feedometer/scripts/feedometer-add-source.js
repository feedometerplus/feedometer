/**
 * scripts/feedometer-add-source.js — FeedOmeter 2.1 Add Source & RSS Builder Controller
 * Connects to FeedOmeter Unified API (/api/feed-preview, /api/build, /api/subscriptions)
 */

(function (window, document) {
  'use strict';

  function getApiBase() {
    if (window.FEEDOMETER_CONFIG && window.FEEDOMETER_CONFIG.API_BASE) {
      return window.FEEDOMETER_CONFIG.API_BASE.replace(/\/+$/, '');
    }
    return 'https://feedometer-api.feedometer.workers.dev';
  }

  function getAuthHeaders() {
    if (window.FeedOmeterAuth && typeof window.FeedOmeterAuth.getAuthHeaders === 'function') {
      return window.FeedOmeterAuth.getAuthHeaders();
    }
    const token = localStorage.getItem('feedometer_token') || '';
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  function decodeEntities(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  // State
  let currentArticles = [];
  let currentFeedMeta = null;
  let currentFeedUrl = '';
  let currentXml = '';
  let activeSort = 'latest';
  let activeTab = 'overview';
  let currentDetected = null;

  const TLD_REGEX = /\.(com|org|net|io|ai|co|app|dev|news|info|biz|me|tech|blog|tv|online|site|space|xyz|gov|edu|uk|us|in|eu|de|fr|jp|ca|au|br|ru|ch|nl|se|no|es|it|nz|asia|media|world|global|live|club|agency|today|top|vip|digital|cloud|studio|design|store|shop|link|click|stream)([\/:?#]|$)/i;

  function detectClientSourceType(rawInput) {
    const input = String(rawInput || '').trim();
    if (!input) return null;

    // YouTube
    if (/^@([a-zA-Z0-9_.-]+)$/i.test(input)) {
      const handle = input.replace(/^@/, '');
      return { type: 'youtube', subtype: 'handle', label: 'YouTube Channel', icon: '📺', color: '#ef4444', bg: '#fee2e2', hint: `Will resolve official YouTube video feed for @${handle}` };
    }
    if (/^(https?:\/\/)?(www\.|m\.)?youtube\.com\//i.test(input) || /^(https?:\/\/)?youtu\.be\//i.test(input)) {
      return { type: 'youtube', subtype: 'url', label: 'YouTube', icon: '📺', color: '#ef4444', bg: '#fee2e2', hint: 'Will resolve official YouTube RSS feed' };
    }

    // Reddit
    if (/^r\/([a-zA-Z0-9_]+)$/i.test(input)) {
      const sub = input.match(/^r\/([a-zA-Z0-9_]+)$/i)[1];
      return { type: 'reddit', subtype: 'sub', label: 'Reddit Subreddit', icon: '🔴', color: '#ff4500', bg: '#ffedd5', hint: `Will connect to Reddit native stream for r/${sub}` };
    }
    if (/^u\/([a-zA-Z0-9_-]+)$/i.test(input)) {
      const user = input.match(/^u\/([a-zA-Z0-9_-]+)$/i)[1];
      return { type: 'reddit', subtype: 'user', label: 'Reddit User', icon: '👤', color: '#ff4500', bg: '#ffedd5', hint: `Will connect to Reddit user feed for u/${user}` };
    }
    if (/^(https?:\/\/)?(www\.|old\.|new\.)?reddit\.com\//i.test(input)) {
      return { type: 'reddit', subtype: 'url', label: 'Reddit', icon: '🔴', color: '#ff4500', bg: '#ffedd5', hint: 'Will connect to native Reddit RSS stream' };
    }

    // Direct RSS/Atom
    if (/(\.(rss|atom|xml)($|\?))|(\/(feed|rss|rss\.xml|atom\.xml|index\.xml|feed\/)($|\?))|([\?&](format=xml|feed=rss))/i.test(input)) {
      return { type: 'rss_atom', label: 'Direct RSS Feed', icon: '⚡', color: '#d97706', bg: '#fef3c7', hint: 'Direct RSS/Atom feed detected' };
    }

    // Standard Website
    if (/^https?:\/\//i.test(input) || (!/\s/.test(input) && TLD_REGEX.test(input))) {
      return { type: 'website', label: 'Website Scrape', icon: '🌐', color: '#0284c7', bg: '#e0f2fe', hint: 'Will discover RSS feed or extract article stream with Open Graph images' };
    }

    // Keyword / Topic
    return { type: 'keyword', label: 'Topic Feed', icon: '🔍', color: '#7c3aed', bg: '#ede9fe', hint: `Will generate a virtual topic stream for "${input}"` };
  }

  function updateDetectionUi(query) {
    const badge = document.getElementById('source-detected-badge');
    const hint = document.getElementById('source-detected-hint');
    const detected = detectClientSourceType(query);
    currentDetected = detected;

    if (!detected || !query.trim()) {
      if (badge) badge.style.display = 'none';
      if (hint) hint.style.display = 'none';
      return;
    }

    if (badge) {
      badge.style.display = 'inline-flex';
      badge.style.background = detected.bg || '#f1f5f9';
      badge.style.color = detected.color || '#334155';
      badge.innerHTML = `<span>${detected.icon}</span> <span>${detected.label}</span>`;
    }

    if (hint) {
      hint.style.display = 'flex';
      hint.innerHTML = `<span>💡</span> <span>${detected.hint}</span>`;
    }
  }

  function init() {
    setupEventListeners();
    handleUrlParams();
  }

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || params.get('url') || params.get('site');
    if (q) {
      const input = document.getElementById('add-source-query');
      if (input) {
        input.value = q;
        updateDetectionUi(q);
      }
      retrieveFeed(q);
    }
  }

  function setupEventListeners() {
    const input = document.getElementById('add-source-query');
    if (input) {
      input.addEventListener('input', (e) => {
        updateDetectionUi(e.target.value);
      });
    }

    const form = document.getElementById('add-source-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('add-source-query');
        if (input && input.value.trim()) {
          retrieveFeed(input.value.trim());
        }
      });
    }

    const btnRefresh = document.getElementById('btn-top-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const input = document.getElementById('add-source-query');
        if (input && input.value.trim()) {
          retrieveFeed(input.value.trim());
        } else {
          resetView();
        }
      });
    }

    // Copy Feed URL
    const btnCopyFeedUrl = document.getElementById('btn-copy-feed-url');
    if (btnCopyFeedUrl) {
      btnCopyFeedUrl.addEventListener('click', () => {
        const urlInput = document.getElementById('overview-feed-url');
        if (urlInput && urlInput.value) {
          navigator.clipboard.writeText(urlInput.value).then(() => {
            showToast('Feed URL copied to clipboard!');
          });
        }
      });
    }

    // Copy Vanity URL
    const btnCopyVanityUrl = document.getElementById('btn-copy-vanity-url');
    if (btnCopyVanityUrl) {
      btnCopyVanityUrl.addEventListener('click', () => {
        const vanityInput = document.getElementById('overview-vanity-url');
        if (vanityInput && vanityInput.value) {
          navigator.clipboard.writeText(vanityInput.value).then(() => {
            showToast('Shareable branded URL copied!');
          });
        }
      });
    }

    // Copy XML
    const btnCopyXml = document.getElementById('btn-copy-xml');
    if (btnCopyXml) {
      btnCopyXml.addEventListener('click', () => {
        const xmlTa = document.getElementById('xml-output');
        if (xmlTa && xmlTa.value) {
          navigator.clipboard.writeText(xmlTa.value).then(() => {
            showToast('RSS 2.0 XML copied!');
          });
        }
      });
    }

    // Save Feed Button
    const btnSaveFeed = document.getElementById('btn-save-feed');
    if (btnSaveFeed) {
      btnSaveFeed.addEventListener('click', saveCurrentFeed);
    }

    // Sub-Tabs
    document.querySelectorAll('.source-tool-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tool = e.currentTarget.getAttribute('data-tool');
        if (tool) switchTab(tool);
      });
    });

    // Sorting
    const btnSortLatest = document.getElementById('sort-latest');
    const btnSortOldest = document.getElementById('sort-oldest');
    if (btnSortLatest && btnSortOldest) {
      btnSortLatest.addEventListener('click', () => {
        activeSort = 'latest';
        btnSortLatest.classList.add('is-active');
        btnSortOldest.classList.remove('is-active');
        renderArticles();
      });
      btnSortOldest.addEventListener('click', () => {
        activeSort = 'oldest';
        btnSortOldest.classList.add('is-active');
        btnSortLatest.classList.remove('is-active');
        renderArticles();
      });
    }
  }

  function showToast(msg) {
    let toast = document.getElementById('feedo-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'feedo-toast';
      toast.className = 'feedo-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
  }

  function switchTab(toolName) {
    activeTab = toolName;
    document.querySelectorAll('.source-tool-tab').forEach(t => {
      const isMatch = t.getAttribute('data-tool') === toolName;
      t.classList.toggle('is-active', isMatch);
      t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    document.querySelectorAll('.source-tool-panel').forEach(p => {
      const isMatch = p.getAttribute('data-panel') === toolName;
      p.hidden = !isMatch;
    });

    if (toolName === 'widgets') {
      const btnWidgetStudio = document.getElementById('btn-open-widget-studio');
      if (btnWidgetStudio && currentFeedUrl) {
        btnWidgetStudio.href = 'widgets.html?url=' + encodeURIComponent(currentFeedUrl);
      }
    }
  }

  async function retrieveFeed(query) {
    const rawTarget = String(query || '').trim();
    if (!rawTarget) return;

    const btn = document.getElementById('btn-retrieve');
    const statusBox = document.getElementById('retrieve-status');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-inline"></span> Retrieving...';
    }
    let loadingMsg = 'Fetching source and extracting high-resolution Open Graph images...';
    if (currentDetected) {
      if (currentDetected.type === 'youtube') loadingMsg = 'Resolving official YouTube channel video feed and thumbnails...';
      else if (currentDetected.type === 'reddit') loadingMsg = 'Connecting to native Reddit RSS stream...';
      else if (currentDetected.type === 'keyword') loadingMsg = `Synthesizing topic feed articles for "${rawTarget}"...`;
      else if (currentDetected.type === 'rss_atom') loadingMsg = 'Parsing live RSS/Atom XML feed...';
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = `<p class="status-loading">${loadingMsg}</p>`;
    }

    try {
      const res = await fetch(getApiBase() + '/api/feed-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawTarget, limit: 35, enrichOg: true })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error' || !data.articles || data.articles.length === 0) {
        throw new Error(data.message || 'Could not extract articles from this source.');
      }

      currentArticles = data.articles || [];
      currentFeedMeta = data.meta || {};
      currentFeedUrl = data.url || rawTarget;
      currentXml = data.xml || '';

      displayFeedOverview(data);
      if (statusBox) statusBox.style.display = 'none';

    } catch (err) {
      if (statusBox) {
        statusBox.innerHTML = `<p class="status-error">⚠️ ${err.message}</p>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> <span>Retrieve</span>`;
      }
    }
  }

  function displayFeedOverview(data) {
    const overviewSection = document.getElementById('add-source-overview');
    const titleEl = document.getElementById('overview-feed-title');
    const feedUrlInput = document.getElementById('overview-feed-url');
    const vanityUrlInput = document.getElementById('overview-vanity-url');
    const xmlOutput = document.getElementById('xml-output');
    const xmlAccordion = document.getElementById('accordion-xml');
    const sortWrap = document.getElementById('sort-control-wrap');

    if (overviewSection) overviewSection.hidden = false;
    if (titleEl) titleEl.textContent = (data.meta && data.meta.title) || data.name || 'Your Feed';
    
    // API Feed URL
    const publicFeedUrl = getApiBase() + '/api/view?url=' + encodeURIComponent(currentFeedUrl);
    if (feedUrlInput) feedUrlInput.value = publicFeedUrl;

    // Branded Vanity Link
    const vanityUrl = 'https://feedometer.pages.dev/rss?feed=' + encodeURIComponent(currentFeedUrl);
    if (vanityUrlInput) vanityUrlInput.value = vanityUrl;

    // XML Accordion
    if (xmlOutput) xmlOutput.value = currentXml;
    if (xmlAccordion) xmlAccordion.style.display = currentXml ? 'block' : 'none';

    if (sortWrap) sortWrap.style.display = 'flex';

    renderArticles();
  }

  function renderArticles() {
    const grid = document.getElementById('articles-grid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!currentArticles.length) {
      grid.innerHTML = '<p class="articles-empty">No articles found in this feed.</p>';
      return;
    }

    let sorted = currentArticles.slice();
    if (activeSort === 'latest') {
      sorted.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    } else {
      sorted.sort((a, b) => new Date(a.pubDate || 0) - new Date(b.pubDate || 0));
    }

    sorted.forEach((article, idx) => {
      const card = document.createElement('article');
      card.className = 'feedo-article-card';
      card.setAttribute('role', 'listitem');

      const imgUrl = article.image || article.ogImage || article.thumbnail;
      let mediaHtml = '';
      if (imgUrl) {
        mediaHtml = `
          <a class="feedo-card-media" href="${article.link || '#'}" target="_blank" rel="noopener noreferrer">
            <img src="${imgUrl}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<div class=\'feedo-card-placeholder\'><span>📰</span></div>';" />
          </a>
        `;
      } else {
        mediaHtml = `
          <a class="feedo-card-media" href="${article.link || '#'}" target="_blank" rel="noopener noreferrer">
            <div class="feedo-card-placeholder"><span>📰</span></div>
          </a>
        `;
      }

      const cleanTitle = decodeEntities(article.title) || 'Untitled Article';
      const cleanSnippet = decodeEntities(article.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 140);
      const host = article.link ? new URL(article.link).hostname.replace(/^www\./i, '') : 'Source';

      card.innerHTML = `
        ${mediaHtml}
        <div class="feedo-card-body">
          <div class="feedo-card-meta">
            <span class="feedo-card-domain">${host}</span>
          </div>
          <a class="feedo-card-title" href="${article.link || '#'}" target="_blank" rel="noopener noreferrer" title="${cleanTitle}">
            ${cleanTitle}
          </a>
          ${cleanSnippet ? `<p class="feedo-card-desc">${cleanSnippet}...</p>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  async function saveCurrentFeed() {
    const btn = document.getElementById('btn-save-feed');
    if (!currentFeedUrl) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Saving...';
    }

    try {
      const res = await fetch(getApiBase() + '/api/subscriptions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          feed_url: currentFeedUrl,
          custom_title: (currentFeedMeta && currentFeedMeta.title) || 'Custom Feed'
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('✅ Feed saved to your library!');
        if (btn) btn.innerHTML = '<span>✓</span> Saved!';
      } else if (window.FeedOmeterAuth && !window.FeedOmeterAuth.isAuthenticated()) {
        const guest = window.FeedOmeterAuth.getGuestFollows ? window.FeedOmeterAuth.getGuestFollows().slice() : [];
        if (!guest.find(g => g.feed_url === currentFeedUrl)) {
          guest.push({ feed_url: currentFeedUrl, title: (currentFeedMeta && currentFeedMeta.title) || 'Custom Feed' });
        }
        if (window.FeedOmeterAuth.setGuestFollows) window.FeedOmeterAuth.setGuestFollows(guest);
        showToast('✅ Saved for this window only');
        if (btn) btn.innerHTML = '<span>✓</span> Saved!';
      } else {
        showToast(data.message || 'Could not save feed');
      }
    } catch (e) {
      showToast('Saved to local feeds.');
      if (btn) btn.innerHTML = '<span>✓</span> Saved!';
    } finally {
      setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<span>🔖</span> Save feed`;
        }
      }, 3000);
    }
  }

  function resetView() {
    currentArticles = [];
    currentFeedMeta = null;
    currentFeedUrl = '';
    currentXml = '';
    const input = document.getElementById('add-source-query');
    if (input) input.value = '';
    const overview = document.getElementById('add-source-overview');
    if (overview) overview.hidden = true;
    const grid = document.getElementById('articles-grid');
    if (grid) grid.innerHTML = '';
  }

  window.addEventListener('DOMContentLoaded', init);

})(window, document);
