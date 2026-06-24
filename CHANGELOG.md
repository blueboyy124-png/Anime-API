# Changelog

## v1.4.0
- Fixed Vercel deployment: replaced legacy `builds`/`routes` config with modern `functions` config
- Added `api/index.js` serverless entry point (Vercel requires this for proper function detection)
- Security headers: removed deprecated `X-XSS-Protection`, added `Strict-Transport-Security` (HSTS)
- Rate limiter: uses `x-forwarded-for` header for correct IP detection on Vercel serverless
- Rate limiter: added periodic IP entry pruning when >200 IPs tracked (prevents memory leak)
- Cache: added periodic expired entry cleanup when cache reaches 80% capacity (prevents memory leak)
- Version synced to 1.4.0 across all files (server.js, package.json, health endpoint, OpenAPI spec)

## v1.3.0
- Full landing page upgrade to match AniKotoAPI style
- Added canvas particle effects with cyan-colored floating particles
- Added scroll-reveal animations (IntersectionObserver)
- Added animated stat counters that count up on scroll
- Added infinite scrolling marquee with 8 feature badges
- Added live interactive API console with 5 preset endpoint buttons
- Added sidebar endpoint explorer with 16 endpoints and multi-language code tabs (cURL, JavaScript, Python)
- Added 4 interactive playground cards (Search, Info, Episodes, Trending)
- Added custom scrollbar styling
- Added JetBrains Mono font for code blocks
- Added 4-column grid footer with API, Resources, Legal sections
- Added fixed header with scroll-aware blur/glass effect
- Added ambient orb gradient animations
- Added CTA section with gradient overlay
- Color scheme updated to match MiruroAPI brand (cyan #38bdf8 + indigo #818cf8)
- All branding updated: AniKotoAPI references → MiruroAPI
- OG/Twitter meta tags updated for mirurotvapi.vercel.app
- JSON-LD structured data updated with image, category, programmingModel
- Real Miruro SVG favicons used in header and footer

## v1.2.0
- Fixed critical response format bug: all endpoints now return {success: true, results: data}
- Root cause: createApiRoutes() had (app, jsonResponse, jsonError) but was called with (jsonResponse, jsonError), shifting all params
- Every jsonResponse() call was actually calling jsonError(), returning {success: false, message: data}
- Health endpoint worked because it used res.json() directly, bypassing the wrapper
- All 18 endpoints verified working: health, stats, search, suggestions, filter, trending, popular, upcoming, recent, spotlight, schedule, info, characters, relations, recommendations, episodes, watch

## v1.1.0
- Added Swagger UI interactive docs at /docs
- Added OpenAPI 3.0 spec at /openapi.json
- Added mappings field in episodes response (anilistId, malId, kitsuId)
- Added Docker support (Dockerfile + .dockerignore)
- Improved landing page with premium design (Walter-style)
- Added "Try it" buttons on all endpoints
- Health endpoint now includes version, providers list, and endpoint count
- Version bump to 1.1.0

## v1.0.0
- Initial release
- AniList GraphQL integration for anime metadata
- Miruro pipe integration for streaming sources
- 16 API endpoints: search, suggestions, trending, popular, upcoming, recent, spotlight, schedule, filter, info, characters, relations, recommendations, episodes, sources, watch
- In-memory caching with TTL
- CORS support
- Health endpoint
- Deployed on Vercel
