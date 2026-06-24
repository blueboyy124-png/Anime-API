/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — server.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Main entry point for the MiruroAPI Express server.
 *   Configures CORS, middleware, static files, Swagger docs,
 *   API routes, and 404 handling. Starts the server on the
 *   configured port.
 *
 * @exports
 *   None (side-effect: starts Express server)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// ══════════════════════════════════════════════════════════════
// SERVER CONFIGURATION
// ══════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : null;

// ══════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ══════════════════════════════════════════════════════════════

// NOTE: Single unified CORS middleware — handles all origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    !allowedOrigins ||
    allowedOrigins.includes("*") ||
    (origin && allowedOrigins.includes(origin))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ---- FEATURE: Security headers ----
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ══════════════════════════════════════════════════════════════
// STATIC FILES
// ══════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, "public"), { redirect: false }));

// ══════════════════════════════════════════════════════════════
// CLEAN URL ROUTES
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Clean URL routes (no .html extension) ----
const fs = require("fs");
const publicDir = path.join(__dirname, "public");

app.get("/tos", (req, res) => {
  res.sendFile(path.join(publicDir, "tos.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(publicDir, "privacy.html"));
});

// ══════════════════════════════════════════════════════════════
// SWAGGER UI DOCS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Interactive Swagger UI documentation at /docs ----
app.get("/docs", (req, res) => {
  res.sendFile(path.join(publicDir, "docs.html"));
});

// ══════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Standardized JSON response wrapper ----
/**
 * Wraps data in a standardized success JSON response.
 *
 * @param {object} res - Express response object
 * @param {*} data - The data to return in the response
 * @param {number} status - HTTP status code (default: 200)
 */
const jsonResponse = (res, data, status = 200) =>
  res.status(status).json({ success: true, results: data });

// ---- FEATURE: Standardized error response wrapper ----
/**
 * Returns a standardized error JSON response.
 *
 * @param {object} res - Express response object
 * @param {string} message - Error message to return
 * @param {number} status - HTTP status code (default: 500)
 */
const jsonError = (res, message = "Internal server error", status = 500) =>
  res.status(status).json({ success: false, message });

// ══════════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Rate limiting (100 requests per minute per IP) ----
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 100;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter((t) => now - t < windowMs);
  requestCounts.set(ip, timestamps);

  if (timestamps.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Try again later.",
    });
  }

  timestamps.push(now);

  // NOTE: Periodic cleanup — prune expired IP entries every 60s to prevent memory leak
  if (requestCounts.size > 200) {
    for (const [key, val] of requestCounts) {
      if (val.filter((t) => now - t < windowMs).length === 0) {
        requestCounts.delete(key);
      }
    }
  }

  next();
});

// ══════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════

const apiRoutes = require("./src/routes/apiRoutes");
app.use("/api", apiRoutes(jsonResponse, jsonError));

// ══════════════════════════════════════════════════════════════
// 404 HANDLER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Global error handler ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ---- FEATURE: Catch-all 404 handler for undefined routes ----
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "Endpoint not found",
    });
  }
  const notFoundPath = path.join(publicDir, "404.html");
  if (fs.existsSync(notFoundPath)) {
    return res.status(404).sendFile(notFoundPath);
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

// ══════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.info(`MiruroAPI listening at ${PORT}`);
});

module.exports = app;

// ══════════════════════════════════════════════════════════════ END: server.js
