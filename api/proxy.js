const axios = require("axios");

const PROXY_KEY = Buffer.from("a54d389c18527d9fd3e7f0643e27edbe", "hex");
const PRU_BASE = "https://pru.ultracloud.cc/";

function base64urlXor(str) {
  const buf = Buffer.from(str, "utf-8");
  const xored = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    xored[i] = buf[i] ^ PROXY_KEY[i % PROXY_KEY.length];
  }
  return xored.toString("base64url");
}

function decodePruUrl(pruUrl) {
  try {
    const path = new URL(pruUrl).pathname.replace(/^\//, "").replace(/\/pl\.m3u8$/, "").replace(/\/seg\.jpg$/, "");
    const tildeIdx = path.indexOf("~");
    if (tildeIdx === -1) return null;
    const urlPart = path.substring(0, tildeIdx);
    const refPart = path.substring(tildeIdx + 1);
    const urlBuf = Buffer.from(urlPart, "base64url");
    const url = Buffer.from(Array.from(urlBuf).map((b, i) => b ^ PROXY_KEY[i % PROXY_KEY.length])).toString("utf-8");
    const refBuf = Buffer.from(refPart, "base64url");
    const referer = Buffer.from(Array.from(refBuf).map((b, i) => b ^ PROXY_KEY[i % PROXY_KEY.length])).toString("utf-8");
    return { url, referer };
  } catch {
    return null;
  }
}

function encodeForPru(rawUrl, referer) {
  const urlEnc = base64urlXor(rawUrl);
  const refEnc = base64urlXor(referer || new URL(rawUrl).origin + "/");
  return `${PRU_BASE}${urlEnc}~${refEnc}/pl.m3u8`;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Referer");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { url, referer } = req.query;
  if (!url) return res.status(400).json({ success: false, message: "url query parameter is required" });

  try {
    const decoded = decodePruUrl(url);
    const isPru = !!decoded;
    const targetUrl = decoded ? decoded.url : url;
    const targetReferer = decoded ? decoded.referer : (referer || "https://www.miruro.tv/");

    let fetchUrl;
    let fetchHeaders;

    if (isPru) {
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

    const response = await axios.get(fetchUrl, {
      headers: fetchHeaders,
      timeout: 15000,
      responseType: "arraybuffer",
      validateStatus: (s) => s < 500,
    });

    const contentType = response.headers["content-type"] || "";
    res.setHeader("Cache-Control", "public, max-age=300");

    if (isPru && (contentType.includes("mpegurl") || targetUrl.endsWith(".m3u8") || contentType.includes("x-mpegURL"))) {
      let m3u8 = Buffer.from(response.data).toString("utf-8");

      m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm, (match) => {
        if (match.includes("pru.ultracloud.cc")) {
          const dec = decodePruUrl(match);
          if (dec) return `/api/proxy?url=${encodeURIComponent(dec.url)}&referer=${encodeURIComponent(dec.referer)}`;
        }
        return `/api/proxy?url=${encodeURIComponent(match)}&referer=${encodeURIComponent(targetReferer)}`;
      });

      m3u8 = m3u8.replace(/^([^\s#<][^\s]*\.(m3u8|ts|m4s|m4v|mp4|cmfv|cmfa|vtt|srt|ass|json|aac|mp3))(?:\?[^\s]*)?$/gm, (match) => {
        try {
          const absolute = new URL(match, new URL(targetUrl)).href;
          return `/api/proxy?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(targetReferer)}`;
        } catch {
          return match;
        }
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(m3u8);
    }

    res.setHeader("Content-Type", contentType);
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }
    res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(500).json({ success: false, message: "Proxy failed: " + err.message });
  }
};
