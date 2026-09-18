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

    const copyShareLinkAction = () => {
      if (!shareableReaderUrl) return;
      navigator.clipboard.writeText(shareableReaderUrl).then(() => {
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
        const origText = btnCopyXml.textContent;
        btnCopyXml.textContent = '✅ Copied to Clipboard!';
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
    if (json && json.error) {
      const err = new Error(json.error);
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

  function renderPreview(meta, items) {
    previewContainer.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">${escapeHtml(meta.title)}</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHtml(meta.description)}</p>
        <div style="margin-top: 0.5rem;">
          <span class="status-badge badge-pass">✅ ${items.length} Articles Extracted</span>
        </div>
      </div>
      <div class="cards-grid">
        ${items.map(item => `
          <div class="briefing-card">
            ${item.image ? `<div class="card-media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy"></div>` : ''}
            <div class="card-content">
              <div class="card-meta-top">
                <span class="card-source">WEB-TO-RSS</span>
                <span>${escapeHtml(String(item.pubDate || item.publishedAt || '').split(' ').slice(0, 4).join(' '))}</span>
              </div>
              <h4 class="card-title"><a href="${escapeHtml(item.link)}" target="_blank">${escapeHtml(item.title)}</a></h4>
              <p class="card-snippet">${escapeHtml(item.description)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
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
