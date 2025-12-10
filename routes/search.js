import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Cache dictionary once
let cachedDictionary = null;

// Search Cache (Relevance results)
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 mins
const MAX_CACHE_LIMIT = 200; // Avoid memory overload

/* Build Cloudflare R2 URL */
const buildR2 = (file) => {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return base + encodeURIComponent(file);
};

function normalizeWord(word) {
  if (!word) return "";

  word = word.toLowerCase();

  // Do NOT modify small words (car, bus, cat allowed separately)
  if (word.length <= 3) return word;

  // Irregular English noun plural/singular mapping
  const irregular = {
    children: "child",
    men: "man",
    women: "woman",
    people: "person",
    mice: "mouse",
    geese: "goose",
    teeth: "tooth",
    feet: "foot",
    oxen: "ox",
    lice: "louse",
    dice: "die",
    data: "datum",
    alumni: "alumnus",
    cacti: "cactus",
    fungi: "fungus",
    nuclei: "nucleus",
    crises: "crisis",
    theses: "thesis",
    analyses: "analysis",
    ellipses: "ellipsis",
    parentheses: "parenthesis",
    indices: "index",
    appendices: "appendix",
    criteria: "criterion",
    phenomena: "phenomenon",
  };

  if (irregular[word]) return irregular[word];

  // Auto plural detection — reverse mapping
  const reverseIrregular = Object.fromEntries(
    Object.entries(irregular).map(([pl, sg]) => [sg, pl])
  );

  if (reverseIrregular[word]) return word; // keep singular

  // ✨ Pattern Rules — AI style
  if (word.endsWith("ies")) return word.slice(0, -3) + "y"; // ladies -> lady, cities -> city
  if (word.endsWith("ves")) return word.slice(0, -3) + "f"; // wolves -> wolf, knives -> knif
  if (word.endsWith("xes") || word.endsWith("ses") || word.endsWith("zes")) return word.slice(0, -2); // boxes, buses → boxe, buse
  if (word.endsWith("shes") || word.endsWith("ches")) return word.slice(0, -2); // dishes -> dish
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // cars->car, apples->apple

  return word;  
}

function expandSearchVariants(word) {
  const variants = new Set([word]);

  // Basic plural adders
  if (!word.endsWith("s")) variants.add(word + "s");
  if (word.endsWith("y")) variants.add(word.replace(/y$/, "ies"));
  if (word.endsWith("f")) variants.add(word.replace(/f$/, "ves"));

  return Array.from(variants);
}


/* Extract dictionary words */
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

/* Damerau-Levenshtein (Typo Fix) */
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

/* Typo Correction */
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

/* ---------- FIRST SEARCH (Relevance + Cache + Latest) ---------- */
router.get("/first", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const limit = parseInt(req.query.limit) || 50;
    if (!q) return res.json([]);

    // CACHE CHECK
    if (searchCache.has(q)) {
      const entry = searchCache.get(q);
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        return res.json({
          images: entry.results.slice(0, limit),
          nextCursor: limit,
          total: entry.results.length
        });
      }
      searchCache.delete(q);
    }

    // STOP WORDS
    const stopWords = new Set(["and","or","the","a","an","with","of","in","for","on","at","by"]);
    let words = q.toLowerCase().split(/\s+/).filter((w) => w && !stopWords.has(w)).map(normalizeWord);
    if (!words.length) return res.json([]);

    // DICTIONARY BUILD
    let dictionary = cachedDictionary;
    if (!dictionary) {
      const docs = await Image.find({}, "title tags keywords category secondaryCategory").lean();
      dictionary = new Set();
      docs.forEach(doc => {
        extractWords(doc.title).forEach(w => dictionary.add(w));
        extractWords(doc.category).forEach(w => dictionary.add(w));
        extractWords(doc.secondaryCategory).forEach(w => dictionary.add(w));
        if (Array.isArray(doc.tags)) doc.tags.forEach(t => extractWords(t).forEach(w => dictionary.add(w)));
        if (Array.isArray(doc.keywords)) doc.keywords.forEach(k => extractWords(k).forEach(w => dictionary.add(w)));
      });
      cachedDictionary = dictionary;
      console.log(`📌 Dictionary Cached: ${dictionary.size} words`);
    }

    const correctedWords = words.map(w => correctWord(w, dictionary));
    const regexList = correctedWords.flatMap(w =>
      expandSearchVariants(w).map(v => new RegExp(`\\b${v}`, "i"))
    );

    // MAIN SEARCH
    const results = await Image.find({
      $and: regexList.map(r => ({
        $or: [
          { title: r },
          { name: r },
          { description: r },
          { category: r },
          { secondaryCategory: r },
          { alt: r },
          { tags: r },
          { keywords: r },
        ]
      }))
    }).lean();

    // SCORE WEIGHT
    const weight = {    
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
        for (let field in weight) {
          let value = img[field];
          if (Array.isArray(value)) value = value.join(" ").toLowerCase();
          else if (typeof value === "string") value = value.toLowerCase();
          else value = "";
          correctedWords.forEach((w) => {
            if (value === w) score += weight[field] + 20;
            else if (value.includes(w)) score += weight[field];
          });
        }
        return { ...img, score };
      })
      .sort((a, b) => {
        if (b.score === a.score) {
          return b._id.toString().localeCompare(a._id.toString()); // latest wins
        }
        return b.score - a.score;
      });

    const seen = new Set();
    const final = scored.filter(img => {
      const id = img._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const response = final.map(img => ({
      ...img,
      thumbnailFileName: img.thumbnailFileName || `thumb_${img.fileName}`,
      thumbnailUrl: buildR2(img.thumbnailFileName || `thumb_${img.fileName}`),
      fileUrl: buildR2(img.fileName),
    }));

    // STORE CACHE
    searchCache.set(q, { timestamp: Date.now(), results: response });

    if (searchCache.size > MAX_CACHE_LIMIT) {
      const oldest = searchCache.keys().next().value;
      searchCache.delete(oldest);
    }

    return res.json({
      images: response.slice(0, limit),
      nextCursor: limit,
      total: response.length
    });

  } catch (err) {
    console.error("Search FIRST ERROR:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
});

/* ---------- LOAD MORE RESULTS (Cursor Pagination) ---------- */
router.get("/next", (req, res) => {
  const q = req.query.q?.trim();
  const cursor = parseInt(req.query.cursor);
  const limit = parseInt(req.query.limit) || 50;

  if (!q || !searchCache.has(q)) {
    return res.status(400).json({ error: "No cached search found" });
  }

  const entry = searchCache.get(q);
  const results = entry.results;
  const nextSlice = results.slice(cursor, cursor + limit);
  const nextCursor = cursor + nextSlice.length;

  return res.json({
    images: nextSlice,
    nextCursor: nextCursor < results.length ? nextCursor : null,
    total: results.length
  });
});

export default router;
