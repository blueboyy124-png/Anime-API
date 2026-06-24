# Changelog

## v2.0.1
### Streaming Improvements — Better subtitle extraction, quality fallback

#### Streaming Enhancements
- Improved `extractSubtitles` — now handles multiple provider formats (bonk: file/label/kind/language, others: url/name/lang)
- Updated `getBestStream` — falls back to first active HLS stream when quality metadata is missing
- Updated `getDownloadUrl` — now returns subtitles and bestStream in response
- Added subtitle fields: url, label, language, kind, format, encoding, isDefault

#### Provider Improvements
- Bonk provider confirmed to return subtitles (English, VTT format, captions kind)
- Better handling of providers without quality metadata (bonk, ally, bee return undefined quality)

#### Verified
- Subtitle extraction working: bonk provider returns 1 English subtitle per episode
- Download URL working: bonk provider returns direct download link
- Batch sources: subtitles included in batch responses

---

## v2.0.0
### Major Release — 35 endpoints, streaming improvements, new features

#### Technical Foundation
- Added gzip compression middleware (30-70% response size reduction)
- Added request logging with method, path, status, duration, IP
- Added Cache-Control headers for API responses (varies by endpoint type)
- Improved CORS with preflight caching (24h max-age)
- Health endpoint now includes memory stats (heap, RSS), cache size, node version

#### New AniList Helpers (11 new functions)
- getAllGenres — complete genre list from AniList
- getAllTags — complete tag list with metadata
- getTopAnime — top-rated anime of all time (SCORE_DESC)
- getTrendingDaily — trending anime (last 7 days)
- getTrendingWeekly — trending anime (last 30 days)
- getSeasonalAnime — anime by year + season (e.g., 2025/Spring)
- getAnimeByStudio — anime produced by a specific studio
- getCharacterInfo — character detail with anime list
- getStaffInfo — staff detail with anime list
- searchCharacters — search characters by name
- searchStaff — search staff by name

#### New Streaming & Download Features
- extractSubtitles — extract subtitle URLs from sources
- getBestStream — automatic quality fallback (1080p → 720p → 360p)
- getDownloadUrl — dedicated download URL endpoint
- getBatchSources — fetch multiple episode sources in parallel

#### New API Endpoints (17 new)
- GET /api/trending/daily — daily trending anime
- GET /api/trending/weekly — weekly trending anime
- GET /api/top — top anime by score
- GET /api/random — random anime of the day
- GET /api/multi-search — combined query + filters
- GET /api/season/:year/:season — seasonal anime
- GET /api/studio/:name — anime by studio
- GET /api/genres — all genres list
- GET /api/tags — all tags list
- GET /api/genre/:name — anime by genre
- GET /api/year/:year — anime by year
- GET /api/status/:status — anime by status
- GET /api/format/:format — anime by format
- GET /api/character/:id — character detail
- GET /api/staff/:id — staff detail
- GET /api/characters — search characters
- GET /api/staff — search staff
- GET /api/episodes/:id/batch — batch episode sources
- GET /api/stream — streaming with quality fallback
- GET /api/download — download URL
- GET /api/compare/:id1/:id2 — compare two anime
- GET /api/stats/genre — genre statistics
- GET /api/calendar — monthly airing calendar
- GET /api/timeline/:id — anime release timeline

#### Streaming Improvements
- Subtitle URL extraction from pipe responses
- Quality fallback: tries 1080p → 720p → 480p → 360p automatically
- Batch episode fetching (up to 5 parallel requests)
- Dedicated download endpoint with provider metadata
- Cache headers: episodes/sources (2min), info (5min), genres/tags (24h)

#### Version synced to 2.0.0 across all files

## v1.4.0
- Added creator attribution middleware — injects author info into every response
- Fixed Vercel deployment: replaced legacy `builds`/`routes` config with modern `functions` config
- Added `api/index.js` serverless entry point
- Security headers: removed deprecated `X-XSS-Protection`, added `Strict-Transport-Security` (HSTS)
- Rate limiter: uses `x-forwarded-for` header for correct IP detection on Vercel
- Rate limiter: added periodic IP entry pruning when >200 IPs tracked
- Cache: added periodic expired entry cleanup when cache reaches 80% capacity
- Version synced to 1.4.0

## v1.3.0
- Full landing page upgrade to match AniKotoAPI style
- Added canvas particle effects with cyan-colored floating particles
- Added scroll-reveal animations (IntersectionObserver)
- Added animated stat counters that count up on scroll
- Added infinite scrolling marquee with 8 feature badges
- Added live interactive API console with 5 preset endpoint buttons
- Added sidebar endpoint explorer with 16 endpoints and multi-language code tabs
- Added 4 interactive playground cards (Search, Info, Episodes, Trending)
- Added custom scrollbar styling
- Added JetBrains Mono font for code blocks
- Added 4-column grid footer
- Added fixed header with scroll-aware blur/glass effect
- Added ambient orb gradient animations
- Added CTA section with gradient overlay
- Color scheme updated to match MiruroAPI brand (cyan #38bdf8 + indigo #818cf8)
- All branding updated: AniKotoAPI references → MiruroAPI
- OG/Twitter meta tags updated for mirurotvapi.vercel.app
- JSON-LD structured data updated
- Real Miruro SVG favicons used in header and footer

## v1.2.0
- Fixed critical response format bug: all endpoints now return {success: true, results: data}
- Root cause: createApiRoutes() had (app, jsonResponse, jsonError) but was called with (jsonResponse, jsonError), shifting all params
- Every jsonResponse() call was actually calling jsonError(), returning {success: false, message: data}
- Health endpoint worked because it used res.json() directly, bypassing the wrapper
- All 18 endpoints verified working

## v1.1.0
- Added Swagger UI interactive docs at /docs
- Added OpenAPI 3.0 spec at /openapi.json
- Added mappings field in episodes response
- Added Docker support (Dockerfile + .dockerignore)
- Improved landing page with premium design
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
