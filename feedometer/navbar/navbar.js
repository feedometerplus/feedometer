/**
 * navbar/navbar.js — FeedOmeter 2.1 PeopleSoft PeopleTools Navigation Drawer
 * Modular Navigation Drawer with Multi-Level Drilldown, Favorites & Recents
 */
(function (global) {
  'use strict';

  const STORAGE_KEY_FAVS = 'feedometer_navbar_favs';
  const STORAGE_KEY_RECENTS = 'feedometer_navbar_recents';

  // Navigation Tree (Streamlined for FeedOmeter 2.1)
  const NAV_TREE = {
    id: 'root',
    title: 'Menu',
    children: [
      {
        id: 'news',
        title: 'News & Briefings',
        icon: '📰',
        children: [
          { id: 'home', title: 'Intelligence Briefing', href: 'home.html', icon: '🏠' },
          { id: 'search', title: 'Search & Intelligence', href: 'search.html', icon: '🔍' },
          { id: 'top-stories', title: 'Top Stories (Live Stream)', href: 'top-stories.html', icon: '🔥' },
          { id: 'read-rss', title: 'Split Screen Reader', href: 'read-rss.html', icon: '📖' }
        ]
      },
      {
        id: 'saved',
        title: 'Bookmarks & Queue',
        icon: '⭐',
        children: [
          { id: 'starred', title: 'Starred Articles', href: 'starred.html', icon: '⭐' },
          { id: 'readlater', title: 'Read Later Queue', href: 'read-later.html', icon: '🔖' }
        ]
      },
      {
        id: 'feeds',
        title: 'Feeds & Sources',
        icon: '📡',
        children: [
          { id: 'find-feeds', title: 'Find RSS Feeds (Search)', href: 'find-feeds.html', icon: '🔍' },
          { id: 'watchlists', title: 'Watchlists & Folders', href: 'watchlists.html', icon: '📁' },
          { id: 'find-sources', title: 'Discover & Catalog Sources', href: 'find-sources.html', icon: '📡' },
          { id: 'add-source', title: 'Add Custom RSS Feed', href: 'add-source.html', icon: '➕' },
          { id: 'health', title: 'Source Directory & Health', href: 'sources.html', icon: '🩺' }
        ]
      },
      {
        id: 'settings',
        title: 'Settings & Identity',
        icon: '⚙️',
        children: [
          { id: 'profile-settings', title: 'Profile & Preferences', href: 'settings.html', icon: '👤' },
          { id: 'security-devices', title: 'Security & Active Devices', href: 'settings.html?tab=devices', icon: '🔒' }
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

  function loadUserStorage() {
    try {
      state.favorites = JSON.parse(localStorage.getItem(getScopedKey(STORAGE_KEY_FAVS))) || [
        { id: 'home', title: 'Intelligence Briefing', href: 'home.html', icon: '🏠' },
        { id: 'top-stories', title: 'Top Stories (Live Stream)', href: 'top-stories.html', icon: '🔥' },
        { id: 'starred', title: 'Starred Articles', href: 'starred.html', icon: '⭐' },
        { id: 'read-rss', title: 'Split Screen Reader', href: 'read-rss.html', icon: '📖' }
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
        signoutBtn.innerHTML = '<span>✨</span> <span>Sign In / Join</span>';
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
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        const isLeaf = Boolean(child.href);
        const isPinned = state.favorites.some(f => f.href === child.href);

        html += `
          <div class="nav-menu-item" data-node-id="${child.id}" data-href="${child.href || ''}" data-is-leaf="${isLeaf}">
            <div class="nav-item-left">
              <span class="nav-item-icon">${child.icon || '📁'}</span>
              <span>${child.title}</span>
            </div>
            ${isLeaf ? `
              <button class="nav-fav-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-id="${child.id}" title="${isPinned ? 'Remove Favorite' : 'Add to Favorites'}">
                ★
              </button>
            ` : `
              <span class="nav-item-arrow">›</span>
            `}
          </div>
        `;
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

    container.querySelectorAll('.nav-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.nav-fav-pin-btn')) return;
        const isLeaf = item.getAttribute('data-is-leaf') === 'true';
        const nodeId = item.getAttribute('data-node-id');
        const href = item.getAttribute('data-href');

        if (isLeaf && href) {
          navigateToView(href, item.querySelector('span:nth-child(2)').textContent, item.querySelector('.nav-item-icon').textContent);
        } else {
          state.pathStack.push(nodeId);
          renderDrawer();
        }
      });
    });

    container.querySelectorAll('.nav-fav-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pinId = btn.getAttribute('data-pin-id');
        toggleFavorite(pinId);
      });
    });
  }

  function renderFavoritesTab(container) {
    if (state.favorites.length === 0) {
      container.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No pinned favorites yet.<br>Click ★ on any menu item to pin it here.</div>';
      return;
    }

    let html = '<div class="nav-breadcrumb-bar"><span class="nav-current-title">Pinned Favorites</span></div>';
    state.favorites.forEach(fav => {
      html += `
        <div class="nav-menu-item" data-href="${fav.href}">
          <div class="nav-item-left">
            <span class="nav-item-icon">${fav.icon || '⭐'}</span>
            <span>${fav.title}</span>
          </div>
          <button class="nav-fav-pin-btn pinned" data-remove-fav="${fav.href}">✕</button>
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
      container.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No recent history yet.</div>';
      return;
    }

    let html = '<div class="nav-breadcrumb-bar"><span class="nav-current-title">Recent Pages</span></div>';
    state.recents.forEach(rec => {
      html += `
        <div class="nav-menu-item" data-href="${rec.href}">
          <div class="nav-item-left">
            <span class="nav-item-icon">${rec.icon || '🕒'}</span>
            <span>${rec.title}</span>
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
      state.favorites.push({ id: found.id, title: found.title, href: found.href, icon: found.icon || '⭐' });
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

    // Trigger button (Compass icon in topbar)
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
