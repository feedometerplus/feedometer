/**
 * Visual RSS Studio — standalone controller (not shared with Auto Generator).
 * Flow: Load Website → point-and-click → Matching entries (from preview DOM) → Create feed.
 */
(function () {
  'use strict';

  function apiBase() {
    if (window.FEEDOMETER_CONFIG) {
      const u =
        window.FEEDOMETER_CONFIG.WORKER_URL ||
        window.FEEDOMETER_CONFIG.apiBaseUrl ||
        window.FEEDOMETER_CONFIG.API_BASE_URL;
      if (u) return String(u).replace(/\/$/, '');
    }
    if (window.FEEDOMETER_API_BASE) return String(window.FEEDOMETER_API_BASE).replace(/\/$/, '');
    return 'https://feedometer-api.feedometer.workers.dev';
  }

  const FIELD_ORDER = ['container', 'title', 'link', 'description', 'image', 'date'];

  const els = {
    url: document.getElementById('vb-url'),
    loadBtn: document.getElementById('vb-load'),
    iframe: document.getElementById('vb-iframe'),
    iframeWrap: document.getElementById('vb-iframe-wrap'),
    badge: document.getElementById('vb-badge'),
    contentType: document.getElementById('vb-content-type'),
    renderMode: document.getElementById('vb-render-mode'),
    matchCount: document.getElementById('vb-match-count'),
    matchList: document.getElementById('vb-match-list'),
    createBtn: document.getElementById('vb-create'),
    status: document.getElementById('vb-status'),
    result: document.getElementById('vb-result'),
    feedUrl: document.getElementById('vb-feed-url'),
    feedXml: document.getElementById('vb-feed-xml'),
    toast: document.getElementById('vb-toast'),
    sel: {
      container: document.getElementById('vb-sel-container'),
      title: document.getElementById('vb-sel-title'),
      link: document.getElementById('vb-sel-link'),
      description: document.getElementById('vb-sel-description'),
      image: document.getElementById('vb-sel-image'),
      date: document.getElementById('vb-sel-date')
    }
  };

  const state = {
    siteUrl: '',
    activeField: 'container',
    mode: 'auto',
    loadGen: 0,
    items: []
  };

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('is-show');
    setTimeout(() => els.toast.classList.remove('is-show'), 2800);
  }

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || '';
    els.status.className = 'vb-status' + (kind ? ' is-' + kind : '');
  }

  function setLoading(on) {
    if (els.iframeWrap) els.iframeWrap.classList.toggle('is-loading', on);
    if (els.loadBtn) {
      els.loadBtn.disabled = on;
      els.loadBtn.textContent = on ? 'Loading…' : 'Load Website';
    }
  }

  function setBadge(engine) {
    if (!els.badge) return;
    els.badge.hidden = false;
    els.badge.className = 'vb-badge';
    if (engine === 'browser') {
      els.badge.textContent = 'Browser rendered';
      els.badge.classList.add('is-ok');
    } else if (engine === 'blocked') {
      els.badge.textContent = 'Site blocked preview';
      els.badge.classList.add('is-err');
    } else if (engine === 'static') {
      els.badge.textContent = 'HTML preview';
      els.badge.classList.add('is-static');
    } else {
      els.badge.textContent = engine || '';
    }
  }

  function normalizeUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u;
  }

  function isBadSelector(sel) {
    const s = String(sel || '').trim();
    return !s || s === '.' || s === '*' || s === '#' || /^>\s*$/.test(s);
  }

  function getSelectors() {
    const out = {};
    Object.keys(els.sel).forEach((k) => {
      const v = els.sel[k] && els.sel[k].value.trim();
      if (v && !isBadSelector(v)) out[k] = v;
    });
    return out;
  }

  function markBound(field, value) {
    const input = els.sel[field];
    if (!input) return;
    const clean = isBadSelector(value) ? '' : String(value || '').trim();
    input.value = clean;
    const row = input.closest('[data-field]');
    if (row) {
      const tag = row.querySelector('.vb-bound');
      if (tag) {
        tag.textContent = clean ? 'Bound' : '—';
        tag.classList.toggle('is-on', Boolean(clean));
      }
    }
  }

  function clearSelectors() {
    FIELD_ORDER.forEach((f) => markBound(f, ''));
  }

  function highlightActiveField() {
    document.querySelectorAll('.vb-field').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-field') === state.activeField);
    });
    syncInspectorField();
  }

  function syncInspectorField() {
    if (els.iframe && els.iframe.contentWindow) {
      try {
        els.iframe.contentWindow.postMessage(
          { type: 'SET_ACTIVE_FIELD', field: state.activeField },
          '*'
        );
        els.iframe.contentWindow.postMessage(
          { type: 'set_target_field', field: state.activeField },
          '*'
        );
      } catch (_) {}
    }
  }

  function advanceManualField() {
    for (const f of FIELD_ORDER) {
      if (!els.sel[f] || !els.sel[f].value.trim()) {
        state.activeField = f;
        highlightActiveField();
        return;
      }
    }
  }

  /**
   * Auto Cluster: only set container from the click.
   * Title/link are relative selectors used inside each matched container (not page-wide junk).
   */
  function applyAutoCluster(selector) {
    if (isBadSelector(selector)) {
      toast('Could not read that element — click the article card again');
      return;
    }
    markBound('container', selector);
    // Relative to each container match — not global page selectors
    markBound('title', 'h1, h2, h3, h4');
    markBound('link', 'a[href]');
    markBound('description', '');
    markBound('image', '');
    markBound('date', '');
    state.activeField = 'description';
    highlightActiveField();
  }

  function previewDoc() {
    try {
      return els.iframe && els.iframe.contentDocument;
    } catch (_) {
      return null;
    }
  }

  function safeQueryAll(root, selector) {
    if (!root || !selector) return [];
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function safeQuery(root, selector) {
    if (!root || !selector) return null;
    try {
      return root.querySelector(selector);
    } catch (_) {
      return null;
    }
  }

  function textOf(el) {
    if (!el) return '';
    return String(el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  function absUrl(href) {
    if (!href) return '';
    try {
      return new URL(href, state.siteUrl || (els.url && els.url.value) || window.location.href).href;
    } catch (_) {
      return href;
    }
  }

  /**
   * Matching entries = live results from the preview iframe (what you see).
   * This is the right-hand panel’s job.
   */
  function evaluateInPreview() {
    const selectors = getSelectors();
    const doc = previewDoc();

    if (!selectors.container) {
      renderMatches([]);
      if (els.matchList) {
        els.matchList.innerHTML =
          '<li class="vb-empty">Bind a <strong>Container</strong> first (click an article card in the preview).</li>';
      }
      return;
    }

    if (!doc || !doc.body) {
      renderMatches([]);
      if (els.matchList) {
        els.matchList.innerHTML =
          '<li class="vb-empty">Preview not ready. Click Load Website, then select again.</li>';
      }
      return;
    }

    let nodes = safeQueryAll(doc, selectors.container).filter((el) => {
      if (!el || el.id === 'feedometer-proxy-notice') return false;
      if (el.closest && el.closest('#feedometer-proxy-notice')) return false;
      return el !== doc.body && el !== doc.documentElement;
    });

    // Prefer nodes that look like article cards (have a link or heading)
    if (nodes.length > 80) {
      nodes = nodes.filter((el) => el.querySelector && (el.querySelector('a[href]') || el.querySelector('h1,h2,h3,h4')));
    }
    nodes = nodes.slice(0, 60);

    const titleSel = selectors.title || 'h1, h2, h3, h4, a';
    const linkSel = selectors.link || 'a[href]';
    const descSel = selectors.description || '';
    const imageSel = selectors.image || 'img';
    const dateSel = selectors.date || 'time';

    const items = [];
    nodes.forEach((container) => {
      const titleEl = safeQuery(container, titleSel) || safeQuery(container, 'a');
      const linkEl =
        (linkSel ? safeQuery(container, linkSel) : null) ||
        (titleEl && titleEl.closest ? titleEl.closest('a') : null) ||
        safeQuery(container, 'a[href]');
      const href = linkEl ? linkEl.getAttribute('href') : '';
      const title = textOf(titleEl) || textOf(linkEl);
      if (!title && !href) return;

      let image = '';
      const imgEl = imageSel ? safeQuery(container, imageSel) : safeQuery(container, 'img');
      if (imgEl) {
        image = absUrl(
          imgEl.getAttribute('src') ||
            imgEl.getAttribute('data-src') ||
            imgEl.getAttribute('data-original') ||
            ''
        );
      }

      items.push({
        title: title || 'Untitled',
        link: absUrl(href),
        description: descSel ? textOf(safeQuery(container, descSel)) : '',
        image,
        pubDate: dateSel ? textOf(safeQuery(container, dateSel)) : ''
      });
    });

    renderMatches(items);

    if (items.length) {
      setStatus('Matching entries updated — ' + items.length + ' articles from your selectors.', 'ok');
    } else {
      setStatus(
        'No matching entries. In Manual mode: click Container in the left list, then click a full article card (not only the title).',
        'warn'
      );
    }
  }

  function renderMatches(items) {
    state.items = items || [];
    if (els.matchCount) els.matchCount.textContent = String(state.items.length);
    if (!els.matchList) return;
    els.matchList.innerHTML = '';
    if (!state.items.length) {
      els.matchList.innerHTML =
        '<li class="vb-empty">No matches yet. Select a container on the preview — this list shows every article that matches.</li>';
      return;
    }
    state.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'vb-match';
      const title = document.createElement('div');
      title.className = 'vb-match-title';
      title.textContent = item.title || 'Untitled';
      li.appendChild(title);
      if (item.link) {
        const link = document.createElement('div');
        link.className = 'vb-match-link';
        link.textContent = item.link;
        li.appendChild(link);
      }
      els.matchList.appendChild(li);
    });
  }

  let evalTimer = null;
  function scheduleEvaluate() {
    clearTimeout(evalTimer);
    evalTimer = setTimeout(evaluateInPreview, 200);
  }

  function loadWebsite() {
    const url = normalizeUrl(els.url && els.url.value);
    if (!url) {
      setStatus('Enter a website URL first.', 'err');
      return;
    }
    state.siteUrl = url;
    if (els.url) els.url.value = url;
    clearSelectors();
    renderMatches([]);
    state.activeField = 'container';
    highlightActiveField();

    const gen = ++state.loadGen;
    const renderMode = (els.renderMode && els.renderMode.value) || 'auto';
    const proxy =
      apiBase() +
      '/api/builder/proxy?url=' +
      encodeURIComponent(url) +
      '&render_mode=' +
      encodeURIComponent(renderMode);

    setLoading(true);
    setStatus('Loading website preview…');
    setBadge('');

    const watchdog = setTimeout(() => {
      if (gen !== state.loadGen) return;
      setLoading(false);
      setStatus('Preview may still be loading — try clicking if the page appears.', 'warn');
    }, 60000);

    els.iframe.onload = () => {
      if (gen !== state.loadGen) return;
      clearTimeout(watchdog);
      setLoading(false);
      try {
        const doc = els.iframe.contentDocument;
        const bodyText = doc && doc.body ? doc.body.innerText.slice(0, 400) : '';
        if (/This website blocked the preview|Access Denied/i.test(bodyText)) {
          setBadge('blocked');
          setStatus(
            'This site blocks cloud access. Try BBC / TechCrunch / The Verge, or use Auto Feed Generator.',
            'err'
          );
          return;
        }
      } catch (_) {}
      setBadge(renderMode === 'browser' ? 'browser' : 'static');
      setStatus(
        state.mode === 'auto'
          ? 'Preview ready — click one article card. Matching entries will list similar cards.'
          : 'Preview ready — click a field on the left (Container, Title…), then click that element on the page.',
        'ok'
      );
      highlightActiveField();
    };

    els.iframe.onerror = () => {
      if (gen !== state.loadGen) return;
      clearTimeout(watchdog);
      setLoading(false);
      setStatus('Preview failed to load.', 'err');
    };

    els.iframe.removeAttribute('srcdoc');
    els.iframe.src = proxy;
  }

  function buildRssXml(items, siteUrl) {
    let host = siteUrl;
    try {
      host = new URL(siteUrl).hostname;
    } catch (_) {}
    let xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n';
    xml += '    <title>' + escapeXml(host) + ' Feed</title>\n';
    xml += '    <link>' + escapeXml(siteUrl) + '</link>\n';
    xml += '    <description>Created with Feedometer Visual RSS Studio</description>\n';
    (items || []).forEach((a) => {
      xml += '    <item>\n';
      xml += '      <title>' + escapeXml(a.title || 'Untitled') + '</title>\n';
      xml += '      <link>' + escapeXml(a.link || siteUrl) + '</link>\n';
      if (a.description) xml += '      <description>' + escapeXml(a.description) + '</description>\n';
      if (a.pubDate) xml += '      <pubDate>' + escapeXml(a.pubDate) + '</pubDate>\n';
      xml += '    </item>\n';
    });
    xml += '  </channel>\n</rss>';
    return xml;
  }

  function escapeXml(s) {
    return String(s || '').replace(/[<>&'"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
    );
  }

  async function createFeed() {
    evaluateInPreview();
    const selectors = getSelectors();
    if (!state.siteUrl) {
      setStatus('Load a website first.', 'err');
      return;
    }
    if (!selectors.container) {
      setStatus('Select a Container on the preview first.', 'err');
      return;
    }
    if (!state.items.length) {
      setStatus('Matching entries is empty — fix Container/Title/Link so the right panel lists articles.', 'err');
      return;
    }

    // Ensure title/link exist for save/create
    if (!selectors.title) markBound('title', 'h1, h2, h3, h4');
    if (!selectors.link) markBound('link', 'a[href]');

    els.createBtn.disabled = true;
    els.createBtn.textContent = 'Creating…';

    const items = state.items.slice();
    const xml = buildRssXml(items, state.siteUrl);

    try {
      await fetch(apiBase() + '/api/builder/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.siteUrl,
          selectors: getSelectors(),
          content_type: (els.contentType && els.contentType.value) || 'news',
          extraction_mode: 'manual',
          render_mode: (els.renderMode && els.renderMode.value) || 'auto',
          render_js: (els.renderMode && els.renderMode.value) === 'browser' ? 1 : 0
        })
      });
    } catch (_) {}

    const live = apiBase() + '/api/builder/feed?url=' + encodeURIComponent(state.siteUrl);
    if (els.feedUrl) els.feedUrl.value = live;
    if (els.feedXml) els.feedXml.textContent = xml;
    if (els.result) {
      els.result.hidden = false;
      els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setStatus('Feed created — ' + items.length + ' articles listed on the right. Copy the live URL below.', 'ok');
    toast('Feed created (' + items.length + ' items)');
    els.createBtn.disabled = false;
    els.createBtn.textContent = 'Create feed from selections';
  }

  function onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const type = data.type || '';

    if (type === 'FEEDOMETER_ELEMENT_SELECTED' || type === 'element_selected') {
      let selector = String(data.selector || '').trim();
      if (isBadSelector(selector)) {
        toast('Weak selector from that click — try the card frame or a heading');
        return;
      }

      if (state.mode === 'auto') {
        applyAutoCluster(selector);
        toast('Container set — updating matching entries…');
      } else {
        // Manual: ALWAYS bind the field the user selected on the left (not inspector default)
        const field = state.activeField || 'container';
        markBound(field, selector);
        toast('Bound ' + field + ' ← ' + selector.slice(0, 48));
        advanceManualField();
      }
      scheduleEvaluate();
    } else if (type === 'FEEDOMETER_INSPECTOR_READY' || type === 'inspector_ready') {
      highlightActiveField();
    }
  }

  function init() {
    if (!els.iframe || !els.loadBtn) return;

    els.loadBtn.addEventListener('click', loadWebsite);
    if (els.url) {
      els.url.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadWebsite();
      });
    }

    document.querySelectorAll('[data-vb-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-vb-mode]').forEach((b) => b.classList.remove('is-on'));
        btn.classList.add('is-on');
        state.mode = btn.getAttribute('data-vb-mode') || 'auto';
        if (state.mode === 'manual') {
          state.activeField = 'container';
          highlightActiveField();
          setStatus('Manual: click a field on the left, then click that element on the page.', 'ok');
        } else {
          setStatus('Auto Cluster: click one article card on the preview.', 'ok');
        }
      });
    });

    document.querySelectorAll('.vb-field').forEach((row) => {
      row.addEventListener('click', () => {
        state.activeField = row.getAttribute('data-field') || 'container';
        highlightActiveField();
        toast('Now click the ' + state.activeField + ' on the preview');
      });
      const input = row.querySelector('input');
      if (input) {
        input.addEventListener('focus', () => {
          state.activeField = row.getAttribute('data-field') || 'container';
          highlightActiveField();
        });
      }
    });

    Object.keys(els.sel).forEach((k) => {
      if (els.sel[k]) els.sel[k].addEventListener('input', scheduleEvaluate);
    });

    if (els.createBtn) els.createBtn.addEventListener('click', createFeed);

    document.querySelectorAll('[data-copy-feed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = els.feedUrl && els.feedUrl.value;
        if (!v) return;
        navigator.clipboard.writeText(v).then(() => toast('Feed URL copied')).catch(() => toast(v));
      });
    });

    document.querySelectorAll('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = btn.getAttribute('data-sample');
        if (els.url) els.url.value = u;
        loadWebsite();
      });
    });

    window.addEventListener('message', onMessage);

    const params = new URLSearchParams(window.location.search);
    const site = params.get('url') || params.get('site');
    if (site) {
      if (els.url) els.url.value = site;
      loadWebsite();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
