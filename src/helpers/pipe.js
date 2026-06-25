/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — pipe.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Miruro streaming pipe integration. Handles encoding/decoding
 *   of the secure/pipe tunnel that Miruro uses for episode lists
 *   and streaming sources. Decodes base64+gzip responses and
 *   injects simplified slug-based episode IDs.
 *
 * @exports
 *   getEpisodes, getSources, getWatchSources
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const axios = require("axios");
const { Buffer } = require("buffer");
const zlib = require("zlib");

// ══════════════════════════════════════════════════════════════
// MIRURO PIPE CONFIGURATION
// ══════════════════════════════════════════════════════════════

/**
 * Miruro's secure pipe endpoint URL.
 * All streaming requests go through this base64+gzip encoded tunnel.
 *
 * @type {string}
 */
const MIRURO_PIPE_URL = "https://www.miruro.tv/api/secure/pipe";

/**
 * Request headers mimicking a browser.
 * Referer is required for the pipe endpoint to accept requests.
 *
 * @type {object}
 */
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Referer: "https://www.miruro.tv/",
  Origin: "https://www.miruro.tv",
};

// ══════════════════════════════════════════════════════════════
// ENCODING / DECODING UTILITIES
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Base64url encode pipe request payload ----
/**
 * Encodes a JSON payload into the base64url format expected by the pipe endpoint.
 * Used for all pipe API requests (episodes, sources).
 *
 * @param {object} payload - The request payload to encode
 * @returns {string} Base64url-encoded string (no padding)
 *
 * @example
 *   const encoded = encodePipeRequest({ path: "episodes", method: "GET", query: { anilistId: 20 } });
 */
const encodePipeRequest = (payload) => {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString("base64url");
};

// ---- FEATURE: Decode base64+gzip pipe response ----
/**
 * Decodes a pipe response from base64url + XOR obfuscation + gzip format.
 * The Miruro pipe returns all responses XORed with PIPE_OBF_KEY then gzipped.
 *
 * @type {Buffer}
 */
const PIPE_OBF_KEY = Buffer.from("71951034f8fbcf53d89db52ceb3dc22c", "hex");

/**
 * @param {string} encodedStr - The base64url-encoded response
 * @returns {object} Decoded JSON object
 * @throws {Error} If decoding or decompression fails
 */
const decodePipeResponse = (encodedStr) => {
  try {
    const padded = encodedStr + "=".repeat((4 - (encodedStr.length % 4)) % 4);
    const raw = Buffer.from(padded, "base64url");
    // NOTE: XOR decode with obfuscation key before gzip decompression
    const xored = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) {
      xored[i] = raw[i] ^ PIPE_OBF_KEY[i % PIPE_OBF_KEY.length];
    }
    const decompressed = zlib.gunzipSync(xored);
    return JSON.parse(decompressed.toString("utf-8"));
  } catch (e) {
    throw new Error("Failed to decode pipe response: " + e.message);
  }
};

// ---- FEATURE: Subtitle proxy for CORS-safe browser access ----
/**
 * CDN streams (mt.nekostream.site) have CORS * — browsers load them directly.
 * Subtitles use third-party CDNs that may block cross-origin — proxy those.
 *
 * @type {string}
 */
const PROXY_BASE = "/api/proxy?url=";

/**
 * Proxies a URL through /api/proxy for CORS bypass.
 *
 * @param {string} url - Raw URL
 * @param {string} [referer] - Optional referer to pass
 * @returns {string} Proxied URL
 */
const proxyUrl = (url, referer) => {
  if (!url || !url.startsWith("http")) return url;
  try {
    const ref = referer ? "&referer=" + encodeURIComponent(referer) : "";
    return PROXY_BASE + encodeURIComponent(url) + ref;
  } catch {
    return url;
  }
};

/**
 * Streams are returned as-is (raw CDN URLs).
 * The browser loads them directly — CDN has CORS * and serves real content to residential IPs.
 * Server-side requests get decoy PNG images, so proxying through /api/proxy defeats the purpose.
 *
 * @param {object} sources - Decoded sources with streams array
 * @returns {object} Sources with raw stream URLs
 */
const proxyStreams = (sources) => {
  // NOTE: Intentionally return raw CDN URLs — the CDN serves real video to browsers
  // but decoy PNG images to server-side requests. The browser's residential IP is required.
  return sources;
};

/**
 * Proxies subtitle URLs through /api/proxy for CORS bypass.
 * Subtitles come from third-party CDNs that may not have CORS headers.
 *
 * @param {object} sources - Decoded sources with subtitles array
 * @returns {object} Sources with proxied subtitle URLs
 */
const proxySubtitles = (sources) => {
  if (!sources?.subtitles) return sources;
  sources.subtitles = sources.subtitles.map((s) => {
    const raw = s.url || s.file;
    if (!raw || !raw.startsWith("http")) return s;
    const proxied = proxyUrl(raw, "https://www.miruro.tv/");
    return { ...s, url: proxied, file: proxied };
  });
  return sources;
};

// ---- FEATURE: Decode base64 episode ID to plain text ----
/**
 * Decodes a base64-encoded episode ID back to plain text.
 * Episode IDs from the pipe are base64-encoded with ":" separators.
 *
 * @param {string} encodedId - The base64url-encoded episode ID
 * @returns {string} Decoded plain text ID, or original if decoding fails
 *
 * @example
 *   const decoded = translateId("YW5pbWVwaGU6MjA6c3ViOjE=");
 *   // returns "animepahe:20:sub:1"
 */
const translateId = (encodedId) => {
  try {
    const padded = encodedId + "=".repeat((4 - (encodedId.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64url").toString("utf-8");
    // NOTE: Only return decoded value if it looks like a valid ID (contains ":")
    if (decoded.includes(":")) return decoded;
    return encodedId;
  } catch {
    return encodedId;
  }
};

// ---- FEATURE: Recursively decode all base64 IDs in a nested object ----
/**
 * Walks a JSON structure and decodes any base64 "id" fields.
 * Saves the original base64 value in a `rawPipeId` field on episode objects
 * so the pipe sources endpoint can be called directly from the client.
 *
 * @param {object|Array} obj - The object or process
 * @returns {object|Array} The same object with decoded IDs (mutated in place)
 */
const deepTranslate = (obj) => {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key === "id" && typeof obj[key] === "string") {
        // NOTE: Save original base64 before decoding (needed for pipe sources call)
        if (obj.number !== undefined) {
          obj.rawPipeId = obj[key];
        }
        obj[key] = translateId(obj[key]);
      } else if (typeof obj[key] === "object") {
        deepTranslate(obj[key]);
      }
    }
  }
  return obj;
};

// ══════════════════════════════════════════════════════════════
// EPISODE ID INJECTION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Transform episode IDs into simplified path-based slugs ----
/**
 * Converts raw pipe episode IDs into clean slug format:
 *   watch/{provider}/{anilistId}/{category}/{prefix}-{number}
 *
 * This makes episode IDs human-readable and URL-safe for the /watch endpoint.
 *
 * @param {object} data - Raw pipe response with providers
 * @param {number} anilistId - The AniList anime ID
 * @returns {object} Modified data with slug-based episode IDs
 *
 * @example
 *   // Before: "animepahe:20:sub:1"
 *   // After:  "watch/kiwi/20/sub/animepahe-1"
 */
const injectSourceSlugs = (data, anilistId) => {
  const providers = data.providers || {};

  for (const [provName, provData] of Object.entries(providers)) {
    if (!provData || typeof provData !== "object") continue;

    let episodes = provData.episodes;
    if (!episodes) continue;

    // NOTE: Some providers return a flat array — wrap it in { sub: [...] }
    if (Array.isArray(episodes)) {
      provData.episodes = { sub: episodes };
      episodes = provData.episodes;
    }

    for (const [category, epList] of Object.entries(episodes)) {
      if (!Array.isArray(epList)) continue;

      for (const ep of epList) {
        if (ep.id && ep.number) {
          // NOTE: rawPipeId is already set by deepTranslate — preserve original base64
          // Take only the prefix before ":" for the slug
          const prefix = ep.id.includes(":") ? ep.id.split(":")[0] : ep.id;
          ep.id = `watch/${provName}/${anilistId}/${category}/${prefix}-${ep.number}`;
        }
      }
    }
  }

  return data;
};

// ══════════════════════════════════════════════════════════════
// PIPE API FUNCTIONS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Fetch raw decoded episode data from Miruro pipe ----
/**
 * Internal helper to fetch and decode raw episode data from the pipe.
 * Sends a base64-encoded request and decodes the gzipped response.
 *
 * @param {number} anilistId - The AniList anime ID
 * @returns {Promise<object>} Decoded episode data with providers
 * @throws {Error} If the pipe request fails
 */
const fetchRawEpisodes = async (anilistId) => {
  const payload = {
    path: "episodes",
    method: "GET",
    query: { anilistId },
    body: null,
    version: "0.2.0",
  };

  const encodedReq = encodePipeRequest(payload);
  const res = await axios.get(`${MIRURO_PIPE_URL}?e=${encodedReq}`, {
    headers: HEADERS,
    timeout: 15000,
  });

  if (res.status !== 200) throw new Error(`Pipe request failed: ${res.status}`);
  const data = decodePipeResponse(res.text || res.data);
  return deepTranslate(data);
};

// ---- FEATURE: Get episodes with slug-based IDs ----
/**
 * Fetches the full episode list for an anime from all providers.
 * Returns episodes with simplified slug-based IDs for the /watch endpoint.
 *
 * @param {number} anilistId - The AniList anime ID
 * @returns {Promise<object>} Episode data with providers and mappings
 *
 * @example
 *   const episodes = await getEpisodes(20); // Naruto
 *   console.log(Object.keys(episodes.providers)); // ["kiwi", "bee", "bonk", ...]
 */
const getEpisodes = async (anilistId) => {
  const data = await fetchRawEpisodes(anilistId);
  const result = injectSourceSlugs(data, anilistId);

  // NOTE: Ensure mappings field is present (like Walter's API)
  if (!result.mappings) {
    result.mappings = { anilistId };
    if (result.malId) result.mappings.malId = result.malId;
    if (result.kitsuId) result.mappings.kitsuId = result.kitsuId;
  }

  return result;
};

// ---- FEATURE: Get streaming sources (detailed endpoint) ----
/**
 * Fetches M3U8 streaming sources for a specific episode.
 * This is the detailed/manual endpoint — use /watch for simpler access.
 *
 * @param {string} episodeId - The raw episode ID from the pipe
 * @param {string} provider - Provider name (e.g., "kiwi", "bee", "bonk")
 * @param {number} anilistId - The AniList anime ID
 * @param {string} [category="sub"] - Audio category ("sub" or "dub")
 * @returns {Promise<object>} Streaming sources with M3U8 URLs, subtitles, timestamps
 *
 * @example
 *   const sources = await getSources("animepahe:20:sub:1", "kiwi", 20, "sub");
 *   console.log(sources.streams[0].url); // "https://.../master.m3u8"
 */
const getSources = async (episodeId, provider, anilistId, category = "sub") => {
  const encId = Buffer.from(episodeId).toString("base64url");
  const payload = {
    path: "sources",
    method: "GET",
    query: { episodeId: encId, provider, category, anilistId },
    body: null,
    version: "0.2.0",
  };

  const encodedReq = encodePipeRequest(payload);
  const res = await axios.get(`${MIRURO_PIPE_URL}?e=${encodedReq}`, {
    headers: HEADERS,
    timeout: 15000,
  });

  if (res.status !== 200) throw new Error(`Pipe sources request failed: ${res.status}`);
  const sources = deepTranslate(decodePipeResponse(res.text || res.data));
  return proxySubtitles(proxyStreams(sources));
};

// ---- FEATURE: Get streaming sources (simple slug-based endpoint) ----
/**
 * Resolves a slug-based episode ID and fetches its streaming sources.
 * This is the recommended endpoint — just pass the slug from /episodes.
 *
 * @param {string} provider - Provider name (e.g., "kiwi", "bee")
 * @param {number} anilistId - The AniList anime ID
 * @param {string} category - Audio category ("sub" or "dub")
 * @param {string} slug - Episode slug (e.g., "animepahe-1")
 * @returns {Promise<object>} Streaming sources with M3U8 URLs, subtitles, timestamps
 * @throws {Error} If provider or episode slug is not found
 *
 * @example
 *   const sources = await getWatchSources("kiwi", 20, "sub", "animepahe-1");
 *   console.log(sources.streams[0].url); // "https://.../master.m3u8"
 */
const getWatchSources = async (provider, anilistId, category, slug) => {
  const data = await fetchRawEpisodes(anilistId);
  const provData = (data.providers || {})[provider];

  if (!provData) throw new Error(`Provider ${provider} not found`);

  const episodes = provData.episodes?.[category] || [];
  let targetId = null;

  // NOTE: fetchRawEpisodes returns raw pipe IDs (e.g. "animedao:cowboy-bebop:1")
  // Build the slug from the prefix and episode number to match against the URL slug
  for (const ep of episodes) {
    const origId = ep.id || "";
    const prefix = origId.includes(":") ? origId.split(":")[0] : origId;
    const generated = `${prefix}-${ep.number}`;

    if (generated === slug) {
      targetId = ep.id; // getSources expects decoded ID, it will base64url-encode
      break;
    }
  }

  if (!targetId) throw new Error(`Episode slug '${slug}' not found for provider ${provider}`);
  return getSources(targetId, provider, anilistId, category);
};

// ══════════════════════════════════════════════════════════════
// SUBTITLE EXTRACTION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Extract subtitle URLs from streaming sources ----
/**
 * Extracts and formats subtitle URLs from the pipe sources response.
 * Handles multiple subtitle formats from different providers.
 *
 * Provider formats:
 *   bonk: { file, label, kind, default, language, format, encoding }
 *   others: { url, name, lang, format }
 *
 * @param {object} sources - The sources response from getSources/getWatchSources
 * @returns {Array} Array of subtitle objects { url, label, language, kind, format, isDefault }
 */
const extractSubtitles = (sources) => {
  const raw = sources.subtitles || sources.captions || [];

  if (!Array.isArray(raw)) return [];

  return raw.map((sub) => ({
    url: sub.url || sub.file || null,
    label: sub.label || sub.name || sub.language || "Unknown",
    language: sub.language || sub.lang || sub.label || "en",
    kind: sub.kind || "subtitles",
    format: sub.format || "vtt",
    encoding: sub.encoding || "utf-8",
    isDefault: sub.default || false,
  })).filter((sub) => sub.url);
};

// ---- FEATURE: Extract skip timestamps (OP/ED) from sources ----
/**
 * Extracts skip timestamps (OP/ED) from the pipe sources response.
 * Only available for providers with skip_times capability (e.g., bonk).
 *
 * @param {object} sources - The sources response from getSources/getWatchSources
 * @returns {object|null} Skip timestamps object or null
 */
const extractSkipTimes = (sources) => {
  const skipTimes = sources.skipTimes || sources.skip || null;
  if (!skipTimes || typeof skipTimes !== "object") return null;

  return {
    intro: skipTimes.intro || skipTimes.op || null,
    outro: skipTimes.outro || skipTimes.ed || null,
    preview: skipTimes.preview || null,
  };
};

// ══════════════════════════════════════════════════════════════
// QUALITY FALLBACK
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Get best available stream with quality fallback ----
/**
 * Returns the best available HLS stream with automatic quality fallback.
 * Tries 1080p → 720p → 480p → 360p in order.
 * Falls back to first HLS stream if no quality match.
 *
 * @param {object} sources - The sources response
 * @param {string} [preferredQuality="1080p"] - Preferred quality
 * @returns {object|null} Best available stream object or null
 */
const getBestStream = (sources, preferredQuality = "1080p") => {
  const streams = (sources.streams || []).filter((s) => s.type === "hls" && s.url);
  if (streams.length === 0) return null;

  // NOTE: Try preferred quality first, then fallback
  const qualityOrder = ["1080p", "720p", "480p", "360p"];
  const startIdx = qualityOrder.indexOf(preferredQuality);
  const ordered = startIdx >= 0
    ? qualityOrder.slice(startIdx)
    : qualityOrder;

  for (const q of ordered) {
    const match = streams.find((s) => s.quality === q);
    if (match) return match;
  }

  // NOTE: Some providers don't include quality — return first active HLS stream, or first HLS stream
  const active = streams.find((s) => s.isActive);
  if (active) return active;

  return streams[0];
};

// ══════════════════════════════════════════════════════════════
// DOWNLOAD URL
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Get download URL for an episode ----
/**
 * Fetches the download URL for a specific episode from the pipe.
 * Returns the direct download link, subtitles, and best stream if available.
 *
 * @param {string} provider - Provider name
 * @param {number} anilistId - The AniList anime ID
 * @param {string} category - Audio category ("sub" or "dub")
 * @param {string} slug - Episode slug (e.g., "animepahe-1")
 * @returns {Promise<object>} Object with download URL, subtitles, best stream, and metadata
 */
const getDownloadUrl = async (provider, anilistId, category, slug) => {
  const sources = await getWatchSources(provider, anilistId, category, slug);
  const subtitles = extractSubtitles(sources);
  const bestStream = getBestStream(sources);

  return {
    download: sources.download || null,
    subtitles,
    bestStream,
    provider,
    anilistId,
    category,
    slug,
    hasDownload: !!sources.download,
    hasSubtitles: subtitles.length > 0,
  };
};

// ══════════════════════════════════════════════════════════════
// BATCH EPISODES
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Get sources for multiple episodes at once ----
/**
 * Fetches streaming sources for multiple episodes in parallel.
 * Useful for preloading next episodes or batch downloading.
 *
 * @param {string} provider - Provider name
 * @param {number} anilistId - The AniList anime ID
 * @param {string} category - Audio category ("sub" or "dub")
 * @param {string[]} slugs - Array of episode slugs (e.g., ["animepahe-1", "animepahe-2"])
 * @returns {Promise<object>} Object mapping slug → sources (with errors for failed ones)
 */
const getBatchSources = async (provider, anilistId, category, slugs) => {
  const results = {};

  const fetchOne = async (slug) => {
    try {
      const sources = await getWatchSources(provider, anilistId, category, slug);
      const best = getBestStream(sources);
      const subtitles = extractSubtitles(sources);
      results[slug] = {
        success: true,
        streams: sources.streams,
        bestStream: best,
        subtitles,
        download: sources.download || null,
      };
    } catch (err) {
      results[slug] = {
        success: false,
        error: err.message,
      };
    }
  };

  // NOTE: Fetch up to 5 episodes in parallel to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    await Promise.all(batch.map(fetchOne));
  }

  return {
    provider,
    anilistId,
    category,
    total: slugs.length,
    successful: Object.values(results).filter((r) => r.success).length,
    failed: Object.values(results).filter((r) => !r.success).length,
    episodes: results,
  };
};

module.exports = {
  getEpisodes,
  getSources,
  getWatchSources,
  getDownloadUrl,
  getBatchSources,
  extractSubtitles,
  extractSkipTimes,
  getBestStream,
  encodePipeRequest,
  decodePipeResponse,
  translateId,
  deepTranslate,
  injectSourceSlugs,
};

// ══════════════════════════════════════════════════════════════ END: pipe.js
