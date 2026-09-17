/**
 * Feedometer - Public Standalone RSS Reader & Viewer
 * Renders canonical JSON from the Feedometer Worker. Parse/image/dedupe live on the Worker.
 */

(function () {
  'use strict';

  // Sample Curated Feeds
  const SAMPLE_FEEDS = {
    tech: 'https://news.ycombinator.com/rss',
    world: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    science: 'https://www.sciencedaily.com/rss/top/science.xml',
    verge: 'https://www.theverge.com/rss/index.xml',
    bbc: 'https://feeds.bbci.co.uk/news/rss.xml',
    nasa: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    cnn: 'http://rss.cnn.com/rss/edition.rss',
    sky: 'https://feeds.skynews.com/feeds/rss/home.xml',
    npr: 'https://feeds.npr.org/1001/rss.xml',
    wired: 'https://www.wired.com/feed/rss',
    mit: 'https://technologyreview.com/feed/',
    forbes: 'https://www.forbes.com/business/feed/'
  };

  // State
  let currentItems = [];
  let currentFeedMeta = { title: '', description: '', link: '', url: '', feedIcon: '' };
  let currentViewMode = 'list'; // 'grid' or 'list'
  let starredLinks = new Set(JSON.parse(localStorage.getItem('feedometer_starred') || '[]'));
  let activeSearchQuery = '';
  let activeFilterMode = 'all';
  let thumbnailEnrichGen = 0;
  const ogImageCache = new Map();

  const OG_THUMBNAIL_MAX_ITEMS = 24;
  const OG_THUMBNAIL_CONCURRENCY = 4;

  // DOM Elements
  const feedUrlInput = document.getElementById('feed-url-input');
  const btnFetchFeed = document.getElementById('btn-fetch-feed');
  const feedTitleEl = document.getElementById('feed-title');
  const feedCountBadge = document.getElementById('feed-count-badge');
  const cardsContainer = document.getElementById('cards-container');
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorContainer = document.getElementById('error-container');
  const viewGridBtn = document.getElementById('view-grid-btn');
  const viewListBtn = document.getElementById('view-list-btn');
  const feedSearchInput = document.getElementById('feed-search-input');
  const feedFilterSelect = document.getElementById('feed-filter-select'); // may be null
  const feedRefreshBtn = document.getElementById('feed-refresh-btn');
  const heroState = document.getElementById('hero-state');
  const readerPanel = document.getElementById('reader-panel');
  const readerBackBtn = document.getElementById('reader-back-btn');
  const siteHeader = document.querySelector('.site-header');

  // Reader Modal DOM
  const readerModal = document.getElementById('reader-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalLink = document.getElementById('modal-link');
  const modalClose = document.getElementById('modal-close');

  // ---- Panel visibility helpers ----
  function showReaderPanel() {
    if (heroState) {
      heroState.style.display = 'none';
      heroState.classList.add('hidden');
    }
    if (readerPanel) {
      readerPanel.style.display = 'flex';
      readerPanel.classList.remove('hidden');
    }

    // Output view: Keep top bar enabled, hide background color & menu icons
    if (siteHeader) siteHeader.classList.add('in-reader-view');
    document.body.classList.add('reader-view-active');

    // Close any open popups, dropdowns, or modals
    const navDropdown = document.getElementById('feed-navigator-dropdown');
    if (navDropdown && navDropdown.classList.contains('active')) {
      navDropdown.classList.remove('active');
    }
    const bgPopup = document.getElementById('bg-color-popup');
    if (bgPopup && bgPopup.classList.contains('active')) {
      bgPopup.classList.remove('active');
    }
    const feedoPlusDropdown = document.getElementById('feedoplus-dropdown');
    if (feedoPlusDropdown && feedoPlusDropdown.classList.contains('active')) {
      feedoPlusDropdown.classList.remove('active');
    }
    const launchModal = document.getElementById('launch-modal');
    if (launchModal && launchModal.classList.contains('active')) {
      launchModal.classList.remove('active');
    }
    const pubModal = document.getElementById('publisher-feeds-modal');
    if (pubModal && pubModal.classList.contains('active')) {
      pubModal.classList.remove('active');
    }

    // Reset window and reader body scroll position to top
    window.scrollTo(0, 0);
    const body = readerPanel && readerPanel.querySelector('.reader-body');
    if (body) body.scrollTop = 0;
  }

  function showHeroState() {
    if (readerPanel) {
      readerPanel.style.display = 'none';
      readerPanel.classList.add('hidden');
    }
    if (heroState) {
      heroState.style.display = '';
      heroState.classList.remove('hidden');
    }

    // Feed reader view: Make background color and menu icons visible all the time
    if (siteHeader) siteHeader.classList.remove('in-reader-view');
    document.body.classList.remove('reader-view-active');

    const pubModal = document.getElementById('publisher-feeds-modal');
    if (pubModal && pubModal.classList.contains('active')) {
      pubModal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // clear feed state
    currentItems = [];
    currentFeedMeta = { title: '', description: '', link: '', url: '', feedIcon: '' };
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (feedTitleEl) feedTitleEl.textContent = 'Top Stories';
    if (feedCountBadge) feedCountBadge.textContent = '0 stories';
    if (feedSearchInput) feedSearchInput.value = '';
    activeSearchQuery = '';
    activeFilterMode = 'all';
    // clear URL param
    window.history.replaceState({}, '', window.location.pathname);
    setViewMode('list');
    // focus input
    if (feedUrlInput) {
      feedUrlInput.value = '';
      feedUrlInput.focus({ preventScroll: true });
    }
  }

  // Initialize
  function init() {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    setupEventListeners();

    // Check URL parameters ONLY if explicitly shared from builder/external (exclude hacker news auto-param)
    const urlParams = new URLSearchParams(window.location.search);
    const feedParam = urlParams.get('url') || urlParams.get('feed');

    if (feedParam && feedParam !== SAMPLE_FEEDS.tech && !feedParam.includes('ycombinator')) {
      feedUrlInput.value = feedParam;
      loadFeed(feedParam);
    } else {
      // 100% blank state on fresh load — show hero and ensure icons are visible
      if (heroState) {
        heroState.style.display = '';
        heroState.classList.remove('hidden');
      }
      if (readerPanel) {
        readerPanel.style.display = 'none';
        readerPanel.classList.add('hidden');
      }
      if (siteHeader) siteHeader.classList.remove('in-reader-view');
      document.body.classList.remove('reader-view-active');
      if (feedUrlInput) {
        feedUrlInput.value = '';
        feedUrlInput.focus({ preventScroll: true });
      }
      // Clean query string from browser bar if it had old leftover params
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }

  function setupEventListeners() {
    btnFetchFeed.addEventListener('click', () => {
      const url = feedUrlInput.value.trim();
      if (url) loadFeed(url);
    });

    feedUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = feedUrlInput.value.trim();
        if (url) loadFeed(url);
      }
    });

    // Sample pills with smooth selection
    document.querySelectorAll('.sample-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const targetPill = e.currentTarget;

        // Visual feedback
        document.querySelectorAll('.sample-pill').forEach(p => p.classList.remove('active-selected'));
        targetPill.classList.add('active-selected');

        const feedKey = targetPill.getAttribute('data-feed');
        if (SAMPLE_FEEDS[feedKey]) {
          feedUrlInput.value = SAMPLE_FEEDS[feedKey];
          feedUrlInput.focus();
        }
      });
    });

    // Back button — returns to hero state
    if (readerBackBtn) {
      readerBackBtn.addEventListener('click', showHeroState);
    }

    // View toggle
    if (viewGridBtn && viewListBtn) {
      viewGridBtn.addEventListener('click', () => setViewMode('grid'));
      viewListBtn.addEventListener('click', () => setViewMode('list'));
    }

    // Live search
    if (feedSearchInput) {
      feedSearchInput.addEventListener('input', (e) => {
        activeSearchQuery = e.target.value.trim().toLowerCase();
        applyFiltersAndRender();
      });
    }

    // Filter dropdown
    if (feedFilterSelect) {
      feedFilterSelect.addEventListener('change', (e) => {
        activeFilterMode = e.target.value;
        applyFiltersAndRender();
      });
    }

    // Refresh feed button
    if (feedRefreshBtn) {
      feedRefreshBtn.addEventListener('click', () => {
        if (currentFeedMeta.url) {
          feedRefreshBtn.classList.add('spinning');
          loadFeed(currentFeedMeta.url, { nocache: true }).finally(() => {
            setTimeout(() => feedRefreshBtn.classList.remove('spinning'), 600);
          });
        }
      });
    }

    // Modal close
    if (modalClose) {
      modalClose.addEventListener('click', closeModal);
    }
    if (readerModal) {
      readerModal.addEventListener('click', (e) => {
        if (e.target === readerModal) closeModal();
      });
    }

    // Sample Feeds Carousel setup
    setupSampleCarousel();

    // Terms & Privacy Modal setup
    setupTermsModal();
    setupPrivacyModal();

    // Launch / Notify Modal setup (auto-opens on load/refresh)
    setupLaunchModal();

    // Publisher Category Feeds Modal setup
    setupPublisherCategoryModal();

    // Feed Navigator Dropdown setup
    setupFeedNavigatorDropdown();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        const pubModal = document.getElementById('publisher-feeds-modal');
        if (pubModal && pubModal.classList.contains('active')) {
          pubModal.classList.remove('active');
          document.body.style.overflow = '';
        }
        const termsModal = document.getElementById('terms-modal');
        if (termsModal && termsModal.classList.contains('active')) {
          termsModal.classList.remove('active');
          document.body.style.overflow = '';
        }
        const privacyModal = document.getElementById('privacy-modal');
        if (privacyModal && privacyModal.classList.contains('active')) {
          privacyModal.classList.remove('active');
          document.body.style.overflow = '';
        }
        const launchModal = document.getElementById('launch-modal');
        if (launchModal && launchModal.classList.contains('active')) {
          launchModal.classList.remove('active');
        }
        const navDropdown = document.getElementById('feed-navigator-dropdown');
        if (navDropdown && navDropdown.classList.contains('active')) {
          navDropdown.classList.remove('active');
        }
      }
    });
  }

  function setupSampleCarousel() {
    const carousel = document.getElementById('sample-feeds-carousel');
    const prevBtn = document.getElementById('sample-carousel-prev');
    const nextBtn = document.getElementById('sample-carousel-next');

    if (!carousel || !prevBtn || !nextBtn) return;

    const scrollAmount = 180;

    prevBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    // Frictionless mouse drag-to-scroll support on desktop
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasDragged = false;

    carousel.addEventListener('mousedown', (e) => {
      isDown = true;
      hasDragged = false;
      startX = e.pageX - carousel.offsetLeft;
      startScrollLeft = carousel.scrollLeft;
      carousel.style.scrollBehavior = 'auto';
    });

    window.addEventListener('mouseup', () => {
      if (isDown) {
        isDown = false;
        carousel.style.scrollBehavior = 'smooth';
      }
    });

    carousel.addEventListener('mouseleave', () => {
      if (isDown) {
        isDown = false;
        carousel.style.scrollBehavior = 'smooth';
      }
    });

    carousel.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 4) hasDragged = true;
      carousel.scrollLeft = startScrollLeft - walk;
    });

    // Prevent accidental click when dragging
    carousel.addEventListener('click', (e) => {
      if (hasDragged) {
        e.stopImmediatePropagation();
        e.preventDefault();
        hasDragged = false;
      }
    }, true);
  }

  const POPULAR_FEEDS = [
    { name: 'BBC News', domain: 'bbc.co.uk', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'World News', bg: '#bb1919' },
    { name: 'NY Times', domain: 'nytimes.com', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'World News', bg: '#111827' },
    { name: 'The Guardian', domain: 'theguardian.com', url: 'https://www.theguardian.com/world/rss', category: 'World News', bg: '#052962' },
    { name: 'Sky Sports', domain: 'skysports.com', url: 'https://www.skysports.com/rss/12040', category: 'Sports', bg: '#0b1e42' },
    { name: 'CNN', domain: 'cnn.com', url: 'http://rss.cnn.com/rss/edition.rss', category: 'World News', bg: '#cc0000' },
    { name: 'NPR News', domain: 'npr.org', url: 'https://feeds.npr.org/1001/rss.xml', category: 'World News', bg: '#23588f' },
    { name: 'Al Jazeera', domain: 'aljazeera.com', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'World News', bg: '#91530e' },
    { name: 'The Verge', domain: 'theverge.com', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech & AI', bg: '#e5127d' },
    { name: 'TechCrunch', domain: 'techcrunch.com', url: 'https://techcrunch.com/feed/', category: 'Startups & VC', bg: '#029e4b' },
    { name: 'Wired', domain: 'wired.com', url: 'https://www.wired.com/feed/rss', category: 'Deep Tech', bg: '#111827' },
    { name: 'Hacker News', domain: 'news.ycombinator.com', url: 'https://news.ycombinator.com/rss', category: 'Developer', bg: '#ff6600' },
    { name: 'Ars Technica', domain: 'arstechnica.com', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Engineering', bg: '#ff4e00' },
    { name: 'MIT Tech', domain: 'technologyreview.com', url: 'https://www.technologyreview.com/feed/', category: 'AI & Research', bg: '#111827' },
    { name: 'Engadget', domain: 'engadget.com', url: 'https://www.engadget.com/rss.xml', category: 'Gadgets', bg: '#0066cc' },
    { name: 'WSJ Markets', domain: 'wsj.com', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', category: 'Finance', bg: '#002f6c' },
    { name: 'Bloomberg', domain: 'bloomberg.com', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'Finance', bg: '#142542' },
    { name: 'Forbes', domain: 'forbes.com', url: 'https://www.forbes.com/business/feed/', category: 'Business', bg: '#111827' },
    { name: 'FT News', domain: 'ft.com', url: 'https://www.ft.com/news-feed?format=rss', category: 'Global Economy', bg: '#e07a5f' },
    { name: 'Fast Company', domain: 'fastcompany.com', url: 'https://www.fastcompany.com/latest/rss', category: 'Innovation', bg: '#111827' },
    { name: 'NASA', domain: 'nasa.gov', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'Space', bg: '#0b3d91' },
    { name: 'ScienceDaily', domain: 'sciencedaily.com', url: 'https://www.sciencedaily.com/rss/top/science.xml', category: 'Science', bg: '#1b6ca8' },
    { name: 'Nature', domain: 'nature.com', url: 'https://www.nature.com/nature.rss', category: 'Research', bg: '#105b8c' },
    { name: 'InsideEVs', domain: 'insideevs.com', url: 'https://insideevs.com/rss/news/all/', category: 'EV News', bg: '#0284c7' },
    { name: 'IGN', domain: 'ign.com', url: 'https://feeds.feedburner.com/ign/all', category: 'Gaming', bg: '#bf1313' },
    { name: 'Polygon', domain: 'polygon.com', url: 'https://www.polygon.com/rss/index.xml', category: 'Gaming', bg: '#e5127d' }
  ];

  const PUBLISHER_FEEDS_CATALOG = {
    'bbc.co.uk': {
      name: 'BBC News',
      domain: 'bbc.co.uk',
      bg: '#bb1919',
      category: 'World News',
      description: 'British Broadcasting Corporation',
      feeds: [
        { title: 'Top Stories / Front Page', url: 'https://feeds.bbci.co.uk/news/rss.xml', tag: 'Headlines', desc: 'Breaking news and world headlines' },
        { title: 'World News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', tag: 'World', desc: 'International affairs and global events' },
        { title: 'Business & Economy', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', tag: 'Business', desc: 'Markets, economy, and financial analysis' },
        { title: 'Technology & AI', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', tag: 'Technology', desc: 'Innovations, AI, gadgets, and digital tech' },
        { title: 'Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', tag: 'Science', desc: 'Scientific discoveries and climate news' },
        { title: 'Entertainment & Arts', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', tag: 'Culture', desc: 'Film, music, culture, and celeb news' }
      ]
    },
    'nytimes.com': {
      name: 'NY Times',
      domain: 'nytimes.com',
      bg: '#111827',
      category: 'World News',
      description: 'The New York Times',
      feeds: [
        { title: 'Home Page Headlines', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', tag: 'Top News', desc: 'Front page journalism and breaking reports' },
        { title: 'World News', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', tag: 'World', desc: 'Global reporting and diplomatic dispatch' },
        { title: 'Business & Markets', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', tag: 'Business', desc: 'Corporate news, finance, and global markets' },
        { title: 'Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', tag: 'Tech', desc: 'Silicon Valley, AI, and digital culture' },
        { title: 'Science & Health', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', tag: 'Science', desc: 'Research, health, space, and environment' }
      ]
    },
    'theguardian.com': {
      name: 'The Guardian',
      domain: 'theguardian.com',
      bg: '#052962',
      category: 'World News',
      description: 'Independent Global Journalism',
      feeds: [
        { title: 'World News', url: 'https://www.theguardian.com/world/rss', tag: 'World', desc: 'International news and comprehensive reporting' },
        { title: 'Business', url: 'https://www.theguardian.com/uk/business/rss', tag: 'Business', desc: 'Markets, companies, and financial trends' },
        { title: 'Technology', url: 'https://www.theguardian.com/uk/technology/rss', tag: 'Tech', desc: 'Computing, artificial intelligence, and internet' },
        { title: 'Global Sport', url: 'https://www.theguardian.com/uk/sport/rss', tag: 'Sport', desc: 'Football, rugby, cricket, and global sports' },
        { title: 'Culture & Arts', url: 'https://www.theguardian.com/uk/culture/rss', tag: 'Culture', desc: 'Film, music, books, and visual arts' }
      ]
    },
    'skysports.com': {
      name: 'Sky Sports',
      domain: 'skysports.com',
      bg: '#0b1e42',
      category: 'Sports',
      description: 'Live Sports & Breaking Updates',
      feeds: [
        { title: 'Top Sports Stories', url: 'https://www.skysports.com/rss/12040', tag: 'Headlines', desc: 'Breaking sports news and live highlights' },
        { title: 'Football News', url: 'https://www.skysports.com/rss/11095', tag: 'Football', desc: 'Premier League, Champions League & world football' },
        { title: 'Transfer Centre', url: 'https://www.skysports.com/rss/11661', tag: 'Transfers', desc: 'Transfer news, gossip, and confirmed deals' },
        { title: 'Formula 1 & Motorsport', url: 'https://www.skysports.com/rss/12433', tag: 'Motorsport', desc: 'F1 race reports, drivers, and team updates' },
        { title: 'Cricket', url: 'https://www.skysports.com/rss/12123', tag: 'Cricket', desc: 'International test matches, T20, and leagues' }
      ]
    },
    'cnn.com': {
      name: 'CNN',
      domain: 'cnn.com',
      bg: '#cc0000',
      category: 'World News',
      description: 'Cable News Network',
      feeds: [
        { title: 'Top International Stories', url: 'http://rss.cnn.com/rss/edition.rss', tag: 'Headlines', desc: 'Top international breaking news' },
        { title: 'World News', url: 'http://rss.cnn.com/rss/edition_world.rss', tag: 'World', desc: 'Global developments and international coverage' },
        { title: 'Money & Business', url: 'http://rss.cnn.com/rss/money_latest.rss', tag: 'Business', desc: 'Economy, markets, and company news' },
        { title: 'Technology', url: 'http://rss.cnn.com/rss/edition_technology.rss', tag: 'Tech', desc: 'Digital innovation and future tech' },
        { title: 'World Sport', url: 'http://rss.cnn.com/rss/edition_sport.rss', tag: 'Sport', desc: 'Scores, athletic profiles, and championships' }
      ]
    },
    'npr.org': {
      name: 'NPR News',
      domain: 'npr.org',
      bg: '#23588f',
      category: 'World News',
      description: 'National Public Radio',
      feeds: [
        { title: 'Top News Headlines', url: 'https://feeds.npr.org/1001/rss.xml', tag: 'Headlines', desc: 'NPR top stories and breaking coverage' },
        { title: 'World News', url: 'https://feeds.npr.org/1004/rss.xml', tag: 'World', desc: 'International affairs and humanitarian reports' },
        { title: 'Business & Economy', url: 'https://feeds.npr.org/1006/rss.xml', tag: 'Business', desc: 'Economic analysis and workplace trends' },
        { title: 'Technology', url: 'https://feeds.npr.org/1019/rss.xml', tag: 'Tech', desc: 'Tech policy, digital life, and big tech' },
        { title: 'Science & Health', url: 'https://feeds.npr.org/1007/rss.xml', tag: 'Science', desc: 'Space exploration, medicine, and research' }
      ]
    },
    'aljazeera.com': {
      name: 'Al Jazeera',
      domain: 'aljazeera.com',
      bg: '#91530e',
      category: 'World News',
      description: 'Global News Network',
      feeds: [
        { title: 'All News & World Stories', url: 'https://www.aljazeera.com/xml/rss/all.xml', tag: 'Headlines', desc: 'Comprehensive Middle East and world reporting' }
      ]
    },
    'theverge.com': {
      name: 'The Verge',
      domain: 'theverge.com',
      bg: '#e5127d',
      category: 'Tech & AI',
      description: 'Tech, Science, Art & Modern Culture',
      feeds: [
        { title: 'All Stories Stream', url: 'https://www.theverge.com/rss/index.xml', tag: 'Headlines', desc: 'Comprehensive Verge coverage across all beats' },
        { title: 'Tech News', url: 'https://www.theverge.com/rss/tech/index.xml', tag: 'Tech', desc: 'Consumer tech, gadgets, AI, and computing' },
        { title: 'Reviews & Verdicts', url: 'https://www.theverge.com/rss/reviews/index.xml', tag: 'Reviews', desc: 'In-depth hardware and software verdicts' },
        { title: 'Gaming', url: 'https://www.theverge.com/rss/gaming/index.xml', tag: 'Gaming', desc: 'Video games, consoles, and gaming culture' }
      ]
    },
    'techcrunch.com': {
      name: 'TechCrunch',
      domain: 'techcrunch.com',
      bg: '#029e4b',
      category: 'Startups & VC',
      description: 'Startup Ecosystem & Venture Capital',
      feeds: [
        { title: 'Latest Headlines', url: 'https://techcrunch.com/feed/', tag: 'Headlines', desc: 'Breaking tech and startup news' },
        { title: 'Startups Hub', url: 'https://techcrunch.com/category/startups/feed/', tag: 'Startups', desc: 'Early-stage founders, launches, and demos' },
        { title: 'Venture Capital', url: 'https://techcrunch.com/category/venture/feed/', tag: 'VC', desc: 'Funding rounds, seed capital, and acquisitions' },
        { title: 'Artificial Intelligence', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', tag: 'AI', desc: 'Generative AI, LLMs, and research models' },
        { title: 'Fintech', url: 'https://techcrunch.com/category/fintech/feed/', tag: 'Fintech', desc: 'Payments, crypto, banking, and wealth tech' }
      ]
    },
    'wired.com': {
      name: 'Wired',
      domain: 'wired.com',
      bg: '#111827',
      category: 'Deep Tech',
      description: 'The Future As It Happens',
      feeds: [
        { title: 'Top Stories', url: 'https://www.wired.com/feed/rss', tag: 'Headlines', desc: 'In-depth tech journalism and culture' },
        { title: 'Business', url: 'https://www.wired.com/feed/category/business/latest/rss', tag: 'Business', desc: 'Venture capitalism, big tech, and power' },
        { title: 'Science', url: 'https://www.wired.com/feed/category/science/latest/rss', tag: 'Science', desc: 'Space, biotech, physics, and climate' },
        { title: 'Gear & Tech', url: 'https://www.wired.com/feed/category/gear/latest/rss', tag: 'Gear', desc: 'Product testing, buying guides, and gadgets' },
        { title: 'Security & Privacy', url: 'https://www.wired.com/feed/category/security/latest/rss', tag: 'Security', desc: 'Hacking, privacy, surveillance, and cyber defense' }
      ]
    },
    'news.ycombinator.com': {
      name: 'Hacker News',
      domain: 'news.ycombinator.com',
      bg: '#ff6600',
      category: 'Developer',
      description: 'Y Combinator Tech & Hacker Community',
      feeds: [
        { title: 'Top Frontpage', url: 'https://news.ycombinator.com/rss', tag: 'Trending', desc: 'Top ranked developer submissions and discussions' },
        { title: 'Show HN', url: 'https://news.ycombinator.com/showrss', tag: 'Showcase', desc: 'New apps, libraries, and open source projects' }
      ]
    },
    'arstechnica.com': {
      name: 'Ars Technica',
      domain: 'arstechnica.com',
      bg: '#ff4e00',
      category: 'Engineering',
      description: 'Original Technica & Science Reporting',
      feeds: [
        { title: 'Main Feed', url: 'https://feeds.arstechnica.com/arstechnica/index', tag: 'Headlines', desc: 'Original tech analysis and reporting' },
        { title: 'Technology Lab', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', tag: 'Tech', desc: 'Hardware, software, networks, and cloud' },
        { title: 'Science & Space', url: 'https://feeds.arstechnica.com/arstechnica/science', tag: 'Science', desc: 'Cosmology, biology, and scientific breakthroughs' },
        { title: 'Cars & EV', url: 'https://feeds.arstechnica.com/arstechnica/cars', tag: 'Automotive', desc: 'Electric cars, autonomous drive, and transit' },
        { title: 'Gaming & Culture', url: 'https://feeds.arstechnica.com/arstechnica/gaming', tag: 'Gaming', desc: 'Video game industry and reviews' }
      ]
    },
    'technologyreview.com': {
      name: 'MIT Tech Review',
      domain: 'technologyreview.com',
      bg: '#111827',
      category: 'AI & Research',
      description: 'Massachusetts Institute of Technology',
      feeds: [
        { title: 'Main Flagship Feed', url: 'https://www.technologyreview.com/feed/', tag: 'Headlines', desc: 'MIT Technology Review flagship intelligence and reporting' },
        { title: 'Artificial Intelligence', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', tag: 'AI', desc: 'Deep learning, neural nets, and AI ethics' },
        { title: 'Biotechnology', url: 'https://www.technologyreview.com/topic/biotechnology/feed/', tag: 'Biotech', desc: 'Genomics, medicine, and human longevity' },
        { title: 'Climate & Clean Energy', url: 'https://www.technologyreview.com/topic/climate-change/feed/', tag: 'Climate', desc: 'Renewables, carbon removal, and green grid' }
      ]
    },
    'engadget.com': {
      name: 'Engadget',
      domain: 'engadget.com',
      bg: '#0066cc',
      category: 'Gadgets',
      description: 'Consumer Electronics & Gear Reviews',
      feeds: [
        { title: 'Latest Stories', url: 'https://www.engadget.com/rss.xml', tag: 'Headlines', desc: 'Consumer tech, electronics, and devices' }
      ]
    },
    'wsj.com': {
      name: 'WSJ',
      domain: 'wsj.com',
      bg: '#002f6c',
      category: 'Finance',
      description: 'The Wall Street Journal',
      feeds: [
        { title: 'Financial Markets Main', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', tag: 'Markets', desc: 'Wall Street Journal financial markets' },
        { title: 'World News', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', tag: 'World', desc: 'Global geopolitical and economic events' },
        { title: 'US Business', url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml', tag: 'Business', desc: 'Corporate management and industry coverage' },
        { title: 'Technology (WSJD)', url: 'https://feeds.a.dj.com/rss/RSSWSJD.xml', tag: 'Tech', desc: 'WSJ tech column and digital innovation' },
        { title: 'Editorial Opinion', url: 'https://feeds.a.dj.com/rss/RSSOpinion.xml', tag: 'Opinion', desc: 'Editorial board and commentary' }
      ]
    },
    'bloomberg.com': {
      name: 'Bloomberg',
      domain: 'bloomberg.com',
      bg: '#142542',
      category: 'Finance',
      description: 'Global Business & Financial Intelligence',
      feeds: [
        { title: 'Markets News', url: 'https://feeds.bloomberg.com/markets/news.rss', tag: 'Markets', desc: 'Global equity, bond, and currency updates' },
        { title: 'Politics & Policy', url: 'https://feeds.bloomberg.com/politics/news.rss', tag: 'Politics', desc: 'Government policies and legislative news' },
        { title: 'Technology', url: 'https://feeds.bloomberg.com/technology/news.rss', tag: 'Tech', desc: 'Tech titans and venture investing' },
        { title: 'Wealth & Investing', url: 'https://feeds.bloomberg.com/wealth/news.rss', tag: 'Wealth', desc: 'Personal finance, hedge funds, and family offices' }
      ]
    },
    'forbes.com': {
      name: 'Forbes',
      domain: 'forbes.com',
      bg: '#111827',
      category: 'Business',
      description: 'Business, Wealth & Entrepreneurship',
      feeds: [
        { title: 'Business News', url: 'https://www.forbes.com/business/feed/', tag: 'Business', desc: 'Forbes business insights and wealth lists' },
        { title: 'Innovation & Tech', url: 'https://www.forbes.com/innovation/feed/', tag: 'Innovation', desc: 'Emerging technology and startup founders' }
      ]
    },
    'ft.com': {
      name: 'FT News',
      domain: 'ft.com',
      bg: '#e07a5f',
      category: 'Global Economy',
      description: 'Financial Times Global News',
      feeds: [
        { title: 'Global Economy & News', url: 'https://www.ft.com/news-feed?format=rss', tag: 'Economy', desc: 'Financial Times world business intelligence' },
        { title: 'World Affairs', url: 'https://www.ft.com/world?format=rss', tag: 'World', desc: 'Diplomacy, international trade, and geopolitics' },
        { title: 'Companies & Deals', url: 'https://www.ft.com/companies?format=rss', tag: 'Companies', desc: 'Global corporate analysis and M&A' },
        { title: 'Technology', url: 'https://www.ft.com/technology?format=rss', tag: 'Tech', desc: 'Fintech, AI, and enterprise tech' }
      ]
    },
    'fastcompany.com': {
      name: 'Fast Company',
      domain: 'fastcompany.com',
      bg: '#111827',
      category: 'Innovation',
      description: 'Progressive Business, Design & Work',
      feeds: [
        { title: 'Latest Stories', url: 'https://www.fastcompany.com/latest/rss', tag: 'Headlines', desc: 'Progressive business and creative culture' },
        { title: 'Technology', url: 'https://www.fastcompany.com/technology/rss', tag: 'Tech', desc: 'Next-gen computing and design trends' },
        { title: 'Work Life', url: 'https://www.fastcompany.com/work-life/rss', tag: 'Workplace', desc: 'Productivity, remote work, and future of work' },
        { title: 'Co.Design', url: 'https://www.fastcompany.com/co-design/rss', tag: 'Design', desc: 'Architecture, UX, product design, and style' }
      ]
    },
    'nasa.gov': {
      name: 'NASA',
      domain: 'nasa.gov',
      bg: '#0b3d91',
      category: 'Space',
      description: 'National Aeronautics and Space Admin',
      feeds: [
        { title: 'All News & Releases', url: 'https://www.nasa.gov/feed/', tag: 'Headlines', desc: 'Official NASA press releases and discovery updates' },
        { title: 'News Releases', url: 'https://www.nasa.gov/news-release/feed/', tag: 'Releases', desc: 'Live mission briefings and statements' },
        { title: 'Missions & Telescopes', url: 'https://www.nasa.gov/missions/feed/', tag: 'Missions', desc: 'Space exploration missions and telescopes' },
        { title: 'Earth Science', url: 'https://www.nasa.gov/earth/feed/', tag: 'Earth', desc: 'Atmospheric and planetary observations' }
      ]
    },
    'sciencedaily.com': {
      name: 'ScienceDaily',
      domain: 'sciencedaily.com',
      bg: '#1b6ca8',
      category: 'Science',
      description: 'Peer-Reviewed Science Research',
      feeds: [
        { title: 'Top Science Headlines', url: 'https://www.sciencedaily.com/rss/top/science.xml', tag: 'Science', desc: 'Peer-reviewed research and discoveries' },
        { title: 'Health & Medicine', url: 'https://www.sciencedaily.com/rss/top/health.xml', tag: 'Health', desc: 'Medical research and healthcare studies' },
        { title: 'Technology & Physics', url: 'https://www.sciencedaily.com/rss/top/technology.xml', tag: 'Tech', desc: 'Engineering, nanotechnology, and robotics' },
        { title: 'Environment & Climate', url: 'https://www.sciencedaily.com/rss/top/environment.xml', tag: 'Environment', desc: 'Ecology, geology, and green solutions' }
      ]
    },
    'nature.com': {
      name: 'Nature',
      domain: 'nature.com',
      bg: '#105b8c',
      category: 'Research',
      description: 'International Journal of Science',
      feeds: [
        { title: 'Latest Research', url: 'https://www.nature.com/nature.rss', tag: 'Research', desc: 'Nature international journal of science' },
        { title: 'Biotechnology', url: 'https://www.nature.com/nbt.rss', tag: 'Biotech', desc: 'Nature Biotechnology research papers' },
        { title: 'Biological Sciences', url: 'https://www.nature.com/subjects/biological-sciences.rss', tag: 'Biology', desc: 'Cellular biology, genetics, and ecology' }
      ]
    },
    'insideevs.com': {
      name: 'InsideEVs',
      domain: 'insideevs.com',
      bg: '#0284c7',
      category: 'EV News',
      description: 'Electric Vehicle News, Reviews & Charging',
      feeds: [
        { title: 'All EV News', url: 'https://insideevs.com/rss/news/all/', tag: 'Headlines', desc: 'Comprehensive electric vehicle breaking news' },
        { title: 'Articles & Reviews', url: 'https://insideevs.com/rss/articles/all/', tag: 'Reviews', desc: 'In-depth EV road tests and comparisons' },
        { title: 'Features & Deep Dives', url: 'https://insideevs.com/rss/features/all/', tag: 'Features', desc: 'Industry analysis and battery tech' },
        { title: 'Charging & Stations', url: 'https://insideevs.com/rss/category/charging/', tag: 'Charging', desc: 'Superchargers, NACS, and charging speeds' }
      ]
    },
    'ign.com': {
      name: 'IGN',
      domain: 'ign.com',
      bg: '#bf1313',
      category: 'Gaming',
      description: 'Video Games, Reviews & Entertainment',
      feeds: [
        { title: 'All Video Games', url: 'https://feeds.feedburner.com/ign/all', tag: 'All', desc: 'Video game news, trailers, and updates' },
        { title: 'Game Reviews & Verdicts', url: 'https://feeds.feedburner.com/ign/reviews', tag: 'Reviews', desc: 'Scored video game reviews and verdicts' },
        { title: 'Breaking News', url: 'https://feeds.feedburner.com/ign/news', tag: 'Headlines', desc: 'Breaking news across PlayStation, Xbox & PC' },
        { title: 'Games All', url: 'https://feeds.feedburner.com/ign/games-all', tag: 'Games', desc: 'Gameplay features, guides, and walkthroughs' }
      ]
    },
    'polygon.com': {
      name: 'Polygon',
      domain: 'polygon.com',
      bg: '#e5127d',
      category: 'Gaming',
      description: 'Gaming Culture, Anime & Entertainment',
      feeds: [
        { title: 'All Stories Stream', url: 'https://www.polygon.com/rss/index.xml', tag: 'Headlines', desc: 'Gaming, entertainment, anime, and culture' },
        { title: 'Gaming News', url: 'https://www.polygon.com/gaming/rss/index.xml', tag: 'Gaming', desc: 'Game announcements, patch notes, and esports' },
        { title: 'Reviews & Critiques', url: 'https://www.polygon.com/reviews/rss/index.xml', tag: 'Reviews', desc: 'In-depth game and movie review critiques' },
        { title: 'Entertainment & Culture', url: 'https://www.polygon.com/entertainment/rss/index.xml', tag: 'Entertainment', desc: 'Comic books, tabletop, and film discussions' }
      ]
    }
  };

  // Publisher Category Modal handler
  let openPublisherCategoryModalFn = null;

  function setupPublisherCategoryModal() {
    const pubModal = document.getElementById('publisher-feeds-modal');
    const pubClose = document.getElementById('pub-modal-close');
    const pubIcon = document.getElementById('pub-modal-icon');
    const pubFallback = document.getElementById('pub-modal-fallback');
    const pubTitle = document.getElementById('pub-modal-title');
    const pubBadge = document.getElementById('pub-modal-badge');
    const pubDesc = document.getElementById('pub-modal-desc');
    const pubSearch = document.getElementById('pub-modal-search-input');
    const pubGrid = document.getElementById('pub-cards-grid');
    const pubEmpty = document.getElementById('pub-modal-empty');
    const pubBody = pubModal ? pubModal.querySelector('.pub-modal-body') : null;

    if (!pubModal || !pubGrid) return;

    let activePublisher = null;

    function renderPublisherCards(filterQuery = '') {
      if (!activePublisher || !activePublisher.feeds) return;
      pubGrid.innerHTML = '';
      const q = String(filterQuery || '').trim().toLowerCase();
      let matches = 0;

      activePublisher.feeds.forEach((feed) => {
        const titleMatch = feed.title.toLowerCase().includes(q);
        const tagMatch = (feed.tag || '').toLowerCase().includes(q);
        const descMatch = (feed.desc || '').toLowerCase().includes(q);

        if (!q || titleMatch || tagMatch || descMatch) {
          matches++;
          const card = document.createElement('div');
          card.className = 'pub-feed-card';

          const cardHeader = document.createElement('div');
          cardHeader.className = 'pub-feed-card-header';

          const tagBadge = document.createElement('span');
          tagBadge.className = 'pub-feed-card-badge';
          tagBadge.textContent = feed.tag || activePublisher.category || 'Feed';

          const domainSpan = document.createElement('span');
          domainSpan.className = 'pub-feed-card-domain';
          domainSpan.textContent = activePublisher.domain;

          cardHeader.appendChild(tagBadge);
          cardHeader.appendChild(domainSpan);

          const cardContent = document.createElement('div');
          cardContent.className = 'pub-feed-card-content';

          const cardTitle = document.createElement('h4');
          cardTitle.className = 'pub-feed-card-title';
          cardTitle.textContent = feed.title;

          const cardDesc = document.createElement('p');
          cardDesc.className = 'pub-feed-card-desc';
          cardDesc.textContent = feed.desc || `Official ${activePublisher.name} RSS feed stream`;

          cardContent.appendChild(cardTitle);
          cardContent.appendChild(cardDesc);

          const cardFooter = document.createElement('div');
          cardFooter.className = 'pub-feed-card-footer';

          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'pub-feed-card-open-btn';
          openBtn.innerHTML = `
            <span>View Articles</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          `;
          openBtn.title = `View articles from ${feed.title}`;

          openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closePublisherModal();
            if (feedUrlInput) {
              feedUrlInput.value = feed.url;
              loadFeed(feed.url);
            }
          });

          cardFooter.appendChild(openBtn);

          card.appendChild(cardHeader);
          card.appendChild(cardContent);
          card.appendChild(cardFooter);

          pubGrid.appendChild(card);
        }
      });

      if (pubEmpty) {
        pubEmpty.style.display = matches === 0 ? 'block' : 'none';
      }
    }

    function openPublisherModal(domainOrKey) {
      const pub = PUBLISHER_FEEDS_CATALOG[domainOrKey] ||
        Object.values(PUBLISHER_FEEDS_CATALOG).find(p => p.name.toLowerCase() === String(domainOrKey).toLowerCase()) ||
        POPULAR_FEEDS.find(p => p.domain === domainOrKey || p.name.toLowerCase() === String(domainOrKey).toLowerCase());

      if (!pub) return;

      activePublisher = {
        name: pub.name,
        domain: pub.domain,
        bg: pub.bg || '#0284c7',
        category: pub.category || 'News',
        description: (pub.description || `${pub.name} RSS feeds`).replace(/\s*•\s*\d+\s+Verified\s+Feeds/i, '').replace(/\s*•\s*Verified\s+Stream/i, '').trim(),
        feeds: pub.feeds || [{ title: `${pub.name} Headlines`, url: pub.url, tag: pub.category, desc: `Latest news stream from ${pub.name}` }]
      };

      if (pubTitle) pubTitle.textContent = activePublisher.name;
      if (pubDesc) pubDesc.textContent = activePublisher.description;
      if (pubBadge) pubBadge.style.display = 'none';

      if (pubIcon && pubFallback) {
        pubIcon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(activePublisher.domain)}&sz=128`;
        pubIcon.alt = activePublisher.name;
        pubIcon.style.display = 'block';
        pubFallback.style.display = 'none';

        pubIcon.onerror = () => {
          pubIcon.style.display = 'none';
          pubFallback.style.display = 'flex';
          pubFallback.style.background = '#111827';
          pubFallback.textContent = activePublisher.name.charAt(0);
        };
      }

      if (pubSearch) pubSearch.value = '';
      if (pubBody) pubBody.scrollTop = 0;
      renderPublisherCards('');
      if (pubBody) pubBody.scrollTop = 0;

      // Close any open popups or dropdowns
      const bgPopup = document.getElementById('bg-color-popup');
      if (bgPopup && bgPopup.classList.contains('active')) {
        bgPopup.classList.remove('active');
        document.dispatchEvent(new CustomEvent('close-bg-picker'));
      }
      const navDropdown = document.getElementById('feed-navigator-dropdown');
      const navBtn = document.getElementById('btn-feed-navigator');
      if (navDropdown && navDropdown.classList.contains('active')) {
        navDropdown.classList.remove('active');
        if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
      }

      pubModal.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Always ensure body is scrolled to the very top
      requestAnimationFrame(() => {
        if (pubBody) pubBody.scrollTop = 0;
      });

      if (pubSearch && window.innerWidth > 768) {
        setTimeout(() => pubSearch.focus(), 80);
      }
    }

    function closePublisherModal() {
      pubModal.classList.remove('active');
      document.body.style.overflow = '';
      if (pubSearch) pubSearch.blur();
      if (pubBody) pubBody.scrollTop = 0;
    }

    if (pubClose) {
      pubClose.addEventListener('click', closePublisherModal);
    }

    pubModal.addEventListener('click', (e) => {
      if (e.target === pubModal) {
        closePublisherModal();
      }
    });

    if (pubSearch) {
      pubSearch.addEventListener('input', (e) => {
        renderPublisherCards(e.target.value);
      });
      pubSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closePublisherModal();
        }
      });
    }

    openPublisherCategoryModalFn = openPublisherModal;
  }

  function setupFeedNavigatorDropdown() {
    const navBtn = document.getElementById('btn-feed-navigator');
    const navDropdown = document.getElementById('feed-navigator-dropdown');
    const navSearch = document.getElementById('feed-nav-search');
    const appsGrid = document.getElementById('launcher-apps-grid');
    const navEmpty = document.getElementById('feed-nav-empty');

    if (!navBtn || !navDropdown || !appsGrid) return;

    // Render 25 app cards into the 3-column launcher grid
    function renderLauncherGrid() {
      appsGrid.innerHTML = '';
      POPULAR_FEEDS.forEach((feed) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'launcher-app-item';
        item.dataset.url = feed.url;
        item.dataset.domain = feed.domain;
        item.dataset.name = feed.name.toLowerCase();
        item.dataset.category = feed.category.toLowerCase();
        item.title = `${feed.name} • View Categories & Feeds`;

        const iconWrap = document.createElement('div');
        iconWrap.className = 'launcher-icon-wrap';

        const img = document.createElement('img');
        img.className = 'launcher-icon-img';
        img.alt = feed.name;
        img.loading = 'lazy';
        img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(feed.domain)}&sz=64`;

        const fallback = document.createElement('div');
        fallback.className = 'launcher-icon-fallback';
        fallback.style.background = feed.bg || '#3b82f6';
        fallback.style.display = 'none';
        fallback.textContent = feed.name.charAt(0);

        img.onerror = () => {
          img.style.display = 'none';
          fallback.style.display = 'flex';
        };

        iconWrap.appendChild(img);
        iconWrap.appendChild(fallback);

        const label = document.createElement('span');
        label.className = 'launcher-app-label';
        label.textContent = feed.name;

        item.appendChild(iconWrap);
        item.appendChild(label);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          closeDropdown();
          if (openPublisherCategoryModalFn) {
            openPublisherCategoryModalFn(feed.domain || feed.name);
          } else if (feedUrlInput) {
            feedUrlInput.value = feed.url;
            loadFeed(feed.url);
          }
        });

        appsGrid.appendChild(item);
      });
    }

    renderLauncherGrid();

    function openDropdown() {
      // Mutual Exclusivity: Close background color popup if open
      const bgPopup = document.getElementById('bg-color-popup');
      if (bgPopup && bgPopup.classList.contains('active')) {
        bgPopup.classList.remove('active');
      }
      document.dispatchEvent(new CustomEvent('close-bg-picker'));

      if (navSearch) navSearch.value = '';
      filterLauncher('');
      navDropdown.classList.add('active');
      navBtn.setAttribute('aria-expanded', 'true');
      // Only auto-focus on desktop screens to prevent mobile virtual keyboard distortion
      if (navSearch && window.innerWidth > 768) {
        setTimeout(() => navSearch.focus(), 60);
      }
    }

    function closeDropdown() {
      navDropdown.classList.remove('active');
      navBtn.setAttribute('aria-expanded', 'false');
      if (navSearch) navSearch.blur();
      window.scrollTo(0, 0);
    }

    function filterLauncher(query) {
      const q = String(query || '').trim().toLowerCase();
      const items = appsGrid.querySelectorAll('.launcher-app-item');
      let matches = 0;

      items.forEach((item) => {
        const name = item.dataset.name || '';
        const cat = item.dataset.category || '';
        if (!q || name.includes(q) || cat.includes(q)) {
          item.style.display = 'flex';
          matches++;
        } else {
          item.style.display = 'none';
        }
      });

      if (navEmpty) {
        navEmpty.style.display = matches === 0 ? 'block' : 'none';
      }
    }

    navBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (navDropdown.classList.contains('active')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    if (navSearch) {
      navSearch.addEventListener('input', (e) => {
        filterLauncher(e.target.value);
      });
      navSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
        if (e.key === 'Enter') {
          const visible = Array.from(appsGrid.querySelectorAll('.launcher-app-item')).filter(
            (i) => i.style.display !== 'none'
          );
          if (visible.length > 0) {
            visible[0].click();
          }
        }
      });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!navDropdown.contains(e.target) && !navBtn.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  function setupLaunchModal() {
    const launchModal = document.getElementById('launch-modal');
    const launchClose = document.getElementById('launch-modal-close');
    const launchTrigger = document.getElementById('btn-open-notify-modal');
    const subscribeBtn = document.getElementById('btn-launch-subscribe');
    const emailInput = document.getElementById('launch-email-input');
    const msgEl = document.getElementById('launch-modal-msg');
    let isClosing = false;

    function openLaunchModal() {
      if (!launchModal) return;

      // Close any open popups or dropdowns
      const bgPopup = document.getElementById('bg-color-popup');
      if (bgPopup && bgPopup.classList.contains('active')) {
        bgPopup.classList.remove('active');
        document.dispatchEvent(new CustomEvent('close-bg-picker'));
      }
      const navDropdown = document.getElementById('feed-navigator-dropdown');
      const navBtn = document.getElementById('btn-feed-navigator');
      if (navDropdown && navDropdown.classList.contains('active')) {
        navDropdown.classList.remove('active');
        if (navBtn) navBtn.setAttribute('aria-expanded', 'false');
      }

      launchModal.classList.remove('closing');
      launchModal.classList.add('active');
      if (launchTrigger) {
        launchTrigger.classList.remove('caught');
        launchTrigger.classList.add('launched');
      }
    }

    function closeLaunchModal() {
      if (!launchModal || isClosing) return;
      isClosing = true;
      launchModal.classList.remove('active');
      launchModal.classList.add('closing');
      
      // As the card collapses into the button, catch it and wobble the button
      setTimeout(() => {
        if (launchTrigger) {
          launchTrigger.classList.remove('launched');
          launchTrigger.classList.add('caught');
          setTimeout(() => {
            if (launchTrigger) launchTrigger.classList.remove('caught');
          }, 650);
        }
      }, 200);

      setTimeout(() => {
        launchModal.classList.remove('closing');
        isClosing = false;
      }, 400);
    }

    if (launchTrigger) {
      launchTrigger.addEventListener('click', openLaunchModal);
    }

    if (launchClose) {
      launchClose.addEventListener('click', closeLaunchModal);
    }

    // Clicking anywhere on the card focuses the email input box
    if (launchModal && emailInput) {
      launchModal.addEventListener('click', (e) => {
        if (e.target.closest('#launch-modal-close') || e.target.closest('#btn-launch-subscribe')) {
          return;
        }
        emailInput.focus();
      });
    }

    if (subscribeBtn && emailInput) {
      async function handleSubscribe(e) {
        if (e) e.preventDefault();
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          if (msgEl) {
            msgEl.textContent = 'Please enter a valid email address.';
            msgEl.className = 'launch-msg error';
            msgEl.style.display = 'block';
          }
          return;
        }

        if (subscribeBtn) {
          subscribeBtn.disabled = true;
          subscribeBtn.textContent = 'Subscribing...';
        }

        // 1. Client-side persistence
        try {
          const subs = JSON.parse(localStorage.getItem('feedometer_subscribers') || '[]');
          if (!subs.includes(email)) {
            subs.push(email);
            localStorage.setItem('feedometer_subscribers', JSON.stringify(subs));
          }
        } catch (err) {}

        // 2. Save on the Cloudflare Worker waitlist API
        try {
          const workerBase = (
            (window.FEEDOMETER_API_BASE) ||
            (window.FEEDOMETER_CONFIG && window.FEEDOMETER_CONFIG.WORKER_API_BASE) ||
            WORKER_BASE ||
            ''
          ).replace(/\/$/, '');

          if (!workerBase) {
            throw new Error('Worker API is not configured.');
          }

          const res = await fetch(`${workerBase}/api/waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, source: 'launch-notify-popup' })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || 'Could not save your email. Please try again.');
          }
          if (msgEl) {
            msgEl.textContent = data.message || 'Awesome! You are on the VIP launch list.';
            msgEl.className = 'launch-msg success';
            msgEl.style.display = 'block';
          }
        } catch (err) {
          console.warn('[Feedometer] Waitlist remote sync warning:', err);
          if (msgEl) {
            msgEl.textContent = err.message || 'Could not reach the notify service. Please try again.';
            msgEl.className = 'launch-msg error';
            msgEl.style.display = 'block';
          }
          if (subscribeBtn) {
            subscribeBtn.disabled = false;
            subscribeBtn.textContent = 'Notify';
          }
          return;
        }
        emailInput.value = '';
        if (subscribeBtn) {
          subscribeBtn.disabled = true;
          subscribeBtn.textContent = 'SUBSCRIBED! ✓';
        }

        setTimeout(() => {
          closeLaunchModal();
          setTimeout(() => {
            if (subscribeBtn) {
              subscribeBtn.disabled = false;
              subscribeBtn.textContent = 'Notify';
            }
            if (msgEl) msgEl.style.display = 'none';
          }, 500);
        }, 2200);
      }

      subscribeBtn.addEventListener('click', handleSubscribe);
      emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubscribe(e);
      });
    }
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

  function setupPrivacyModal() {
    const privacyModal = document.getElementById('privacy-modal');
    const privacyClose = document.getElementById('privacy-modal-close');
    const privacyTriggers = document.querySelectorAll('.privacy-trigger, #privacy-link');

    privacyTriggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (privacyModal) {
          privacyModal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      });
    });

    if (privacyClose) {
      privacyClose.addEventListener('click', () => {
        if (privacyModal) {
          privacyModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }

    if (privacyModal) {
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) {
          privacyModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    if (mode === 'grid') {
      cardsContainer.className = 'cards-grid';
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
    } else {
      cardsContainer.className = 'cards-list';
      viewListBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
    }
    applyFiltersAndRender();
  }

  function applyFiltersAndRender() {
    let filtered = [...currentItems];

    // Search filter
    if (activeSearchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(activeSearchQuery) ||
        item.description.toLowerCase().includes(activeSearchQuery)
      );
    }

    // Mode filter
    if (activeFilterMode === 'has-image') {
      filtered = filtered.filter(item => !!item.image);
    } else if (activeFilterMode === 'starred') {
      filtered = filtered.filter(item => starredLinks.has(item.link));
    }

    renderCards(filtered);
  }

  const WORKER_BASE = (window.FEEDOMETER_API_BASE || '').replace(/\/$/, '');
  const LOCAL_WORKER = (window.FEEDOMETER_LOCAL_API || '').replace(/\/$/, '');

  function looksLikeUrl(raw) {
    const u = String(raw || '').trim();
    if (!u) return false;
    if (/\s/.test(u)) return false;
    if (/^https?:\/\//i.test(u)) return true;
    return u.includes('.') && !u.startsWith('javascript:');
  }

  async function fetchWithTimeout(resource, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(resource, { signal: controller.signal, cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestView(base, rawUrl, nocache, timeoutMs) {
    if (!base) return null;
    try {
      let workerUrl = `${base}/api/view?url=${encodeURIComponent(rawUrl)}`;
      if (nocache) workerUrl += '&nocache=1';
      const res = await fetchWithTimeout(workerUrl, timeoutMs || 15000);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        return null;
      }
      if (json && (json.code === 'capacity' || json.code === 'content_blocked' || json.code === 'ssrf_blocked')) {
        const err = new Error(json.error || 'Request blocked');
        err.code = json.code;
        throw err;
      }
      if (json && json.ok && Array.isArray(json.items)) {
        return json;
      }
    } catch (e) {
      if (e && (e.code === 'capacity' || e.code === 'content_blocked' || e.code === 'ssrf_blocked')) throw e;
      console.warn('[Feedometer] Worker fetch failed:', base, e && e.message);
    }
    return null;
  }

  async function fetchCanonicalFeed(rawUrl, options) {
    const url = String(rawUrl || '').trim();
    if (!looksLikeUrl(url)) {
      throw new Error('invalid-url');
    }
    const nocache = options && options.nocache;

    if (LOCAL_WORKER) {
      try {
        const local = await requestView(LOCAL_WORKER, url, nocache, 2500);
        if (local) return local;
      } catch (eLocal) {
        if (eLocal && (eLocal.code === 'capacity' || eLocal.code === 'content_blocked' || eLocal.code === 'ssrf_blocked')) {
          throw eLocal;
        }
      }
    }
    const remote = await requestView(WORKER_BASE, url, nocache, 15000);
    if (remote) return remote;

    throw new Error('unreachable');
  }

  function titlesAreSame(a, b) {
    const x = String(a || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const y = String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return !!(x && y && x === y);
  }

  function titleFromHost(url) {
    try {
      let host = new URL(url).hostname.replace(/^www\./i, '');
      host = host.replace(/^(feeds?|rss|atom|syndication|xml)\./i, '');
      host = host.replace(/\.(co|com|org|net|gov|ac)\.[a-z]{2}$/i, '');
      host = host.replace(/\.[a-z]{2,}$/i, '');
      if (host) return host.charAt(0).toUpperCase() + host.slice(1);
    } catch (e) {}
    return '';
  }

  function resolveDisplayFeedTitle(rawTitle, items, feedUrl, homeUrl) {
    let t = String(rawTitle || '').replace(/\s+/g, ' ').trim();
    const first = items[0] && items[0].title;
    if (!t || titlesAreSame(t, first)) {
      t = titleFromHost(homeUrl || feedUrl) || t;
    }
    return t || 'RSS Feed';
  }

  function mapWorkerItems(json) {
    const meta = json.meta || {};
    const feedUrl = json.feedUrl || meta.url || '';
    const homeUrl = meta.feedHomeUrl || meta.link || feedUrl;
    const rawTitle = decodeHtmlEntities(meta.feedTitle || meta.title || '');
    const items = (json.items || []).map((item) => {
      const link = item.link || item.url || '';
      const published = item.publishedAt || item.pubDate || '';
      return {
        id: item.id || link,
        title: decodeHtmlEntities(item.title || 'Untitled'),
        link,
        url: link,
        description: decodeHtmlEntities(item.description || item.summary || ''),
        pubDate: formatDate(published),
        publishedAt: item.publishedAt || '',
        author: decodeHtmlEntities(item.author || ''),
        image: item.image || '',
        source: decodeHtmlEntities(item.source || rawTitle)
      };
    });
    const feedTitle = resolveDisplayFeedTitle(rawTitle, items, feedUrl, homeUrl);
    items.forEach((item) => {
      if (!item.source || titlesAreSame(item.source, items[0] && items[0].title)) {
        item.source = feedTitle;
      }
    });
    return {
      meta: {
        title: feedTitle,
        description: decodeHtmlEntities(meta.description || ''),
        link: homeUrl,
        url: feedUrl,
        feedIcon: meta.feedIcon || ''
      },
      items,
      feedUrl
    };
  }

  async function loadFeed(url, options) {
    showLoading(true);
    showError(false);
    cardsContainer.innerHTML = '';

    try {
      const json = await fetchCanonicalFeed(url, options);
      const mapped = mapWorkerItems(json);
      currentFeedMeta = mapped.meta;
      currentItems = mapped.items;

      logFeedDiagnostics('worker', currentItems);
      renderFeedMeta(currentFeedMeta, currentItems.length);

      activeSearchQuery = '';
      activeFilterMode = 'all';
      if (feedSearchInput) feedSearchInput.value = '';
      if (feedFilterSelect) feedFilterSelect.value = 'all';

      setViewMode('list');
      startThumbnailOgEnrichment(currentItems);
      showReaderPanel();

      const shareUrl = mapped.feedUrl || url;
      if (feedUrlInput && mapped.feedUrl) {
        feedUrlInput.value = mapped.feedUrl;
      }
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('url', shareUrl);
      window.history.replaceState({}, '', newUrl);

      try {
        window.dispatchEvent(new CustomEvent('feedometer:feed-loaded', {
          detail: {
            feedUrl: shareUrl,
            title: currentFeedMeta.title,
            itemsCount: currentItems.length,
            publisher: currentFeedMeta.title
          }
        }));
      } catch (_) {}

    } catch (err) {
      console.error(err);
      try {
        window.dispatchEvent(new CustomEvent('feedometer:feed-error', {
          detail: {
            url: url,
            code: err && err.code,
            message: err && err.message
          }
        }));
      } catch (_) {}
      if (err && err.code === 'capacity') {
        showError(true, 'Free reader is busy. Try again in a few hours.', err.code);
      } else if (err && (err.code === 'content_blocked' || err.code === 'ssrf_blocked')) {
        showError(true, err.message, err.code);
      } else {
        showError(true, "We couldn't access the feed. Try another one please.....");
      }
    } finally {
      showLoading(false);
    }
  }

  function logFeedDiagnostics(feedSource, items) {
    const withImage = (items || []).filter((i) => i.image && String(i.image).trim()).length;
    console.info('[Feedometer] load:', {
      feedSource: feedSource || 'worker',
      stories: items ? items.length : 0,
      withHeroImage: withImage,
      workerApi: WORKER_BASE || '(not set)'
    });
  }

  function decodeHtmlEntities(str) {
    if (!str) return '';
    function pass(s) {
      return String(s)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const n = parseInt(hex, 16);
        try { return n ? String.fromCodePoint(n) : _; } catch (e) { return _; }
      })
      .replace(/&#(\d+);/g, (_, num) => {
        const n = parseInt(num, 10);
        try { return n ? String.fromCodePoint(n) : _; } catch (e) { return _; }
      })
        .replace(/&nbsp;/gi, ' ')
        .replace(/&rsquo;/gi, '\u2019')
        .replace(/&lsquo;/gi, '\u2018')
        .replace(/&rdquo;/gi, '\u201D')
        .replace(/&ldquo;/gi, '\u201C')
        .replace(/&mdash;/gi, '\u2014')
        .replace(/&ndash;/gi, '\u2013')
        .replace(/&hellip;/gi, '\u2026')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }
    return pass(pass(str)).replace(/\s+/g, ' ').trim();
  }

  function cleanSnippet(title, description) {
    let d = (description || '').replace(/\s+/g, ' ').trim();
    const t = (title || '').replace(/\s+/g, ' ').trim();
    if (!d || !t) return d;
    if (d.toLowerCase() === t.toLowerCase()) return '';
    if (d.toLowerCase().indexOf(t.toLowerCase()) === 0) {
      d = d.slice(t.length).replace(/^[\s\-–—:|]+/, '').trim();
    }
    return d;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr).trim();
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return String(dateStr).trim();
    }
  }

  function renderFeedMeta(meta, count) {
    if (feedTitleEl) feedTitleEl.textContent = meta.title || 'Top Stories';
    if (feedCountBadge) feedCountBadge.textContent = `${count} ${count === 1 ? 'story' : 'stories'}`;
  }

  function isArticleUrl(link) {
    try {
      const u = new URL(link);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function ensureCardMedia(card) {
    let mediaEl = card.querySelector('.card-media');
    if (mediaEl) return mediaEl;
    mediaEl = document.createElement('div');
    mediaEl.className = 'card-media';
    const content = card.querySelector('.card-content');
    if (content) card.insertBefore(mediaEl, content);
    else card.appendChild(mediaEl);
    return mediaEl;
  }

  function removeCardMedia(mediaEl) {
    if (mediaEl && mediaEl.parentNode) mediaEl.parentNode.removeChild(mediaEl);
  }

  function setCardMediaImage(mediaEl, item, imageUrl) {
    if (!mediaEl || !imageUrl) return;
    mediaEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (!item._ogThumbnailTried) {
        tryOgThumbnailForItem(item, mediaEl);
        return;
      }
      removeCardMedia(mediaEl);
    });
    mediaEl.appendChild(img);
  }

  async function tryOgThumbnailForItem(item, mediaEl) {
    if (!item || !item.link || item._ogThumbnailTried) return;
    item._ogThumbnailTried = true;
    const image = await fetchOgImageForArticle(item.link);
    if (!image) {
      removeCardMedia(mediaEl);
      return;
    }
    item.image = image;
    const inFeed = currentItems.find((x) => x.link === item.link);
    if (inFeed) inFeed.image = image;
    if (!mediaEl.parentNode) return;
    setCardMediaImage(mediaEl, item, image);
  }

  function mountCardMedia(card, item) {
    if (!(item.image && String(item.image).trim())) return;
    const mediaEl = ensureCardMedia(card);
    setCardMediaImage(mediaEl, item, item.image);
  }

  async function fetchOgImageForArticle(articleUrl) {
    if (!articleUrl || !isArticleUrl(articleUrl)) return '';
    if (ogImageCache.has(articleUrl)) {
      return ogImageCache.get(articleUrl);
    }

    let image = '';
    if (WORKER_BASE) {
      try {
        const res = await fetch(`${WORKER_BASE}/api/og?url=${encodeURIComponent(articleUrl)}`);
        if (res.ok) {
          const data = JSON.parse(await res.text());
          if (data.ok && data.image && /^https?:\/\//i.test(String(data.image))) {
            image = String(data.image).trim();
          }
        }
      } catch (e) {}
    }

    ogImageCache.set(articleUrl, image || '');
    return image || '';
  }

  function findCardForArticleLink(articleLink) {
    const cards = cardsContainer.querySelectorAll('.modern-card');
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].dataset.articleLink === articleLink) {
        return cards[i];
      }
    }
    return null;
  }

  function startThumbnailOgEnrichment(items) {
    thumbnailEnrichGen += 1;
    const gen = thumbnailEnrichGen;

    const candidates = (items || [])
      .filter((item) => isArticleUrl(item.link) && !(item.image && String(item.image).trim()))
      .slice(0, OG_THUMBNAIL_MAX_ITEMS);

    if (!candidates.length) return;

    let cursor = 0;

    async function worker() {
      while (cursor < candidates.length) {
        if (gen !== thumbnailEnrichGen) return;
        const index = cursor++;
        const item = candidates[index];
        const image = await fetchOgImageForArticle(item.link);
        if (gen !== thumbnailEnrichGen || !image) continue;

        item.image = image;
        const inFeed = currentItems.find((x) => x.link === item.link);
        if (inFeed) inFeed.image = image;

        const card = findCardForArticleLink(item.link);
        if (card) {
          const mediaEl = ensureCardMedia(card);
          setCardMediaImage(mediaEl, item, image);
        }
      }
    }

    const poolSize = Math.min(OG_THUMBNAIL_CONCURRENCY, candidates.length);
    Promise.all(Array.from({ length: poolSize }, () => worker())).catch(() => {});
  }

  function renderCards(items) {
    cardsContainer.innerHTML = '';
    if (!items || items.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <p>No articles found in this feed stream.</p>
        </div>
      `;
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'modern-card';
      if (item.link) {
        card.dataset.articleLink = item.link;
      }

      const isSensitiveStory = item.isSensitive || (item.safety && item.safety.isSensitive);
      if (isSensitiveStory) {
        card.classList.add('is-sensitive-item');
      }

      mountCardMedia(card, item);

      const faviconSrc = currentFeedMeta.feedIcon || '';
      const sensitiveBadgeHtml = isSensitiveStory ? '<span class="sensitive-story-badge" title="This story contains sensitive or graphic news reportage">Sensitive News</span> ' : '';

      const content = document.createElement('div');
      content.className = 'card-content';
      content.innerHTML = `
          <h3 class="card-title">
            ${sensitiveBadgeHtml}<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          </h3>
          <p class="card-snippet">${escapeHtml(cleanSnippet(item.title, item.description))}</p>
          <div class="card-footer">
            <div class="card-source-info">
              ${faviconSrc ? `<img src="${escapeHtml(faviconSrc)}" class="source-favicon" alt="" onerror="this.style.display='none'">` : ''}
              <span class="source-name">${escapeHtml(item.source || 'RSS')}</span>
              ${item.pubDate ? `<span class="source-separator">•</span><span class="card-date-time">${escapeHtml(item.pubDate)}</span>` : ''}
            </div>
          </div>
      `;
      card.appendChild(content);

      cardsContainer.appendChild(card);
    });
  }

  function openModal(item) {
    if (!readerModal) return;
    modalTitle.textContent = item.title;
    modalBody.innerHTML = item.contentHtml || `<p>${escapeHtml(item.description)}</p>`;
    modalLink.href = item.link;
    readerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!readerModal) return;
    readerModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showLoading(show) {
    if (loadingSpinner) {
      loadingSpinner.style.display = show ? 'flex' : 'none';
    }
    if (btnFetchFeed) {
      btnFetchFeed.disabled = show;
      btnFetchFeed.style.opacity = show ? '0.7' : '1';
    }
  }

  function showError(show, msg = '', code = '') {
    if (errorContainer) {
      errorContainer.style.display = show ? 'block' : 'none';
      if (show) {
        if (code === 'content_blocked' || code === 'ssrf_blocked' || String(msg).includes('prohibited') || String(msg).includes('safety') || String(msg).includes('restricted network')) {
          errorContainer.innerHTML = `
            <div class="safety-block-card">
              <div class="safety-block-header">
                <span class="safety-block-icon">⚠️</span>
                <span class="safety-block-title">Content Safety Notice</span>
              </div>
              <p class="safety-block-text">${escapeHtml(msg)}</p>
              <div class="safety-block-actions">
                <button type="button" class="safety-curated-btn" id="btn-safety-open-catalog">Explore 25 Curated Publishers</button>
              </div>
            </div>
          `;
          const openCatalogBtn = document.getElementById('btn-safety-open-catalog');
          if (openCatalogBtn) {
            openCatalogBtn.addEventListener('click', () => {
              const navBtn = document.getElementById('btn-feed-navigator');
              if (navBtn) navBtn.click();
            });
          }
        } else {
          errorContainer.innerHTML = `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 1rem 1.25rem; color: #991b1b; font-size: 0.95rem; font-weight: 500;">
              ${escapeHtml(msg)}
            </div>
          `;
        }
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
