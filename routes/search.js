// routes/search.js
import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Cache (dictionary + trending + suggestions)
let cachedDictionary = null;
let trending = new Map();
let suggestionCache = new Set();

/* R2 Public URL */
const buildR2 = (file) => {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return base + encodeURIComponent(file);
};

/* Word Normalization */
function normalizeWord(word) {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function extractWords(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[0-9]/g, " ")
    .split(/\s+/)
    .map(normalizeWord)
    .filter(w => w.length > 2);
}

/* Edit Distance */
function editDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);

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
  dictionary.forEach(dbWord => {
    const dist = editDistance(word, dbWord);
    if (dist < minDist) {
      minDist = dist;
      best = dbWord;
    }
  });
  return best;
}

/* Suggest Similar Words */
function getSuggestions(word, dictionary) {
  const suggestions = [];
  dictionary.forEach(dbWord => {
    if (editDistance(word, dbWord) <= 2) suggestions.push(dbWord);
  });
  return suggestions.slice(0, 5);
}

/* ======================== SEARCH API ======================== */
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json({ results: [], suggestions: [], trending: [] });

    const stopWords = new Set(["and", "or", "the", "a", "an", "with", "of", "in", "for", "on", "at", "by"]);
    let words = q.toLowerCase().split(/\s+/).filter(w => w && !stopWords.has(w));
    words = words.map(normalizeWord);

    if (!cachedDictionary) {
      const docs = await Image.find({}, "title tags keywords category secondaryCategory").lean();

      cachedDictionary = new Set();
      docs.forEach(doc => {
        extractWords(doc.title).forEach(w => cachedDictionary.add(w));
        extractWords(doc.category).forEach(w => cachedDictionary.add(w));
        extractWords(doc.secondaryCategory).forEach(w => cachedDictionary.add(w));
        if (Array.isArray(doc.tags)) doc.tags.forEach(t => extractWords(t).forEach(w => cachedDictionary.add(w)));
        if (Array.isArray(doc.keywords)) doc.keywords.forEach(k => extractWords(k).forEach(w => cachedDictionary.add(w)));
      });

      console.log(`📌 Dictionary Cached: ${cachedDictionary.size} words`);
    }

    const correctedWords = words.map(w => correctWord(w, cachedDictionary));
    const regexList = correctedWords.map(w => new RegExp(`\\b${w}`, "i"));

    // Save trending search count
    const mainTerm = correctedWords.join(" ");
    trending.set(mainTerm, (trending.get(mainTerm) || 0) + 1);

    const results = await Image.find({
      $and: regexList.map(r => ({
        $or: [
          { title: r }, { name: r }, { description: r },
          { category: r }, { secondaryCategory: r },
          { alt: r }, { tags: r }, { keywords: r }
        ]
      }))
    }).lean().limit(300);

    // Scoring
    const scoreField = {
      title: 60, name: 50, keywords: 45, tags: 40,
      description: 25, category: 20, secondaryCategory: 10, alt: 5
    };

    const scored = results
      .map(img => {
        let score = 0;
        for (let field in scoreField) {
          let value = img[field];
          if (Array.isArray(value)) value = value.join(" ").toLowerCase();
          else if (typeof value === "string") value = value.toLowerCase();
          else value = "";

          correctedWords.forEach(w => {
            if (!value) return;
            if (value === w) score += scoreField[field] + 20;
            else if (value.includes(w)) score += scoreField[field];
          });
        }
        return { ...img, score };
      })
      .sort((a, b) => b.score - a.score);

    const seen = new Set();
    const final = scored.filter(img => {
      const id = img._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const responseResults = final.slice(0, 200).map(img => {
      img.thumbnailFileName ||= `thumb_${img.fileName}`;
      img.thumbnailUrl = buildR2(img.thumbnailFileName);
      img.fileUrl = buildR2(img.fileName);
      delete img.score;
      return img;
    });

    return res.json({
      results: responseResults,
      suggestions: getSuggestions(words[0], cachedDictionary),
      trending: Array.from(trending.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
    });

  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
