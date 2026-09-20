/**
 * workers/feedometer-worker.js — Feedometer API & Edge Worker
 * Unified Modular Cloudflare Worker for FeedOmeter Personal Feed Intelligence Platform
 * Phase 2 — 7-Domain Enterprise Identity Architecture & Normalized Content Platform
 *
 * Folder map (this file only routes; it does not pick thumbnails itself):
 *   lib/       shared helpers (crypto, JSON responses)
 *   modules/   HTTP handlers (auth, stream, folders, articles)
 *   services/  RSS parse, cache, fusion, thumbnail picking, channel catalog
 */

import { handleOptions, jsonResponse, errorResponse } from './lib/response.js';
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleForgotPassword,
  handleVerifyResetToken,
  handleResetPassword,
  handleMe,
  handleGoogleAuth,
  handleProfileUpdate,
  handlePasswordChange,
  handleListSessions,
  handleRevokeSession,
  handleRevokeOtherSessions,
  handleGetPreferences,
  handleUpdatePreferences,
  handleDeleteAccount
} from './modules/auth.js';
import { handleStream } from './modules/streams.js';
import { handleListSubscriptions, handleCreateSubscription, handleDeleteSubscription } from './modules/subscriptions.js';
import { handleListFolders, handleCreateFolder, handleDeleteFolder, handleAssignFeed, handleUnassignFeed } from './modules/folders.js';
import {
  handleStarArticle,
  handleUnstarArticle,
  handleSaveArticle,
  handleUnsaveArticle,
  handleReadArticle,
  handleListStarred,
  handleListSaved
} from './modules/articles.js';
import {
  handleSearch,
  handleSuggestions,
  handleSavedSearches,
  handleKeywordAlerts,
  handleRecordClick
} from './modules/search.js';
import { discoverFeedsAndArticles, findFeedsUnified } from './services/feed-discovery-engine.js';
import { buildRssFromUrl } from './services/web-to-rss.js';
import { generateKeywordFeed } from './services/keyword-feed-engine.js';
import { fetchFeedWithCache } from './services/cache-manager.js';
import { handleGetFilters, handleSaveFilters } from './services/user-filters.js';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // ------------------------------------------------------------------------
      // 1. Enterprise Identity & User Management Routes (7 Domains)
      // ------------------------------------------------------------------------
      if (pathname === '/api/auth/register' && request.method === 'POST') {
        return await handleRegister(request, env);
      }
      if (pathname === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }
      if (pathname === '/api/auth/forgot-password' && request.method === 'POST') {
        return await handleForgotPassword(request, env);
      }
      if (pathname === '/api/auth/reset-password' && request.method === 'GET') {
        return await handleVerifyResetToken(request, env);
      }
      if (pathname === '/api/auth/reset-password' && request.method === 'POST') {
        return await handleResetPassword(request, env);
      }
      if (pathname === '/api/auth/google' && request.method === 'POST') {
        return await handleGoogleAuth(request, env);
      }
      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      }
      if (pathname === '/api/auth/me' && request.method === 'GET') {
        return await handleMe(request, env);
      }
      if (pathname === '/api/auth/profile' && (request.method === 'POST' || request.method === 'PUT')) {
        return await handleProfileUpdate(request, env);
      }
      if ((pathname === '/api/auth/password' || pathname === '/api/auth/change-password') && request.method === 'POST') {
        return await handlePasswordChange(request, env);
      }
      if (pathname === '/api/auth/sessions' && request.method === 'GET') {
        return await handleListSessions(request, env);
      }
      if ((pathname === '/api/auth/sessions/other' || pathname === '/api/auth/sessions/revoke-others') && (request.method === 'DELETE' || request.method === 'POST')) {
        return await handleRevokeOtherSessions(request, env);
      }
      if (pathname.startsWith('/api/auth/sessions/') && request.method === 'DELETE') {
        const sessId = pathname.replace('/api/auth/sessions/', '');
        return await handleRevokeSession(request, sessId, env);
      }
      if (pathname === '/api/auth/sessions/revoke' && request.method === 'POST') {
        try {
          const body = await request.json();
          return await handleRevokeSession(request, body.session_id, env);
        } catch (e) {
          return errorResponse('Invalid JSON body', 400);
        }
      }
      if (pathname === '/api/auth/preferences' && request.method === 'GET') {
        return await handleGetPreferences(request, env);
      }
      if (pathname === '/api/auth/preferences' && (request.method === 'POST' || request.method === 'PUT')) {
        return await handleUpdatePreferences(request, env);
      }
      if ((pathname === '/api/auth/account' || pathname === '/api/auth/delete') && request.method === 'DELETE') {
        return await handleDeleteAccount(request, env);
      }
      if (pathname === '/api/auth/delete' && request.method === 'POST') {
        return await handleDeleteAccount(request, env);
      }

      // ------------------------------------------------------------------------
      // 2. Subscriptions Routes (Phase 2 [P2-02])
      // ------------------------------------------------------------------------
      if (pathname === '/api/subscriptions' && request.method === 'GET') {
        return await handleListSubscriptions(request, env);
      }
      if (pathname === '/api/subscriptions' && request.method === 'POST') {
        return await handleCreateSubscription(request, env);
      }
      if (pathname.startsWith('/api/subscriptions/') && request.method === 'DELETE') {
        const id = pathname.replace('/api/subscriptions/', '');
        return await handleDeleteSubscription(request, id, env);
      }

      // ------------------------------------------------------------------------
      // 3. Hierarchical Folders Routes (Phase 2 [P2-02])
      // ------------------------------------------------------------------------
      if (pathname === '/api/folders' && request.method === 'GET') {
        return await handleListFolders(request, env);
      }
      if (pathname === '/api/folders' && request.method === 'POST') {
        return await handleCreateFolder(request, env);
      }
      if (pathname.startsWith('/api/folders/') && pathname.endsWith('/feeds') && request.method === 'POST') {
        const folderId = pathname.replace('/api/folders/', '').replace('/feeds', '');
        return await handleAssignFeed(request, folderId, env);
      }
      if (pathname.startsWith('/api/folders/') && request.method === 'DELETE') {
        const parts = pathname.replace('/api/folders/', '').split('/');
        if (parts.length === 3 && parts[1] === 'feeds') {
          return await handleUnassignFeed(request, parts[0], parts[2], env);
        }
        return await handleDeleteFolder(request, parts[0], env);
      }

      // ------------------------------------------------------------------------
      // 4. Normalized Articles Interaction & State Routes
      // ------------------------------------------------------------------------
      if (pathname === '/api/articles/star' && request.method === 'POST') {
        return await handleStarArticle(request, env);
      }
      if (pathname === '/api/articles/unstar' && request.method === 'POST') {
        return await handleUnstarArticle(request, env);
      }
      if (pathname === '/api/articles/save' && request.method === 'POST') {
        return await handleSaveArticle(request, env);
      }
      if (pathname === '/api/articles/unsave' && request.method === 'POST') {
        return await handleUnsaveArticle(request, env);
      }
      if (pathname === '/api/articles/read' && request.method === 'POST') {
        return await handleReadArticle(request, env);
      }
      if (pathname === '/api/articles/starred' && request.method === 'GET') {
        return await handleListStarred(request, env);
      }
      if (pathname === '/api/articles/saved' && request.method === 'GET') {
        return await handleListSaved(request, env);
      }

// ------------------------------------------------------------------------
      // 5. Search & News Discovery Intelligence Routes
      // ------------------------------------------------------------------------
      if ((pathname === '/api/feeds/find' || pathname === '/api/search/feeds') && request.method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const category = url.searchParams.get('cat') || url.searchParams.get('category') || 'all';
        const language = url.searchParams.get('lang') || url.searchParams.get('language') || 'all';
        const country = url.searchParams.get('country') || 'all';
        const sort = url.searchParams.get('sort') || 'relevance';
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
        const result = await findFeedsUnified({ query: q, category, language, country, sort, limit, env });
        return jsonResponse(result);
      }
      if (pathname === '/api/search' && request.method === 'GET') {
        return await handleSearch(request, url, env);
      }
      if (pathname === '/api/search/discover' && request.method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const result = await discoverFeedsAndArticles(q);
        return jsonResponse(result);
      }
      if (pathname === '/api/search/suggest' && request.method === 'GET') {
        return await handleSuggestions(request, url, env);
      }
      if (pathname.startsWith('/api/search/saved')) {
        return await handleSavedSearches(request, url, env);
      }
      if (pathname.startsWith('/api/search/alerts')) {
        return await handleKeywordAlerts(request, url, env);
      }
      if (pathname === '/api/search/click' && request.method === 'POST') {
        return await handleRecordClick(request, env);
      }

      // ------------------------------------------------------------------------
      // 6. Stream Engine Route (Multi-Feed Fusion)
      // ------------------------------------------------------------------------
      if (pathname === '/api/stream' && request.method === 'GET') {
        return await handleStream(request, url, env, ctx);
      }

      if (pathname === '/api/filters' && request.method === 'GET') {
        return await handleGetFilters(request, env);
      }
      if (pathname === '/api/filters' && (request.method === 'POST' || request.method === 'PUT')) {
        return await handleSaveFilters(request, env);
      }
      if (pathname === '/api/telemetry' && request.method === 'POST') {
        return jsonResponse({ status: 'accepted' });
      }

      // ------------------------------------------------------------------------
      // 6. Public Feed View & Dynamic RSS Route (Phase 2 Enhanced)
      // ------------------------------------------------------------------------
      if (pathname === '/api/view' && request.method === 'GET') {
        const topicQuery = url.searchParams.get('q') || url.searchParams.get('topic');
        const targetUrl = url.searchParams.get('url') || url.searchParams.get('feed');
        const format = url.searchParams.get('format') || '';
        const wantsXml = format === 'xml' || format === 'rss' || (request.headers.get('accept') || '').includes('xml');

        if (topicQuery) {
          const kwResult = await generateKeywordFeed(topicQuery, env);
          if (wantsXml || !format) {
            return new Response(kwResult.xml, {
              headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=900'
              }
            });
          }
          return jsonResponse(kwResult);
        }

        if (!targetUrl) return errorResponse('Missing url or q parameter', 400);

        if (wantsXml) {
          try {
            const buildResult = await buildRssFromUrl(targetUrl, env);
            return new Response(buildResult.xml, {
              headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=900'
              }
            });
          } catch (e) {
            return errorResponse(e.message || 'Failed to render feed XML', 422);
          }
        }

        return await handleStream(request, new URL(url.origin + '/api/stream?urls=' + encodeURIComponent(targetUrl)), env, ctx);
      }

      // ------------------------------------------------------------------------
      // 7. Feed Preview & Web-to-RSS Routes (Phase 2 Enhanced)
      // ------------------------------------------------------------------------
      if ((pathname === '/api/feed-preview' || pathname === '/api/test-feed') && request.method === 'POST') {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const targetUrl = body.url || body.site;
        if (!targetUrl) return errorResponse('Missing url parameter', 400);

        try {
          const buildResult = await buildRssFromUrl(targetUrl, env);
          return jsonResponse({
            success: true,
            status: 'success',
            url: buildResult.siteUrl || targetUrl,
            name: (buildResult.meta && buildResult.meta.title) || body.name || 'Feed',
            articles: buildResult.items || [],
            count: (buildResult.items || []).length,
            xml: buildResult.xml || '',
            meta: buildResult.meta || {}
          });
        } catch (prevErr) {
          return jsonResponse({
            success: false,
            status: 'error',
            url: targetUrl,
            name: body.name || 'Feed',
            articles: [],
            count: 0,
            message: prevErr.message || 'Preview failed'
          }, 422);
        }
      }

      if ((pathname === '/api/build' || pathname === '/api/web-to-rss') && (request.method === 'GET' || request.method === 'POST')) {
        let targetUrl = url.searchParams.get('url') || url.searchParams.get('site');
        if (!targetUrl && request.method === 'POST') {
          try {
            const body = await request.json();
            targetUrl = body.url || body.site;
          } catch (_) {}
        }
        if (!targetUrl) return errorResponse('Missing url or site parameter', 400);

        try {
          const buildResult = await buildRssFromUrl(targetUrl, env);
          return jsonResponse(buildResult);
        } catch (buildErr) {
          return errorResponse(buildErr.message || 'Failed to build RSS feed', 422);
        }
      }

      // ------------------------------------------------------------------------
      // 8. Catalog Discovery Route (Phase 1 Baseline)
      // ------------------------------------------------------------------------
      if (pathname === '/api/catalog' || pathname === '/api/publishers') {
        if (env.DB) {
          try {
            const rows = await env.DB.prepare(`
              SELECT s.id, s.title, s.feed_url, s.category, s.status, s.is_verified,
                     sh.response_ms, sh.last_http_status, sh.last_success_at, sh.consecutive_failures
              FROM sources s
              LEFT JOIN source_health sh ON sh.source_id = s.id
              WHERE s.status = 'active'
              ORDER BY s.is_verified DESC, s.title ASC
              LIMIT 100
            `).all();
            if (rows.results && rows.results.length > 0) {
              return jsonResponse({ status: 'success', publishers: rows.results, sources: rows.results });
            }
          } catch (e) {
            console.warn('D1 sources read error:', e.message);
          }
        }
        return jsonResponse({ status: 'success', publishers: [] });
      }

      // ------------------------------------------------------------------------
      // 8. Waitlist Signup Route
      // ------------------------------------------------------------------------
      if (pathname === '/api/waitlist' && request.method === 'POST') {
        try {
          const body = await request.json();
          const email = (body.email || '').trim().toLowerCase();
          if (!email || !email.includes('@')) return errorResponse('Invalid email address');
          if (env.DB) {
            await env.DB.prepare('INSERT OR IGNORE INTO notify_signups (email, joined_at, synced_at) VALUES (?, ?, ?)')
              .bind(email, new Date().toISOString(), new Date().toISOString()).run();
          }
          return jsonResponse({ status: 'success', message: 'Subscribed to launch updates' });
        } catch (e) {
          return errorResponse('Failed to record signup');
        }
      }

      // ------------------------------------------------------------------------
      // 9. Root / Health Check
      // ------------------------------------------------------------------------
      if (pathname === '/' || pathname === '/api/health') {
        return jsonResponse({
          status: 'online',
          service: 'feedometer-api',
          version: '2.1.0',
          engine: '7-Domain Enterprise Identity & Stream-First Content Engine',
          timestamp: Date.now()
        });
      }

      return errorResponse('Not Found', 404, 'NOT_FOUND');

    } catch (err) {
      console.error('Unhandled Worker error:', err.stack || err.message);
      return errorResponse('Internal Server Error', 500, 'INTERNAL_SERVER_ERROR');
    }
  },

  // Automated Cron Triggers
  async scheduled(event, env, ctx) {
    console.log('Scheduled cron triggered at:', new Date().toISOString());
    if (!env.DB) return;
    try {
      const hotFeeds = await env.DB.prepare(`
        SELECT id, title, feed_url, website_url, category, logo_url
        FROM sources
        WHERE status = 'active' AND feed_url IS NOT NULL AND TRIM(feed_url) != ''
        ORDER BY COALESCE(last_polled_at, 0) ASC
        LIMIT 30
      `).all();
      for (const src of (hotFeeds.results || [])) {
        ctx.waitUntil(
          fetchFeedWithCache(src, env, ctx, 14400).catch((err) => {
            console.warn('Cron ingest failed for ' + src.title + ': ' + err.message);
          })
        );
      }
      ctx.waitUntil((async () => {
        try {
          const alerts = await env.DB.prepare('SELECT id, user_id, keyword FROM keyword_alerts WHERE is_active = 1').all();
          const list = alerts.results || [];
          if (!list.length) return;
          const recent = await env.DB.prepare('SELECT title, snippet FROM articles WHERE ingested_at > ? LIMIT 200')
            .bind(Date.now() - 4 * 3600 * 1000).all();
          const articles = recent.results || [];
          for (const alert of list) {
            const kw = String(alert.keyword || '').toLowerCase();
            if (!kw) continue;
            const hits = articles.filter((a) => ((a.title || '') + ' ' + (a.snippet || '')).toLowerCase().includes(kw)).length;
            if (hits > 0) {
              await env.DB.prepare('UPDATE keyword_alerts SET match_count = match_count + ?, last_notified_at = ? WHERE id = ?')
                .bind(hits, Date.now(), alert.id).run();
            }
          }
        } catch (e) {}
      })());
    } catch (e) {
      console.warn('Cron ingest error:', e.message);
    }
  }
};
