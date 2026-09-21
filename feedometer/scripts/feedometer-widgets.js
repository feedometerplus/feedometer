/**
 * scripts/feedometer-widgets.js — FeedOmeter 2.1 Widget Studio Controller
 * Live Canvas Engine, 6 Layouts, Real-time Theme/Color/Typography Customization, Pagination & Embed Exporter
 */

(function (window, document) {
  'use strict';

  function getApiBase() {
    if (window.FEEDOMETER_API_BASE) {
      return window.FEEDOMETER_API_BASE.replace(/\/+$/, '');
    }
    if (window.FeedOmeterConfig && window.FeedOmeterConfig.API_BASE_URL) {
      return window.FeedOmeterConfig.API_BASE_URL.replace(/\/+$/, '');
    }
    if (window.FEEDOMETER_CONFIG && window.FEEDOMETER_CONFIG.API_BASE) {
      return window.FEEDOMETER_CONFIG.API_BASE.replace(/\/+$/, '');
    }
    return 'https://feedometer-api.feedometer.workers.dev';
  }

  function decodeEntities(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return '';
    }
  }

  // Default Widget State
  const widgetState = {
    title: 'Live News Feed',
    feedUrl: '',
    layout: 'news-wall',
    theme: 'light',
    accentColor: '#10b981',
    radius: '12px',
    font: "'Inter', sans-serif",
    itemsPerPage: 6,
    currentPage: 1,
    showThumbnails: true,
    showDescriptions: true,
    showDate: true,
    viewport: 'desktop',
    articles: []
  };

  // Sample seed articles if no URL loaded yet
  const sampleArticles = [
    {
      title: 'Global Tech & AI Summit Unveils Next-Gen Neural Acceleration Chips',
      link: '#',
      description: 'Industry leaders gather to showcase breakthrough neural processing architectures delivering 10x compute efficiency.',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
      source: 'TechPulse',
      pubDate: new Date().toISOString()
    },
    {
      title: 'Clean Energy Transition Accelerates Across Coastal Power Grids',
      link: '#',
      description: 'Offshore wind developments surpass quarterly generation projections with innovative storage integration.',
      image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=80',
      source: 'GreenWire',
      pubDate: new Date().toISOString()
    },
    {
      title: 'Space Exploration Agency Schedules Autonomous Rover Lunar Deployment',
      link: '#',
      description: 'New landing system completes extreme environmental stress tests ahead of scheduled launch.',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
      source: 'Cosmos News',
      pubDate: new Date().toISOString()
    },
    {
      title: 'Global Financial Markets Rally on Positive Manufacturing Indicators',
      link: '#',
      description: 'Supply chain index rebound powers broad-based international equity advances.',
      image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
      source: 'MarketSphere',
      pubDate: new Date().toISOString()
    },
    {
      title: 'Biotech Breakthrough: Rapid Molecular Screening Accelerates Therapeutics',
      link: '#',
      description: 'Computational modeling identifies key peptide candidates for targeted cellular repair.',
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=80',
      source: 'BioTech Daily',
      pubDate: new Date().toISOString()
    },
    {
      title: 'Autonomous Transportation Systems Complete Million-Mile Safety Trial',
      link: '#',
      description: 'Next-generation sensor fusion and real-time mapping pass rigorous urban safety audits.',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      source: 'AutoDrive',
      pubDate: new Date().toISOString()
    }
  ];

  function init() {
    loadSavedPreferences();
    setupEventListeners();
    handleUrlParams();
  }

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const feed = params.get('feed') || params.get('url');

    if (feed) {
      widgetState.feedUrl = feed;
      widgetState.currentPage = 1;
      const urlInput = document.getElementById('ws-feed-url');
      if (urlInput) urlInput.value = feed;

      // 1. Try instant cache transfer from Add Source preview in sessionStorage
      let usedCache = false;
      try {
        const cachedRaw = sessionStorage.getItem('feedometer_last_preview');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const isMatch = (cached.feedUrl && cached.feedUrl === feed) ||
                          (cached.rawUrl && (feed.includes(encodeURIComponent(cached.rawUrl)) || feed === cached.rawUrl));
          
          if (isMatch && Array.isArray(cached.articles) && cached.articles.length > 0) {
            widgetState.articles = cached.articles;
            widgetState.title = cached.title || cached.name || 'Live Feed';
            
            const titleInput = document.getElementById('ws-widget-title');
            if (titleInput) titleInput.value = widgetState.title;
            
            const statusText = document.getElementById('ws-live-status');
            if (statusText) statusText.textContent = `Loaded ${cached.articles.length} live items`;

            saveState();
            renderLiveCanvas();
            usedCache = true;
          }
        }
      } catch (_) {}

      // 2. If no cache match, fetch live from backend
      if (!usedCache) {
        renderSkeletonCanvas();
        loadFeedData(feed);
      }
    } else {
      loadLivePublicStream();
    }
  }

  function loadSavedPreferences() {
    try {
      const raw = localStorage.getItem('feedometer_widget_state');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.layout) widgetState.layout = saved.layout;
        if (saved.theme) widgetState.theme = saved.theme;
        if (saved.accentColor) widgetState.accentColor = saved.accentColor;
        if (saved.radius) widgetState.radius = saved.radius;
        if (saved.font) widgetState.font = saved.font;
        if (saved.itemsPerPage) widgetState.itemsPerPage = saved.itemsPerPage;
        if (typeof saved.showThumbnails === 'boolean') widgetState.showThumbnails = saved.showThumbnails;
        if (typeof saved.showDescriptions === 'boolean') widgetState.showDescriptions = saved.showDescriptions;
        if (typeof saved.showDate === 'boolean') widgetState.showDate = saved.showDate;
      }
    } catch (_) {}
  }

  function saveState() {
    try {
      localStorage.setItem('feedometer_widget_state', JSON.stringify({
        title: widgetState.title,
        layout: widgetState.layout,
        theme: widgetState.theme,
        accentColor: widgetState.accentColor,
        radius: widgetState.radius,
        font: widgetState.font,
        itemsPerPage: widgetState.itemsPerPage,
        showThumbnails: widgetState.showThumbnails,
        showDescriptions: widgetState.showDescriptions,
        showDate: widgetState.showDate
      }));
    } catch (_) {}
  }

  function setupEventListeners() {
    // Title Input
    const titleInput = document.getElementById('ws-widget-title');
    if (titleInput) {
      titleInput.value = widgetState.title;
      titleInput.addEventListener('input', (e) => {
        widgetState.title = e.target.value;
        saveState();
        renderLiveCanvas();
      });
    }

    // Feed Search & Load
    const feedInput = document.getElementById('ws-feed-url');
    const btnLoadFeed = document.getElementById('ws-btn-load-feed');
    if (feedInput && btnLoadFeed) {
      const triggerLoad = () => {
        const val = feedInput.value.trim();
        if (val) {
          widgetState.feedUrl = val;
          widgetState.currentPage = 1;
          renderSkeletonCanvas();
          loadFeedData(val);
        }
      };
      btnLoadFeed.addEventListener('click', triggerLoad);
      feedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerLoad();
      });
    }

    // Layout Pickers
    document.querySelectorAll('.ws-layout-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const layout = e.currentTarget.getAttribute('data-layout');
        if (layout) {
          widgetState.layout = layout;
          document.querySelectorAll('.ws-layout-card').forEach(c => c.classList.toggle('is-active', c === card));
          saveState();
          renderLiveCanvas();
        }
      });
    });

    // Theme Preset Select
    const themeSelect = document.getElementById('ws-theme-select');
    if (themeSelect) {
      themeSelect.value = widgetState.theme;
      themeSelect.addEventListener('change', (e) => {
        widgetState.theme = e.target.value;
        saveState();
        renderLiveCanvas();
      });
    }

    // Accent Color Picker
    const colorInput = document.getElementById('ws-color-accent');
    if (colorInput) {
      colorInput.value = widgetState.accentColor;
      colorInput.addEventListener('input', (e) => {
        widgetState.accentColor = e.target.value;
        saveState();
        renderLiveCanvas();
      });
    }

    // Radius Select
    const radiusSelect = document.getElementById('ws-radius-select');
    if (radiusSelect) {
      radiusSelect.value = widgetState.radius;
      radiusSelect.addEventListener('change', (e) => {
        widgetState.radius = e.target.value;
        saveState();
        renderLiveCanvas();
      });
    }

    // Font Select
    const fontSelect = document.getElementById('ws-font-select');
    if (fontSelect) {
      fontSelect.value = widgetState.font;
      fontSelect.addEventListener('change', (e) => {
        widgetState.font = e.target.value;
        saveState();
        renderLiveCanvas();
      });
    }

    // Items Per Page Slider
    const itemsSlider = document.getElementById('ws-items-slider');
    const itemsCountLabel = document.getElementById('ws-items-count-label');
    if (itemsSlider) {
      itemsSlider.value = widgetState.itemsPerPage;
      if (itemsCountLabel) itemsCountLabel.textContent = widgetState.itemsPerPage;
      itemsSlider.addEventListener('input', (e) => {
        widgetState.itemsPerPage = parseInt(e.target.value, 10);
        widgetState.currentPage = 1;
        if (itemsCountLabel) itemsCountLabel.textContent = widgetState.itemsPerPage;
        saveState();
        renderLiveCanvas();
      });
    }

    // Toggles
    const toggleThumb = document.getElementById('ws-toggle-thumbnails');
    if (toggleThumb) {
      toggleThumb.checked = widgetState.showThumbnails;
      toggleThumb.addEventListener('change', (e) => {
        widgetState.showThumbnails = e.target.checked;
        saveState();
        renderLiveCanvas();
      });
    }

    const toggleDesc = document.getElementById('ws-toggle-desc');
    if (toggleDesc) {
      toggleDesc.checked = widgetState.showDescriptions;
      toggleDesc.addEventListener('change', (e) => {
        widgetState.showDescriptions = e.target.checked;
        saveState();
        renderLiveCanvas();
      });
    }

    const toggleDate = document.getElementById('ws-toggle-date');
    if (toggleDate) {
      toggleDate.checked = widgetState.showDate;
      toggleDate.addEventListener('change', (e) => {
        widgetState.showDate = e.target.checked;
        saveState();
        renderLiveCanvas();
      });
    }

    // Viewport Switchers
    document.querySelectorAll('.ws-viewport-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vp = e.currentTarget.getAttribute('data-viewport');
        if (vp) {
          widgetState.viewport = vp;
          document.querySelectorAll('.ws-viewport-btn').forEach(b => b.classList.toggle('is-active', b === btn));
          const canvas = document.getElementById('ws-preview-canvas');
          if (canvas) {
            canvas.className = 'ws-preview-canvas view-' + vp;
          }
        }
      });
    });

    // Embed Code Modal
    const btnGetCode = document.getElementById('ws-btn-get-code');
    const modalEmbed = document.getElementById('ws-modal-embed');
    const btnCloseEmbed = document.getElementById('ws-modal-close-embed');
    if (btnGetCode && modalEmbed) {
      btnGetCode.addEventListener('click', () => {
        generateEmbedCode();
        modalEmbed.hidden = false;
      });
    }
    if (btnCloseEmbed && modalEmbed) {
      btnCloseEmbed.addEventListener('click', () => { modalEmbed.hidden = true; });
    }

    // Analytics Modal
    const btnAnalytics = document.getElementById('ws-btn-analytics');
    const modalAnalytics = document.getElementById('ws-modal-analytics');
    const btnCloseAnalytics = document.getElementById('ws-modal-close-analytics');
    if (btnAnalytics && modalAnalytics) {
      btnAnalytics.addEventListener('click', () => { modalAnalytics.hidden = false; });
    }
    if (btnCloseAnalytics && modalAnalytics) {
      btnCloseAnalytics.addEventListener('click', () => { modalAnalytics.hidden = true; });
    }
  }

  async function loadLivePublicStream() {
    const statusText = document.getElementById('ws-live-status');
    try {
      const res = await fetch(getApiBase() + '/api/stream?limit=12');
      const data = await res.json();
      if (data.items && data.items.length) {
        widgetState.articles = data.items.map((i) => ({
          title: i.title,
          link: i.link || i.url,
          description: i.summary || i.snippet || '',
          image: i.image || i.image_url || '',
          source: (i.source && i.source.title) || 'Feed',
          pubDate: i.published
        }));
        if (statusText) statusText.textContent = 'Live public stream (' + widgetState.articles.length + ' items)';
        renderLiveCanvas();
        return;
      }
    } catch (e) {}
    if (statusText) statusText.textContent = 'Sample preview (not live)';
    widgetState.articles = sampleArticles;
    renderLiveCanvas();
  }

  async function loadFeedData(rawFeedUrl) {
    const statusText = document.getElementById('ws-live-status');
    if (statusText) statusText.textContent = 'Loading live feed items...';

    // Extract target if it's an API view URL
    let target = rawFeedUrl;
    try {
      if (rawFeedUrl.includes('/api/view')) {
        const parsed = new URL(rawFeedUrl, window.location.origin);
        target = parsed.searchParams.get('url') || parsed.searchParams.get('q') || rawFeedUrl;
      }
    } catch (_) {}

    try {
      const res = await fetch(getApiBase() + '/api/feed-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, limit: 35, enrichOg: true })
      });

      const data = await res.json();
      if (res.ok && data.articles && data.articles.length > 0) {
        widgetState.articles = data.articles;
        widgetState.feedUrl = rawFeedUrl;
        widgetState.currentPage = 1;

        // Always update title to match the incoming feed
        const freshTitle = (data.meta && data.meta.title) || data.name || 'Live Feed';
        widgetState.title = freshTitle;
        const titleIn = document.getElementById('ws-widget-title');
        if (titleIn) titleIn.value = freshTitle;

        if (statusText) statusText.textContent = `Loaded ${data.articles.length} live items`;
        saveState();
      } else {
        if (statusText) statusText.textContent = 'Showing sample preview data';
        widgetState.articles = sampleArticles;
      }
    } catch (_) {
      if (statusText) statusText.textContent = 'Showing sample preview data';
      widgetState.articles = sampleArticles;
    }

    renderLiveCanvas();
  }

  function renderSkeletonCanvas() {
    const canvas = document.getElementById('ws-preview-canvas');
    if (!canvas) return;

    let skeletonCards = '';
    for (let i = 0; i < 6; i++) {
      skeletonCards += `
        <div class="widget-card" style="opacity: 0.6; pointer-events: none;">
          <div class="widget-card-media" style="background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: wsPulse 1.5s infinite; height: 140px;"></div>
          <div class="widget-card-body">
            <div style="height: 12px; width: 40%; background: #e2e8f0; border-radius: 4px; margin-bottom: 8px;"></div>
            <div style="height: 16px; width: 90%; background: #e2e8f0; border-radius: 4px; margin-bottom: 6px;"></div>
            <div style="height: 12px; width: 70%; background: #f1f5f9; border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }

    canvas.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#0f172a;">Loading live feed...</h3>
        <span style="font-size:0.75rem; font-weight:700; color:#10b981; text-transform:uppercase;">● Live Widget</span>
      </div>
      <div class="widget-layout-${widgetState.layout}">
        ${skeletonCards}
      </div>
    `;
  }

  function renderLiveCanvas() {
    const canvas = document.getElementById('ws-preview-canvas');
    if (!canvas) return;

    // Apply Theme Colors
    let bg = '#ffffff';
    let cardBg = '#ffffff';
    let border = '#e2e8f0';
    let text = '#0f172a';
    let textMuted = '#64748b';

    if (widgetState.theme === 'dark') {
      bg = '#0f172a';
      cardBg = '#1e293b';
      border = '#334155';
      text = '#f8fafc';
      textMuted = '#94a3b8';
    } else if (widgetState.theme === 'slate') {
      bg = '#f1f5f9';
      cardBg = '#ffffff';
      border = '#cbd5e1';
      text = '#1e293b';
      textMuted = '#64748b';
    } else if (widgetState.theme === 'glass') {
      bg = 'rgba(255, 255, 255, 0.7)';
      cardBg = 'rgba(255, 255, 255, 0.85)';
      border = 'rgba(255, 255, 255, 0.4)';
      text = '#0f172a';
      textMuted = '#475569';
    } else if (widgetState.theme === 'transparent') {
      bg = 'transparent';
      cardBg = 'transparent';
      border = '#e2e8f0';
      text = '#0f172a';
      textMuted = '#64748b';
    }

    canvas.style.backgroundColor = bg;
    canvas.style.fontFamily = widgetState.font;
    canvas.style.setProperty('--w-card-bg', cardBg);
    canvas.style.setProperty('--w-card-border', border);
    canvas.style.setProperty('--w-card-radius', widgetState.radius);
    canvas.style.setProperty('--w-accent', widgetState.accentColor);
    canvas.style.setProperty('--w-text', text);
    canvas.style.setProperty('--w-text-muted', textMuted);

    const totalArticles = widgetState.articles.length;
    const itemsPerPage = Math.max(1, widgetState.itemsPerPage || 6);
    const totalPages = Math.max(1, Math.ceil(totalArticles / itemsPerPage));

    if (widgetState.currentPage > totalPages) widgetState.currentPage = totalPages;
    if (widgetState.currentPage < 1) widgetState.currentPage = 1;

    const startIndex = (widgetState.currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalArticles);
    const pageItems = widgetState.articles.slice(startIndex, endIndex);

    let html = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:${text};">${widgetState.title}</h3>
        <span style="font-size:0.75rem; font-weight:700; color:${widgetState.accentColor}; text-transform:uppercase;">● Live Widget</span>
      </div>
      <div class="widget-layout-${widgetState.layout}">
    `;

    pageItems.forEach(article => {
      const img = article.image || article.ogImage || article.thumbnail;
      let mediaHtml = '';
      if (widgetState.showThumbnails) {
        if (img) {
          mediaHtml = `
            <div class="widget-card-media">
              <img src="${img}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<div class=\\'widget-card-placeholder\\'><span>📰</span></div>';" />
            </div>
          `;
        } else {
          mediaHtml = `
            <div class="widget-card-media">
              <div class="widget-card-placeholder"><span>📰</span></div>
            </div>
          `;
        }
      }

      let host = 'SOURCE';
      if (article.link) {
        try { host = new URL(article.link).hostname.replace(/^www\./i, ''); } catch (_) {}
      } else if (article.source) {
        host = article.source;
      }

      const cleanTitle = decodeEntities(article.title) || 'Untitled Article';
      const cleanSnippet = decodeEntities(article.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 140);

      const metaHtml = widgetState.showDate
        ? `<div class="widget-card-meta"><span class="widget-card-domain">${host}</span></div>`
        : '';

      const descHtml = (widgetState.showDescriptions && cleanSnippet)
        ? `<p class="widget-card-desc">${cleanSnippet}...</p>`
        : '';

      html += `
        <a class="widget-card" href="${article.link || '#'}" target="_blank" rel="noopener noreferrer" title="${cleanTitle}">
          ${mediaHtml}
          <div class="widget-card-body">
            ${metaHtml}
            <div class="widget-card-title">${cleanTitle}</div>
            ${descHtml}
          </div>
        </a>
      `;
    });

    html += '</div>';

    // Render Pagination Bar when total articles exceeds itemsPerPage
    if (totalPages > 1) {
      let pageButtons = '';
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= widgetState.currentPage - 1 && p <= widgetState.currentPage + 1)) {
          pageButtons += `<button type="button" class="ws-page-btn ${p === widgetState.currentPage ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
        } else if (p === widgetState.currentPage - 2 || p === widgetState.currentPage + 2) {
          pageButtons += `<span style="padding:0 4px; color:${textMuted}; font-weight:700;">...</span>`;
        }
      }

      html += `
        <div class="ws-pagination-bar">
          <span class="ws-pagination-info">Showing ${startIndex + 1}–${endIndex} of ${totalArticles} items</span>
          <div class="ws-pagination-actions">
            <button type="button" class="ws-page-btn" data-page="${widgetState.currentPage - 1}" ${widgetState.currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>
            ${pageButtons}
            <button type="button" class="ws-page-btn" data-page="${widgetState.currentPage + 1}" ${widgetState.currentPage === totalPages ? 'disabled' : ''}>Next ›</button>
          </div>
        </div>
      `;
    }

    canvas.innerHTML = html;

    // Attach Pagination Click Handlers
    canvas.querySelectorAll('.ws-page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = parseInt(e.currentTarget.getAttribute('data-page'), 10);
        if (targetPage >= 1 && targetPage <= totalPages && targetPage !== widgetState.currentPage) {
          widgetState.currentPage = targetPage;
          renderLiveCanvas();
          const wrap = document.querySelector('.ws-preview-canvas-wrap');
          if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  function generateEmbedCode() {
    const feed = encodeURIComponent(widgetState.feedUrl || 'https://www.bbc.com/sport');
    const height = widgetState.layout === 'ticker' ? '60' : '600';
    const iframeCode = `<iframe src="https://feedometer.pages.dev/embed.html?feed=${feed}&layout=${widgetState.layout}&theme=${widgetState.theme}&accent=${encodeURIComponent(widgetState.accentColor)}" width="100%" height="${height}" frameborder="0" style="border:none; border-radius:${widgetState.radius}; overflow:hidden;"></iframe>`;

    const scriptCode = `<div id="feedometer-widget" data-feed="${feed}" data-layout="${widgetState.layout}" data-theme="${widgetState.theme}"></div>
<script async src="https://feedometer.pages.dev/scripts/feedometer-widgets.bundle.js"></script>`;

    const iframeBox = document.getElementById('ws-embed-iframe-code');
    const scriptBox = document.getElementById('ws-embed-script-code');
    if (iframeBox) iframeBox.value = iframeCode;
    if (scriptBox) scriptBox.value = scriptCode;
  }

  window.addEventListener('DOMContentLoaded', init);

})(window, document);
