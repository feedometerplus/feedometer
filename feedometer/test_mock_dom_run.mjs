import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('integrations.html', 'utf8');
const js = fs.readFileSync('scripts/feedometer-integrations.js', 'utf8');

class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.style = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      toggle: () => {}
    };
    this.children = [];
    this.listeners = {};
  }
  addEventListener(evt, fn) {
    this.listeners[evt] = fn;
  }
  getAttribute(name) {
    if (name === 'data-tab') return 'marketplace';
    if (name === 'data-code') return 'slack';
    return '';
  }
  querySelectorAll(sel) {
    return [];
  }
  querySelector(sel) {
    return null;
  }
}

const elements = {};
const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
for (const m of idMatches) {
  elements[m[1]] = new MockElement(m[1]);
}

const mockDocument = {
  readyState: 'complete',
  getElementById: (id) => elements[id] || null,
  querySelectorAll: (sel) => {
    return [new MockElement('', 'button')];
  },
  querySelector: (sel) => null,
  addEventListener: (evt, fn) => fn()
};

const mockWindow = {
  document: mockDocument,
  FEEDOMETER_CONFIG: { API_BASE: 'https://feedometer-api.feedometer.workers.dev' },
  FeedOmeterAuth: { getToken: () => 'mock_token' },
  fetch: async (url) => ({
    ok: true,
    json: async () => ({ catalog: [], connections: [] })
  }),
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout: (fn) => fn()
};

const context = vm.createContext(mockWindow);

try {
  vm.runInContext(js, context);
  
  // Wait for async loadAllData to complete
  await new Promise(r => setTimeout(r, 50));
  
  console.log('✅ Communication grid length:', elements['grid-communication'].innerHTML.length);
  console.log('✅ Automation grid length:', elements['grid-automation'].innerHTML.length);
  console.log('✅ Productivity grid length:', elements['grid-productivity'].innerHTML.length);
  console.log('✅ Developer grid length:', elements['grid-developer'].innerHTML.length);
} catch (e) {
  console.error('❌ JS Runtime Error:', e);
}
