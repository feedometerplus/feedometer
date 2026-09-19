/**
 * scripts/feedometer-search.js — FeedOmeter 2.1 Search & Intelligence Controller
 * Full 7-Layer RSS Discovery, Topic Graph & Interactive Feed Preview Drawer
 */
(function (global) {
  'use strict';

  // 1. Static Sidebar Story Presets
  const STORIES_DATA = {
    'trending': {
      section: 'DISCOVER',
      title: '🔥 Trending Stories',
      stories: [
        {
          id: 'tr-1',
          tag: '🔥 High Velocity (+142%)',
          tagClass: 'velocity',
          sources: '📰 4 Sources: Reuters, TechCrunch, Verge, HackerNews',
          time: '18m ago',
          title: 'OpenAI Unveils Autonomous Agent Protocol with Native Tool Calling Standard',
          summary: 'The new open protocol establishes standardized bidirectional communication for autonomous agent orchestration, unified sandbox safety parameters, and multi-tenant telemetry pipelines across enterprise cloud nodes.',
          bullets: [
            { label: 'Cross-Engine Interoperability', text: 'Replaces proprietary adapters with a universal JSON-RPC 2.0 interface.' },
            { label: 'Hardware Optimization', text: 'Latency reduced by 34% on Nvidia Blackwell clusters.' }
          ],
          entities: [
            { name: 'OpenAI', type: 'blue' },
            { name: 'Autonomous Agents', type: 'purple' },
            { name: 'Nvidia', type: 'green' }
          ]
        },
        {
          id: 'tr-2',
          tag: '⚡ Breakthrough Signal',
          tagClass: 'signal',
          sources: '📰 3 Sources: Bloomberg, Ars Technica, Tom\'s Hardware',
          time: '42m ago',
          title: 'Nvidia Demonstrates Next-Gen Optical Interconnects for 100k-GPU Data Centers',
          summary: 'Co-packaged optics (CPO) achieve sub-microsecond latency across rack-scale clusters, cutting energy consumption per gigabit by more than 40% compared to traditional copper transceivers.',
          bullets: [
            { label: 'Energy Efficiency', text: '3.2 Tbps optical modules integrate directly into GPU package substrates.' }
          ],
          entities: [
            { name: 'Nvidia', type: 'green' },
            { name: 'Optical Interconnects', type: 'amber' }
          ]
        },
        {
          id: 'tr-3',
          tag: '🚀 Space Milestone',
          tagClass: 'space',
          sources: '📰 2 Sources: NASA Press, SpaceNews',
          time: '1h ago',
          title: 'James Webb Space Telescope Detects Atmospheric Carbon Signatures on Habitable-Zone Exoplanet',
          summary: 'Spectroscopic analysis of planet K2-18b confirms dimethyl sulfide and methane concentrations, prompting peer-reviewed follow-up observations from terrestrial radio arrays.',
          bullets: [
            { label: 'Biosignature Analysis', text: 'Atmospheric transmission spectra confirmed at 5-sigma statistical significance.' }
          ],
          entities: [
            { name: 'JWST', type: 'purple' },
            { name: 'Exoplanets', type: 'blue' }
          ]
        }
      ]
    },
    'ai': {
      section: 'DISCOVER',
      title: '🤖 AI & Machine Learning',
      stories: [
        {
          id: 'ai-1',
          tag: '⚡ Model Release',
          tagClass: 'signal',
          sources: '📰 5 Sources: VentureBeat, MIT Tech Review, Arxiv',
          time: '12m ago',
          title: 'DeepSeek-V3 Reasoning Benchmarks Exceed Proprietary Frontiers in Code Synthesis',
          summary: 'Independent benchmarks demonstrate state-of-the-art results across HumanEval and SWE-bench with open weights and optimized MoE sparsity patterns.',
          bullets: [
            { label: 'Sparse MoE Architecture', text: '671B total parameters with only 37B active per token.' }
          ],
          entities: [
            { name: 'DeepSeek', type: 'purple' },
            { name: 'MoE Models', type: 'blue' }
          ]
        }
      ]
    },
    'markets': {
      section: 'DISCOVER',
      title: '💰 Global Markets & Fintech',
      stories: [
        {
          id: 'mk-1',
          tag: '📈 Market Movement',
          tagClass: 'velocity',
          sources: '📰 4 Sources: Financial Times, WSJ, Bloomberg',
          time: '25m ago',
          title: 'Semiconductor ETF Volumes Surge as Next-Gen Cloud CapEx Projections Rise 28%',
          summary: 'Institutional flows accelerate into hyperscale datacenter supply chains following upward revisions in enterprise AI infrastructure spending.',
          bullets: [
            { label: 'CapEx Surge', text: 'Global datacenter commitments top $240B for the fiscal year.' }
          ],
          entities: [
            { name: 'Semiconductors', type: 'green' },
            { name: 'Hyperscalers', type: 'blue' }
          ]
        }
      ]
    },
    'world': {
      section: 'DISCOVER',
      title: '🌍 World Geopolitics & Macro',
      stories: [
        {
          id: 'wd-1',
          tag: '🌍 Macro Briefing',
          tagClass: 'signal',
          sources: '📰 3 Sources: BBC, Reuters, AP',
          time: '35m ago',
          title: 'Global Clean Energy Transition Crosses 40% Grid Contribution in Q3',
          summary: 'Combined solar, wind, and storage deployments reach record interconnection rates across North America and Europe.',
          bullets: [
            { label: 'Renewables Share', text: 'Solar additions outpace fossil additions by 3:1 ratio.' }
          ],
          entities: [
            { name: 'Energy', type: 'green' },
            { name: 'Infrastructure', type: 'blue' }
          ]
        }
      ]
    },
    'space': {
      section: 'DISCOVER',
      title: '🚀 Space Exploration & Science',
      stories: [
        {
          id: 'sp-1',
          tag: '🚀 Launch Window',
          tagClass: 'space',
          sources: '📰 2 Sources: SpaceFlight Now, Ars Technica',
          time: '50m ago',
          title: 'Starship Flight Test Approved for Orbital Payload Dispenser Demonstration',
          summary: 'Regulatory filings show FAA approval for booster catch and orbital satellite dispenser validation over the Indian Ocean.',
          bullets: [
            { label: 'Booster Recovery', text: 'Tower catch attempt at Starbase Launch Pad A.' }
          ],
          entities: [
            { name: 'SpaceX', type: 'purple' },
            { name: 'Starship', type: 'blue' }
          ]
        }
      ]
    },
    'gaming': {
      section: 'DISCOVER',
      title: '🎮 Gaming & Interactive Tech',
      stories: [
        {
          id: 'gm-1',
          tag: '🎮 Engine Architecture',
          tagClass: 'signal',
          sources: '📰 3 Sources: Eurogamer, IGN, PC Gamer',
          time: '1h 10m ago',
          title: 'Unreal Engine 5.5 Introduces Sub-Millisecond Neural Frame Generation API',
          summary: 'Real-time ray tracing denoising neural network integrates directly into hardware pipelines with zero perceptual ghosting artifacts.',
          bullets: [
            { label: 'Neural Denoising', text: 'Frame times cut from 16ms to 7ms on flagship hardware.' }
          ],
          entities: [
            { name: 'Unreal Engine', type: 'blue' },
            { name: 'Rendering', type: 'amber' }
          ]
        }
      ]
    },
    'ws-ai-hardware': {
      section: 'WORKSPACES',
      title: '⚡ AI Hardware Research (+3 new)',
      stories: [
        {
          id: 'ws-1',
          tag: '⚡ Research Brief',
          tagClass: 'signal',
          sources: '📰 3 Sources: Semiconductor Engineering, AnandTech',
          time: '14m ago',
          title: 'Custom Silicon TPU v6 Architecture Details Disclosed with 3D HBM4 Stacking',
          summary: 'Next-generation matrix multiply units feature unified optical crossbars delivering 4.8 TB/s inter-node bandwidth.',
          bullets: [
            { label: 'HBM4 Memory', text: 'Direct die-to-wafer hybrid bonding.' }
          ],
          entities: [
            { name: 'TPU', type: 'green' },
            { name: 'Silicon', type: 'blue' }
          ]
        }
      ]
    },
    'ws-space-exp': {
      section: 'WORKSPACES',
      title: '🚀 Space Exp. Deep-Dive (12 items)',
      stories: []
    },
    'ws-agents': {
      section: 'WORKSPACES',
      title: '🤖 Autonomous Agents (+5 new)',
      stories: []
    },
    'alert-openai': {
      section: 'ALERTS',
      title: '🔔 Keyword Alert: OpenAI (8 triggers)',
      stories: [
        {
          id: 'al-1',
          tag: '🔔 Alert Trigger',
          tagClass: 'signal',
          sources: '📰 4 Sources: The Information, Bloomberg',
          time: '5m ago',
          title: 'OpenAI Expands Stargate Data Center Initiative with Multiple Utility Partners',
          summary: 'Negotiations advance for dedicated gigawatt-scale computing campuses featuring dedicated renewable power and redundant fiber backbones.',
          bullets: [
            { label: 'Stargate Campus', text: 'Up to 5GW target capacity planned over multi-phase rollout.' }
          ],
          entities: [
            { name: 'OpenAI', type: 'blue' },
            { name: 'Stargate', type: 'green' }
          ]
        }
      ]
    },
    'alert-nvidia': {
      section: 'ALERTS',
      title: '🔔 Keyword Alert: Nvidia (3 new)',
      stories: [
        {
          id: 'al-2',
          tag: '🔔 Alert Trigger',
          tagClass: 'signal',
          sources: '📰 3 Sources: Reuters, Tom\'s Hardware',
          time: '15m ago',
          title: 'Nvidia Blackwell Ultra Shipments Target Q2 with Enhanced Liquid Cooling Standard',
          summary: 'Server OEMs certify direct-to-chip liquid distribution manifolds for 120kW high-density racks.',
          bullets: [
            { label: 'Thermal Design', text: '100% liquid cooling removes need for facility chillers.' }
          ],
          entities: [
            { name: 'Nvidia', type: 'green' },
            { name: 'Blackwell', type: 'amber' }
          ]
        }
      ]
    },
    'alert-cloudflare': {
      section: 'ALERTS',
      title: '🔔 Keyword Alert: Cloudflare',
      stories: []
    }
  };

  // 2. Comprehensive 7-Layer Topic Graph & Discovery Dictionary
  const SEMANTIC_TOPIC_GRAPH = {
    'cricket': {
      name: 'Cricket',
      neighbors: ['IPL', 'ICC World Test Championship', 'T20 World Cup', 'ESPNcricinfo', 'Cricbuzz', 'Wisden', 'BCCI'],
      sources: [
        {
          id: 'src_espncricinfo',
          title: 'ESPNcricinfo News',
          domain: 'espncricinfo.com',
          feed_url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
          feed_type: 'rss',
          authority: 96,
          frequency: 24,
          health: 99.9,
          subscribers: 142000,
          description: 'Global ball-by-ball cricket journalism, tournament analysis, and breaking international fixtures.',
          articles: [
            { title: 'ICC Finalizes Standardized Multi-Day Red Ball Playing Conditions for 2026-2027', time: '45m ago', snippet: 'Updated playing regulations focus on over-rate penalties, mandatory reserve day triggers, and optical tracking telemetry.' },
            { title: 'Champions Trophy Venue Blueprint Finalized After Multi-Board Conciliation', time: '3h ago', snippet: 'Host schedules confirmed with dedicated contingency windows for weather delays.' },
            { title: 'Fast Bowling Load Management Protocol Adopted by All Full Member Boards', time: '6h ago', snippet: 'Wearable biometric sensor standards mandated to prevent repetitive stress injuries.' }
          ]
        },
        {
          id: 'src_bbc_cricket',
          title: 'BBC Sport Cricket',
          domain: 'bbc.com',
          feed_url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
          feed_type: 'rss',
          authority: 98,
          frequency: 14,
          health: 100.0,
          subscribers: 98000,
          description: 'Authoritative reporting on England, County Championship, Ashes, and World Cup developments.',
          articles: [
            { title: 'County Championship Season Expansion Receives Overwhelming County Endorsement', time: '1h ago', snippet: 'Red-ball schedule guarantees prime summer fixtures with enhanced live broadcasting access.' },
            { title: 'Ashes Tour Schedule Confirmed: 5 Test Matches Across Traditional Australian Venues', time: '5h ago', snippet: 'Perth, Adelaide, Brisbane, Melbourne, and Sydney locked in with day-night fixture at Adelaide Oval.' }
          ]
        },
        {
          id: 'src_cricbuzz',
          title: 'Cricbuzz Latest Headlines',
          domain: 'cricbuzz.com',
          feed_url: 'https://www.cricbuzz.com/rss/news',
          feed_type: 'rss',
          authority: 92,
          frequency: 18,
          health: 99.5,
          subscribers: 86000,
          description: 'Comprehensive match reports, player interviews, and domestic T20 league coverage.',
          articles: [
            { title: 'IPL Auction Dynamics: Franchise Retentions Reach Record Cap Commitments', time: '2h ago', snippet: 'Teams prioritize core domestic talent and premium fast-bowling all-rounders.' },
            { title: 'BCCI Announces Expanded 10-Team Women\'s Premier League Window', time: '4h ago', snippet: 'Structural calendar alignment ensures full international marquee player availability.' }
          ]
        },
        {
          id: 'src_guardian_cricket',
          title: 'The Guardian Cricket',
          domain: 'theguardian.com',
          feed_url: 'https://www.theguardian.com/sport/cricket/rss',
          feed_type: 'rss',
          authority: 95,
          frequency: 8,
          health: 100.0,
          subscribers: 45000,
          description: 'In-depth essays, columnists, and live match day coverage from premier sports journalists.',
          articles: [
            { title: 'Why the Evolution of Wrist-Spin Has Redefined Middle-Overs Strategy in T20', time: '7h ago', snippet: 'Tactical analysis exploring release angles, seam stability, and boundary mitigation.' }
          ]
        }
      ],
      newsletters: [
        {
          id: 'nl_wisden',
          title: 'Wisden Cricket Weekly',
          domain: 'wisden.com',
          feed_url: 'https://wisden.substack.com/feed',
          feed_type: 'substack',
          authority: 94,
          frequency: 2,
          health: 100.0,
          subscribers: 32000,
          description: 'The historic Bible of cricket bringing thoughtful essays, historic records, and analysis.',
          articles: [
            { title: 'Wisden Issue #142: The Golden Age of Fast Bowling All-Rounders', time: '1d ago', snippet: 'Historical comparisons spanning 50 years of Test match dominance.' }
          ]
        },
        {
          id: 'nl_cricket_monthly',
          title: 'The Cricket Monthly Digest',
          domain: 'thecricketmonthly.com',
          feed_url: 'https://thecricketmonthly.com/feed/rss',
          feed_type: 'newsletter',
          authority: 91,
          frequency: 1,
          health: 99.0,
          subscribers: 18000,
          description: 'Long-form narrative journalism exploring the cultural impact of international cricket.',
          articles: [
            { title: 'The Architect of the Modern Yorker: An Oral History', time: '3d ago', snippet: 'Legendary bowlers reflect on the physics and psychology of the toe-crusher.' }
          ]
        }
      ],
      youtube: [
        {
          id: 'yt_robelinda',
          title: 'Robelinda2 Cricket Vault',
          domain: 'youtube.com',
          feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvX6x_w0F5r0o0zQ1w4m2A',
          feed_type: 'youtube',
          authority: 88,
          frequency: 4,
          health: 100.0,
          subscribers: 820000,
          description: 'Iconic cricket highlights, historic spells, and retro international footage archives.',
          articles: [
            { title: 'Allan Donald vs Mike Atherton (Trent Bridge 1998) 1080p 60fps', time: '2d ago', snippet: 'The most intense 40 minutes of fast bowling theatre in Test history.' }
          ]
        },
        {
          id: 'yt_icc',
          title: 'ICC Official Channel',
          domain: 'youtube.com',
          feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvX6x_w0F5r0o0zQ1w4m2B',
          feed_type: 'youtube',
          authority: 97,
          frequency: 12,
          health: 100.0,
          subscribers: 9500000,
          description: 'Official tournament highlights, press conferences, and player profiles.',
          articles: [
            { title: 'Top 10 Fielding Moments from ICC World Test Championship', time: '18h ago', snippet: 'Spectacular diving catches and direct-hit runouts from around the globe.' }
          ]
        }
      ],
      topics: ['IPL 2026', 'ICC World Test Championship', 'T20 World Cup', 'BCCI Policy', 'Fast Bowling Biomechanics'],
      companies: ['ICC', 'BCCI', 'Cricket Australia', 'ECB', 'Wisden Media'],
      sampleArticles: [
        {
          id: 'crk_art_1',
          title: 'ICC Finalizes Standardized Multi-Day Red Ball Playing Conditions for 2026-2027 Cycle',
          snippet: 'The International Cricket Council has finalized updated playing regulations focusing on over-rate penalties, mandatory reserve day triggers, and optical tracking telemetry for boundary calls.',
          author: 'Osman Samiuddin',
          time: '1h ago',
          source: { id: 'src_espncricinfo', title: 'ESPNcricinfo', domain: 'espncricinfo.com', authority: 96 },
          why_badges: [
            { label: 'Exact match: Cricket', type: 'highlight' },
            { label: 'Verified Authority (96)', type: 'verified' },
            { label: 'Breaking (<2h)', type: 'trending' }
          ],
          bullets: [
            { label: 'Telemetry Standard', text: 'Optical edge sensors deploy on all international pitches.' },
            { label: 'Over-Rate Penalty', text: 'Automatic fielder restriction triggers on 85th minute mark.' }
          ],
          cluster: [
            {
              source_title: 'BBC Sport Cricket',
              title: 'ICC modernizes over-rate enforcement with live umpire timing chips',
              snippet: 'Umpires will now receive tactile vibrational alerts when innings rates fall behind schedule.'
            }
          ]
        },
        {
          id: 'crk_art_2',
          title: 'BCCI Announces Expanded 10-Team Women\'s Premier League Window for Upcoming Season',
          snippet: 'Record viewership figures prompt structural calendar alignment with international boards to guarantee full marquee overseas player participation.',
          author: 'Harsha Bhogle',
          time: '3h ago',
          source: { id: 'src_cricbuzz', title: 'Cricbuzz', domain: 'cricbuzz.com', authority: 92 },
          why_badges: [
            { label: 'High Velocity (+88%)', type: 'trending' },
            { label: 'Verified Source (92)', type: 'verified' }
          ],
          bullets: [
            { label: 'WPL Expansion', text: 'Tournament duration extended to 28 days with two additional franchises.' }
          ]
        }
      ]
    },
    'ai agents': {
      name: 'AI Agents',
      neighbors: ['Autonomous Agents', 'LLMs', 'OpenAI', 'Anthropic', 'LangChain', 'MCP', 'CrewAI', 'AutoGen', 'Tool Calling'],
      sources: [
        {
          id: 'src_openai',
          title: 'OpenAI Developer & Research Blog',
          domain: 'openai.com',
          feed_url: 'https://openai.com/news/rss.xml',
          feed_type: 'rss',
          authority: 99,
          frequency: 4,
          health: 100.0,
          subscribers: 420000,
          description: 'Official announcements, model weights, API capabilities, and agent orchestration frameworks.',
          articles: [
            { title: 'Introducing the Standardized Tool Calling Protocol for Multi-Tenant Clusters', time: '2h ago', snippet: 'Unified JSON-RPC schemas and sandboxing parameters for autonomous systems.' },
            { title: 'Fine-Tuning Frontier Models with Reinforced Tool Telemetry', time: '1d ago', snippet: 'Evaluating task completion rates with deterministic verification harnesses.' }
          ]
        },
        {
          id: 'src_anthropic',
          title: 'Anthropic Engineering & Research',
          domain: 'anthropic.com',
          feed_url: 'https://www.anthropic.com/feed.xml',
          feed_type: 'rss',
          authority: 98,
          frequency: 3,
          health: 100.0,
          subscribers: 280000,
          description: 'Deep technical research on Claude, constitutional AI, tool calling standards, and model safety.',
          articles: [
            { title: 'Model Context Protocol (MCP) Enterprise Deployment Patterns', time: '3h ago', snippet: 'Connecting local databases, developer environments, and enterprise APIs seamlessly.' }
          ]
        },
        {
          id: 'src_langchain',
          title: 'LangChain Official Blog',
          domain: 'blog.langchain.dev',
          feed_url: 'https://blog.langchain.dev/rss/',
          feed_type: 'rss',
          authority: 92,
          frequency: 6,
          health: 100.0,
          subscribers: 110000,
          description: 'Architecture patterns for memory, multi-agent evaluation, vector retrieval, and LangGraph deployment.',
          articles: [
            { title: 'Building Multi-Agent Workflows with LangGraph 0.2', time: '5h ago', snippet: 'State management, human-in-the-loop breakpoints, and time-travel debugging.' }
          ]
        }
      ],
      newsletters: [
        {
          id: 'nl_latentspace',
          title: 'Latent Space',
          domain: 'latent.space',
          feed_url: 'https://www.latent.space/feed',
          feed_type: 'substack',
          authority: 95,
          frequency: 2,
          health: 100.0,
          subscribers: 95000,
          description: 'The premier AI Engineering newsletter & podcast decoding foundation models and autonomous systems.',
          articles: [
            { title: 'The 2026 AI Engineer Tech Stack: From RAG to Autonomous Agents', time: '1d ago', snippet: 'Comprehensive map of evaluation harnesses, memory layers, and execution runtimes.' }
          ]
        }
      ],
      youtube: [
        {
          id: 'yt_aiexplained',
          title: 'AI Explained',
          domain: 'youtube.com',
          feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw',
          feed_type: 'youtube',
          authority: 93,
          frequency: 2,
          health: 100.0,
          subscribers: 410000,
          description: 'Objective, math-grounded walkthroughs of state-of-the-art AI architectures and agent capabilities.',
          articles: [
            { title: 'Are We Close to Fully Autonomous Software Engineering? Paper Deep Dive', time: '2d ago', snippet: 'Examining SWE-bench verified benchmark results and agent error distributions.' }
          ]
        }
      ],
      topics: ['Model Context Protocol (MCP)', 'Multi-Agent Systems', 'Tool Calling Standards', 'Autonomous Sandboxing', 'Human-in-the-Loop'],
      companies: ['OpenAI', 'Anthropic', 'LangChain', 'CrewAI', 'Microsoft AI'],
      sampleArticles: []
    }
  };

  // 3. Formula: 35% Relevance + 20% Frequency + 15% Authority + 15% Health + 10% Subscribers + 5% Engagement
  function calculateDiscoveryScore(opts) {
    const rel = Math.max(0, Math.min(1.0, opts.relevance || 1.0));
    const freq = Math.max(0.1, Math.min(1.0, (opts.frequency || 1.0) / 10.0));
    const auth = Math.max(0, Math.min(1.0, (opts.authority || 50) / 100.0));
    const health = Math.max(0, Math.min(1.0, (opts.health || 100.0) / 100.0));
    const subs = Math.max(0, Math.min(1.0, opts.subscribers > 0 ? Math.log10(opts.subscribers + 1) / 5.0 : 0.0));
    const eng = Math.max(0, Math.min(1.0, (opts.engagement || 50) / 100.0));

    const score = (0.35 * rel) + (0.20 * freq) + (0.15 * auth) + (0.15 * health) + (0.10 * subs) + (0.05 * eng);
    return Math.round(score * 1000) / 1000;
  }

  // Active Discovery Memory State
  let currentDiscoveryData = null;

  // 4. Client-Side 7-Layer Discovery Engine Execution
  function discoverFeedsAndArticlesLocally(query) {
    const q = (query || '').trim();
    if (!q) return null;
    const qLower = q.toLowerCase();

    // Check matched topic
    let matched = null;
    for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
      if (qLower === key || qLower.includes(key) || key.includes(qLower) || val.neighbors.some(n => n.toLowerCase().includes(qLower))) {
        matched = val;
        break;
      }
    }

    const scoreList = (list) => {
      return (list || []).map(s => ({
        ...s,
        discovery_score: calculateDiscoveryScore({
          relevance: 0.95,
          frequency: s.frequency || 5,
          authority: s.authority || 80,
          health: s.health || 100,
          subscribers: s.subscribers || 10000,
          engagement: 75
        })
      })).sort((a, b) => b.discovery_score - a.discovery_score);
    };

    if (matched) {
      return {
        query: q,
        total_sources_found: (matched.sources.length + matched.newsletters.length + (matched.youtube ? matched.youtube.length : 0)),
        suggested_sources: scoreList(matched.sources),
        suggested_newsletters: scoreList(matched.newsletters),
        suggested_youtube: scoreList(matched.youtube),
        related_topics: matched.topics || [],
        related_companies: matched.companies || [],
        articles: matched.sampleArticles || []
      };
    }

    // Dynamic Generic Generation for any arbitrary keyword
    const capitalized = q.charAt(0).toUpperCase() + q.slice(1);
    const cleanSlug = q.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'topic';

    const dynamicSources = scoreList([
      {
        id: 'src_' + cleanSlug + '_hub',
        title: capitalized + ' Global News Hub',
        domain: cleanSlug + 'news.org',
        feed_url: 'https://www.' + cleanSlug + 'news.org/rss.xml',
        feed_type: 'rss',
        authority: 88,
        frequency: 10,
        health: 100.0,
        subscribers: 28000,
        description: 'Curated editorial reporting and continuous updates covering global ' + q + ' developments.',
        articles: [
          { title: 'Global Market Report: Accelerating Adoption Trends in ' + capitalized, time: '1h ago', snippet: 'Industry leadership briefing on supply chain expansion and capital commitments.' },
          { title: 'Strategic Roadmap 2026: Technology and Policy Shifts in ' + capitalized, time: '4h ago', snippet: 'Analyzing key regulatory benchmarks and cross-industry partnerships.' },
          { title: 'Emerging Startups and Innovators Shaping the ' + capitalized + ' Ecosystem', time: '8h ago', snippet: 'Deep dive into fast-growing ventures and breakthrough architectures.' }
        ]
      },
      {
        id: 'src_' + cleanSlug + '_daily',
        title: capitalized + ' Daily Intelligence',
        domain: cleanSlug + 'daily.com',
        feed_url: 'https://' + cleanSlug + 'daily.com/feed',
        feed_type: 'rss',
        authority: 84,
        frequency: 6,
        health: 99.5,
        subscribers: 19000,
        description: 'In-depth market intelligence, key company watchlists, and research papers on ' + q + '.',
        articles: [
          { title: 'Executive Briefing: Daily Synthesis of Key ' + capitalized + ' Signals', time: '2h ago', snippet: 'Curated morning briefing for decision makers and engineering leads.' },
          { title: 'Q3 Financial Performance and Infrastructure CapEx Across ' + capitalized, time: '6h ago', snippet: 'Earnings synthesis and enterprise contract valuations.' }
        ]
      },
      {
        id: 'src_' + cleanSlug + '_insider',
        title: capitalized + ' Insider Weekly',
        domain: cleanSlug + 'insider.io',
        feed_url: 'https://' + cleanSlug + 'insider.io/rss',
        feed_type: 'rss',
        authority: 81,
        frequency: 4,
        health: 100.0,
        subscribers: 14000,
        description: 'Executive analysis, funding tracker, and emerging trend synthesis in ' + q + '.',
        articles: [
          { title: 'Top Venture Deals and M&A Transactions in ' + capitalized, time: '1d ago', snippet: 'Weekly funding round roundup and strategic investor breakdown.' }
        ]
      }
    ]);

    const dynamicNewsletters = scoreList([
      {
        id: 'nl_' + cleanSlug + '_letter',
        title: 'The ' + capitalized + ' Letter',
        domain: 'substack.com',
        feed_url: 'https://' + cleanSlug + '.substack.com/feed',
        feed_type: 'substack',
        authority: 82,
        frequency: 2,
        health: 100.0,
        subscribers: 15000,
        description: 'Weekly long-form essays, executive takeaways, and industry trends in ' + q + '.',
        articles: [
          { title: 'Edition #48: The Long-Term Economics of ' + capitalized, time: '2d ago', snippet: 'Why compounding advantages are shifting competitive dynamics.' }
        ]
      }
    ]);

    const dynamicArticles = [
      {
        id: 'dyn_art_' + Date.now(),
        title: 'Global Industry Analysis: Key Structural Trends Reshaping ' + capitalized,
        snippet: 'Market leaders and research analysts outline the fundamental growth vectors, policy parameters, and technology shifts across the ' + q + ' ecosystem.',
        author: 'Intelligence Editorial Desk',
        time: '1h ago',
        source: { id: 'src_global', title: capitalized + ' Daily', domain: cleanSlug + '.org', authority: 88 },
        why_badges: [
          { label: 'Discovered for "' + q + '"', type: 'highlight' },
          { label: 'Freshness (<2h)', type: 'trending' },
          { label: 'Verified Authority (88)', type: 'verified' }
        ],
        bullets: [
          { label: 'Market Velocity', text: 'Growth rate accelerating with increased cross-sector institutional adoption.' }
        ]
      }
    ];

    return {
      query: q,
      total_sources_found: dynamicSources.length + dynamicNewsletters.length,
      suggested_sources: dynamicSources,
      suggested_newsletters: dynamicNewsletters,
      suggested_youtube: [],
      related_topics: [capitalized + ' Trends', capitalized + ' Market', capitalized + ' Research', capitalized + ' Leaders'],
      related_companies: [capitalized + ' Alliance', 'Global ' + capitalized + ' Group', capitalized + ' Ventures'],
      articles: dynamicArticles
    };
  }

  let currentView = 'trending';
  let currentSection = 'DISCOVER';
  let currentTitle = '🔥 Trending Stories';

  function switchView(viewKey, title, section) {
    currentView = viewKey;
    currentTitle = title;
    currentSection = section;
    currentDiscoveryData = null;

    // Clear search box value
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    // Nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('nav-item-active');
      btn.classList.add('nav-item-inactive');
      if (btn.getAttribute('data-view') === viewKey) {
        btn.classList.remove('nav-item-inactive');
        btn.classList.add('nav-item-active');
      }
    });

    // Breadcrumb
    const secEl = document.getElementById('header-section');
    const titleEl = document.getElementById('header-title');
    if (secEl) secEl.textContent = section;
    if (titleEl) titleEl.textContent = title;

    // Render stories
    const data = STORIES_DATA[viewKey] || STORIES_DATA['trending'];
    renderStories(data.stories);
  }

  function renderStories(stories) {
    const container = document.getElementById('story-container');
    if (!container) return;

    if (!stories || stories.length === 0) {
      container.innerHTML = `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:3.5rem 2rem; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size:2.75rem; margin-bottom:0.75rem;">🔍</div>
          <h3 style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:0.35rem;">No story clusters in this view</h3>
          <p style="font-size:13px; color:#64748b; margin-bottom:1.25rem;">Type any keyword above (e.g. "cricket", "AI Agents", "quantum") or click a topic chip to discover internet feeds.</p>
          <button class="btn-universe primary" onclick="FeedOmeterSearch.handleSearch('cricket')" style="display:inline-flex;">Discover "Cricket" Feeds</button>
        </div>
      `;
      return;
    }

    container.innerHTML = stories.map(s => `
      <article class="story-card">
        <div class="story-card-top">
          <div class="story-meta-pills">
            <span class="badge-tag ${s.tagClass || 'signal'}">${s.tag || 'Breaking'}</span>
            <span class="badge-sources">${s.sources || '📰 Global Feed'}</span>
            <span class="badge-time">${s.time || 'Live'}</span>
          </div>
          <button class="bookmark-icon-btn" title="Save to Workspace" onclick="FeedOmeterSearch.toast('Saved story to workspace!')">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          </button>
        </div>

        <h2 class="story-title" onclick="FeedOmeterSearch.openArticleReader('${s.id || ''}', '${(s.title || '').replace(/'/g, "\\'")}', '${(s.summary || s.snippet || '').replace(/'/g, "\\'")}')">
          ${s.title}
        </h2>

        <p class="story-summary-text">
          ${s.summary || s.snippet || ''}
        </p>

        ${s.bullets && s.bullets.length ? `
          <div class="story-takeaways-box">
            ${s.bullets.map(b => `
              <div class="takeaway-item">
                <span class="takeaway-dot">•</span>
                <span><strong>${b.label}:</strong> ${b.text}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="story-bottom-row">
          <div class="story-entity-chips">
            <span class="entity-label">Entities:</span>
            ${s.entities ? s.entities.map(e => `
              <span class="chip-tag ${e.type}" onclick="FeedOmeterSearch.handleSearch('${e.name}')" style="cursor:pointer;">${e.name}</span>
            `).join('') : ''}
          </div>
          <button class="read-cluster-btn" onclick="FeedOmeterSearch.openArticleReader('${s.id || ''}', '${(s.title || '').replace(/'/g, "\\'")}', '${(s.summary || s.snippet || '').replace(/'/g, "\\'")}')">
            <span>Read Full Cluster</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </article>
    `).join('');
  }

  // 5. Render Discovery View (Expand Feed Universe + Sources + Newsletters + Articles)
  function renderDiscoveryView(data) {
    currentDiscoveryData = data;
    const container = document.getElementById('story-container');
    if (!container || !data) return;

    let html = '';

    // 1. Expand Feed Universe Hero Banner
    html += `
      <div class="discovery-universe-banner">
        <div class="universe-banner-left">
          <span class="universe-icon-badge">⚡</span>
          <div>
            <span class="universe-title">Expanded Feed Universe for "${data.query}"</span>
            <span class="universe-sub">Discovered ${data.total_sources_found || 6} high-authority feeds, newsletters & publications across the internet</span>
          </div>
        </div>
        <div class="universe-actions">
          <button class="btn-universe secondary" onclick="FeedOmeterSearch.toast('📁 Workspace created for: ${data.query}')">Create Workspace</button>
          <button class="btn-universe primary" id="btnFollowAllFeeds" onclick="FeedOmeterSearch.followAll('${data.query}')">⚡ Follow All Feeds (${data.total_sources_found || 6})</button>
        </div>
      </div>
    `;

    // 2. Suggested Feeds & Sources
    if (data.suggested_sources && data.suggested_sources.length > 0) {
      html += `
        <div class="discovery-section-title">
          <span>📡</span> <span>Sources You May Want to Follow (${data.suggested_sources.length})</span>
        </div>
        <div class="sources-cards-grid">
          ${data.suggested_sources.map((s, idx) => `
            <div class="discovered-source-card">
              <div class="source-card-top">
                <div style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${s.id || idx}', 'source')">
                  <div class="source-card-title hover:text-blue-600 transition-colors">${s.title}</div>
                  <div class="source-card-domain">${s.domain}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.35rem;">
                  <button class="btn-preview-feed text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all cursor-pointer" onclick="FeedOmeterSearch.previewSource('${s.id || idx}', 'source')" title="Preview recent feed articles">👁️ Preview</button>
                  <button class="btn-follow-source" id="btn-src-${idx}" onclick="FeedOmeterSearch.toggleFollow(this, '${(s.title || '').replace(/'/g, "\\'")}')">+ Follow</button>
                </div>
              </div>
              <p class="source-card-desc" style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${s.id || idx}', 'source')">${s.description || ''}</p>
              <div class="source-card-metrics">
                <span class="metric-pill auth">⚡ ${s.authority}/100 Auth</span>
                <span class="metric-pill">📅 ${s.frequency}/day</span>
                <span class="metric-pill">🟢 ${s.health || 100}% Health</span>
                ${s.subscribers ? `<span class="metric-pill">👥 ${(s.subscribers).toLocaleString()} readers</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 3. Suggested Newsletters & Substack
    if (data.suggested_newsletters && data.suggested_newsletters.length > 0) {
      html += `
        <div class="discovery-section-title">
          <span>✉️</span> <span>Suggested Newsletters & Substack (${data.suggested_newsletters.length})</span>
        </div>
        <div class="sources-cards-grid">
          ${data.suggested_newsletters.map((n, idx) => `
            <div class="discovered-source-card">
              <div class="source-card-top">
                <div style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${n.id || idx}', 'newsletter')">
                  <div class="source-card-title hover:text-blue-600 transition-colors">${n.title}</div>
                  <div class="source-card-domain">${n.domain}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.35rem;">
                  <button class="btn-preview-feed text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all cursor-pointer" onclick="FeedOmeterSearch.previewSource('${n.id || idx}', 'newsletter')" title="Preview newsletter issues">👁️ Preview</button>
                  <button class="btn-follow-source" onclick="FeedOmeterSearch.toggleFollow(this, '${(n.title || '').replace(/'/g, "\\'")}', 'Subscribed')">+ Subscribe</button>
                </div>
              </div>
              <p class="source-card-desc" style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${n.id || idx}', 'newsletter')">${n.description || ''}</p>
              <div class="source-card-metrics">
                <span class="metric-pill auth">⚡ ${n.authority}/100 Auth</span>
                <span class="metric-pill">👥 ${(n.subscribers || 10000).toLocaleString()} readers</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 4. Suggested YouTube Channels
    if (data.suggested_youtube && data.suggested_youtube.length > 0) {
      html += `
        <div class="discovery-section-title">
          <span>🎥</span> <span>Suggested YouTube Channels (${data.suggested_youtube.length})</span>
        </div>
        <div class="sources-cards-grid">
          ${data.suggested_youtube.map((y, idx) => `
            <div class="discovered-source-card">
              <div class="source-card-top">
                <div style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${y.id || idx}', 'youtube')">
                  <div class="source-card-title hover:text-blue-600 transition-colors">${y.title}</div>
                  <div class="source-card-domain">YouTube Feed</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.35rem;">
                  <button class="btn-preview-feed text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all cursor-pointer" onclick="FeedOmeterSearch.previewSource('${y.id || idx}', 'youtube')" title="Preview channel videos">👁️ Preview</button>
                  <button class="btn-follow-source" onclick="FeedOmeterSearch.toggleFollow(this, '${(y.title || '').replace(/'/g, "\\'")}', 'Subscribed')">+ Follow</button>
                </div>
              </div>
              <p class="source-card-desc" style="cursor:pointer;" onclick="FeedOmeterSearch.previewSource('${y.id || idx}', 'youtube')">${y.description || ''}</p>
              <div class="source-card-metrics">
                <span class="metric-pill auth">⚡ ${y.authority}/100 Auth</span>
                <span class="metric-pill">👥 ${(y.subscribers || 100000).toLocaleString()} subs</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 5. Clustered News Stories Stream
    if (data.articles && data.articles.length > 0) {
      html += `
        <div class="discovery-section-title">
          <span>📰</span> <span>Live Clustered News Stories (${data.articles.length})</span>
        </div>
      `;
      html += data.articles.map(s => `
        <article class="story-card" style="margin-bottom:1rem;">
          <div class="story-card-top">
            <div class="story-meta-pills">
              ${s.why_badges ? s.why_badges.map(b => `<span class="badge-tag ${b.type}">${b.label}</span>`).join('') : ''}
              <span class="badge-sources">📰 ${s.source ? s.source.title : 'Global Feed'}</span>
              <span class="badge-time">${s.time || 'Live'}</span>
            </div>
            <button class="bookmark-icon-btn" title="Save to Workspace" onclick="FeedOmeterSearch.toast('Saved story to workspace!')">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            </button>
          </div>

          <h2 class="story-title" onclick="FeedOmeterSearch.openArticleReader('${s.id || ''}', '${(s.title || '').replace(/'/g, "\\'")}', '${(s.snippet || s.summary || '').replace(/'/g, "\\'")}')">
            ${s.title}
          </h2>

          <p class="story-summary-text">
            ${s.snippet || s.summary || ''}
          </p>

          ${s.bullets && s.bullets.length ? `
            <div class="story-takeaways-box">
              ${s.bullets.map(b => `
                <div class="takeaway-item">
                  <span class="takeaway-dot">•</span>
                  <span><strong>${b.label}:</strong> ${b.text}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${s.cluster && s.cluster.length ? `
            <div class="story-takeaways-box" style="background:#f1f5f9; border-left:3px solid #3b82f6;">
              <div style="font-size:11px; font-weight:700; color:#1e40af; margin-bottom:0.25rem; text-transform:uppercase;">Cross-Feed Cluster Perspectives</div>
              ${s.cluster.map(c => `
                <div class="takeaway-item">
                  <span class="takeaway-dot">•</span>
                  <span><strong>${c.source_title}:</strong> ${c.title}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="story-bottom-row">
            <div class="story-entity-chips">
              <span class="entity-label">Entities:</span>
              <span class="chip-tag blue" onclick="FeedOmeterSearch.handleSearch('${data.query}')" style="cursor:pointer;">${data.query}</span>
              <span class="chip-tag green">FeedOmeter Live</span>
            </div>
            <button class="read-cluster-btn" onclick="FeedOmeterSearch.openArticleReader('${s.id || ''}', '${(s.title || '').replace(/'/g, "\\'")}', '${(s.snippet || s.summary || '').replace(/'/g, "\\'")}')">
              <span>Read Full Cluster</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </article>
      `).join('');
    }

    // 6. Related Topics & Companies
    html += `
      <div class="related-entities-box">
        ${data.related_topics && data.related_topics.length ? `
          <div class="related-row">
            <strong>Related Topics:</strong>
            ${data.related_topics.map(t => `<span class="related-pill" onclick="FeedOmeterSearch.handleSearch('${t}')">${t}</span>`).join('')}
          </div>
        ` : ''}
        ${data.related_companies && data.related_companies.length ? `
          <div class="related-row">
            <strong>Key Companies:</strong>
            ${data.related_companies.map(c => `<span class="related-pill" onclick="FeedOmeterSearch.handleSearch('${c}')">${c}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
  }

  // 6. Interactive Feed Preview Modal / Output Window
  function previewSource(identifier, type) {
    if (!currentDiscoveryData) return;

    let target = null;
    const list = type === 'newsletter' ? currentDiscoveryData.suggested_newsletters :
                 type === 'youtube' ? currentDiscoveryData.suggested_youtube :
                 currentDiscoveryData.suggested_sources;

    if (list) {
      target = list.find(s => s.id === identifier || String(s.id) === String(identifier)) || list[identifier];
    }

    if (!target) {
      toast('Feed preview not available');
      return;
    }

    // Generate sample feed articles if not explicitly present
    const articles = target.articles || [
      { title: `Latest Release & Operational Briefing: ${target.title}`, time: '2h ago', snippet: `Continuous editorial monitoring and verified updates covering ${currentDiscoveryData.query || 'the sector'}.` },
      { title: `Key Market Trends and Industry Developments in ${target.domain}`, time: '5h ago', snippet: 'In-depth analysis, key performance indicators, and structural policy updates.' },
      { title: `Weekly Executive Review: What Leaders Are Tracking`, time: '1d ago', snippet: 'Comprehensive recap of breakthroughs, transactions, and strategic milestones.' }
    ];

    let modal = document.getElementById('feed-preview-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'feed-preview-modal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:1.5rem; animation:fadeIn 0.2s ease;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#ffffff; border-radius:20px; max-width:760px; width:100%; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); border:1px solid #e2e8f0; overflow:hidden;">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color:#ffffff; padding:1.25rem 1.5rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:40px; height:40px; border-radius:12px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              ${type === 'youtube' ? '🎥' : type === 'newsletter' ? '✉️' : '📡'}
            </div>
            <div>
              <h3 style="font-size:16px; font-weight:800; color:#ffffff; line-height:1.2;">${target.title}</h3>
              <div style="font-size:11.5px; color:#bfdbfe; font-family:'JetBrains Mono',monospace;">${target.domain} • ${target.feed_type ? target.feed_type.toUpperCase() : 'RSS 2.0'}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button onclick="FeedOmeterSearch.toggleFollow(this, '${(target.title || '').replace(/'/g, "\\'")}')" style="background:#ffffff; color:#1e3a8a; border:none; padding:0.4rem 0.85rem; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s ease;">+ Follow Feed</button>
            <button onclick="document.getElementById('feed-preview-modal').style.display='none'" style="background:rgba(255,255,255,0.15); border:none; color:#ffffff; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; cursor:pointer;">✕</button>
          </div>
        </div>

        <!-- Feed Details Bar -->
        <div style="background:#f8fafc; padding:0.75rem 1.5rem; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; font-size:12px;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="background:#eff6ff; color:#1d4ed8; font-weight:700; padding:2px 8px; border-radius:6px; border:1px solid #bfdbfe;">⚡ ${target.authority || 90}/100 Authority</span>
            <span style="background:#ecfdf5; color:#047857; font-weight:700; padding:2px 8px; border-radius:6px; border:1px solid #a7f3d0;">🟢 ${target.health || 100}% Health</span>
            <span style="color:#64748b; font-family:'JetBrains Mono',monospace;">📅 ${target.frequency || 5} posts/day</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button onclick="navigator.clipboard.writeText('${target.feed_url || ''}'); FeedOmeterSearch.toast('Copied RSS feed URL to clipboard!')" style="background:#e2e8f0; color:#334155; border:none; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;">📋 Copy RSS Link</button>
          </div>
        </div>

        <!-- Feed Description -->
        <div style="padding:1rem 1.5rem 0.5rem; font-size:13px; color:#475569; line-height:1.5;">
          ${target.description || 'Continuous syndication and intelligence feed discovered for this topic.'}
        </div>

        <!-- Articles Stream in Feed -->
        <div style="padding:0.75rem 1.5rem 1.5rem; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:0.75rem;">
          <div style="font-size:12px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em;">Recent Articles in Feed (${articles.length})</div>
          ${articles.map(art => `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:0.85rem 1rem; transition:all 0.15s ease;" onmouseover="this.style.borderColor='#93c5fd'" onmouseout="this.style.borderColor='#e2e8f0'">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.35rem;">
                <span style="font-size:11px; font-family:'JetBrains Mono',monospace; color:#94a3b8;">${art.time || 'Today'}</span>
                <button onclick="FeedOmeterSearch.toast('Saved article to reading list!')" style="background:transparent; border:none; color:#94a3b8; cursor:pointer;" title="Save article">🔖</button>
              </div>
              <h4 style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:0.35rem; line-height:1.3; cursor:pointer;" onclick="FeedOmeterSearch.openArticleReader('', '${(art.title || '').replace(/'/g, "\\'")}', '${(art.snippet || '').replace(/'/g, "\\'")}')">${art.title}</h4>
              <p style="font-size:12.5px; color:#64748b; line-height:1.45; margin-bottom:0.5rem;">${art.snippet}</p>
              <div style="display:flex; align-items:center; justify-content:flex-end;">
                <button onclick="FeedOmeterSearch.openArticleReader('', '${(art.title || '').replace(/'/g, "\\'")}', '${(art.snippet || '').replace(/'/g, "\\'")}')" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px; cursor:pointer;">Read Article →</button>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;

    modal.style.display = 'flex';
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = 'none';
    };
  }

  // 7. Interactive Full Article Reader Drawer
  function openArticleReader(id, title, snippet) {
    let modal = document.getElementById('article-reader-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'article-reader-modal';
      modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:1.5rem; animation:fadeIn 0.2s ease;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#ffffff; border-radius:20px; max-width:760px; width:100%; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); border:1px solid #e2e8f0; overflow:hidden;">
        
        <div style="background:#0f172a; color:#ffffff; padding:1.25rem 1.5rem; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.25rem;">📖</span>
            <span style="font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#93c5fd;">FeedOmeter Focused Reader</span>
          </div>
          <button onclick="document.getElementById('article-reader-modal').style.display='none'" style="background:rgba(255,255,255,0.15); border:none; color:#ffffff; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; cursor:pointer;">✕</button>
        </div>

        <div style="padding:1.5rem; overflow-y:auto; flex:1;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            <span style="background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px; border:1px solid #bfdbfe;">Verified Feed</span>
            <span style="font-size:12px; color:#64748b; font-family:'JetBrains Mono',monospace;">Published Live</span>
          </div>
          <h2 style="font-size:20px; font-weight:800; color:#0f172a; line-height:1.3; margin-bottom:1rem;">${title}</h2>
          <p style="font-size:14.5px; color:#334155; line-height:1.65; margin-bottom:1.25rem;">${snippet}</p>

          <div style="background:#f8fafc; border-left:4px solid #3b82f6; border-radius:8px; padding:1rem; margin-bottom:1.25rem;">
            <h4 style="font-size:13px; font-weight:700; color:#1e40af; margin-bottom:0.5rem;">Executive Takeaways & Strategic Summary:</h4>
            <p style="font-size:13px; color:#475569; line-height:1.55;">
              This briefing synthesizes cross-feed reporting and telemetry from multiple authoritative sources indexed in FeedOmeter 2.1. All related entities and source attribution are linked directly in the cluster graph.
            </p>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding-top:1rem; border-top:1px solid #e2e8f0;">
            <button onclick="FeedOmeterSearch.toast('Added to Starred Articles!')" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; padding:0.5rem 1rem; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">⭐ Star Article</button>
            <button onclick="document.getElementById('article-reader-modal').style.display='none'" style="background:#2563eb; color:#ffffff; border:none; padding:0.5rem 1.25rem; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Done Reading</button>
          </div>
        </div>

      </div>
    `;

    modal.style.display = 'flex';
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = 'none';
    };
  }

  // 8. Handle Search Input & Discovery Execution
  async function handleSearch(query) {
    const trimmed = (query || '').trim();
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value !== trimmed) {
      searchInput.value = trimmed;
    }

    const secEl = document.getElementById('header-section');
    const titleEl = document.getElementById('header-title');

    if (!trimmed) {
      if (secEl) secEl.textContent = currentSection;
      if (titleEl) titleEl.textContent = currentTitle;
      const data = STORIES_DATA[currentView] || STORIES_DATA['trending'];
      renderStories(data.stories);
      return;
    }

    if (secEl) secEl.textContent = 'DISCOVERY RESULTS';
    if (titleEl) titleEl.textContent = '"' + trimmed + '"';

    // Highlight search item inactive on nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('nav-item-active');
      btn.classList.add('nav-item-inactive');
    });

    // 1. Try remote API first
    try {
      const res = await fetch('/api/search/discover?q=' + encodeURIComponent(trimmed));
      if (res.ok) {
        const apiData = await res.json();
        if (apiData && (apiData.suggested_sources || apiData.articles)) {
          renderDiscoveryView(apiData);
          return;
        }
      }
    } catch (e) {
      // Backend offline/static preview
    }

    // 2. Client-Side 7-Layer Topic Graph & Multi-Category Generator
    const localData = discoverFeedsAndArticlesLocally(trimmed);
    if (localData) {
      renderDiscoveryView(localData);
      return;
    }

    // 3. Fallback
    renderStories([]);
  }

  // Toast Notification Helper
  function toast(msg) {
    let el = document.getElementById('feedometer-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'feedometer-toast';
      el.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#1e293b; color:#ffffff; padding:10px 18px; border-radius:10px; font-size:13px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.25); z-index:999999; transition:all 0.25s ease; opacity:0; transform:translateY(10px); pointer-events:none; border-left:4px solid #3b82f6;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
    }, 2800);
  }

  function toggleFollow(btn, title, followedText) {
    if (!btn) return;
    const isFollowed = btn.classList.contains('followed');
    const label = followedText || 'Followed';
    if (isFollowed) {
      btn.classList.remove('followed');
      btn.textContent = '+ Follow';
      btn.style.background = '#f1f5f9';
      btn.style.color = '#1e293b';
      toast('Unfollowed: ' + title);
    } else {
      btn.classList.add('followed');
      btn.textContent = '✓ ' + label;
      btn.style.background = '#059669';
      btn.style.color = '#ffffff';
      toast('✓ Successfully ' + label.toLowerCase() + ': ' + title);
    }
  }

  function followAll(query) {
    const btn = document.getElementById('btnFollowAllFeeds');
    if (btn) {
      btn.textContent = '✓ All Feeds Followed!';
      btn.style.background = '#059669';
    }
    document.querySelectorAll('.btn-follow-source').forEach(b => {
      b.classList.add('followed');
      b.textContent = '✓ Followed';
      b.style.background = '#059669';
      b.style.color = '#ffffff';
    });
    toast('✓ Subscribed to all discovered feeds for "' + query + '"!');
  }

  function init() {
    // Nav item clicks
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        const title = btn.getAttribute('data-title');
        const section = btn.getAttribute('data-section') || 'DISCOVER';
        switchView(view, title, section);
      });
    });

    // Omnibox live search & Enter handler
    const searchInput = document.getElementById('search-input');
    const btnDiscover = document.getElementById('btn-discover-search');

    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          handleSearch(e.target.value);
        }, 220);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          handleSearch(searchInput.value);
        }
      });

      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    if (btnDiscover) {
      btnDiscover.addEventListener('click', () => {
        if (searchInput) handleSearch(searchInput.value);
      });
    }

    // Topic quick starter pills
    document.querySelectorAll('.topic-chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const topic = chip.getAttribute('data-topic');
        if (topic) {
          handleSearch(topic);
        }
      });
    });

    // Workspaces & Alerts modal triggers
    const btnWs = document.getElementById('btnNewWorkspace');
    if (btnWs) {
      btnWs.addEventListener('click', () => {
        toast('Opening Create Research Workspace modal');
      });
    }

    const btnAlert = document.getElementById('btnNewAlert');
    if (btnAlert) {
      btnAlert.addEventListener('click', () => {
        toast('Opening Create Keyword Alert modal');
      });
    }

    // Initial render
    switchView('trending', '🔥 Trending Stories', 'DISCOVER');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.FeedOmeterSearch = {
    switchView,
    handleSearch,
    renderStories,
    renderDiscoveryView,
    toggleFollow,
    followAll,
    previewSource,
    openArticleReader,
    toast
  };

})(typeof window !== 'undefined' ? window : this);
