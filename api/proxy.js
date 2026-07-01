/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — proxy.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   CDN proxy endpoint that fetches and rewrites M3U8 playlists
 *   and media segments from third-party CDNs. Handles both
 *   pru.ultracloud.cc encoded URLs (XOR + base64url) and direct
 *   CDN URLs. Rewrites M3U8 internal URLs to route through the
 *   proxy for CORS-safe browser playback.
 *
 * @exports
 *   handler — Vercel serverless function (GET /api/proxy)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const axios = require("axios");

// ══════════════════════════════════════════════════════════════
// PROXY CONFIGURATION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: PRU XOR encryption key (16-byte hex) ----
/**
 * XOR key used to encode/decode pru.ultracloud.cc URLs.
 * Loaded from environment variable PRU_PROXY_KEY with hardcoded fallback.
 * Key length: 16 bytes (32 hex chars).
 *
 * @type {Buffer}
 */
const PROXY_KEY = Buffer.from(
  process.env.PRU_PROXY_KEY || "a54d389c18527d9fd3e7f0643e27edbe",
  "hex"
);

/**
 * Base URL for the PRU CDN proxy service.
 * All proxied M3U8 URLs are rewritten to route through this domain.
 *
 * @type {string}
 */
const PRU_BASE = "https://pru.ultracloud.cc/";

// ══════════════════════════════════════════════════════════════
// ENCODING / DECODING UTILITIES
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Base64url XOR encode for PRU URLs ----
/**
 * Encodes a raw URL into the PRU format: base64url(XOR(url, key)).
 * Used when constructing proxied URLs for the PRU CDN.
 *
 * @param {string} str - The raw URL or referer string to encode
 * @returns {string} Base64url-encoded XOR'd string
 *
 * @example
 *   const encoded = base64urlXor("https://example.com/video.m3u8");
 */
const base64urlXor = (str) => {
  const buf = Buffer.from(str, "utf-8");
  const xored = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    xored[i] = buf[i] ^ PROXY_KEY[i % PROXY_KEY.length];
  }
  return xored.toString("base64url");
};

// ---- FEATURE: Decode PRU URL back to raw URL + referer ----
/**
 * Decodes a pru.ultracloud.cc URL back to its original URL and referer.
 * PRU format: {base64url(XOR(url))}~{base64url(XOR(referer))}/pl.m3u8
 *
 * @param {string} pruUrl - The full PRU URL to decode
 * @returns {{ url: string, referer: string } | null} Decoded URL and referer, or null if invalid
 *
 * @example
 *   const decoded = decodePruUrl("https://pru.ultracloud.cc/abc~def/pl.m3u8");
 *   // { url: "https://...", referer: "https://..." }
 */
const decodePruUrl = (pruUrl) => {
  try {
    const path = new URL(pruUrl).pathname
      .replace(/^\//, "")
      .replace(/\/pl\.m3u8$/, "")
      .replace(/\/seg\.jpg$/, "");
    const tildeIdx = path.indexOf("~");
    if (tildeIdx === -1) return null;

    // NOTE: Split at ~ separator — left is encoded URL, right is encoded referer
    const urlPart = path.substring(0, tildeIdx);
    const refPart = path.substring(tildeIdx + 1);

    const urlBuf = Buffer.from(urlPart, "base64url");
    const url = Buffer.from(
      Array.from(urlBuf).map((b, i) => b ^ PROXY_KEY[i % PROXY_KEY.length])
    ).toString("utf-8");

    const refBuf = Buffer.from(refPart, "base64url");
    const referer = Buffer.from(
      Array.from(refBuf).map((b, i) => b ^ PROXY_KEY[i % PROXY_KEY.length])
    ).toString("utf-8");

    return { url, referer };
  } catch {
    return null;
  }
};

// ---- FEATURE: Encode raw URL + referer for PRU proxy ----
/**
 * Encodes a raw URL and referer into a full PRU proxy URL.
 * Output format: {PRU_BASE}{urlEnc}~{refEnc}/pl.m3u8
 *
 * @param {string} rawUrl - The original media URL
 * @param {string} referer - The referer to use when fetching
 * @returns {string} Full PRU proxy URL
 *
 * @example
 *   const pruUrl = encodeForPru("https://cdn.example.com/v.m3u8", "https://miruro.tv/");
 */
const encodeForPru = (rawUrl, referer) => {
  const urlEnc = base64urlXor(rawUrl);
  const refEnc = base64urlXor(referer || new URL(rawUrl).origin + "/");
  return `${PRU_BASE}${urlEnc}~${refEnc}/pl.m3u8`;
};

// ══════════════════════════════════════════════════════════════
// M3U8 REWRITING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Rewrite M3U8 internal URLs to route through proxy ----
/**
 * Rewrites M3U8 playlist content to proxy all internal URLs.
 * Handles both absolute (https://...) and relative URLs.
 * Skips URLs that are already proxied through pru.ultracloud.cc.
 *
 * @param {string} m3u8 - Raw M3U8 playlist content
 * @param {string} targetReferer - Referer to pass to proxy for each URL
 * @returns {string} Rewritten M3U8 content with proxied URLs
 */
const rewriteM3U8 = (m3u8, targetReferer) => {
  // NOTE: Rewrite absolute URLs (lines starting with http)
  m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm, (match) => {
    if (match.includes("pru.ultracloud.cc")) {
      const dec = decodePruUrl(match);
      if (dec) {
        return `/api/proxy?url=${encodeURIComponent(dec.url)}&referer=${encodeURIComponent(dec.referer)}`;
      }
    }
    return `/api/proxy?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(targetReferer)}`;
  });

  // NOTE: Rewrite relative URLs (lines with file extensions, no # or < prefix)
  m3u8 = m3u8.replace(
    /^([^\s#<][^\s]*\.(m3u8|ts|m4s|m4v|mp4|cmfv|cmfa|vtt|srt|ass|json|aac|mp3))(?:\?[^\s]*)?$/gm,
    (match) => {
      try {
        const absolute = new URL(match, new URL(targetReferer)).href;
        return `/api/proxy?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(targetReferer)}`;
      } catch {
        return match;
      }
    }
  );

  return m3u8;
};

// ══════════════════════════════════════════════════════════════
// PROXY HANDLER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Vercel serverless proxy handler ----
/**
 * Main proxy handler for Vercel serverless function.
 * Fetches content from a target URL and returns it to the client.
 * For M3U8 playlists, rewrites internal URLs to route through the proxy.
 * For other content (segments, subtitles), streams raw bytes.
 *
 * @param {import('http').IncomingMessage} req - Express request
 * @param {import('http').ServerResponse} res - Express response
 * @returns {Promise<void>}
 *
 * @query {string} url - The target URL to proxy (required)
 * @query {string} referer - Optional referer header for the target
 *
 * @example
 *   GET /api/proxy?url=https://example.com/video.m3u8&referer=https://miruro.tv/
 */
module.exports = async function handler(req, res) {
  // NOTE: CORS headers for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Referer");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { url, referer } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, message: "url query parameter is required" });
  }

  try {
    // NOTE: Detect PRU-encoded URLs vs direct CDN URLs
    const decoded = decodePruUrl(url);
    const isPru = !!decoded;
    const targetUrl = decoded ? decoded.url : url;
    const targetReferer = decoded ? decoded.referer : referer || "https://www.miruro.tv/";

    let fetchUrl;
    let fetchHeaders;

    if (isPru) {
      // NOTE: Re-encode for PRU proxy with proper headers
      fetchUrl = encodeForPru(targetUrl, targetReferer);
      fetchHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        Referer: "https://www.miruro.tv/",
        Origin: "https://www.miruro.tv",
      };
    } else {
      fetchUrl = targetUrl;
      fetchHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        Referer: targetReferer,
      };
    }

// ⚡ FIX: EMERGENCY BANDWIDTH SHIELD
    // If the target URL points to a heavy video chunk or asset, stop Vercel from downloading it!
    // Send a redirect instruction so the user's browser downloads it directly from the streaming source CDN.
    if (
      targetUrl.endsWith(".ts") || 
      targetUrl.includes("/segment") || 
      targetUrl.includes(".png") || 
      targetUrl.includes(".jpg") ||
      targetUrl.includes(".woff")
    ) {
      return res.redirect(302, targetUrl);
    }

    // NOTE: Fetch with arraybuffer to handle binary content (segments, fonts)
    const response = await axios.get(fetchUrl, {
      headers: fetchHeaders,
      timeout: 15000,
      responseType: "arraybuffer",
      validateStatus: (s) => s < 500,
    });

    const contentType = response.headers["content-type"] || "";
    res.setHeader("Cache-Control", "public, max-age=300");

    // NOTE: M3U8 playlists need URL rewriting — other content is streamed raw
    if (
      isPru &&
      (contentType.includes("mpegurl") ||
        targetUrl.endsWith(".m3u8") ||
        contentType.includes("x-mpegURL"))
    ) {
      let m3u8 = Buffer.from(response.data).toString("utf-8");
      m3u8 = rewriteM3U8(m3u8, targetReferer);

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(m3u8);
    }

    // NOTE: Stream raw binary content (video segments, subtitles, thumbnails)
    res.setHeader("Content-Type", contentType);
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }
    res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(500).json({ success: false, message: "Proxy failed: " + err.message });
  }
};

// ══════════════════════════════════════════════════════════════ END: proxy.js
