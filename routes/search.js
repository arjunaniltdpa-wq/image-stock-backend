import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Cache dictionary
let cachedDictionary = null;

// Search Result Cache (Relevance results stored temporarily)
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/* Build Cloudflare R2 URL */
const buildR2 = (file) => {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return base + encodeURIComponent(file);
};

/* Normalize Words */
function normalizeWord(word) {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

/* Extract words */
function extractWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[0-9]/g, " ")
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 2);
}

/* Damerau–Levenshtein Typo */
function editDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
      if (i > 1 && j > 1 && b[i - 1] === a[j - 2] && b[i - 2] === a[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

/* Spelling Correction */
function correctWord(word, dictionary) {
  let best = word;
  let minDist = 3;
  dictionary.forEach((dbWord) => {
    const dist = editDistance(word, dbWord);
    if (dist < minDist) {
      minDist = dist;
      best = dbWord;
    }
  });
  return best;
}

/* ---------- SEARCH FIRST RESULTS (Relevance + Cache + First 50) ---------- */
router.get("/first", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const limit = parseInt(req.query.limit) || 50;
    if (!q) return res.json([]);

    // 🔹 Check Cache
    if (searchCache.has(q)) {
      const cacheEntry = searchCache.get(q);
      if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
        return res.json({
          images: cacheEntry.results.slice(0, limit),
          nextCursor: limit,
          total: cacheEntry.results.length
        });
      } else {
        searchCache.delete(q);
      }
    }

    const stopWords = new Set(["and", "or", "the", "a", "an", "with", "of", "in", "for", "on", "at", "by"]);
    let words = q.toLowerCase().split(/\s+/).filter((w) => w && !stopWords.has(w)).map(normalizeWord);
    if (!words.length) return res.json([]);

    // Dictionary build
    let dictionary = cachedDictionary;
    if (!dictionary) {
      const docs = await Image.find({}, "title tags keywords category secondaryCategory").lean();

      dictionary = new Set();
      docs.forEach((doc) => {
        extractWords(doc.title).forEach((w) => dictionary.add(w));
        extractWords(doc.category).forEach((w) => dictionary.add(w));
        extractWords(doc.secondaryCategory).forEach((w) => dictionary.add(w));
        if (Array.isArray(doc.tags)) doc.tags.forEach((t) => extractWords(t).forEach((w) => dictionary.add(w)));
        if (Array.isArray(doc.keywords)) doc.keywords.forEach((k) => extractWords(k).forEach((w) => dictionary.add(w)));
      });

      cachedDictionary = dictionary;
      console.log(`📌 Dictionary Cached: ${dictionary.size} words`);
    }

    const correctedWords = words.map((w) => correctWord(w, dictionary));
    const regexList = correctedWords.map((w) => new RegExp(`\\b${w}`, "i"));

    // Search DB
    const results = await Image.find({
      $and: regexList.map((r) => ({
        $or: [
          { title: r },
          { name: r },
          { description: r },
          { category: r },
          { secondaryCategory: r },
          { alt: r },
          { tags: r },
          { keywords: r },
        ],
      })),
    }).lean().sort({ _id: -1 });

    // Scoring relevance
    const scoreField = {
      title: 120,
      name: 30,
      keywords: 110,
      tags: 110,
      description: 25,
      category: 100,
      secondaryCategory: 80,
      alt: 5,
    };

    const scored = results
      .map((img) => {
        let score = 0;
        for (let field in scoreField) {
          let value = img[field];
          if (Array.isArray(value)) value = value.join(" ").toLowerCase();
          else if (typeof value === "string") value = value.toLowerCase();
          else value = "";
          correctedWords.forEach((w) => {
            if (value === w) score += scoreField[field] + 20;
            else if (value.includes(w)) score += scoreField[field];
          });
        }
        return { ...img, score };
      })
      .sort((a, b) => (b.score === a.score ? b._id - a._id : b.score - a.score));

    const seen = new Set();
    const final = scored.filter((img) => {
      const id = img._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const response = final.map((img) => ({
      ...img,
      thumbnailFileName: img.thumbnailFileName || `thumb_${img.fileName}`,
      thumbnailUrl: buildR2(img.thumbnailFileName || `thumb_${img.fileName}`),
      fileUrl: buildR2(img.fileName),
    }));

    // Cache Store
    searchCache.set(q, {
      timestamp: Date.now(),
      results: response,
    });

    return res.json({
      images: response.slice(0, limit),
      nextCursor: limit,
      total: response.length,
    });

  } catch (err) {
    console.error("Search FIRST ERROR:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
});

/* ---------- LOAD MORE SEARCH RESULTS (Cursor Pagination) ---------- */

router.get("/next", (req, res) => {
  const q = req.query.q?.trim();
  const cursor = parseInt(req.query.cursor);
  const limit = parseInt(req.query.limit) || 50;

  if (!q || !searchCache.has(q)) {
    return res.status(400).json({ error: "No cached search found" });
  }

  const cacheEntry = searchCache.get(q);
  const results = cacheEntry.results;

  const nextSlice = results.slice(cursor, cursor + limit);
  const nextCursor = cursor + nextSlice.length;

  return res.json({
    images: nextSlice,
    nextCursor: nextCursor < results.length ? nextCursor : null,
    total: results.length
  });
});

export default router;
