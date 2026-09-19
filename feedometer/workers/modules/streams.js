/**
 * workers/modules/streams.js — Stream Engine
 *
 * Builds a list of RSS sources, fuses them, then stamps channel tags.
 * Feed URLs and keyword rules live in services/channel-catalog.js — not in HTML.
 *
 * Query params:
 *   urls       = comma-separated feed URLs (public reader: one site)
 *   channel    = Tech | Finance | World | Science | Crypto | all
 *   folder_id  = personal folder stream (signed-in)
 *   limit, cursor
 */
import { verifySessionToken } from '../lib/session.js';
import { fuseFeedStreams } from '../services/feed-fusion.js';
import { jsonResponse, errorResponse } from '../lib/response.js';
import {
  getChannelSources,
  applyChannelTags,
  filterStreamByChannel,
  normalizeChannelId
} from '../services/channel-catalog.js';

/**
 * Personal follows, else the public five-desk catalog.
 */
async function resolveSources(request, env, folderId) {
  const session = await verifySessionToken(request, env);

  if (session && env.DB) {
    if (folderId) {
      const rows = await env.DB.prepare(`
        WITH RECURSIVE SubFolders AS (
          SELECT id FROM folders WHERE id = ? AND user_id = ?
          UNION ALL
          SELECT f.id FROM folders f
          JOIN SubFolders sf ON f.parent_folder_id = sf.id
          WHERE f.user_id = ?
        )
        SELECT DISTINCT s.id, s.title, s.feed_url, s.website_url, s.category, s.logo_url
        FROM sources s
        JOIN user_feed_assignments ufa ON s.id = ufa.feed_id
        JOIN SubFolders sf ON ufa.folder_id = sf.id
        WHERE ufa.user_id = ? AND s.status = 'active'
      `).bind(folderId, session.userId, session.userId, session.userId).all();
      if (rows.results && rows.results.length) return rows.results;
    } else {
      const rows = await env.DB.prepare(`
        SELECT s.id, s.title, s.feed_url, s.website_url, s.category, s.logo_url
        FROM sources s
        JOIN user_feeds uf ON s.id = uf.source_id
        WHERE uf.user_id = ? AND s.status = 'active'
        ORDER BY uf.followed_at DESC
      `).bind(session.userId).all();
      
      if (rows.results && rows.results.length > 0) {
        // If user follows fewer than 6 feeds, blend with top channel sources so stream is always rich
        if (rows.results.length < 6) {
          const defaultSources = getChannelSources('all');
          const combined = [...rows.results];
          defaultSources.forEach(ds => {
            if (!combined.some(c => (c.feed_url || '').toLowerCase() === (ds.feed_url || '').toLowerCase())) {
              combined.push(ds);
            }
          });
          return combined;
        }
        return rows.results;
      }
    }
  }

  return getChannelSources('all');
}

export async function handleStream(request, url, env, ctx) {
  const folderId = url.searchParams.get('folder_id');
  const rawUrls = url.searchParams.get('urls');
  const channel = normalizeChannelId(url.searchParams.get('channel'));
  const limit = url.searchParams.get('limit') || 50;
  const cursor = url.searchParams.get('cursor') || null;

  try {
    let sources = [];

    // Public reader: caller passed explicit feed URL(s). Channel lists stay hidden.
    if (rawUrls) {
      const urlsList = rawUrls.split(',').map((u) => u.trim()).filter(Boolean);
      sources = urlsList.map((feedUrl, idx) => ({
        id: `src_custom_${idx}`,
        title: 'Feed Source',
        feed_url: feedUrl
      }));
    } else {
      sources = await resolveSources(request, env, folderId);
      if (!sources.length) sources = getChannelSources('all');
    }

    let streamResult = await fuseFeedStreams(sources, env, ctx, { limit, cursor });
    streamResult = applyChannelTags(streamResult);
    streamResult = filterStreamByChannel(streamResult, channel);
    streamResult.channel = channel;
    return jsonResponse(streamResult);
  } catch (err) {
    console.error('Stream generation failed:', err.message);
    try {
      let streamResult = await fuseFeedStreams(getChannelSources('all'), env, ctx, { limit, cursor });
      streamResult = applyChannelTags(streamResult);
      streamResult = filterStreamByChannel(streamResult, channel);
      return jsonResponse(streamResult);
    } catch (e2) {
      return errorResponse('Failed to generate stream', 500);
    }
  }
}
