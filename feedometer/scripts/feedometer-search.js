/**
 * scripts/feedometer-search.js — Live catalog search (D1 articles + feed find)
 */
(function (global) {
  'use strict';

  function apiBase() {
    return (global.FEEDOMETER_API_BASE ||
      (global.FeedOmeterConfig && global.FeedOmeterConfig.API_BASE_URL) ||
      'https://feedometer-api.feedometer.workers.dev').replace(/\/$/, '');
  }

  function authHeaders() {
    if (global.FeedOmeterAuth && global.FeedOmeterAuth.getAuthHeaders) {
      return global.FeedOmeterAuth.getAuthHeaders();
    }
    return { 'Content-Type': 'application/json' };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function runSearch(query) {
    const container = document.getElementById('story-container');
    const headerTitle = document.getElementById('header-title');
    const headerSection = document.getElementById('header-section');
    if (headerSection) headerSection.textContent = 'SEARCH';
    if (headerTitle) headerTitle.textContent = query ? ('Results for “' + query + '”') : 'Latest ingested stories';
    if (container) container.innerHTML = '<p class="text-sm text-slate-500 p-4">Searching live catalog…</p>';

    const q = encodeURIComponent(query || '');
    let articles = [];
    let feeds = [];
    try {
      const res = await fetch(apiBase() + '/api/search?q=' + q + '&limit=25', { headers: authHeaders() });
      const json = await res.json();
      articles = json.items || json.stories || [];
    } catch (e) {}
    if (query) {
      try {
        const fres = await fetch(apiBase() + '/api/feeds/find?q=' + q + '&limit=12', { headers: authHeaders() });
        const fjson = await fres.json();
        feeds = fjson.feeds || fjson.sources || fjson.items || [];
      } catch (e) {}
    }
    render(container, articles, feeds, query);
  }

  function render(container, articles, feeds, query) {
    if (!container) return;
    if ((!articles || !articles.length) && (!feeds || !feeds.length)) {
      container.innerHTML = '<div class="p-6 text-center text-slate-500">No indexed articles yet. Open Home so feeds persist, then search again. Use Find Feeds to follow sources.</div>';
      return;
    }
    let html = '';
    if (feeds && feeds.length) {
      html += '<h3 class="text-sm font-bold text-slate-700 mb-2">Sources</h3>';
      feeds.slice(0, 8).forEach((f) => {
        const title = escapeHtml(f.title || f.name || 'Feed');
        const url = f.feed_url || f.url || '';
        html += '<div class="border border-slate-200 rounded-xl p-3 mb-2 flex justify-between gap-3 items-center">' +
          '<div><div class="font-semibold text-slate-900">' + title + '</div>' +
          '<div class="text-xs text-slate-500">' + escapeHtml(url) + '</div></div>' +
          '<button class="text-sm bg-slate-900 text-white rounded-lg px-3 py-1" data-follow-url="' + escapeHtml(url) + '" data-follow-title="' + title + '">Follow</button></div>';
      });
    }
    if (articles && articles.length) {
      html += '<h3 class="text-sm font-bold text-slate-700 mt-4 mb-2">Articles</h3>';
      articles.forEach((a) => {
        const title = escapeHtml(a.title || 'Untitled');
        const snippet = escapeHtml(a.snippet || a.summary || '');
        const src = escapeHtml((a.source && a.source.title) || a.source_title || '');
        const link = a.url || a.link || '#';
        const id = a.id || a.article_id || '';
        html += '<article class="border border-slate-200 rounded-xl p-4 mb-3">' +
          '<a class="font-bold text-slate-900 hover:underline" href="' + escapeHtml(link) + '" target="_blank" rel="noopener">' + title + '</a>' +
          '<p class="text-sm text-slate-600 mt-1">' + snippet + '</p>' +
          '<div class="flex gap-2 mt-2 text-xs text-slate-500"><span>' + src + '</span>' +
          '<button class="ml-auto text-amber-600 font-semibold" data-star-id="' + escapeHtml(id) + '" data-star-url="' + escapeHtml(link) + '" data-star-title="' + title + '">Star</button></div></article>';
      });
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-follow-url]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!global.FeedOmeterAuth || !global.FeedOmeterAuth.isAuthenticated()) {
          if (global.parent && global.parent.showAuthModal) global.parent.showAuthModal();
          return;
        }
        try {
          await global.FeedOmeterAuth.followFeed({ feed_url: btn.getAttribute('data-follow-url'), title: btn.getAttribute('data-follow-title') });
          btn.textContent = 'Following';
        } catch (e) {
          alert(e.message || 'Could not follow');
        }
      });
    });
    container.querySelectorAll('[data-star-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!global.FeedOmeterAuth || !global.FeedOmeterAuth.isAuthenticated()) {
          if (global.parent && global.parent.showAuthModal) global.parent.showAuthModal();
          return;
        }
        try {
          await global.FeedOmeterAuth.starArticle({
            article_id: btn.getAttribute('data-star-id'),
            url: btn.getAttribute('data-star-url'),
            title: btn.getAttribute('data-star-title')
          });
          btn.textContent = 'Starred';
        } catch (e) {
          alert(e.message || 'Could not star');
        }
      });
    });
  }

  function init() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('btn-discover-search');
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    if (input && q) input.value = q;
    if (btn) btn.addEventListener('click', () => runSearch(input ? input.value.trim() : ''));
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearch(input.value.trim());
      });
    }
    if (params.get('alerts') === '1') {
      const name = prompt('Keyword to watch (in-app alert):');
      if (name && global.FeedOmeterAuth && global.FeedOmeterAuth.isAuthenticated()) {
        fetch(apiBase() + '/api/search/alerts', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ keyword: name.trim() })
        }).then(() => alert('Alert saved for: ' + name.trim())).catch(() => {});
      }
    }
    runSearch(q);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : this);
