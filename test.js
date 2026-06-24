/*
 * ======= • ======= • ======= • ======= • =======• =======
 * MiruroAPI — test.js
 * Repository: https://github.com/Shineii86/MiruroAPI
 *
 * @description
 *   Integration test suite for MiruroAPI v2.0.1 endpoints.
 *   Tests all 35 endpoints for correct response format.
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const BASE = process.env.API_URL || "https://mirurotvapi.vercel.app/api";

const tests = [
  // System
  { name: "Health", url: "/health" },
  { name: "Stats", url: "/stats" },
  { name: "OpenAPI", url: "/openapi" },

  // Search & Discovery
  { name: "Search", url: "/search?query=naruto" },
  { name: "Suggestions", url: "/suggestions?query=naruto" },
  { name: "Filter", url: "/filter?genre=Action&per_page=1" },
  { name: "Multi-Search", url: "/multi-search?q=naruto&genre=Action" },

  // Collections
  { name: "Trending", url: "/trending?per_page=1" },
  { name: "Trending Daily", url: "/trending/daily" },
  { name: "Trending Weekly", url: "/trending/weekly" },
  { name: "Popular", url: "/popular?per_page=1" },
  { name: "Top", url: "/top?per_page=1" },
  { name: "Upcoming", url: "/upcoming?per_page=1" },
  { name: "Recent", url: "/recent?per_page=1" },
  { name: "Spotlight", url: "/spotlight" },
  { name: "Schedule", url: "/schedule" },
  { name: "Random", url: "/random" },
  { name: "Upcoming Countdown", url: "/upcoming/countdown" },

  // Seasonal & Studio
  { name: "Seasonal", url: "/season/2025/spring" },
  { name: "Studio", url: "/studio/MAPPA" },

  // Genres & Tags
  { name: "Genres", url: "/genres" },
  { name: "Tags", url: "/tags" },
  { name: "Genre", url: "/genre/Action" },
  { name: "Year", url: "/year/2024" },
  { name: "Status", url: "/status/RELEASING" },
  { name: "Format", url: "/format/MOVIE" },

  // Character & Staff
  { name: "Character", url: "/character/1" },
  { name: "Staff", url: "/staff/1" },
  { name: "Characters Search", url: "/characters?query=kaneki" },
  { name: "Staff Search", url: "/staff?query=oda" },

  // Anime Details
  { name: "Info", url: "/info/20" },
  { name: "Anime Characters", url: "/anime/20/characters" },
  { name: "Relations", url: "/anime/20/relations" },
  { name: "Recommendations", url: "/anime/20/recommendations" },

  // Streaming
  { name: "Episodes", url: "/episodes/20" },
  { name: "Batch Episodes", url: "/episodes/20/batch?provider=kiwi&category=sub&slugs=animepahe-1,animepahe-2" },
  { name: "Stream", url: "/stream?provider=kiwi&anilistId=20&category=sub&slug=animepahe-1" },
  { name: "Download", url: "/download?provider=kiwi&anilistId=20&category=sub&slug=animepahe-1" },
  { name: "Watch", url: "/watch/kiwi/20/sub/animepahe-1" },

  // Utility
  { name: "Compare", url: "/compare/20/21" },
  { name: "Genre Stats", url: "/stats/genre" },
  { name: "Calendar", url: "/calendar" },
  { name: "Timeline", url: "/timeline/20" },
];

let passed = 0;
let failed = 0;

async function runTest(test) {
  try {
    const res = await fetch(`${BASE}${test.url}`);
    if (!res.ok) {
      console.log(`❌ ${test.name} - HTTP ${res.status}`);
      failed++;
      return;
    }
    const data = await res.json();
    if (data.success === true && data.results) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - Invalid response format`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - ${error.message}`);
    failed++;
  }
}

async function runAll() {
  console.log(`\n🧪 MiruroAPI v2.0.1 — Running ${tests.length} tests...\n`);

  for (const test of tests) {
    await runTest(test);
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
