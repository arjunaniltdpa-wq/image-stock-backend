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

/* Word forms */
function getWordForms(q) {
  const forms = new Set();
  forms.add(q);
  if (q.endsWith("s")) forms.add(q.slice(0, -1));
  if (!q.endsWith("s")) forms.add(q + "s");
  return Array.from(forms);
}

router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    const results = [];
    const forms = getWordForms(q);

    const exactRegexArray = forms.map(w => new RegExp(`\\b${w}\\b`, "i"));
    const prefixRegexArray = forms.map(w => new RegExp(`^${w}`, "i"));

    /* Exact matches (fast, .lean() for performance) */
    const exact = await Image.find({
      $or: [
        ...exactRegexArray.map(r => ({ title: r })),
        ...exactRegexArray.map(r => ({ name: r })),
        ...exactRegexArray.map(r => ({ description: r })),
        ...exactRegexArray.map(r => ({ category: r })),
        ...exactRegexArray.map(r => ({ secondaryCategory: r })),
        ...exactRegexArray.map(r => ({ alt: r })),
        ...exactRegexArray.map(r => ({ tags: r })),
        ...exactRegexArray.map(r => ({ keywords: r }))
      ]
    }).lean().limit(150);

    const prefix = await Image.find({
      $or: [
        ...prefixRegexArray.map(r => ({ title: r })),
        ...prefixRegexArray.map(r => ({ name: r })),
        ...prefixRegexArray.map(r => ({ tags: r })),
        ...prefixRegexArray.map(r => ({ keywords: r }))
      ]
    }).lean().limit(150);

    /* Merge without duplicates */
    const addUnique = (arr) => {
      arr.forEach(img => {
        if (!results.find(x => x._id.toString() === img._id.toString())) {
          results.push(img);
        }
      });
    };

    addUnique(exact);
    addUnique(prefix);

    /* 🔥 AUTO-FIX: Ensure every image has thumbnail + URL */
    const final = results.slice(0, 200).map(img => {

      // If old images have no thumb, auto-generate the filename
      if (!img.thumbnailFileName) {
        img.thumbnailFileName = `thumb_${img.fileName}`;
      }

      img.thumbnailUrl = buildR2(img.thumbnailFileName);
      img.fileUrl = buildR2(img.fileName);

      return img;
    });

    return res.json(final);

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
