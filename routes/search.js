import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Cache dictionary once (for typo fallback) + search cache
let cachedDictionary = null;
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10min
const MAX_CACHE_LIMIT = 300;
const MAX_CANDIDATES = 1200; // fetch at most this many documents to score in Node

/* Utility: safe tokenizer — keeps small words but preserves important ones */
function tokenizeQuery(q) {
  if (!q) return [];
  return q
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}0-9\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* Simple morphological expansions (not full stemmer but good coverage) */
function generateVariants(token) {
  const variants = new Set([token]);
  if (token.length > 2) {
    // plural/singular heuristics
    if (token.endsWith("s")) variants.add(token.slice(0, -1));
    else variants.add(token + "s");

    if (token.endsWith("ies")) variants.add(token.slice(0, -3) + "y");
    if (token.endsWith("y")) variants.add(token.slice(0, -1) + "ies");
    if (token.endsWith("ves")) variants.add(token.slice(0, -3) + "f");
    if (token.endsWith("f")) variants.add(token.slice(0, -1) + "ves");
    if (token.endsWith("es")) variants.add(token.slice(0, -2));
  }
  return Array.from(variants);
}

/* Damerau-Levenshtein — optimized enough for small sets (bounded) */
function editDistance(a, b, maxDist = 2) {
  // early checks
  if (Math.abs(a.length - b.length) > maxDist) return 9999;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => Array(a.length + 1).fill(0));
  for (let i = 0; i <= b.length; i++) dp[i][0] = i;
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && b[i - 1] === a[j - 2] && b[i - 2] === a[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
    // early prune row if smallest > maxDist
    if (Math.min(...dp[i]) > maxDist) {
      // continue — we still finish because further rows may drop
    }
  }
  return dp[b.length][a.length];
}

/* Build a cached dictionary of words from the DB (used only for typo fallback) */
async function buildDictionary() {
  if (cachedDictionary) return cachedDictionary;
  const docs = await Image.find({}, "title tags keywords category secondaryCategory name").lean();
  const dict = new Set();
  docs.forEach(doc => {
    const fields = [doc.title, doc.name, doc.category, doc.secondaryCategory];
    if (Array.isArray(doc.tags)) fields.push(...doc.tags);
    if (Array.isArray(doc.keywords)) fields.push(...doc.keywords);
    fields.forEach(f => {
      if (!f) return;
      const words = f.toString().toLowerCase().replace(/[_\-\.\,]/g, " ").split(/\s+/).filter(Boolean);
      words.forEach(w => { if (w.length > 1) dict.add(w); });
    });
  });
  cachedDictionary = Array.from(dict);
  console.log(`Dictionary built: ${cachedDictionary.length} words`);
  return cachedDictionary;
}

/* Score function: powerful, multi-tiered scoring */
function scoreImageForQuery(img, tokens, tokenVariants, weights, nowTs) {
  // fields: title, keywords (arr or string), tags (arr), category, secondaryCategory, description, alt, name
  let score = 0;
  const textFields = {};
  for (const f of Object.keys(weights)) {
    let v = img[f];
    if (!v) { textFields[f] = ""; continue; }
    if (Array.isArray(v)) textFields[f] = v.join(" ").toLowerCase();
    else textFields[f] = v.toString().toLowerCase();
  }

  // Phrase exact boost: full query phrase appears in title or keywords
  const phrase = tokens.join(" ");
  if (phrase && (textFields.title.includes(phrase) || textFields.keywords?.includes(phrase))) {
    score += 1000;
  }

  // token-level scoring and counters
  let tokensFound = 0;
  let tokenMatches = 0;

  tokens.forEach(token => {
    const variants = tokenVariants[token] || [token];
    let matchedThisToken = false;

    for (const field of Object.keys(weights)) {
      const txt = textFields[field] || "";
      // exact word match (word boundary)
      const exactRe = new RegExp(`\\b${token}\\b`, "i");
      if (exactRe.test(txt)) {
        score += weights[field] * 6;
        matchedThisToken = true;
        tokenMatches++;
        continue; // exact is best for this field
      }
      // starts-with
      const startsRe = new RegExp(`\\b${token}`, "i");
      if (startsRe.test(txt)) {
        score += weights[field] * 4;
        matchedThisToken = true;
        tokenMatches++;
        continue;
      }
      // partial
      if (txt.includes(token)) {
        score += weights[field] * 2;
        matchedThisToken = true;
        tokenMatches++;
        continue;
      }
      // variants
      for (const v of variants) {
        if (v === token) continue;
        if (txt.includes(v)) {
          score += Math.floor(weights[field] * 1.2);
          matchedThisToken = true;
          tokenMatches++;
          break;
        }
      }
      if (matchedThisToken) break;
    }

    if (matchedThisToken) tokensFound++;
    else {
      // no direct match — allow a small contribution from fuzzy matches in title/keywords only
      const fieldsToTry = ["title", "keywords"];
      for (const f of fieldsToTry) {
        const txt = (textFields[f] || "").split(/\s+/);
        for (const w of txt) {
          if (!w) continue;
          const d = editDistance(token, w, 2);
          if (d <= 1) { // very close
            score += Math.floor(weights[f] * 0.8);
            matchedThisToken = true;
            tokensFound++;
            break;
          }
        }
        if (matchedThisToken) break;
      }
    }
  });

  // strong boost if ALL tokens appear somewhere (multi-word AND boost)
  if (tokensFound === tokens.length && tokens.length > 0) {
    score += 700;
  } else if (tokenMatches > 0) {
    // partial match boost proportional to matches
    score += tokenMatches * 15;
  }

  // small boost for shorter images (less noise) if title length small
  if (img.title && img.title.length < 40) score += 20;

  // recency/time boost if createdAt present
  if (img.createdAt) {
    const ageDays = Math.max(0, (nowTs - new Date(img.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays < 30) score += Math.max(0, Math.floor((30 - ageDays) / 2)); // newest get small advantage
  }

  // length normalization penalty (very long text fields may get smaller boost)
  return score;
}

/* ---------- FIRST (Advanced) ---------- */
router.get("/first", async (req, res) => {
  try {
    const rawQ = (req.query.q || "").trim();
    if (!rawQ) return res.json({ images: [], nextCursor: null, total: 0 });

    const q = rawQ.toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 10), 200);
    const pageLimit = limit;

    // cached response quick return
    if (searchCache.has(q)) {
      const entry = searchCache.get(q);
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        return res.json({
          images: entry.results.slice(0, pageLimit),
          nextCursor: pageLimit,
          total: entry.results.length,
        });
      }
      searchCache.delete(q);
    }

    // tokenization & variants
    const tokens = tokenizeQuery(q);
    if (!tokens.length) return res.json({ images: [], nextCursor: null, total: 0 });
    const tokenVariants = {};
    tokens.forEach(t => tokenVariants[t] = generateVariants(t));

    // Build coarse DB filter — loose OR on tokens across main fields.
    // This avoids scanning entire DB. We'll fetch a candidate pool and score in node.
    const ors = [];
    tokens.forEach(t => {
      const variants = tokenVariants[t];
      variants.forEach(v => {
        const re = new RegExp(v.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
        ors.push({ title: re });
        ors.push({ keywords: re });
        ors.push({ tags: re });
        ors.push({ category: re });
        ors.push({ secondaryCategory: re });
        ors.push({ description: re });
        ors.push({ alt: re });
        ors.push({ name: re });
      });
    });

    // Also allow a fast $text fallback for phrase boost if text index exists
    // (it will be combined later by node scoring)
    const textQuery = { $or: ors };

    const candidates = await Image.find(textQuery)
      .limit(MAX_CANDIDATES)
      .lean();

    // If candidates are empty and we want typo fallback, build dictionary and find near words
    let finalCandidates = candidates;
    if ((!candidates || candidates.length === 0) && tokens.length > 0) {
      // build dictionary once
      const dict = await buildDictionary();
      // for each token, find close dict words
      const closeMap = {};
      for (const token of tokens) {
        const close = [];
        for (const w of dict) {
          const d = editDistance(token, w, 2);
          if (d <= 1) close.push(w);
          if (close.length >= 8) break;
        }
        if (close.length) closeMap[token] = close;
      }
      // if we found some close words, redo the DB query with the closeMap
      const closeOrs = [];
      for (const token in closeMap) {
        for (const w of closeMap[token]) {
          const re = new RegExp(w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
          closeOrs.push({ title: re }, { keywords: re }, { tags: re }, { category: re }, { secondaryCategory: re });
        }
      }
      if (closeOrs.length) {
        finalCandidates = await Image.find({ $or: closeOrs }).limit(MAX_CANDIDATES).lean();
      }
    }

    // scoring weights (tweak these numbers to taste)
    const weights = {
      title: 120,
      keywords: 110,
      tags: 100,
      category: 90,
      secondaryCategory: 70,
      description: 20,
      alt: 10,
      name: 5,
    };

    // Score each candidate
    const nowTs = Date.now();
    const scored = finalCandidates.map(img => {
      const s = scoreImageForQuery(img, tokens, tokenVariants, weights, nowTs);
      return { ...img, score: s };
    });

    // sort by score desc, createdAt fallback
    scored.sort((a, b) => {
      if (b.score === a.score) {
        if (b.createdAt && a.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
        return b._id.toString().localeCompare(a._id.toString());
      }
      return b.score - a.score;
    });

    // De-duplicate & prepare final response
    const seen = new Set();
    const final = [];
    for (const img of scored) {
      const id = img._id.toString();
      if (seen.has(id)) continue;
      seen.add(id);
      final.push({
        ...img,
        thumbnailFileName: img.thumbnailFileName || `thumb_${img.fileName}`,
        thumbnailUrl: (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/?$/, "/") + encodeURIComponent(img.thumbnailFileName || `thumb_${img.fileName}`),
        fileUrl: (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/?$/, "/") + encodeURIComponent(img.fileName),
      });
    }

    // cache top results
    searchCache.set(q, { timestamp: Date.now(), results: final });
    if (searchCache.size > MAX_CACHE_LIMIT) {
      const oldest = searchCache.keys().next().value;
      searchCache.delete(oldest);
    }

    return res.json({
      images: final.slice(0, pageLimit),
      nextCursor: pageLimit < final.length ? pageLimit : null,
      total: final.length,
    });
  } catch (err) {
    console.error("Advanced SEARCH ERROR:", err);
    return res.status(500).json({ error: "Search failed" });
  }
});

/* ---------- NEXT (cursor-style pagination from cache) ---------- */
router.get("/next", (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    const cursor = parseInt(req.query.cursor) || 0;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 10), 200);

    if (!q || !searchCache.has(q)) {
      return res.status(400).json({ error: "No cached search found" });
    }
    const entry = searchCache.get(q);
    const results = entry.results;
    const slice = results.slice(cursor, cursor + limit);
    const nextCursor = cursor + slice.length;
    return res.json({
      images: slice,
      nextCursor: nextCursor < results.length ? nextCursor : null,
      total: results.length,
    });
  } catch (err) {
    console.error("NEXT PAGE ERROR:", err);
    return res.status(500).json({ error: "Next failed" });
  }
});

export default router;
