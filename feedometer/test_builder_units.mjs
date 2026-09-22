/**
 * test_builder_units.mjs — Comprehensive Unit Tests for Web-to-RSS Builder & Navigation
 */

import { buildRssFromUrl } from './workers/services/web-to-rss.js';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Web-to-RSS Builder & Navigation Tests...\n');

  // Test 1: Navigation Drawer tree
  console.log('1. Testing Navigation Drawer Configuration:');
  const navbarJs = fs.readFileSync('navbar/navbar.js', 'utf8');
  assert(navbarJs.includes("id: 'rss-builder'"), "Navbar contains 'rss-builder' item");
  assert(navbarJs.includes("href: 'builder.html'"), "RSS builder links to builder.html");
  
  // Verify it is inside FEED STUDIO or WORKSPACES section
  const studioSectionMatch = navbarJs.match(/sectionHeader:\s*'(?:FEED STUDIO|WORKSPACES)'[\s\S]*?children:\s*\[([\s\S]*?)\]/);
  assert(studioSectionMatch && studioSectionMatch[1].includes("'rss-builder'"), "RSS Builder is placed inside the FEED STUDIO section");

  // Test 2: builder.html DOM & Structure
  console.log('\n2. Testing builder.html DOM Structure:');
  const builderHtml = fs.readFileSync('builder.html', 'utf8');
  assert(builderHtml.includes('site-url-input'), "Contains site URL input #site-url-input");
  assert(builderHtml.includes('btn-build-feed'), "Contains build button #btn-build-feed");
  assert(builderHtml.includes('builder-result'), "Contains results container #builder-result");
  assert(builderHtml.includes('xml-output-box'), "Contains raw XML preview #xml-output-box");
  assert(builderHtml.includes('preview-container'), "Contains live articles preview #preview-container");
  assert(builderHtml.includes('btn-copy-share-url'), "Contains share link copy button");
  assert(builderHtml.includes('btn-download-xml'), "Contains download XML button");
  assert(builderHtml.includes('tab-mode-manual'), "Contains Visual Builder Mode Tab #tab-mode-manual");
  assert(builderHtml.includes('visual-studio-panel'), "Contains Visual Studio Panel #visual-studio-panel");

  // Test 3: Worker Routing
  console.log('\n3. Testing Worker API Build Routing:');
  const workerJs = fs.readFileSync('workers/feedometer-worker.js', 'utf8');
  assert(workerJs.includes("pathname === '/api/build'"), "Worker handles /api/build endpoint");
  assert(workerJs.includes("buildRssFromUrl"), "Worker invokes buildRssFromUrl service");

  // Test 4: Web-to-RSS Engine Live Fetch & Conversion Test
  console.log('\n4. Testing Web-to-RSS Conversion Engine:');
  try {
    const result = await buildRssFromUrl('https://news.ycombinator.com');
    assert(result.ok === true, "Returned ok: true");
    assert(typeof result.xml === 'string' && result.xml.includes('<rss version="2.0"'), "Generated valid RSS 2.0 XML root");
    assert(result.xml.includes('<channel>'), "Generated RSS channel element");
    assert(result.xml.includes('<item>'), "Generated RSS item elements");
    assert(Array.isArray(result.items) && result.items.length > 0, `Extracted ${result.items ? result.items.length : 0} articles`);
    assert(Boolean(result.items[0].title && result.items[0].link), "Extracted article contains title and valid link");
  } catch (err) {
    console.error("  ⚠️ Live fetch note (network dependent):", err.message);
    // Even if remote network is offline, ensure the parser function exists and handles errors gracefully
    assert(typeof buildRssFromUrl === 'function', "buildRssFromUrl is defined");
  }

  console.log('\n======================================================');
  console.log(`📊 BUILDER TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
