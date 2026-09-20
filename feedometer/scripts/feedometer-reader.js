/**
 * scripts/feedometer-reader.js — FeedOmeter 2.1 3-Pane Reader & Personal Dashboard Controller
 */
(function (global) {
  'use strict';

  function getApiBase() {
    if (window.FEEDOMETER_CONFIG && window.FEEDOMETER_CONFIG.apiBaseUrl) {
      return window.FEEDOMETER_CONFIG.apiBaseUrl.replace(/\/$/, '');
    }
    if (window.FEEDOMETER_API_BASE) {
      return window.FEEDOMETER_API_BASE.replace(/\/$/, '');
    }
    return 'https://feedometer-api.feedometer.workers.dev';
  }

  // App State
  const state = {
    user: null,
    currentTab: 'all', // 'all' | 'starred' | 'saved' | 'history' | 'folder'
    activeFolderId: null,
    activeFolderName: 'All Feeds',
    articles: [],
    folders: [],
    subscriptions: [],
    selectedArticle: null,
    cursor: null,
    hasMore: false,
    isLoading: false,
    fontSize: 16,
    isSerif: false,
    filterUnreadOnly: false,
    searchQuery: ''
  };

  // Helper for API Requests
  async function api(path, options = {}) {
    const authHeaders = global.FeedOmeterAuth ? global.FeedOmeterAuth.getAuthHeaders() : {};
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {})
    };
    const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data: json };
  }

  // Timeago helper
  function timeAgo(dateString) {
    if (!dateString) return '';
    const now = Date.now();
    const epoch = new Date(dateString).getTime();
    if (isNaN(epoch)) return '';
    const diffSec = Math.floor((now - epoch) / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString();
  }

  // Initialize
  async function init() {
    setupEventListeners();
    setupKeyboardShortcuts();

    // Check if user arrived via a password reset link (?reset_token=... or ?token=...)
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset_token') || urlParams.get('token');
    if (resetToken) {
      showAuthModal('login');
      try {
        const verifyData = await global.FeedOmeterAuth.verifyResetToken(resetToken);
        if (verifyData && verifyData.valid) {
          switchAuthMode('reset', { token: resetToken, email: verifyData.email });
        }
      } catch (err) {
        switchAuthMode('login');
        const errEl = document.getElementById('auth-error-msg');
        if (errEl) {
          errEl.textContent = err.message || 'Password reset link is invalid or has expired.';
          errEl.style.display = 'block';
        }
      }
      return;
    }

    const user = global.FeedOmeterAuth ? global.FeedOmeterAuth.getUser() : null;
    if (user) {
      handleAuthenticated(user);
    } else {
      showAuthModal('login');
    }

    window.addEventListener('feedometer:auth_change', (e) => {
      if (e.detail.user) {
        handleAuthenticated(e.detail.user);
      } else {
        handleUnauthenticated();
      }
    });
  }

  function handleAuthenticated(user) {
    state.user = user;
    hideAuthModal();
    renderUserProfile(user);
    loadFolders();
    loadSubscriptions();
    loadStream(true);
  }

  function handleUnauthenticated() {
    state.user = null;
    state.articles = [];
    state.folders = [];
    state.selectedArticle = null;
    renderSidebarTree();
    renderStreamCards();
    renderArticleDetail(null);
    showAuthModal('login');
  }

  // ── 1. Sidebar & Folder Management ──
  async function loadFolders() {
    const res = await api('/api/folders');
    if (res.ok && res.data.folders) {
      state.folders = res.data.folders;
      renderSidebarTree();
    }
  }

  async function loadSubscriptions() {
    const res = await api('/api/subscriptions');
    if (res.ok && res.data.subscriptions) {
      state.subscriptions = res.data.subscriptions;
    }
  }

  function renderUserProfile(user) {
    const emailEl = document.getElementById('user-display-email');
    const avatarEl = document.getElementById('user-display-avatar');
    if (emailEl) emailEl.textContent = user.email || 'Account';
    if (avatarEl) avatarEl.textContent = (user.email ? user.email[0] : 'U').toUpperCase();
  }

  function renderSidebarTree() {
    const folderListEl = document.getElementById('sidebar-folder-tree');
    if (!folderListEl) return;

    if (state.folders.length === 0) {
      folderListEl.innerHTML = '<div style="padding: 0.5rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">No folders created yet</div>';
      return;
    }

    let html = '';
    state.folders.forEach(folder => {
      const isActive = state.currentTab === 'folder' && state.activeFolderId === folder.id;
      html += `
        <div class="sidebar-nav-item ${isActive ? 'active' : ''}" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
          <div class="nav-icon-label">
            <span>${folder.icon || '📁'}</span>
            <span>${folder.name}</span>
          </div>
          <span class="nav-badge">${folder.feed_count || 0}</span>
        </div>
      `;
    });
    folderListEl.innerHTML = html;

    // Attach click handlers
    folderListEl.querySelectorAll('.sidebar-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const folderId = el.getAttribute('data-folder-id');
        const folderName = el.getAttribute('data-folder-name');
        switchStreamContext('folder', folderId, folderName);
      });
    });
  }

  // ── 2. Stream Engine & Feed Fusion ──
  async function loadStream(reset = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    if (reset) {
      state.articles = [];
      state.cursor = null;
      renderStreamLoading(true);
    }

    let endpoint = '/api/stream?limit=25';
    if (state.currentTab === 'folder' && state.activeFolderId) {
      endpoint = `/api/stream?folder_id=${state.activeFolderId}&limit=25`;
    } else if (state.currentTab === 'starred') {
      endpoint = '/api/articles/starred';
    }

    if (state.cursor && state.currentTab !== 'starred') {
      endpoint += `&cursor=${encodeURIComponent(state.cursor)}`;
    }

    const res = await api(endpoint);
    state.isLoading = false;
    renderStreamLoading(false);

    if (res.ok) {
      const items = res.data.items || [];
      if (reset) {
        state.articles = items;
      } else {
        state.articles = [...state.articles, ...items];
      }
      state.cursor = res.data.next_cursor || null;
      state.hasMore = res.data.has_more || false;
      renderStreamCards();

      if (reset && state.articles.length > 0 && !state.selectedArticle) {
        selectArticle(state.articles[0]);
      }
    } else {
      renderStreamError(res.data.message || 'Failed to load feed stream');
    }
  }

  function switchStreamContext(tab, folderId = null, folderName = 'All Feeds') {
    state.currentTab = tab;
    state.activeFolderId = folderId;
    state.activeFolderName = folderName;

    // Update active nav styling
    document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
    if (tab === 'folder') {
      const folderEl = document.querySelector(`[data-folder-id="${folderId}"]`);
      if (folderEl) folderEl.classList.add('active');
    } else {
      const tabEl = document.querySelector(`[data-nav-tab="${tab}"]`);
      if (tabEl) tabEl.classList.add('active');
    }

    // Update Header
    const titleEl = document.getElementById('stream-context-title');
    if (titleEl) titleEl.textContent = folderName;

    loadStream(true);
  }

  function renderStreamCards() {
    const container = document.getElementById('stream-cards-list');
    if (!container) return;

    let filtered = state.articles;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) || 
        (a.summary && a.summary.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="reader-empty-state">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div>
          <p style="font-weight: 600;">No articles found</p>
          <p style="font-size: 0.85rem;">Follow more RSS feeds using the "+ Add Feed" button.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((art, idx) => {
      const isSelected = state.selectedArticle && (state.selectedArticle.id === art.id);
      const isStarred = art.is_starred || false;
      const isSaved = art.is_saved || false;

      html += `
        <div class="article-stream-card ${isSelected ? 'active' : ''} ${art.is_read ? 'is-read' : ''}" data-article-id="${art.id}" data-index="${idx}">
          <div class="card-meta-row">
            <span class="card-source-tag">
              <span>📰</span>
              <span>${art.source ? art.source.title : 'Feed'}</span>
            </span>
            <span class="card-time">${timeAgo(art.published)}</span>
          </div>
          <h4 class="card-title">${art.title}</h4>
          ${art.summary ? `<p class="card-snippet">${art.summary}</p>` : ''}
          <div class="card-actions-row">
            <span class="card-time">${art.audio ? '🎙️ Podcast' : ''}</span>
            <div class="card-btn-group">
              <button class="card-action-btn ${isStarred ? 'starred' : ''}" data-action="star" data-article-id="${art.id}" title="Star">
                ${isStarred ? '★' : '☆'}
              </button>
              <button class="card-action-btn ${isSaved ? 'saved' : ''}" data-action="save" data-article-id="${art.id}" title="Read Later">
                ⏳
              </button>
            </div>
          </div>
        </div>
      `;
    });

    if (state.hasMore) {
      html += `
        <button id="stream-load-more-btn" class="btn-secondary" style="width: 100%; padding: 0.65rem; margin-top: 0.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Load More Articles
        </button>
      `;
    }

    container.innerHTML = html;

    // Attach card clicks
    container.querySelectorAll('.article-stream-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-action-btn')) return;
        const id = card.getAttribute('data-article-id');
        const art = state.articles.find(a => a.id === id);
        if (art) selectArticle(art);
      });
    });

    // Attach Action buttons
    container.querySelectorAll('[data-action="star"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-article-id');
        toggleStar(id);
      });
    });

    container.querySelectorAll('[data-action="save"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-article-id');
        toggleSave(id);
      });
    });

    // Load More Button
    const loadMoreBtn = document.getElementById('stream-load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => loadStream(false));
    }
  }

  function renderStreamLoading(isLoading) {
    const loader = document.getElementById('stream-loader');
    if (loader) loader.style.display = isLoading ? 'block' : 'none';
  }

  function renderStreamError(msg) {
    const container = document.getElementById('stream-cards-list');
    if (container) {
      container.innerHTML = `
        <div class="reader-empty-state">
          <div style="font-size: 2rem; color: #dc2626;">⚠️</div>
          <p style="font-weight: 600; color: #dc2626;">${msg}</p>
        </div>
      `;
    }
  }

  // ── 3. Reader & Detail Pane ──
  function selectArticle(article) {
    state.selectedArticle = article;
    article.is_read = true;

    // Mark active in stream
    document.querySelectorAll('.article-stream-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.querySelector(`[data-article-id="${article.id}"]`);
    if (activeCard) {
      activeCard.classList.add('active', 'is-read');
    }

    // Record read in DB
    api('/api/articles/read', {
      method: 'POST',
      body: JSON.stringify({ article_hash: article.id })
    });

    renderArticleDetail(article);

    // Open detail pane on mobile
    const detailPane = document.getElementById('reader-detail-pane');
    if (detailPane) detailPane.classList.add('open');
  }

  function renderArticleDetail(article) {
    const pane = document.getElementById('reader-article-content');
    if (!pane) return;

    if (!article) {
      pane.innerHTML = `
        <div class="reader-empty-state">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">📖</div>
          <h3>Select an article to start reading</h3>
          <p style="font-size: 0.85rem;">Use <kbd>j</kbd> and <kbd>k</kbd> keys to navigate through your personal timeline.</p>
        </div>
      `;
      return;
    }

    const isStarred = article.is_starred || false;

    pane.innerHTML = `
      <div class="reader-article-header">
        <h1 class="reader-article-title">${article.title}</h1>
        <div class="reader-article-meta">
          <span>📰 <strong>${article.source ? article.source.title : 'Feed Source'}</strong></span>
          <span>🕒 ${timeAgo(article.published)}</span>
          <a href="${article.link}" target="_blank" rel="noopener noreferrer" style="margin-left: auto; font-weight: 600; text-decoration: underline;">
            Open Original ↗
          </a>
        </div>
      </div>

      ${article.image ? `<img class="reader-hero-image" src="${article.image}" alt="${article.title}" onerror="this.style.display='none'" />` : ''}

      ${article.audio ? `
        <div style="margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <p style="font-size: 0.85rem; font-weight: 600; margin: 0 0 0.5rem 0;">🎙️ Podcast Audio Enclosure:</p>
          <audio class="reader-audio-player" controls src="${article.audio.url}"></audio>
        </div>
      ` : ''}

      <div class="reader-article-body" style="font-size: ${state.fontSize}px; font-family: ${state.isSerif ? 'Georgia, serif' : 'var(--font-sans)'};">
        <p>${article.summary || 'No summary content available for this feed entry.'}</p>
      </div>
    `;
  }

  // ── 4. Star & Save Article Actions ──
  async function toggleStar(articleId) {
    const article = state.articles.find(a => a.id === articleId);
    if (!article) return;

    article.is_starred = !article.is_starred;
    renderStreamCards();

    if (article.is_starred) {
      await api('/api/articles/star', {
        method: 'POST',
        body: JSON.stringify({
          article_hash: article.id,
          article_data: article
        })
      });
    } else {
      await api('/api/articles/unstar', {
        method: 'POST',
        body: JSON.stringify({ article_hash: article.id })
      });
    }
  }

  async function toggleSave(articleId) {
    const article = state.articles.find(a => a.id === articleId);
    if (!article) return;

    article.is_saved = !article.is_saved;
    renderStreamCards();

    if (article.is_saved) {
      await api('/api/articles/save', {
        method: 'POST',
        body: JSON.stringify({
          article_hash: article.id,
          article_data: article
        })
      });
    } else {
      await api('/api/articles/unsave', {
        method: 'POST',
        body: JSON.stringify({ article_hash: article.id })
      });
    }
  }

  // ── 5. Modals & Controls ──
  function showAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'flex';
      switchAuthMode(tab);
    }
  }

  function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
  }

  function switchAuthMode(mode, data = {}) {
    const isLogin = mode === 'login';
    const isRegister = mode === 'register';
    const isForgot = mode === 'forgot';
    const isReset = mode === 'reset';

    const loginTab = document.getElementById('auth-tab-login');
    const regTab = document.getElementById('auth-tab-register');
    const tabsRow = document.getElementById('auth-tabs-row');
    const authForm = document.getElementById('auth-form');
    const forgotPanel = document.getElementById('auth-forgot-panel');
    const resetPanel = document.getElementById('auth-reset-panel');
    const submitBtn = document.getElementById('auth-submit-btn');
    const titleEl = document.getElementById('auth-modal-title');
    const nameRow = document.getElementById('auth-name-row');
    const errEl = document.getElementById('auth-error-msg');
    const succEl = document.getElementById('auth-success-msg');

    if (errEl) errEl.style.display = 'none';
    if (succEl) succEl.style.display = 'none';

    if (tabsRow) tabsRow.style.display = (isLogin || isRegister) ? 'flex' : 'none';
    if (authForm) authForm.style.display = (isLogin || isRegister) ? 'flex' : 'none';
    if (forgotPanel) forgotPanel.style.display = isForgot ? 'flex' : 'none';
    if (resetPanel) resetPanel.style.display = isReset ? 'flex' : 'none';

    if (nameRow) nameRow.style.display = isRegister ? 'block' : 'none';
    if (loginTab) loginTab.classList.toggle('active', isLogin);
    if (regTab) regTab.classList.toggle('active', isRegister);

    if (authForm) authForm.setAttribute('data-mode', mode);

    if (titleEl) {
      if (isLogin) titleEl.textContent = 'Sign In to FeedOmeter';
      else if (isRegister) titleEl.textContent = 'Create FeedOmeter Account';
      else if (isForgot) titleEl.textContent = 'Reset Your Password';
      else if (isReset) titleEl.textContent = 'Set New Password';
    }

    if (submitBtn) {
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    }

    if (isReset && data.token) {
      const tokenInput = document.getElementById('reset-token-val');
      if (tokenInput) tokenInput.value = data.token;
      const emailDisplay = document.getElementById('reset-account-email');
      if (emailDisplay && data.email) emailDisplay.textContent = data.email;
    }
  }

  global.switchAuthMode = switchAuthMode;
  global.switchAuthTab = switchAuthMode;

  function showAddFeedModal() {
    const modal = document.getElementById('add-feed-modal');
    if (!modal) return;

    const folderSelect = document.getElementById('feed-folder-select');
    if (folderSelect) {
      folderSelect.innerHTML = '<option value="">(No folder / Top level)</option>' +
        state.folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    }
    modal.style.display = 'flex';
  }

  function showAddFolderModal() {
    const modal = document.getElementById('add-folder-modal');
    if (!modal) return;

    const parentSelect = document.getElementById('folder-parent-select');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">(None - Top Level Folder)</option>' +
        state.folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    }
    modal.style.display = 'flex';
  }

  // ── 6. Event Listeners & Keyboard Shortcuts ──
  function setupEventListeners() {
    // System Nav items
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-nav-tab');
        const title = el.querySelector('.nav-icon-label span:last-child').textContent;
        switchStreamContext(tab, null, title);
      });
    });

    // Add Feed & Add Folder buttons
    const addFeedBtn = document.getElementById('sidebar-add-feed-btn');
    if (addFeedBtn) addFeedBtn.addEventListener('click', showAddFeedModal);

    const addFolderBtn = document.getElementById('sidebar-add-folder-btn');
    if (addFolderBtn) addFolderBtn.addEventListener('click', showAddFolderModal);

    // Logout
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (global.FeedOmeterAuth) global.FeedOmeterAuth.logout();
      });
    }

    // Typography Controls
    const fontSmaller = document.getElementById('btn-font-smaller');
    const fontBigger = document.getElementById('btn-font-bigger');
    const fontSerif = document.getElementById('btn-font-serif');

    if (fontSmaller) fontSmaller.addEventListener('click', () => {
      state.fontSize = Math.max(13, state.fontSize - 1);
      if (state.selectedArticle) renderArticleDetail(state.selectedArticle);
    });
    if (fontBigger) fontBigger.addEventListener('click', () => {
      state.fontSize = Math.min(24, state.fontSize + 1);
      if (state.selectedArticle) renderArticleDetail(state.selectedArticle);
    });
    if (fontSerif) fontSerif.addEventListener('click', () => {
      state.isSerif = !state.isSerif;
      fontSerif.classList.toggle('active', state.isSerif);
      if (state.selectedArticle) renderArticleDetail(state.selectedArticle);
    });

    // Close detail pane on mobile
    const closeDetail = document.getElementById('btn-close-detail');
    if (closeDetail) {
      closeDetail.addEventListener('click', () => {
        const detailPane = document.getElementById('reader-detail-pane');
        if (detailPane) detailPane.classList.remove('open');
      });
    }

    // Search Input
    const searchInput = document.getElementById('stream-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderStreamCards();
      });
    }

    // Modal Close buttons
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.reader-modal-backdrop');
        if (modal && modal.id !== 'auth-modal') modal.style.display = 'none';
      });
    });

    // Auth Form
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = authForm.getAttribute('data-mode') || 'login';
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl = document.getElementById('auth-error-msg');
        if (errEl) errEl.style.display = 'none';

        try {
          if (mode === 'login') {
            await global.FeedOmeterAuth.login(email, password);
          } else {
            await global.FeedOmeterAuth.register(email, password);
          }
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
          }
        }
      });
    }

    // Forgot Password Form Submit
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        const errEl = document.getElementById('auth-error-msg');
        const succEl = document.getElementById('auth-success-msg');
        const submitBtn = document.getElementById('forgot-submit-btn');

        if (errEl) errEl.style.display = 'none';
        if (succEl) succEl.style.display = 'none';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing...'; }

        try {
          const res = await global.FeedOmeterAuth.forgotPassword(email);
          if (succEl) {
            let msg = res.message || 'Password reset link prepared.';
            if (res.reset_token) {
              msg += '<br><a href="#" id="btn-simulate-reset" style="color: #0284c7; font-weight: 700; text-decoration: underline; margin-top: 0.35rem; display: inline-block;">Click here to set new password now →</a>';
            }
            succEl.innerHTML = msg;
            succEl.style.display = 'block';

            if (res.reset_token) {
              setTimeout(() => {
                const simBtn = document.getElementById('btn-simulate-reset');
                if (simBtn) {
                  simBtn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    switchAuthMode('reset', { token: res.reset_token, email: email });
                  });
                }
              }, 50);
            }
          }
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Request Password Reset'; }
        }
      });
    }

    // Reset Password Form Submit
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = document.getElementById('reset-token-val').value.trim();
        const newPass = document.getElementById('reset-password-input').value;
        const confirmPass = document.getElementById('reset-password-confirm').value;
        const errEl = document.getElementById('auth-error-msg');
        const succEl = document.getElementById('auth-success-msg');
        const submitBtn = document.getElementById('reset-submit-btn');

        if (errEl) errEl.style.display = 'none';
        if (succEl) succEl.style.display = 'none';

        if (newPass !== confirmPass) {
          if (errEl) {
            errEl.textContent = 'Passwords do not match.';
            errEl.style.display = 'block';
          }
          return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating...'; }

        try {
          const res = await global.FeedOmeterAuth.resetPassword(token, newPass);
          if (succEl) {
            succEl.textContent = 'Password reset successfully! Signing in...';
            succEl.style.display = 'block';
          }
          setTimeout(() => {
            hideAuthModal();
          }, 600);
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
          }
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Update Password & Sign In'; }
        }
      });
    }

    // Add Feed Form
    const addFeedForm = document.getElementById('add-feed-form');
    if (addFeedForm) {
      addFeedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedUrl = document.getElementById('feed-url-input').value.trim();
        const title = document.getElementById('feed-title-input').value.trim() || 'Feed';
        const category = document.getElementById('feed-category-input').value.trim() || 'general';
        const folderId = document.getElementById('feed-folder-select').value || null;

        const res = await api('/api/subscriptions', {
          method: 'POST',
          body: JSON.stringify({ feed_url: feedUrl, title, category, folder_id: folderId })
        });

        if (res.ok) {
          document.getElementById('add-feed-modal').style.display = 'none';
          addFeedForm.reset();
          loadFolders();
          loadStream(true);
        } else {
          alert(res.data.message || 'Failed to add feed');
        }
      });
    }

    // Add Folder Form
    const addFolderForm = document.getElementById('add-folder-form');
    if (addFolderForm) {
      addFolderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('folder-name-input').value.trim();
        const icon = document.getElementById('folder-icon-input').value.trim() || '📁';
        const parentId = document.getElementById('folder-parent-select').value || null;

        const res = await api('/api/folders', {
          method: 'POST',
          body: JSON.stringify({ name, icon, parent_folder_id: parentId })
        });

        if (res.ok) {
          document.getElementById('add-folder-modal').style.display = 'none';
          addFolderForm.reset();
          loadFolders();
        } else {
          alert(res.data.message || 'Failed to create folder');
        }
      });
    }
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        navigateArticle(1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        navigateArticle(-1);
      } else if (e.key === 's' && state.selectedArticle) {
        toggleStar(state.selectedArticle.id);
      } else if (e.key === 'o' && state.selectedArticle && state.selectedArticle.link) {
        window.open(state.selectedArticle.link, '_blank', 'noopener,noreferrer');
      }
    });
  }

  function navigateArticle(direction) {
    if (state.articles.length === 0) return;
    let currIdx = state.selectedArticle ? state.articles.findIndex(a => a.id === state.selectedArticle.id) : -1;
    let nextIdx = currIdx + direction;
    if (nextIdx >= 0 && nextIdx < state.articles.length) {
      selectArticle(state.articles[nextIdx]);
      const cardEl = document.querySelector(`[data-index="${nextIdx}"]`);
      if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Self Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
