/**
 * navbar/navbar.js — FeedOmeter 2.1 Sleek Royal Blue Navigation Drawer
 * Light royal blue gradient, non-bold sleek typography, floating rounded corners,
 * and #FFEA99 signout button matching the reference design.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY_FAVS = 'feedometer_navbar_favs';
  const STORAGE_KEY_RECENTS = 'feedometer_navbar_recents';

  // Master Navigation Tree with Search & Find Feeds in DISCOVER
  const NAV_TREE = {
    id: 'root',
    title: 'Menu',
    children: [
      {
        id: 'discover',
        title: 'Discover',
        sectionHeader: 'DISCOVER',
        children: [
          { id: 'trending', title: 'Trending', href: 'home.html', icon: '🔥' },
          { id: 'search', title: 'Search', href: 'search.html', icon: '🔍' },
          { id: 'find-feeds', title: 'Find Feeds', href: 'find-feeds.html', icon: '📡' },
          { id: 'following', title: 'Following', href: 'following.html', icon: '⭐', badge: '' },
          { id: 'rss-reader', title: 'RSS Reader', href: 'rss-reader.html', icon: '📰' }
        ]
      },
      {
        id: 'workspaces',
        title: 'Workspaces',
        sectionHeader: 'WORKSPACES',
        sectionMeta: '+ New',
        sectionMetaHref: 'watchlists.html',
        metaClass: 'meta-blue',
        children: [
          { id: 'add-source', title: 'Add Source', href: 'add-source.html', icon: '📡' },
          { id: 'rss-builder', title: 'RSS Builder', href: 'builder.html', icon: '🛠️' },
          { id: 'widget-studio', title: 'Widget Studio', href: 'widgets.html', icon: '🧩' },
          { id: 'feed-filters', title: 'Feed Filters', href: 'filters.html', icon: '⚗️' },
          { id: 'watchlists', title: 'Watchlists & Folders', href: 'watchlists.html', icon: '📁' }
        ]
      },
      {
        id: 'alerts',
        title: 'Alerts',
        sectionHeader: 'ALERTS',
        sectionMeta: '+ Add',
        sectionMetaHref: 'search.html?alerts=1',
        metaClass: 'meta-blue',
        children: [
          { id: 'openai-alert', title: 'OpenAI', href: 'find-sources.html?q=OpenAI', icon: '🟡' },
          { id: 'starred', title: 'Starred', href: 'starred.html', icon: '⭐' },
          { id: 'read-later', title: 'Read Later', href: 'read-later.html', icon: '🔖' },
          { id: 'profile-settings', title: 'Profile & Settings', href: 'settings.html', icon: '⚙️', badge: '' }
        ]
      }
    ]
  };

  function getScopedKey(baseKey) {
    const user = global.FeedOmeterAuth ? global.FeedOmeterAuth.getUser() : null;
    const uId = user && user.id ? user.id : 'guest';
    return `${baseKey}_${uId}`;
  }

  const state = {
    isOpen: false,
    activeTab: 'navigator', // 'navigator' | 'favorites' | 'recents'
    pathStack: ['root'],
    favorites: [],
    recents: []
  };

  function getCurrentActiveHref() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const currentView = urlParams.get('view') || '';
      if (currentView) return currentView;
      const path = window.location.pathname.split('/').pop();
      return path || 'home.html';
    } catch (e) {
      return 'home.html';
    }
  }

  function isItemActive(href) {
    if (!href) return false;
    const curr = getCurrentActiveHref();
    if (curr === href) return true;
    if (curr.startsWith(href) || href.startsWith(curr)) return true;
    return false;
  }

  function loadUserStorage() {
    try {
      state.favorites = JSON.parse(localStorage.getItem(getScopedKey(STORAGE_KEY_FAVS))) || [
        { id: 'trending', title: 'Trending', href: 'home.html', icon: '🔥' },
        { id: 'search', title: 'Search', href: 'search.html', icon: '🔍' },
        { id: 'find-feeds', title: 'Find Feeds', href: 'find-feeds.html', icon: '📡' },
        { id: 'rss-reader', title: 'RSS Reader', href: 'rss-reader.html', icon: '📰' }
      ];
      state.recents = JSON.parse(localStorage.getItem(getScopedKey(STORAGE_KEY_RECENTS))) || [];
    } catch (e) {
      state.favorites = [];
      state.recents = [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(getScopedKey(STORAGE_KEY_FAVS), JSON.stringify(state.favorites));
    } catch (e) {}
  }

  function addRecent(item) {
    if (!item || !item.href) return;
    state.recents = state.recents.filter(r => r.href !== item.href);
    state.recents.unshift({
      id: item.id || item.title,
      title: item.title,
      href: item.href,
      icon: item.icon || '📄',
      badge: item.badge || '',
      visitedAt: Date.now()
    });
    if (state.recents.length > 15) state.recents.pop();
    try {
      localStorage.setItem(getScopedKey(STORAGE_KEY_RECENTS), JSON.stringify(state.recents));
    } catch (e) {}
  }

  function getCurrentNode() {
    let curr = NAV_TREE;
    for (let i = 1; i < state.pathStack.length; i++) {
      const targetId = state.pathStack[i];
      if (curr.children) {
        const found = curr.children.find(c => c.id === targetId);
        if (found) curr = found;
      }
    }
    return curr;
  }

  function renderDrawer() {
    const bodyEl = document.getElementById('feedo-nav-drawer-body');
    const userEmailEl = document.getElementById('feedo-nav-user-email');
    const userAvatarEl = document.getElementById('feedo-nav-user-avatar');
    const signoutBtn = document.getElementById('feedo-signout-btn');

    const user = global.FeedOmeterAuth ? global.FeedOmeterAuth.getUser() : null;
    const isGuest = global.FeedOmeterAuth ? global.FeedOmeterAuth.isGuest() : (localStorage.getItem('feedometer_guest_mode') === 'true');
    const initial = user && (user.name || user.email) ? (user.name || user.email)[0].toUpperCase() : 'G';
    const pic = user ? (user.picture || user.picture_url) : null;

    if (userEmailEl) userEmailEl.textContent = user ? (user.name || user.email) : (isGuest ? 'Guest Explorer' : 'Guest');
    if (userAvatarEl) {
      if (pic) {
        userAvatarEl.innerHTML = `<img src="${pic}" referrerpolicy="no-referrer" alt="User" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" onerror="this.parentElement.textContent='${initial}';" />`;
      } else {
        userAvatarEl.innerHTML = '';
        userAvatarEl.textContent = initial;
      }
    }

    if (signoutBtn) {
      if (!user && isGuest) {
        signoutBtn.innerHTML = '<span>✨</span> <span>Sign In</span>';
        signoutBtn.className = 'nav-drawer-signout-btn';
        signoutBtn.onclick = function (e) {
          if (e) e.preventDefault();
          closeDrawer();
          if (typeof window.showAuthModal === 'function') window.showAuthModal();
        };
      } else {
        signoutBtn.innerHTML = '<span>🚪</span> <span>Sign Out</span>';
        signoutBtn.className = 'nav-drawer-signout-btn';
        signoutBtn.onclick = function (e) {
          if (typeof window.executeSignOut === 'function') window.executeSignOut(e);
        };
      }
    }

    if (!bodyEl) return;

    if (state.activeTab === 'navigator') {
      renderNavigatorTab(bodyEl);
    } else if (state.activeTab === 'favorites') {
      renderFavoritesTab(bodyEl);
    } else if (state.activeTab === 'recents') {
      renderRecentsTab(bodyEl);
    }
  }

  function getEffectiveBadge(item) {
    if (item.id === 'following') {
      try {
        const cached = localStorage.getItem('feedometer_cached_subscriptions_count');
        if (cached !== null && parseInt(cached, 10) >= 0) return String(cached);
        const guestList = (global.FeedOmeterAuth && global.FeedOmeterAuth.getGuestFollows)
          ? global.FeedOmeterAuth.getGuestFollows()
          : JSON.parse(sessionStorage.getItem('feedometer_guest_subscriptions') || '[]');
        if (guestList && guestList.length > 0) return String(guestList.length);
      } catch (e) {}
    }
    if (item.id === 'watchlists') {
      try {
        const n = localStorage.getItem('feedometer_cached_folders_count');
        if (n !== null && parseInt(n, 10) > 0) return String(n);
      } catch (e) {}
    }
    return item.badge || '';
  }

  function renderNavigatorTab(container) {
    const node = getCurrentNode();
    const isRoot = state.pathStack.length === 1;

    let html = '';

    if (!isRoot) {
      html += `
        <div class="nav-breadcrumb-bar">
          <button id="feedo-nav-back-btn" class="nav-back-btn">
            ← Back
          </button>
          <span class="nav-current-title">${node.title}</span>
        </div>
      `;

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          const isLeaf = Boolean(child.href);
          const badgeClass = child.badgeType === 'new' ? 'badge-new' : (child.badgeType === 'alert' ? 'badge-alert' : '');
          const activeClass = isLeaf && isItemActive(child.href) ? 'active' : '';
          const badgeText = getEffectiveBadge(child);

          html += `
            <div class="nav-menu-item ${activeClass}" data-node-id="${child.id}" data-href="${child.href || ''}" data-is-leaf="${isLeaf}">
              <div class="nav-item-left">
                <span class="nav-item-icon">${child.icon || '📁'}</span>
                <span class="nav-item-title">${child.title}</span>
              </div>
              <div class="nav-item-right">
                ${badgeText ? `<span class="nav-badge ${badgeClass}">${badgeText}</span>` : ''}
                ${!isLeaf ? `<span class="nav-item-arrow">›</span>` : ''}
              </div>
            </div>
          `;
        });
      }
    } else {
      // Root view: Render sections DISCOVER, WORKSPACES, ALERTS matching mockup
      node.children.forEach(section => {
        html += `
          <div class="nav-section-header">
            <span class="nav-section-title">${section.sectionHeader || section.title}</span>
            ${section.sectionMeta ? `<button type="button" class="nav-section-meta ${section.metaClass || ''}" data-section-href="${section.sectionMetaHref || ''}">${section.sectionMeta}</button>` : ''}
          </div>
        `;

        if (section.children) {
          section.children.forEach((child) => {
            const isLeaf = Boolean(child.href);
            const badgeClass = child.badgeType === 'new' ? 'badge-new' : (child.badgeType === 'alert' ? 'badge-alert' : '');
            const activeClass = isLeaf && isItemActive(child.href) ? 'active' : '';
            const badgeText = getEffectiveBadge(child);

            html += `
              <div class="nav-menu-item ${activeClass}" data-node-id="${child.id}" data-href="${child.href || ''}" data-is-leaf="${isLeaf}">
                <div class="nav-item-left">
                  <span class="nav-item-icon">${child.icon || '📁'}</span>
                  <span class="nav-item-title">${child.title}</span>
                </div>
                <div class="nav-item-right">
                  ${badgeText ? `<span class="nav-badge ${badgeClass}">${badgeText}</span>` : ''}
                  ${!isLeaf ? `<span class="nav-item-arrow">›</span>` : ''}
                </div>
              </div>
            `;
          });
        }
      });
    }

    container.innerHTML = html;

    // Attach listeners
    const backBtn = document.getElementById('feedo-nav-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        state.pathStack.pop();
        renderDrawer();
      });
    }

    container.querySelectorAll('[data-section-href]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const href = btn.getAttribute('data-section-href');
        if (href) navigateToView(href, btn.textContent, '➕');
      });
    });

    container.querySelectorAll('.nav-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const isLeaf = item.getAttribute('data-is-leaf') === 'true';
        const nodeId = item.getAttribute('data-node-id');
        const href = item.getAttribute('data-href');

        if (isLeaf && href) {
          navigateToView(href, item.querySelector('.nav-item-title').textContent, item.querySelector('.nav-item-icon').textContent);
        } else {
          state.pathStack.push(nodeId);
          renderDrawer();
        }
      });
    });
  }

  function renderFavoritesTab(container) {
    if (state.favorites.length === 0) {
      container.innerHTML = '<div style="padding: 2.5rem 1rem; text-align: center; color: rgba(255,255,255,0.6); font-size: 0.85rem;">No pinned favorites yet.</div>';
      return;
    }

    let html = '<div class="nav-breadcrumb-bar"><span class="nav-current-title">Favorites</span></div>';
    state.favorites.forEach(fav => {
      const badgeClass = fav.badgeType === 'new' ? 'badge-new' : (fav.badgeType === 'alert' ? 'badge-alert' : '');
      const activeClass = isItemActive(fav.href) ? 'active' : '';
      html += `
        <div class="nav-menu-item ${activeClass}" data-href="${fav.href}">
          <div class="nav-item-left">
            <span class="nav-item-icon">${fav.icon || '⭐'}</span>
            <span class="nav-item-title">${fav.title}</span>
          </div>
          <div class="nav-item-right">
            ${fav.badge ? `<span class="nav-badge ${badgeClass}">${fav.badge}</span>` : ''}
            <button class="nav-fav-pin-btn pinned" data-remove-fav="${fav.href}" title="Remove">✕</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.nav-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.nav-fav-pin-btn')) return;
        const href = item.getAttribute('data-href');
        navigateToView(href);
      });
    });

    container.querySelectorAll('[data-remove-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const href = btn.getAttribute('data-remove-fav');
        state.favorites = state.favorites.filter(f => f.href !== href);
        saveFavorites();
        renderDrawer();
      });
    });
  }

  function renderRecentsTab(container) {
    if (state.recents.length === 0) {
      container.innerHTML = '<div style="padding: 2.5rem 1rem; text-align: center; color: rgba(255,255,255,0.6); font-size: 0.85rem;">No recent history yet.</div>';
      return;
    }

    let html = '<div class="nav-breadcrumb-bar"><span class="nav-current-title">Recent Pages</span></div>';
    state.recents.forEach(rec => {
      const activeClass = isItemActive(rec.href) ? 'active' : '';
      html += `
        <div class="nav-menu-item ${activeClass}" data-href="${rec.href}">
          <div class="nav-item-left">
            <span class="nav-item-icon">${rec.icon || '🕒'}</span>
            <span class="nav-item-title">${rec.title}</span>
          </div>
          <span class="nav-item-arrow">↗</span>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.nav-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const href = item.getAttribute('data-href');
        navigateToView(href);
      });
    });
  }

  function toggleFavorite(nodeId) {
    let found = null;
    function search(node) {
      if (node.id === nodeId && node.href) found = node;
      if (node.children) node.children.forEach(search);
    }
    search(NAV_TREE);

    if (!found) return;

    const existsIdx = state.favorites.findIndex(f => f.href === found.href);
    if (existsIdx !== -1) {
      state.favorites.splice(existsIdx, 1);
    } else {
      state.favorites.push({ id: found.id, title: found.title, href: found.href, icon: found.icon || '⭐', badge: found.badge || '' });
    }
    saveFavorites();
    renderDrawer();
  }

  function navigateToView(href, title, icon) {
    addRecent({ id: href, title: title || href, href, icon: icon || '📄' });
    closeDrawer();

    const isAuth = global.FeedOmeterAuth && global.FeedOmeterAuth.isAuthenticated();
    const isGuest = global.FeedOmeterAuth ? global.FeedOmeterAuth.isGuest() : (localStorage.getItem('feedometer_guest_mode') === 'true');

    // Protect auth-only routes in guest mode
    const authOnlyPages = ['settings.html', 'starred.html', 'read-later.html', 'watchlists.html'];
    const requiresAccount = authOnlyPages.some(function (p) { return href.startsWith(p); });

    if (isGuest && requiresAccount && !isAuth) {
      if (typeof window.showAuthModal === 'function') {
        window.showAuthModal();
      } else if (window.parent && typeof window.parent.showAuthModal === 'function') {
        window.parent.showAuthModal();
      }
      return;
    }

    if (href.startsWith('settings.html')) {
      const tab = href.includes('tab=') ? href.split('tab=')[1].split('&')[0] : 'profile';
      if (typeof window.openSettingsModal === 'function') {
        window.openSettingsModal(tab);
        return;
      }
    }

    if (typeof window.loadView === 'function') {
      window.loadView(href);
      return;
    }

    const frame = document.getElementById('rv-shell-frame');
    if (frame) {
      frame.src = href;
      try {
        window.history.pushState(null, '', `?view=${encodeURIComponent(href)}`);
      } catch (e) {}
    } else {
      window.location.href = href;
    }
  }

  function openDrawer() {
    state.isOpen = true;
    loadUserStorage();
    renderDrawer();
    const drawer = document.getElementById('feedo-nav-drawer');
    const backdrop = document.getElementById('feedo-nav-backdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  }

  function closeDrawer() {
    state.isOpen = false;
    const drawer = document.getElementById('feedo-nav-drawer');
    const backdrop = document.getElementById('feedo-nav-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  // Init
  function init() {
    loadUserStorage();

    const triggerBtn = document.getElementById('feedo-navbar-trigger-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', openDrawer);
    }

    const closeBtn = document.getElementById('feedo-nav-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    const backdrop = document.getElementById('feedo-nav-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Tab buttons
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-nav-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTab = btn.getAttribute('data-nav-tab');
        renderDrawer();
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) {
        closeDrawer();
      }
    });

    window.addEventListener('feedometer:auth_change', () => {
      loadUserStorage();
      renderDrawer();
    });
  }

  global.FeedOmeterNavBar = {
    open: openDrawer,
    close: closeDrawer,
    navigate: navigateToView
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
