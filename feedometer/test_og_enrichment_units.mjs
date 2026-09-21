/**
 * test_og_enrichment_units.mjs — Unit Tests for Open Graph Enrichment & Filter Algorithms
 */

import { looksLikeLowQualityImage, extractImageFromHtml } from './workers/services/web-to-rss.js';

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

console.log('🧪 Starting Open Graph Enrichment & Filtering Unit Tests...\n');

// 1. Testing Image Quality Filter
console.log('1. Testing Image Quality & Tracking Filter:');
assert(looksLikeLowQualityImage('') === true, 'Empty string is identified as low quality');
assert(looksLikeLowQualityImage('https://example.com/pixel.gif') === true, '1x1 tracking pixel is rejected');
assert(looksLikeLowQualityImage('https://example.com/spacer.gif') === true, 'Spacer gif is rejected');
assert(looksLikeLowQualityImage('https://example.com/avatar_small.jpg') === true, 'Avatar is rejected');
assert(looksLikeLowQualityImage('https://example.com/sprite-icons.png') === true, 'Sprite is rejected');
assert(looksLikeLowQualityImage('https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200') === false, 'High-resolution photo URL is accepted');

// 2. Testing Open Graph & JSON-LD Extraction from HTML
console.log('\n2. Testing Open Graph & JSON-LD HTML Extractor:');
const sampleHtmlOg = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Breaking Tech News" />
  <meta property="og:image" content="https://theverge.com/images/ai-chips-hero.jpg" />
  <meta name="twitter:image" content="https://theverge.com/images/twitter-card.jpg" />
</head>
<body><h1>Article</h1></body>
</html>`;

const extractedOg = extractImageFromHtml(sampleHtmlOg, 'https://theverge.com/article-1');
assert(extractedOg === 'https://theverge.com/images/ai-chips-hero.jpg', 'Successfully extracted og:image property');

const sampleHtmlJsonLd = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "headline": "Science Breakthrough",
        "image": {
          "@type": "ImageObject",
          "url": "https://reuters.com/images/science-hero.jpg"
        }
      }
    ]
  }
  </script>
</head>
<body><p>Content</p></body>
</html>`;

const extractedJsonLd = extractImageFromHtml(sampleHtmlJsonLd, 'https://reuters.com/news/123');
assert(extractedJsonLd === 'https://reuters.com/images/science-hero.jpg', 'Successfully extracted schema.org JSON-LD @graph image');

// 3. Testing Jaccard Similarity Algorithm (>= 74%)
console.log('\n3. Testing Jaccard Similarity Duplicate Detection Algorithm:');
function getTokens(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function jaccardSimilarity(arr1, arr2) {
  if (!arr1.length || !arr2.length) return 0;
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  let intersection = 0;
  set1.forEach(t => { if (set2.has(t)) intersection++; });
  const union = new Set([...arr1, ...arr2]).size;
  return union ? (intersection / union) : 0;
}

const titleA = 'Brighton humbling a big lesson for Arsenal - Arteta';
const titleB = 'Brighton humbling a big lesson for Arsenal Arteta';
const titleC = 'Australia seeks big tech support for internet safety AI regulation';

const simAB = jaccardSimilarity(getTokens(titleA), getTokens(titleB));
const simAC = jaccardSimilarity(getTokens(titleA), getTokens(titleC));

assert(simAB >= 0.74, `Near duplicate titles have similarity >= 0.74 (Got: ${simAB.toFixed(2)})`);
assert(simAC < 0.20, `Unrelated titles have similarity < 0.20 (Got: ${simAC.toFixed(2)})`);

console.log('\n======================================================');
console.log(`📊 ENRICHMENT TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) process.exit(1);
