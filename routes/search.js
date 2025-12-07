// routes/search.js
import express from "express";
import Image from "../models/Image.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

/* Cloudflare R2 public URL builder */
const buildR2 = (file) => {
  let base = process.env.R2_PUBLIC_BASE_URL || "";
  if (!base.endsWith("/")) base += "/";
  return base + encodeURIComponent(file);
};

/* ===============================
      WORD NORMALIZATION
  - remove plural forms (lion → lion, lions → lion)
  - Smart conversion for "ies" (families → family)
================================== */
function normalizeWord(word) {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/* Extract words properly (underscore, hyphen, camelCase) */
function extractWords(text) {
  if (!text) return [];
  return text
    .replace(/[_\-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[0-9]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeWord)
    .filter(w => w.length > 2);
}

/* ===============================
        Damerau-Levenshtein
        SPELLING CORRECTION
================================== */
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

      if (
        i > 1 &&
        j > 1 &&
        b[i - 1] === a[j - 2] &&
        b[i - 2] === a[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

/* Smart Auto-Correct with Distance ≤ 2 */
function correctWord(word, dictionary) {
  let best = word;
  let minDist = 3; // Allow up to 2 edits only (BEST LEVEL)

  dictionary.forEach(dbWord => {
    const dist = editDistance(word.toLowerCase(), dbWord.toLowerCase());
    if (dist < minDist) {
      minDist = dist;
      best = dbWord;
    }
  });

  return best;
}

/* ==================================
         MAIN SEARCH ROUTE
=================================== */
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    /* REMOVE USELESS WORDS */
    const stopWords = new Set(["and", "or", "the", "a", "an", "with", "of", "in", "for", "on", "at", "by"]);
    let words = q.toLowerCase().split(/\s+/).filter(w => w && !stopWords.has(w));

    // Normalize (plural → singular)
    words = words.map(normalizeWord);

    /* Build Dictionary from DB */
    const docs = await Image.find({}, "title tags keywords category secondaryCategory")
      .lean()
      .limit(3000); // you can increase later

    const dictionary = new Set();
    docs.forEach(doc => {
      extractWords(doc.title).forEach(w => dictionary.add(w));
      extractWords(doc.category).forEach(w => dictionary.add(w));
      extractWords(doc.secondaryCategory).forEach(w => dictionary.add(w));
      if (Array.isArray(doc.tags)) doc.tags.forEach(t => extractWords(t).forEach(w => dictionary.add(w)));
      if (Array.isArray(doc.keywords)) doc.keywords.forEach(k => extractWords(k).forEach(w => dictionary.add(w)));
    });

    /* SPELLING CORRECT */
    const correctedWords = words.map(w => correctWord(w, dictionary));

    /* SEARCH USING $AND (multi-word required) */
    const regexList = correctedWords.map(w => new RegExp(w, "i"));

    const results = await Image.find({
      $and: regexList.map(r => ({
        $or: [
          { title: r }, { name: r }, { description: r },
          { category: r }, { secondaryCategory: r },
          { alt: r }, { tags: r }, { keywords: r }
        ]
      }))
    }).lean().limit(200);

    /* Relevance Score */
    const scoreField = {
      title: 60, name: 50, keywords: 45, tags: 40,
      description: 25, category: 20, secondaryCategory: 10, alt: 5
    };

    const scored = results
      .map(img => {
        let score = 0;
        for (let field in scoreField) {
          const value = (img[field] || "").toString().toLowerCase();
          correctedWords.forEach(w => {
            if (!value) return;
            if (value === w) score += scoreField[field] + 20;
            else if (value.includes(w)) score += scoreField[field];
          });
        }
        return { ...img, score };
      })
      .sort((a, b) => b.score - a.score);

    /* Remove Duplicates */
    const unique = [];
    const seen = new Set();
    scored.forEach(img => {
      if (!seen.has(img._id.toString())) {
        seen.add(img._id.toString());
        unique.push(img);
      }
    });

    /* Attach URLs */
    const response = unique.slice(0, 200).map(img => {
      img.thumbnailFileName ||= `thumb_${img.fileName}`;
      img.thumbnailUrl = buildR2(img.thumbnailFileName);
      img.fileUrl = buildR2(img.fileName);
      delete img.score;
      return img;
    });

    return res.json(response);

  } catch (err) {
    console.error("Search error:", err.message);
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
