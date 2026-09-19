/**
 * FeedOmeter 2.1 — Phase 2 End-to-End API Test Suite
 * Tests: Auth, Sessions, Decoupled Subscriptions, Recursive Folders, Feed Fusion & Article State
 *
 * Usage:
 *   node test_e2e_api.js [BASE_URL]
 * Example:
 *   node test_e2e_api.js http://localhost:8787
 *   node test_e2e_api.js https://feedometer-api.YOUR_SUBDOMAIN.workers.dev
 */

const BASE_URL = process.argv[2] || 'http://localhost:8787';

async function runTest() {
  console.log('====================================================');
  console.log(`🚀 Starting Phase 2 E2E Test Suite on: ${BASE_URL}`);
  console.log('====================================================\n');

  let token = null;
  let userId = null;
  let folderId = null;
  let subscriptionId = null;
  let articleHash = null;

  const testEmail = `test_${Date.now()}@feedometer.com`;
  const testPassword = 'SecurePassword123!';

  // Helper for requests
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data: json };
  }

  // 1. Health Check
  console.log('1. Testing Health Endpoint (/api/health)...');
  const health = await api('/api/health');
  console.log(`   Status: ${health.status} | Response:`, health.data);

  // 2. User Registration
  console.log(`\n2. Testing User Registration (/api/auth/register) -> ${testEmail}...`);
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  console.log(`   Status: ${reg.status}`);
  if (reg.ok && reg.data.token) {
    token = reg.data.token;
    userId = reg.data.user?.id;
    console.log(`   ✅ Registered! User ID: ${userId}, Token: ${token.slice(0, 16)}...`);
  } else {
    console.error('   ❌ Registration failed:', reg.data);
    return;
  }

  // 3. Verify Session Profile (/api/auth/me)
  console.log('\n3. Testing Session Profile (/api/auth/me)...');
  const me = await api('/api/auth/me');
  console.log(`   Status: ${me.status} | Email: ${me.data.user?.email} | Subscriptions: ${me.data.user?.subscription_count}`);
  if (me.ok && me.data.user?.email === testEmail) {
    console.log('   ✅ Auth verification passed!');
  } else {
    console.error('   ❌ Auth verification failed:', me.data);
  }

  // 4. Create Folder
  console.log('\n4. Testing Folder Creation (/api/folders)...');
  const folderRes = await api('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name: 'Tech & Engineering', icon: '💻' })
  });
  console.log(`   Status: ${folderRes.status}`);
  if (folderRes.ok && folderRes.data.folder) {
    folderId = folderRes.data.folder.id;
    console.log(`   ✅ Created Folder: "${folderRes.data.folder.name}" (ID: ${folderId})`);
  } else {
    console.error('   ❌ Folder creation failed:', folderRes.data);
  }

  // 5. Subscribe to RSS Feed
  const feedUrl = 'https://feeds.bbci.co.uk/news/rss.xml';
  console.log(`\n5. Testing Feed Subscription (/api/subscriptions) -> ${feedUrl}...`);
  const subRes = await api('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      feed_url: feedUrl,
      title: 'BBC Top Stories',
      category: 'news'
    })
  });
  console.log(`   Status: ${subRes.status}`);
  if (subRes.ok && subRes.data.subscription) {
    subscriptionId = subRes.data.subscription.id;
    console.log(`   ✅ Subscribed! Source ID: ${subRes.data.subscription.source_id}`);
  } else {
    console.error('   ❌ Feed subscription failed:', subRes.data);
  }

  // 6. Assign Feed to Folder
  if (folderId && subscriptionId) {
    console.log(`\n6. Testing Feed-to-Folder Assignment (/api/folders/${folderId}/feeds)...`);
    const assignRes = await api(`/api/folders/${folderId}/feeds`, {
      method: 'POST',
      body: JSON.stringify({ feed_id: subRes.data.subscription.source_id })
    });
    console.log(`   Status: ${assignRes.status}`);
    if (assignRes.ok) {
      console.log('   ✅ Feed assigned to folder successfully!');
    } else {
      console.error('   ❌ Feed folder assignment failed:', assignRes.data);
    }
  }

  // 7. Test Aggregated Stream Fetching (Feed Fusion Engine)
  console.log('\n7. Testing Aggregated Stream Fetching (/api/stream)...');
  const streamRes = await api('/api/stream?limit=5');
  console.log(`   Status: ${streamRes.status}`);
  const streamItems = streamRes.data.items || streamRes.data.articles || [];
  if (streamRes.ok && streamItems.length > 0) {
    console.log(`   ✅ Stream returned ${streamItems.length} live articles!`);
    const firstArticle = streamItems[0];
    articleHash = firstArticle.id || firstArticle.article_hash;
    console.log(`   Sample Article: "${firstArticle.title}" (Hash: ${articleHash ? articleHash.slice(0, 12) : ''}...)`);
  } else {
    console.log('   ℹ️ Stream returned empty or initial fetch in progress:', streamRes.data);
  }

  // 8. Test Star Article
  if (articleHash) {
    console.log(`\n8. Testing Star Article (/api/articles/star)...`);
    const starRes = await api('/api/articles/star', {
      method: 'POST',
      body: JSON.stringify({
        article_hash: articleHash,
        article_data: { title: 'Starred Test Article', url: 'https://news.ycombinator.com' }
      })
    });
    console.log(`   Status: ${starRes.status}`);
    if (starRes.ok) {
      console.log('   ✅ Article starred successfully!');
    }

    // 9. Test Mark as Read
    console.log(`\n9. Testing Mark as Read (/api/articles/read)...`);
    const readRes = await api('/api/articles/read', {
      method: 'POST',
      body: JSON.stringify({ article_hash: articleHash })
    });
    console.log(`   Status: ${readRes.status}`);
    if (readRes.ok) {
      console.log('   ✅ Article marked as read!');
    }
  }

  // 10. Logout & Invalidation
  console.log('\n10. Testing Logout (/api/auth/logout)...');
  const logoutRes = await api('/api/auth/logout', { method: 'POST' });
  console.log(`   Status: ${logoutRes.status}`);
  if (logoutRes.ok) {
    console.log('   ✅ Logged out successfully!');
  }

  console.log('\n====================================================');
  console.log('🎉 Phase 2 End-to-End Test Suite Completed!');
  console.log('====================================================');
}

runTest().catch(console.error);
