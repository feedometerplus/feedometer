/**
 * Feedometer - Public Web-to-RSS Feed Builder
 * Preview UI for Worker /api/build (HTML → RSS). Scrape lives on the Worker.
 */

(function () {
  'use strict';

  // DOM Elements
  const siteUrlInput = document.getElementById('site-url-input');
  const btnBuildFeed = document.getElementById('btn-build-feed');
  const builderResult = document.getElementById('builder-result');
  const previewContainer = document.getElementById('preview-container');
  const xmlOutputBox = document.getElementById('xml-output-box');
  const btnCopyXml = document.getElementById('btn-copy-xml');
  const btnDownloadXml = document.getElementById('btn-download-xml');
  const btnOpenInViewer = document.getElementById('btn-open-in-viewer');
  const shareFeedUrlInput = document.getElementById('share-feed-url-input');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');
  const btnCopyInlineUrl = document.getElementById('btn-copy-inline-url');
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorContainer = document.getElementById('error-container');

  let generatedXmlString = '';
  let generatedFeedUrl = '';
  let shareableReaderUrl = '';

  function init() {
    setupEventListeners();

    const urlParams = new URLSearchParams(window.location.search);
    const siteParam = urlParams.get('url') || urlParams.get('site');
    if (siteParam) {
      siteUrlInput.value = siteParam;
      buildRssFeed(siteParam);
    }
  }

  function setupEventListeners() {
    btnBuildFeed.addEventListener('click', () => {
      const url = siteUrlInput.value.trim();
      if (url) buildRssFeed(url);
    });

    siteUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = siteUrlInput.value.trim();
        if (url) buildRssFeed(url);
      }
    });

    function showToast(msg) {
      const toast = document.getElementById('discovery-toast');
      const toastMsg = document.getElementById('toast-message');
      if (toast && toastMsg) {
        toastMsg.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 2500);
      }
    }

    const copyShareLinkAction = () => {
      if (!shareableReaderUrl) return;
      navigator.clipboard.writeText(shareableReaderUrl).then(() => {
        showToast('Shareable link copied to clipboard!');
        if (btnCopyShareUrl) {
          const origText = btnCopyShareUrl.textContent;
          btnCopyShareUrl.textContent = '✅ Copied Share Link!';
          setTimeout(() => { btnCopyShareUrl.textContent = origText; }, 2000);
        }
        if (btnCopyInlineUrl) {
          const origText = btnCopyInlineUrl.textContent;
          btnCopyInlineUrl.textContent = '✅ Copied!';
          setTimeout(() => { btnCopyInlineUrl.textContent = origText; }, 2000);
        }
      });
    };

    if (btnCopyShareUrl) btnCopyShareUrl.addEventListener('click', copyShareLinkAction);
    if (btnCopyInlineUrl) btnCopyInlineUrl.addEventListener('click', copyShareLinkAction);

    btnCopyXml.addEventListener('click', () => {
      if (!generatedXmlString) return;
      navigator.clipboard.writeText(generatedXmlString).then(() => {
        showToast('RSS 2.0 XML copied to clipboard!');
        const origText = btnCopyXml.textContent;
        btnCopyXml.textContent = '✅ Copied XML!';
        setTimeout(() => { btnCopyXml.textContent = origText; }, 2000);
      });
    });

    btnDownloadXml.addEventListener('click', () => {
      if (!generatedXmlString) return;
      const blob = new Blob([generatedXmlString], { type: 'application/rss+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'feedometer-feed.xml';
      link.click();
      showToast('Downloaded feedometer-feed.xml!');
    });

    btnOpenInViewer.addEventListener('click', () => {
      if (generatedFeedUrl) {
        window.location.href = `index.html?url=${encodeURIComponent(generatedFeedUrl)}`;
      }
    });

    document.querySelectorAll('.sample-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const site = e.currentTarget.getAttribute('data-site');
        if (site) {
          siteUrlInput.value = site;
          buildRssFeed(site);
        }
      });
    });

    // Terms Modal setup
    setupTermsModal();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const termsModal = document.getElementById('terms-modal');
        if (termsModal && termsModal.classList.contains('active')) {
          termsModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
  }

  function setupTermsModal() {
    const termsModal = document.getElementById('terms-modal');
    const termsClose = document.getElementById('terms-modal-close');
    const termsTriggers = document.querySelectorAll('.terms-trigger, #terms-link');

    termsTriggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (termsModal) {
          termsModal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      });
    });

    if (termsClose) {
      termsClose.addEventListener('click', () => {
        if (termsModal) {
          termsModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }

    if (termsModal) {
      termsModal.addEventListener('click', (e) => {
        if (e.target === termsModal) {
          termsModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  }

  const WORKER_BASE = (window.FEEDOMETER_API_BASE || '').replace(/\/$/, '');
  const LOCAL_WORKER = (window.FEEDOMETER_LOCAL_API || '').replace(/\/$/, '');

  function looksLikeUrl(raw) {
    const u = String(raw || '').trim();
    if (!u || /\s/.test(u)) return false;
    if (/^https?:\/\//i.test(u)) return true;
    return u.includes('.') && !u.startsWith('javascript:');
  }

  async function requestBuild(base, rawUrl) {
    if (!base) return null;
    const workerUrl = `${base}/api/build?url=${encodeURIComponent(rawUrl)}`;
    const res = await fetch(workerUrl);
    const json = await res.json().catch(() => null);
    if (json && json.code === 'capacity') {
      const err = new Error('capacity');
      err.code = 'capacity';
      throw err;
    }
    if (json && json.ok && json.xml && Array.isArray(json.items)) {
      return json;
    }
    if (json && (json.error || json.message)) {
      const err = new Error(json.message || json.error);
      throw err;
    }
    return null;
  }

  async function buildRssFeed(rawUrl) {
    showLoading(true);
    showError(false);
    builderResult.style.display = 'none';

    try {
      const targetUrl = String(rawUrl || '').trim();
      if (!looksLikeUrl(targetUrl)) {
        throw new Error('Please enter a valid website URL.');
      }
      siteUrlInput.value = targetUrl;

      let json = null;
      if (LOCAL_WORKER) {
        try { json = await requestBuild(LOCAL_WORKER, targetUrl); } catch (e) {
          if (e && e.code === 'capacity') throw e;
        }
      }
      if (!json) {
        json = await requestBuild(WORKER_BASE, targetUrl);
      }
      if (!json) {
        throw new Error('We couldn\'t build a feed from this address. Try again later.');
      }

      generatedXmlString = json.xml;
      generatedFeedUrl = json.siteUrl || targetUrl;
      siteUrlInput.value = generatedFeedUrl;

      let baseUrl = 'https://feedometer.pages.dev/index.html';
      if (window.location.protocol.startsWith('http')) {
        baseUrl = window.location.origin + window.location.pathname.replace(/builder\.html$/, 'index.html');
      }
      shareableReaderUrl = `${baseUrl}?url=${encodeURIComponent(generatedFeedUrl)}`;
      if (shareFeedUrlInput) {
        shareFeedUrlInput.value = shareableReaderUrl;
      }

      renderPreview(json.meta, json.items);
      xmlOutputBox.textContent = generatedXmlString;
      builderResult.style.display = 'block';

    } catch (err) {
      console.error(err);
      if (err && err.code === 'capacity') {
        showError(true, 'Free builder is busy. Try again in a few hours.');
      } else {
        showError(true, err.message || 'Failed to generate RSS feed.');
      }
    } finally {
      showLoading(false);
    }
  }

  function formatCardTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return String(dateStr).split(' ').slice(0, 4).join(' ');
      }
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return String(dateStr).split(' ').slice(0, 4).join(' ');
    }
  }

  function getDomainName(url, defaultName = 'Web Source') {
    try {
      if (!url) return defaultName;
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      let host = u.hostname.replace(/^www\./, '');
      const parts = host.split('.');
      if (parts.length >= 2) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
      return host;
    } catch (_) {
      return defaultName;
    }
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

  function getFallbackCover(title, sourceName, idx) {
    const gradients = [
      ['#1e293b', '#0f172a'],
      ['#0369a1', '#075985'],
      ['#4338ca', '#312e81'],
      ['#047857', '#064e3b'],
      ['#b45309', '#78350f'],
      ['#be185d', '#831843'],
      ['#374151', '#111827']
    ];
    const [c1, c2] = gradients[idx % gradients.length];
    const initial = (sourceName || 'N').charAt(0).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><defs><linearGradient id="g${idx}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="240" fill="url(#g${idx})"/><g fill="#ffffff" opacity="0.08"><circle cx="360" cy="40" r="90"/><circle cx="50" cy="200" r="70"/></g><text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="800" font-size="46" opacity="0.9">${initial}</text><text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-weight="600" font-size="13" letter-spacing="1" opacity="0.7">${escapeXml(sourceName || 'FeedOmeter').toUpperCase()}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function renderPreview(meta, items) {
    const sourceTitle = meta.title || getDomainName(generatedFeedUrl, 'Web Source');

    previewContainer.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 750; color: #0f172a; margin-bottom: 0.25rem;">${escapeHtml(meta.title)}</h3>
        <p style="color: #64748b; font-size: 0.9rem; line-height: 1.5;">${escapeHtml(meta.description)}</p>
        <div style="margin-top: 0.65rem;">
          <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 0.2rem 0.65rem; border-radius: 8px; font-size: 0.78rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
            ✅ ${items.length} Articles Extracted
          </span>
        </div>
      </div>
      <div class="cards-grid">
        ${items.map((item, idx) => {
          const itemSource = sourceTitle || getDomainName(item.link, 'Web Source');
          const timeText = formatCardTime(item.pubDate || item.publishedAt);
          const fallbackCover = getFallbackCover(item.title, itemSource, idx);
          const imgSrc = item.image || fallbackCover;

          return `
            <article class="article-card">
              <div class="article-card-media">
                <img 
                  src="${escapeHtml(imgSrc)}" 
                  alt="${escapeHtml(item.title)}" 
                  loading="lazy" 
                  onerror="this.onerror=null;this.src='${fallbackCover}';"
                >
              </div>
              <div class="article-card-body">
                <div class="article-meta-row">
                  <span class="article-source-pill" title="${escapeHtml(itemSource)}">${escapeHtml(itemSource)}</span>
                  <span class="article-date-text">${escapeHtml(timeText)}</span>
                </div>
                <h4 class="article-card-title" title="${escapeHtml(item.title)}">
                  <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                </h4>
                <div class="article-card-footer">
                  <div class="card-footer-icons-left">
                    <button class="card-icon-action btn-card-star" title="Bookmark article" aria-label="Bookmark">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                    <button class="card-icon-action btn-card-doc" title="Article summary" aria-label="Summary">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </button>
                  </div>
                  <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="card-icon-action" title="Open full article" aria-label="Open article">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                  </a>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    // Attach click handlers to star & doc buttons
    previewContainer.querySelectorAll('.btn-card-star').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.toggle('starred');
        const isStarred = btn.classList.contains('starred');
        const svg = btn.querySelector('svg');
        if (isStarred) {
          svg.setAttribute('fill', '#f59e0b');
          svg.setAttribute('stroke', '#f59e0b');
          showToast('Article saved to bookmarks!');
        } else {
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          showToast('Removed from bookmarks');
        }
      });
    });

    previewContainer.querySelectorAll('.btn-card-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('Article details ready in reader');
      });
    });
  }

  function showLoading(show) {
    if (loadingSpinner) loadingSpinner.style.display = show ? 'block' : 'none';
  }

  function showError(show, msg = '') {
    if (errorContainer) {
      errorContainer.style.display = show ? 'block' : 'none';
      if (show) {
        errorContainer.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 1rem 1.25rem; color: #991b1b;">
            <strong>⚠️ Web-to-RSS Error:</strong> ${escapeHtml(msg)}
          </div>
        `;
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
